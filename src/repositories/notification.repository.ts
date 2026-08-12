import { Types } from 'mongoose'
import { notificationModel } from '~/models/notification.model'
import { NotificationType } from '~/services/notification.service'

class NotificationRepository {
      static async getNotificationPage({
            user_id,
            page = 1,
            limit,
            type = 'SYSTEM'
      }: {
            user_id: Types.ObjectId
            page: number
            limit: number
            type: NotificationType
      }) {
            const totalCountResult = await notificationModel.aggregate([
                  {
                        $match: { notification_user_id: user_id }
                  },
                  {
                        $unwind: '$notifications_message'
                  },
                  {
                        $match: { 'notifications_message.notification_attribute.notification_type': type }
                  },
                  {
                        $group: {
                              _id: null,
                              totalCount: { $sum: 1 }
                        }
                  }
            ])

            const totalCount = totalCountResult.length > 0 ? totalCountResult[0].totalCount : 0

            const numberDocument = limit * (page - 1)
            const result = await notificationModel.aggregate([
                  {
                        $match: {
                              notification_user_id: user_id
                        }
                  },

                  {
                        $unwind: '$notifications_message'
                  },

                  {
                        $match: {
                              'notifications_message.notification_attribute.notification_type': type
                        }
                  },

                  {
                        $sort: {
                              'notifications_message.notification_creation_time': -1
                        }
                  },

                  {
                        $skip: numberDocument
                  },

                  {
                        $limit: limit
                  },

                  // Lookup người mua
                  {
                        $lookup: {
                              from: 'users',

                              localField:
                                    'notifications_message.notification_attribute.user_buy_id',

                              foreignField: '_id',

                              as: 'buyer_info'
                        }
                  },

                  // Lấy object đầu tiên thay vì array
                  {
                        $set: {
                              buyer_info: {
                                    $arrayElemAt: ['$buyer_info', 0]
                              }
                        }
                  },

                  // Chỉ lấy field cần thiết
                  {
                        $set: {
                              'notifications_message.notification_attribute.buyer_info': {
                                    _id: '$buyer_info._id',
                                    fullName: '$buyer_info.fullName',
                                    nickName: '$buyer_info.nickName',
                                    avatar: '$buyer_info.avatar',
                                    email: '$buyer_info.email'
                              }
                        }
                  },

                  {
                        $unset: 'buyer_info'
                  },

                  {
                        $group: {
                              _id: '$_id',

                              notification_count: {
                                    $first: '$notification_count'
                              },

                              notification_user_id: {
                                    $first: '$notification_user_id'
                              },

                              notifications_message: {
                                    $push: '$notifications_message'
                              },

                              get: {
                                    $sum: 1
                              }
                        }
                  }
            ])
            let nameCount = `total_notification_type`
            let totalPage = Math.ceil(totalCount / limit)
            return { notification: result[0] ? result[0] : { notifications_message: [] }, [nameCount]: totalCount, totalPage }
      }
}

export default NotificationRepository
