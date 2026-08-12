import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { Request, Response } from 'express'
import { Types } from 'mongoose'
import { AuthFailedError, BadRequestError, ForbiddenError, ResponseError } from '~/Core/response.error'
import { IRequestCustom } from '~/middlewares/authentication'
import keyStoreModel from '~/models/keyStore.model'
import { notificationModel } from '~/models/notification.model'
import userModel, { UserDocument } from '~/models/user.model'
import SelectData from '~/utils/SelectData'
import Convert from '~/utils/convert'
import { getGoogleUser, getOautGoogleToken } from '~/utils/google.oauth'
import { renderNotificationSystem } from '~/utils/notification.util'
import ProviderJWT, { IToken } from '~/utils/provider.jwt'
import KeyStoreService from './keyStore.service'
import UserService from './user.service'
class AuthService {
      //REGISTER
      static async register(req: Request, res: Response) {
            // req.body --> email, password
            const { email, password } = req.body
            //check email trong database
            const foundEmail = await UserService.findUserByEmail({ email })
            if (foundEmail) throw new BadRequestError({ detail: 'Email đã được đăng kí' })

            //hash pass

            const hashPassword = await bcrypt.hash(password, 10)
            if (!hashPassword) throw new ResponseError({ detail: 'Hash failed' })

            // tạo account user
            const createUser = await UserService.createUser({ email, password: hashPassword })
            const { email: emailUser, _id, roles } = createUser
            // {public_key, private_key}
            const public_key = randomBytes(64).toString('hex')
            const private_key = randomBytes(64).toString('hex')

            const { access_token, refresh_token } = (await ProviderJWT.createPairToken({
                  payload: { email: emailUser, _id, roles },
                  key: { public_key, private_key }
            })) as IToken

            await KeyStoreService.createKeyStoreUser({
                  user_id: _id,
                  public_key,
                  private_key,
                  refresh_token,
                  access_token
            })

            const admin = await userModel.findOne({ roles: { $in: ['Admin'] } })

            const noti = await notificationModel.findOneAndUpdate(
                  {
                        notification_user_id: new Types.ObjectId(createUser._id)
                  },
                  {
                        $inc: { notification_count: 1 },
                        $push: { notifications_message: renderNotificationSystem('Xin chào, cảm ơn bạn đã đăng kí tài khoản <3') }
                  },

                  { new: true, upsert: true }
            )

            const oneWeek = 7 * 24 * 60 * 60 * 1000 // 7 ngày tính bằng miligiây
            const expiryDate = new Date(Date.now() + oneWeek)
            res.cookie('refresh_token', refresh_token, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('client_id', createUser._id, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('access_token', access_token, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            //return cho class Response ở controller
            return {
                  user: SelectData.omit(Convert.convertPlantObject(createUser as object), ['password', 'createdAt', 'updatedAt', '__v'])
            }
      }

      //LOGIN

      static async login(req: IRequestCustom, res: Response) {
            const { email, password } = req.body
            // found email
            const foundUser = await UserService.findUserByEmail({ email })
            console.log({email, password, foundUser})
            if (!foundUser) throw new AuthFailedError({ detail: 'Đăng nhập thất bại, vui lòng nhập thông tin hợp lệ' })
            // match email with user._id

            // compare pass

            const comparePass = await bcrypt.compareSync(password, foundUser.password)
            if (!comparePass) throw new AuthFailedError({ detail: 'Đăng nhập thất bại, vui lòng nhập thông tin hợp lệ' })

            await keyStoreModel.findOneAndDelete({ user_id: foundUser._id })

            const public_key = randomBytes(64).toString('hex')
            const private_key = randomBytes(64).toString('hex')
            const keyStore = await keyStoreModel.findOneAndUpdate(
                  { user_id: foundUser._id },
                  { $set: { public_key, private_key } },
                  { new: true, upsert: true }
            )

            const { access_token, refresh_token: new_rf } = ProviderJWT.createPairToken({
                  payload: { _id: foundUser._id, email: foundUser.email, roles: foundUser.roles },
                  key: { private_key: keyStore?.private_key as string, public_key: keyStore?.public_key as string }
            }) as IToken

            //check token cu
            if (req?.cookies['refresh_token']) {
                  const refresh_token = req.cookies['refresh_token'] as string

                  // neu hop le thi thu hoi
                  if (refresh_token === keyStore.refresh_token) {
                        await keyStoreModel?.findOneAndUpdate(
                              { user_id: foundUser._id },
                              { $set: { refresh_token: new_rf }, $addToSet: { refresh_token_used: refresh_token } }
                        )
                        // }
                  }
            }

            await keyStoreModel?.findOneAndUpdate({ user_id: foundUser._id }, { $set: { refresh_token: new_rf } })

            const queryNotification = { notification_user_id: new Types.ObjectId(foundUser?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationSystem('Chào mừng bạn đã đăng nhập trở lại')
                  },
                  $inc: { notification_count: 1 }
            }

            const optionNotification = { new: true, upsert: true }
            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            const oneWeek = 7 * 24 * 60 * 60 * 1000 // 7 ngày tính bằng miligiây
            const expiryDate = new Date(Date.now() + oneWeek)
            res.cookie('refresh_token', new_rf, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('client_id', foundUser._id, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('access_token', access_token, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            return {
                  user: SelectData.omit(Convert.convertPlantObject(foundUser as object), ['password', 'createdAt', 'updatedAt', '__v'])
            }
      }

      // logout

      static async logout(req: IRequestCustom, res: Response) {
            const { keyStore, user } = req
            await KeyStoreService.deleteKeyStore({ user_id: (user as UserDocument).id })
            res.clearCookie('refresh_token')
            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotification = {
                  $push: {
                        notifications_message: renderNotificationSystem('Tiến hành logout')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }

            await notificationModel.findOneAndUpdate(queryNotification, updateNotification, optionNotification)

            return { message: 'Logout success!!' }
      }

      static async refresh_token(req: IRequestCustom, res: Response) {
            const { refresh_token, keyStore, user } = req
            //console.log(([^)]+))
            //console.log(([^)]+))

            if (keyStore?.refresh_token_used.includes(keyStore.refresh_token)) {
                  await keyStoreModel.deleteOne({ user_id: user?._id })
                  throw new ForbiddenError({ detail: 'Token đã được sử dụng' })
            }

            if (keyStore?.refresh_token !== refresh_token) throw new ForbiddenError({ detail: 'Token không đúng router' })
            const public_key = randomBytes(64).toString('hex')
            const private_key = randomBytes(64).toString('hex')
            const token = (await ProviderJWT.createPairToken({
                  payload: { email: user?.email as string, _id: user?._id, roles: user?.roles as string[] },
                  key: { public_key: public_key as string, private_key: private_key as string }
            })) as IToken
            const update = await keyStoreModel
                  .findOneAndUpdate(
                        { user_id: new Types.ObjectId(user?._id) },
                        {
                              $set: { refresh_token: token.refresh_token, public_key, private_key },
                              $addToSet: { refresh_token_used: refresh_token }
                        },
                        { upsert: true, new: true }
                  )
                  .lean()
            //console.log(([^)]+))

            const oneWeek = 7 * 24 * 60 * 60 * 1000 // 7 ngày tính bằng miligiây
            const expiryDate = new Date(Date.now() + oneWeek)
            res.cookie('refresh_token', token.refresh_token, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('client_id', user?._id, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            res.cookie('access_token', token.access_token, {
                  maxAge: oneWeek,
                  expires: expiryDate,
                  secure: true,
                  httpOnly: false,
                  sameSite: 'none'
            })

            return { token: token.access_token, rf: token.refresh_token, user }
      }

      static async loginWithGoogle(req: Request<unknown, unknown, unknown, { code: any }>) {
            //console.log(([^)]+))
            // return req.query.code
            const { code } = req.query
            const token = await getOautGoogleToken(code)
            // eslint-disable-next-line prettier/prettier
            const { id_token, access_token } = token
            const googleUser: any = await getGoogleUser({ id_token, access_token })
            //console.log(([^)]+))
            const user = googleUser.data
            if ('verified_email' in googleUser) {
                  if (!googleUser.verified_email) {
                        new ForbiddenError({ detail: 'block' })
                  }
            }

            return { image: user.picture, name: user.name }
      }
}

export default AuthService
