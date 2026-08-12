import { Types } from 'mongoose'
import { IRequestCustom } from '~/middlewares/authentication'
import { notificationModel } from '~/models/notification.model'
import NotificationRepository from '~/repositories/notification.repository'
import OrderRepository from '~/repositories/order.repo'

export type NotificationType = 'PRODUCT' | 'SYSTEM' | 'ADMIN' | 'SHOP' | 'USER'

class NotificationService {
      static async getMeNotification(req: IRequestCustom) {
            const { user } = req
            const page = Number(req.query.page)
            const { type } = req.query
            const limit = Number(req.query.limit)

            const result = await NotificationRepository.getNotificationPage({
                  user_id: new Types.ObjectId(user?._id),
                  limit,
                  page,
                  type: type as NotificationType
            })
            return { notifications: result }
      }

      static async getMeNotificationPage(req: IRequestCustom) {
            const page = Number(req.query.page)
            const limit = Number(req.query.limit)

            const { user } = req
            const result = await NotificationRepository.getNotificationPage({
                  user_id: new Types.ObjectId(user?._id),
                  limit,
                  page,
                  type: 'PRODUCT'
            })

            return result
      }

      static async getMyShopNotifications(req: IRequestCustom) {
            const { user } = req
            const { product_id } = req.params
            //@ Tìm Shop
            // const queryShop = {owner: new Types.ObjectId(user?._id)}
            // const foundShopUser = await shopModel.findOne(queryShop)
            // const query = {_id: new Types.ObjectId(user?._id)}
            // const foundUser = await userModel.findOne(query)
            const result = await OrderRepository.getOrderWitId({ order_products_products_id: product_id })

            return { myNotificationShop: { product_sell: result } }
      }

      static async readNotification(req: IRequestCustom) {
            const { user } = req
            const notification_id = req.params.notification_id as string

            const query = {
                  notification_user_id: new Types.ObjectId(user?._id),
                  notifications_message: { $elemMatch: { _id: new Types.ObjectId(notification_id) } }
            }
            const update = { 'notifications_message.$.notification_isRead': true }

            await notificationModel.findOneAndUpdate(query, update)

            return { message: `Đánh dấu đã đọc thông báo có id: ${notification_id}` }
      }
      static async deleteNotification(req: IRequestCustom) {
            const { user } = req
            const notification_id = req.params.notification_id as string

            const query = {
                  notification_user_id: new Types.ObjectId(user?._id)
            }
            const update = {
                  // $pull: { notifications.message: { _id: new Types.ObjectId(notification_id) } },
                  $pull: { notifications_message: { _id: new Types.ObjectId(notification_id) } },
                  $inc: { notification_count: -1 }
            }
            const option = { new: true, upsert: true }

            const result = await notificationModel.findOneAndUpdate(query, update, option)
            return { message: `Đã xóa thông báo có id: ${notification_id}` }
      }
}

export default NotificationService
