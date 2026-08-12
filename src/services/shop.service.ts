import { Types } from 'mongoose'
import { BadRequestError } from '~/Core/response.error'
import cloudinary from '~/configs/cloundinary.config'
import { IRequestCustom } from '~/middlewares/authentication'
import { notificationModel } from '~/models/notification.model'
import { orderModel } from '~/models/order.model'
import productModel, { IProduct } from '~/models/product.model'
import { TShopDoc, productShopModel, shopModel } from '~/models/shop.model'
import userModel from '~/models/user.model'
import ShopRepository from '~/repositories/shop.repository'
import { renderNotificationSystem } from '~/utils/notification.util'
import uploadToCloudinary from '~/utils/uploadCloudinary'

class ShopService {
      static async registerShop(req: IRequestCustom) {
            const { shop_name, data, shop_description } = req.body
            const { user } = req
            const { file } = req
            const { state, mode } = req.query

            let update = {}
            if (state === 'Full') {
                  if (!file) throw new BadRequestError({ detail: 'Missing File' })
                  const folder = `user/${user?._id}/shops`
                  const result = await uploadToCloudinary(file, folder)
                  update = {
                        $set: { shop_name, shop_avatar: { secure_url: result.secure_url, public_id: result.public_id }, shop_description }
                  }
            }

            if (state === 'no-file') {
                  update = {
                        $set: { shop_name, shop_description }
                  }
            }

            const registerShop = await shopModel.findOneAndUpdate({ owner: new Types.ObjectId(user?._id) }, update, {
                  new: true,
                  upsert: true
            })


            const productShop = await productShopModel.findOneAndUpdate(
                  { shop_id: registerShop._id },
                  { $set: { shop_id: registerShop._id } },
                  { new: true, upsert: true }
            )

            const updateUser = await userModel.findOneAndUpdate(
                  { _id: user?._id },
                  { $set: { isOpenShop: true } },
                  { new: true, upsert: true }
            )

            const queryNotification = { notification_user_id: new Types.ObjectId(user?._id) }
            const updateNotifcation = {
                  $push: {
                        notifications_message: renderNotificationSystem(
                              mode === 'UPDATE' ? 'Cập nhập thông tin cửa hàng thành công' : 'Đăng kí mở cửa hàng thành công'
                        )
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }

            const result = await notificationModel.findOneAndUpdate(queryNotification, updateNotifcation, optionNotification)
            return { shop: registerShop, user: updateUser }
      }

      static async UploadAvatarShop(req: IRequestCustom) {
            const file = req.file
            if (!file) throw new BadRequestError({ detail: 'Không có file' })
            const { user } = req
            const folder = `user/${user?._id}/shops`
            const result = await uploadToCloudinary(file, folder)

            const shopUpdate = await shopModel.findOneAndUpdate(
                  { owner: user?._id },
                  {
                        $set: { shop_avatar: { secure_url: result.secure_url, public_id: result.public_id } }
                  },

                  { new: true, upsert: true }
            )
            return { shop_id: shopUpdate._id, shop_avatar: shopUpdate.shop_avatar }
      }

      static async deleteAvatarShop(req: IRequestCustom) {
            const { shop_id, public_id } = req.body
            const resultRemove = await cloudinary.uploader.destroy(public_id)
            const removeDocument = await shopModel.findOneAndUpdate({ _id: new Types.ObjectId(shop_id) }, { $unset: { shop_avatar: 1 } })
            return { message: 'Xóa thành công' }
      }

      static async getMyShop(req: IRequestCustom) {
            const { user } = req

            const [foundShop] = await shopModel.aggregate([
                  {
                        $match: {
                              owner: new Types.ObjectId(user?._id)
                        }
                  },
                  {
                        $set: {
                              shop_order_count: {
                                    $size: {
                                          $ifNull: ['$shop_order', []]
                                    }
                              }
                        }
                  },
                  {
                        $unset: 'shop_order'
                  }
            ])

            if (!foundShop)
                  throw new BadRequestError({
                        detail: 'Không tìm thấy Shop'
                  })

            return {
                  shop: foundShop
            }
      }

      static async getProductMyShop(req: IRequestCustom) {
            const { user } = req
            const { page, limit, shop_id, sort, inc } = req.query
            const shopQuery = { owner: new Types.ObjectId(user?._id) }

            const PAGE = Number(page)
            const LIMIT = Number(limit)
            const SKIP = LIMIT * (PAGE - 1)

            const foundOrder = await orderModel
                  .find({
                        'order_products.products.shop_id': new Types.ObjectId(shop_id as string)
                  })
                  .populate({ path: 'order_products.products.product_id', select: { product_name: 1, product_price: 1 } })


            const shop = await shopModel.findOne(shopQuery).populate({
                  path: 'shop_products',
                  options: {
                        // sort: filter,
                        skip: SKIP,
                        limit: LIMIT,
                        select: {
                              _id: 1,
                              product_name: 1,
                              product_price: 1,
                              product_thumb_image: 1,
                              product_votes: 1,
                              product_is_bought: 1,
                              product_desc_image: 1,
                              product_available: 1
                        }
                  }
            })

            // const shop = await shopModel.findOne({ owner: new Types.ObjectId(user?._id) })
            // const foundProductMyShop = await productModel.find({ shop_id: shop?._id, product_state: true })

            //console.log(([^)]+))
            return { shop: shop, order: foundOrder }
      }

      static async foundShopHasProductType(req: IRequestCustom) {
            const { product_type } = req.query
            const filterProductType = await productModel.find({ product_type }).populate('shop_id')

            const shop_unique: TShopDoc[] = []

            filterProductType.filter((p) => {
                  const foundShop = shop_unique.findIndex((shop) => shop._id === p.shop_id._id)
                  if (foundShop === -1) {
                        shop_unique.push(p.shop_id as unknown as TShopDoc)
                  }
                  return
            })

            return { shops: shop_unique }
      }

      static async getShopInfoOfProduct(req: IRequestCustom) {
            const { shop_id } = req.query

            const foundShop = await shopModel.findOne({ _id: new Types.ObjectId(shop_id as string) })

            return { shop: foundShop }
      }

      static async getShopId(req: IRequestCustom) {
            const { shop_id } = req.query
            const shop = await shopModel.findOne({ _id: new Types.ObjectId(shop_id as string) })

            return { shop }
      }

      static async getProductFilter(req: IRequestCustom) {
            const { page, limit, shop_id, sort, inc } = req.query
            const PAGE = Number(page)
            const INC = Number(inc)

            const LIMIT = Number(limit)
            const SKIP = LIMIT * (PAGE - 1)
            const filter = { [sort as keyof IProduct]: INC, _id: 1 }

            const shopQuery = { _id: new Types.ObjectId(shop_id as string) }

            const shop = await shopModel.findOne(shopQuery).populate({
                  path: 'shop_products',
                  options: {
                        sort: filter,
                        skip: SKIP,
                        limit: LIMIT,
                        select: {
                              _id: 1,
                              product_name: 1,
                              product_price: 1,
                              product_thumb_image: 1,
                              product_votes: 1,
                              product_is_bought: 1,
                              product_desc_image: 1
                        }
                  }
            })

            return { shop: shop || { shop_products: [] } }
      }

      static async getOrderMyShop(req: IRequestCustom) {
            const { user } = req
            const { page, limit, shop_id } = req.query
            const orderQuery = {
                  'order_products.products.shop_id': new Types.ObjectId(shop_id as string)
            }

            const PAGE = Number(page)

            const LIMIT = Number(limit)
            const SKIP = LIMIT * (PAGE - 1)

            const result = await shopModel
                  .findOne({ _id: new Types.ObjectId(shop_id as string) })
                  .select('shop_order')
                  .populate({
                        path: 'shop_order.product_id',
                        model: 'Product',
                        select: '_id product_thumb_image product_name product_votes product_price'
                  })

                  .exec()

            const startIndex = (PAGE - 1) * LIMIT
            const endIndex = PAGE * LIMIT

            const paginatedOrders = result?.shop_order.slice(startIndex, endIndex)
            const temp = await ShopRepository.getMyOrderShop({ shop_id: new Types.ObjectId(shop_id as string), limit: LIMIT, skip: SKIP })
            // const foundOrder = await orderModel
            //       .find(orderQuery)
            //       .populate({
            //             path: populatePath,
            //             options: populateOption
            //       })
            //       .skip(SKIP)
            //       .limit(LIMIT)
            // const PAGE_RESULT = PAGE - 1
            // const start = LIMIT * PAGE_RESULT
            // const end = start + LIMIT
            // const pagination = foundOrder?.order_products.slice(start, end)
            return paginatedOrders ? { orderShop: paginatedOrders, temp } : { order_products: [] }
      }

      static async getShopAdmin(req: IRequestCustom) {
            const admin = await userModel.findOne({ roles: 'admin' })
            const shopAdmin = await shopModel
                  .findOne({ owner: new Types.ObjectId(admin?._id) })
                  .select('shop_name shop_avatar shop_avatar_default shop_vote _id shop_count_total_vote')
                  .lean()

            return { shopAdmin }
      }
}

export default ShopService
