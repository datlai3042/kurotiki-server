import { Types } from 'mongoose'
import { IRequestCustom } from '~/middlewares/authentication'
import { CartProduct, CartProductWithId, cartModel } from '~/models/cart.modal'
import { notificationModel } from '~/models/notification.model'
import { orderModel } from '~/models/order.model'
import productModel from '~/models/product.model'
import { shopModel } from '~/models/shop.model'
import { checkQuanity } from '~/utils/checkQuantity.util'
import { renderNotificationProduct, renderNotificationShop } from '~/utils/notification.util'

class OrderService {
      static async orderAddProduct(req: IRequestCustom<{ orders: { products: CartProductWithId[]; order_total: number } }>) {
            const { user } = req
            const { products, order_total } = req.body.orders

            const checkQuanityProduct = await checkQuanity({ products })
            if (!checkQuanityProduct) {
                  return checkQuanityProduct
            }

            /*
                  B1: Update Order -> Mảng order từ client gửi lên
                  B2: Update Cart -> xóa product và -1 count cart
                  B3: Update Product -> lấy số lượng quantity - với product_available
                  B4: Update Notification -> notification người mua
                  B5: Update Shop -> notification chủ shop

                  Notes:.....

                  @Order
                  Thêm mảng order này vào document order của user

                  @Cart
                  User gửi order là 1 mảng products lên
                  Từ mảng products có product_id -> xóa product đó khỏi cart, vào giảm cart_count -= products.length

                  @Product
                  Lấy field của từng product trong mảng products
                  product = product_id ::: product_available -= product.quantity

                  @Notification
                  @ - @ User -> Thêm thông báo mua thành công
                  @ - @ Shop -> Trong mỗi product của mảng products sẽ có shop_id, từ shop_id ta có document Shop, thông quan owner của document ta thu được _id của chủ shop
                        Cuối cùng là thêm thông báo đã bán được sản phẩm

            */

            //ORDER MODEL
            const queryOrder = { order_user_id: new Types.ObjectId(user?._id) }
            const updateOrder = { $addToSet: { order_products: { products: products, order_total } } }
            const optionOrder = { new: true, upsert: true, multi: true }
            const updateOrderDocument = await orderModel
                  .findOneAndUpdate(queryOrder, updateOrder, optionOrder)
                  .populate('order_products.products.product_id')
                  .populate('order_products.products.shop_id')

            // .populate({ path: 'order_products.products.product_id' })
            // .populate({ path: 'order_products.products.shop_id' })

            //CART MODEL

            /// lấy mảng product_id trong mảng products từ client truyền lên
            const productId = products.map((product) => product.product_id._id)
            const queryCart = { cart_user_id: new Types.ObjectId(user?._id) }
            const updateCart = {
                  $pull: { cart_products: { product_id: { $in: productId } } },
                  $inc: { cart_count_product: -productId.length }
            }
            const optionCart = { new: true, upsert: true, multi: true }
            const updateCartDocument = await cartModel.findOneAndUpdate(queryCart, updateCart, optionCart)

            const product_info: { product_name: string; product_quantity: number; product_image: string }[] = []
            //PRODUCT MODEL
            for (let index = 0; index < productId.length; index++) {
                  const queryProduct = { _id: productId[index] }
                  const foundProduct = await productModel.findOne(queryProduct)

                  const updateProduct = {
                        $inc: {
                              product_available: -products[index].quantity,
                              product_is_bought: products[index].quantity
                        }
                  }
                  const optionProduct = { new: true, upsert: true }

                  const updateProductDocument = await productModel.findOneAndUpdate(queryProduct, updateProduct, optionProduct)
                  product_info.push({
                        product_name: updateProductDocument?.product_name as string,
                        product_quantity: products[index].quantity,
                        product_image: updateProductDocument?.product_thumb_image.secure_url as string
                  })
            }

            // Lấy Object Order vừa được thêm vào
            const indexLastOrder = updateOrderDocument?.order_products?.length! - 1
            const elementLast = updateOrderDocument?.order_products[indexLastOrder]

            //NOTIFICATION MODEL - USER
            for (let index = 0; index < products.length; index++) {
                  const queryNotificationUser = { notification_user_id: new Types.ObjectId(user?._id) }
                  const updateNotificationUser = {
                        $inc: { notification_count: 1 },
                        $push: {
                              notifications_message: [
                                    renderNotificationProduct({
                                          message: `Mua thành công sản phẩm `,
                                          product_name: product_info[index].product_name,
                                          product_quantity: product_info[index].product_quantity,

                                          order_id: elementLast!._id as Types.ObjectId
                                    })
                              ]
                        }
                  }

                  const optionNotificationUser = { new: true, upsert: true }
                  const updateNotificationUserDocument = await notificationModel.findOneAndUpdate(
                        queryNotificationUser,
                        updateNotificationUser,
                        optionNotificationUser
                  )
            }

            for (let index = 0; index < products.length; index++) {
                  const queryFoundOwnerShop = { _id: elementLast?.products[index].shop_id }
                  const updateShop = { $push: { shop_order: products[index] } }
                  await shopModel.findOneAndUpdate(queryFoundOwnerShop, updateShop)
            }

            //NOTIFICATION MODEL - SHOP MODEL
            for (let index = 0; index < products.length; index++) {
                  const queryFoundOwnerShop = { _id: elementLast?.products[index].shop_id }
                  const populateShop = { path: 'owner', select: { _id: 1 } }

                  const onwer = await shopModel.findOne(queryFoundOwnerShop).populate(populateShop)

                  const queryNotificationShop = { notification_user_id: new Types.ObjectId(onwer?.owner._id) }
                  const updateNotificationShop = {
                        $inc: { notification_count: 1 },
                        $push: {
                              notifications_message: [
                                    renderNotificationShop({
                                          message: `Đã bán thành công ${products[index].quantity} sản phẩm`,
                                          product_name: product_info[index].product_name,
                                          product_quantity: product_info[index].product_quantity,
                                          order_id: elementLast?._id!,
                                          order_product_id: elementLast?.products[index]._id!,
                                          user_buy_id: user?._id,
                                          product_image: product_info[index].product_image
                                    })
                              ]
                        }
                  }
                  const optionNotificationShop = { new: true, upsert: true }
                  const updateNotificationShopDocument = await notificationModel.findOneAndUpdate(
                        queryNotificationShop,
                        updateNotificationShop,
                        optionNotificationShop
                  )
            }

            return { message: 'SUCCESS', order_success: elementLast }
      }

      static async getMyOrder(req: IRequestCustom) {
            const { user } = req
            const query = { order_user_id: new Types.ObjectId(user?._id) }

            const myOrder = await orderModel
                  .findOne(query)
                  .populate({
                        path: 'order_products.products.product_id',
                        select: { product_name: 1, product_thumb_image: 1, product_price: 1 }
                  })
                  .populate({
                        path: 'order_products.products.shop_id',
                        select: {
                              shop_name: 1
                        }
                  })

            return { order: myOrder }
      }

      static async buyAgain(req: IRequestCustom<{ products: CartProduct[] }>) {
            const { user } = req
            const products = req.body.products
            const query = { cart_user_id: new Types.ObjectId(user?._id) }
            const update = { $push: { cart_products: { $each: products, $position: 0 } }, $inc: { cart_count_product: products.length } }
            const option = { new: true, upsert: true }

            const updateCart = await cartModel.findOneAndUpdate(query, update, option)

            return { message: 'OK' }
      }

      static async getOrderInfo(req: IRequestCustom) {
            const order_id = req.params.order_id
            const { user } = req
            const query = { order_user_id: new Types.ObjectId(user?._id), 'order_products._id': new Types.ObjectId(order_id) }
            // const select = { 'order_products.$': 1 }
            const getOrderInfo = await orderModel
                  .findOne(query)
                  // .select({ 'orders.products.products.product_id': 1 })
                  .populate({ path: 'order_products.products.product_id' })
                  .populate({
                        path: 'order_products.products.shop_id',
                        select: '_id shop_name ',
                  })

                  .lean()

            const orderInfo = getOrderInfo?.order_products.filter((order) => {
                  if (order._id.toString() === order_id) {
                        return order
                  }
                  return null
            })
            return {
                  getOrderInfo: {
                        order_products: orderInfo,
                  }
            }
      }
}

export default OrderService
