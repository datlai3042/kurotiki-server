import bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { Types } from 'mongoose'
import cloudinary from '~/configs/cloundinary.config'
import { BadRequestError, NotFoundError } from '~/Core/response.error'
import { IRequestCustom } from '~/middlewares/authentication'
import { notificationModel } from '~/models/notification.model'
import userModel from '~/models/user.model'
import AccountRepository from '~/repositories/account.repositort'
import Convert from '~/utils/convert'
import { renderNotificationUser } from '~/utils/notification.util'
import SelectData from '~/utils/SelectData'
import sleep from '~/utils/sleep'
import uploadToCloudinary from '~/utils/uploadCloudinary'

config()
class AccountService {
      static async getMeQuery(req: IRequestCustom) {
            return {
                  user: SelectData.omit(Convert.convertPlantObject(req.user as object), ['password', 'createdAt', 'updatedAt'])
            }
      }

      static async getMe(req: IRequestCustom) {
            return {
                  user: SelectData.omit(Convert.convertPlantObject(req.user as object), ['password', 'createdAt', 'updatedAt'])
            }
      }
      static async updateInfo(req: IRequestCustom) {
            const { user } = req
            const update = await userModel.findOneAndUpdate(
                  { _id: user?._id },
                  { $set: { bob: req.body.birth, gender: req.body.gender, fullName: req.body.fullName, nickName: req.body.nickName, user_address: req.body.user_address || user?.user_address } },
                  { new: true, upsert: true }
            )

            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa cập nhập thông tin cá nhân')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }
            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            return {
                  user: update
            }
      }

      static async updateAvatar(req: IRequestCustom) {
            const user = req.user

            if (!user?.avatar.secure_url) {
                  const result = await uploadToCloudinary(req?.file as Express.Multer.File, user?._id)
                  const update = await userModel.findOneAndUpdate(
                        {
                              _id: user?._id
                        },
                        {
                              $set: { avatar: { secure_url: result.secure_url, public_id: result.public_id, date_update: Date.now() } }
                        },
                        { new: true, upsert: true }
                  )
                  const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
                  const updateNotification = {
                        $push: {
                              notifications_message: renderNotificationUser('Bạn vừa cập nhập avatar cá nhân')
                        },

                        $inc: { notification_count: 1 }
                  }
                  const optionNotification = { new: true, upsert: true }

                  await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

                  return { user: update }
            } else {
                  const folder = `users/${user.id}/avatar`
                  const result = await uploadToCloudinary(req?.file as Express.Multer.File, folder)
                  const update = await userModel.findOneAndUpdate(
                        {
                              _id: user?._id
                        },
                        {
                              $addToSet: {
                                    avatar_used: {
                                          public_id: user?.avatar.public_id,
                                          secure_url: user?.avatar.secure_url,
                                          date_update: user.avatar.date_update
                                    }
                              },
                              $set: { avatar: { secure_url: result.secure_url, public_id: result.public_id, date_update: Date.now() } }
                        },
                        { new: true, upsert: true }
                  )

                  const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
                  const updateNotification = {
                        $push: {
                              notifications_message: renderNotificationUser('Bạn vừa cập nhập avatar cá nhân')
                        },
                        $inc: { notification_count: 1 }
                  }
                  const optionNotification = { new: true, upsert: true }

                  await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

                  return { user: update }
            }
      }

      static async getAllAvatar(req: IRequestCustom) {
            const user = req.user
            const foundAllAvatar = await userModel.find({ _id: user?._id }, { avatar_used: 1 })
            return { avatar_used: foundAllAvatar[0].avatar_used }
      }

      static async deleteAvatarUsed(req: IRequestCustom) {
            const user = req.user
            const public_id = req.body.public_id
            const result = await cloudinary.uploader.destroy(public_id)
            const objAvatarUsed = await AccountRepository.findSecureUrlWithPublicId(public_id)
            const update = await userModel.findOneAndUpdate(
                  {
                        _id: user?._id
                  },
                  {
                        $pull: { avatar_used: { public_id, secure_url: objAvatarUsed?.avatar.secure_url } }
                  },
                  { new: true, upsert: true }
            )

            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa xóa một hình ảnh cũ')
                  },

                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }

            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            return { user: update }
      }

      static async deleteAvatar(req: IRequestCustom) {
            const user = req.user
            const update = await userModel.findOneAndUpdate(
                  {
                        _id: user?._id
                  },
                  {
                        $addToSet: {
                              avatar_used: {
                                    public_id: user?.avatar.public_id,
                                    secure_url: user?.avatar.secure_url,
                                    date_update: user?.avatar.date_update
                              }
                        },
                        $unset: { avatar: 1 }
                  },
                  { new: true, upsert: true }
            )

            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa xóa hình ảnh đại diện')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }

            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            return { user: update }
      }

      static async addAddress(req: IRequestCustom) {
            const { user } = req
            const { addressPayload } = req.body

            const query = { _id: new Types.ObjectId(user?._id) }
            const update = { $addToSet: { user_address: addressPayload } }
            const option = { new: true, upsert: true }

            const updateUser = await userModel.findOneAndUpdate(query, update, option)

            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa thêm 1 địa chỉ')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }

            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            return { user: updateUser }
      }

      static async setAddressDefault(req: IRequestCustom) {
            const { user } = req
            const { addressPayload } = req.body
            await userModel.updateMany({ _id: new Types.ObjectId(user?._id) }, { 'user_address.$[].address_default': false })
            const query = { _id: new Types.ObjectId(user?._id), 'user_address._id': addressPayload._id }
            const update = { 'user_address.$.address_default': true }
            const option = { new: true, upsert: true }

            const userUpdate = await userModel.findOneAndUpdate(query, update, option)

            return { user: userUpdate }
      }

      static async deleteAddress(req: IRequestCustom) {
            const { user } = req
            const { address_id } = req.params

            const query = { _id: new Types.ObjectId(user?._id), 'user_address._id': address_id }
            const update = { $pull: { user_address: { _id: address_id } } }
            const option = { new: true, upsert: true }

            const updateUser = await userModel.findOneAndUpdate(query, update, option)

            return { user: updateUser }
      }

      static async securityPassword(req: IRequestCustom) {
            const { user } = req
            const { password } = req.body
            const userQuery = { _id: new Types.ObjectId(user?._id) }
            const foundUser = await userModel.findOne(userQuery)
            if (!foundUser) throw new NotFoundError({ detail: 'Không tìm thấy user' })
            const comparePass = await bcrypt.compareSync(password, foundUser?.password)

            await sleep(5000)
            return { message: comparePass ? true : false }
      }

      static async updateEmail(req: IRequestCustom) {
            const { user } = req
            const { password, newEmail } = req.body
            const userQuery = { _id: new Types.ObjectId(user?._id) }
            const foundUser = await userModel.findOne(userQuery)
            if (!foundUser) throw new NotFoundError({ detail: 'Không tìm thấy user' })
            const comparePass = await bcrypt.compareSync(password, foundUser?.password)
            if (!comparePass) {
                  throw new BadRequestError({ detail: 'Quá trình cập nhập xảy ra lỗi' })
            }
            foundUser.email = newEmail || foundUser.email
            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa thay đổi email')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }
            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            await foundUser.save()
            await sleep(5000)

            return { user: foundUser }
      }

      static async updatePassword(req: IRequestCustom<{ password: string; newPassword: string }>) {
            const { user } = req
            const { newPassword, password } = req.body

            const userQuery = { _id: new Types.ObjectId(user?._id) }
            const foundUser = await userModel.findOne(userQuery)
            if (!foundUser) throw new NotFoundError({ detail: 'Không tìm thấy user' })
            const comparePass = await bcrypt.compareSync(password, foundUser?.password)
            if (!comparePass) {
                  throw new BadRequestError({ detail: 'Sai mật khẩu' })
            }
            const hashPassword = await bcrypt.hash(newPassword, 10)
            foundUser.password = hashPassword
            await foundUser.save()
            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationUser('Bạn vừa thay đổi mật khẩu')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }
            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            await sleep(5000)
            return { message: true, user: SelectData.omit(Convert.convertPlantObject(foundUser), ['password']) }
      }
}

export default AccountService
