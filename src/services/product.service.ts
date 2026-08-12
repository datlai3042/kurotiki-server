import mongoose, { Types } from 'mongoose'
import { BadRequestError, ForbiddenError } from '~/Core/response.error'
import cloudinary from '~/configs/cloundinary.config'
import { HEADER, IRequestCustom } from '~/middlewares/authentication'
import { notificationModel } from '~/models/notification.model'
import productModel, { ProductType } from '~/models/product.model'
import { TShopDoc, shopModel } from '~/models/shop.model'
import CommentRepository from '~/repositories/comment.repository'
import ProductRepository from '~/repositories/product.repository'
import ShopRepository from '~/repositories/shop.repository'
import { renderNotificationSystem } from '~/utils/notification.util'
import uploadToCloudinary from '~/utils/uploadCloudinary'
import { userProductSeeUnique } from '~/utils/user.utils'

class ProductService {
      static async searchQuery(req: IRequestCustom) {
            const { text } = req.query

            const products = await productModel
                  .find({ $text: { $search: text as string } })
                  .select('product_name _id product_thumb_image product_votes')
                  .skip(0)
                  .limit(4)

            const shops = await shopModel
                  .find({ $text: { $search: text as string } })
                  .select('shop_name _id shop_avatar shop_vote shop_count_total_vote')
                  .skip(0)
                  .limit(2)

            return { products, shops }
      }

      static async seachNameProduct(req: IRequestCustom) {
            const { page, limit, text } = req.query
            const PAGE = Number(page)
            const LIMIT = Number(limit)
            const SKIP = LIMIT * (PAGE - 1)

            const products = await productModel
                  .find({ $text: { $search: text as string } })
                  .select('product_name _id product_thumb_image product_votes')
                  .skip(SKIP)
                  .limit(LIMIT)

            return { shop: { shop_products: products } }
      }

      static async createBaseProductId(req: IRequestCustom) {
            const { user } = req
            const foundShop = await shopModel.findOne({ owner: user?._id })

            const createProduct = await productModel.findOneAndUpdate(
                  { _id: new mongoose.Types.ObjectId() },
                  { $set: { owner: foundShop?._id } },
                  { new: true, upsert: true }
            )

            return { product_id: createProduct?._id }
      }

      static async uploadProductDescriptionImageOne(req: IRequestCustom) {
            const file = req.file
            const { user } = req
            const { product_id } = req.body
            if (file) {
                  const folder = `users/${user?.id}/products`
                  const result = await uploadToCloudinary(file, folder)
                  const productDemo = await productModel.findOneAndUpdate(
                        {
                              _id: new mongoose.Types.ObjectId(product_id)
                        },
                        {
                              $addToSet: {
                                    product_desc_image: { secure_url: result.secure_url, public_id: result.public_id }
                              }
                        },
                        { new: true, upsert: true }
                  )
                  return {
                        product: {
                              product_id: productDemo._id,
                              public_id: result.public_id,
                              secure_url: result.secure_url
                        }
                  }
            }

            return { message: 'Missing file' }
      }

      static async deleteProductDescriptionImageOne(req: IRequestCustom) {
            const { public_id, product_id } = req.body
            if (!product_id || !public_id) return { message: 'Không tìm thấy id hoặc public_id' }

            const result = await cloudinary.uploader.destroy(public_id)
            const deleteProduct = await productModel.findOneAndUpdate(
                  { _id: product_id },
                  { $pull: { product_desc_image: { public_id } } },
                  { new: true, upsert: true }
            )
            if (!result) return result
            return { message: 'Xoa thanh cong' }
      }

      static async uploadProductThumb(req: IRequestCustom) {
            const file = req.file
            const { user } = req
            const { product_id } = req.body
            if (file) {
                  const folder = `users/${user?.id}/products`
                  const result = await uploadToCloudinary(file, folder)
                  const productDemo = await productModel.findOneAndUpdate(
                        {
                              _id: new mongoose.Types.ObjectId(product_id)
                        },
                        {
                              $set: {
                                    product_thumb_image: { secure_url: result.secure_url, public_id: result.public_id }
                              }
                        },
                        { new: true, upsert: true }
                  )
                  return {
                        product: {
                              product_id: productDemo._id,
                              product_thumb_image: productDemo.product_thumb_image
                        }
                  }
            }

            return { message: 'Missing file' }
      }

      static async getProductShop(req: IRequestCustom) {
            const user = req.user
            const foundShop = await shopModel.findOne({ owner: new Types.ObjectId(user?._id) })

            const product_all = await productModel.find({
                  shop_id: foundShop?._id
            })
            const result = product_all.map((product) => {
                  return product.product_desc_image.map((img) => {
                        const config = cloudinary.url(img.public_id, { width: 100, height: 100 })
                        img.secure_url = config
                        return img
                  })
            })

            return { product_all }
      }

      static async deleteProductThumb(req: IRequestCustom) {
            const public_id = req.body.public_id
            const id = req.body.id
            if (!id || !public_id) return { message: 'Không tìm thấy id hoặc public_id' }
            const result = await cloudinary.uploader.destroy(public_id)
            const deleteProduct = await productModel.findOneAndUpdate(
                  { _id: id },
                  { $unset: { product_thumb_image: 1 } },
                  { new: true, upsert: true }
            )
            if (!result) return result
            return { message: 'Xoa thanh cong' }
      }

      static async deleteProductImageFull(req: IRequestCustom) {
            const id = req.body.id
            if (!id) throw new BadRequestError({ detail: 'Khong co id' })
            const productSelect = await productModel.findOne({ _id: new Types.ObjectId(id) }).select({ product_desc_image: 1 })
            productSelect?.product_desc_image.forEach(async (product) => {
                  await cloudinary.uploader.destroy(product.public_id)
            })
            const productDemo = await productModel
                  .findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $unset: { product_desc_image: 1 } })
                  .lean()

            return { message: productDemo }
      }

      static async getAllProduct(req: IRequestCustom) {
            const { page, limit } = req.query
            const PAGE = Number(page)
            const LIMIT = Number(limit)
            const SKIP = LIMIT * (PAGE - 1)

            const products = await productModel
                  .find({ isProductFull: true })
                  .skip(SKIP)
                  .limit(LIMIT)
                  .sort({ product_price: 1 })
                  .select({ _id: 1, product_name: 1, product_price: 1, product_thumb_image: 1, product_votes: 1 })
                  .lean()
            const totalProduct = await productModel.find({ isProductFull: true })
            const totalPage = Math.ceil(totalProduct.length / LIMIT)

            return { products: products, totalPage }
      }

      static async getAllProductCare(req: IRequestCustom) {
            const products = await productModel
                  .find({ isProductFull: true })
                  .limit(18)
                  .sort({ product_price: -1 })
                  .select({ _id: 1, product_name: 1, product_price: 1, product_thumb_image: 1, product_votes: 1 })

            return { products }
      }

      static async getProductSimilar(req: IRequestCustom) {
            const { product_type, type, product_id } = req.query

            const productQuery = { product_type: product_type as string, _id: { $nin: [new Types.ObjectId(product_id as string)] } }

            const products = await productModel
                  .find(productQuery)
                  .select({ _id: 1, product_name: 1, product_price: 1, product_thumb_image: 1, product_votes: 1, product_is_bought: 1 })
                  .limit(35)

            return { products }
      }

      static async getProductBestBought(req: IRequestCustom) {
            const { page, limit } = req.query

            const PAGE = Number(page)
            const LIMIT = Number(limit)

            const products = await productModel
                  .find({})
                  .limit(LIMIT)
                  .sort({ product_is_bought: -1 })
                  .select({ _id: 1, product_name: 1, product_price: 1, product_thumb_image: 1, product_votes: 1, product_is_bought: 1 })
            return { products }
      }

      static async getProductBookAllType(req: IRequestCustom) {
            const productQuery = { product_type: 'Book' }
            const productQueryManga = { product_type: 'Book', 'attribute.type': 'Manga' }
            const productQueryNovel = { product_type: 'Book', 'attribute.type': 'Novel' }
            const productQueryDetective = { product_type: 'Book', 'attribute.type': 'Detective' }

            const text = await ProductRepository.getProductDetai({ product_type: 'Book' })

            const products = await productModel
                  .find(productQuery)
                  .select('_id product_thumb_image product_name product_votes product_price')
            const productManga = await productModel
                  .find(productQueryManga)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.type')
            const productNovel = await productModel
                  .find(productQueryNovel)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.type')
            const productDetective = await productModel
                  .find(productQueryDetective)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.type')

            return { products, manga: productManga, novel: productNovel, detective: productDetective, test: text }
      }

      static async getProductFoodAllType(req: IRequestCustom) {
            const productQuery = { product_type: 'Food' }
            const productQueryFastFood = { product_type: 'Food', 'attribute.type': 'Fast food' }
            const productQueryCannedGood = { product_type: 'Food', 'attribute.type': 'Canned Goods' }
            const productQueryDrinks = { product_type: 'Food', 'attribute.type': 'Drinks' }

            const products = await productModel
                  .find(productQuery)
                  .select('_id product_thumb_image product_name product_votes product_price')
            const productFastFood = await productModel
                  .find(productQueryFastFood)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.product_food_type')
            const productCannedGood = await productModel
                  .find(productQueryCannedGood)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.type')
            const productDrinks = await productModel
                  .find(productQueryDrinks)
                  .select('_id product_thumb_image product_name product_votes product_price attribute.type')

            return { products, fastFood: productFastFood, cannedGood: productCannedGood, drinks: productDrinks }
      }

      static async getProductWithId(req: IRequestCustom) {
            const id = req.params.id
            const product = await productModel
                  .findOne({ _id: new mongoose.Types.ObjectId(id), product_state: true })
                  .populate({ path: 'shop_id', populate: { path: 'owner', model: 'User', select: { _id: 1 } } })

            const client_id = req.headers[HEADER.CLIENT_ID]
            if (client_id) {
                  const foundShop = await shopModel.findOne({ _id: new Types.ObjectId(product?.shop_id._id) })
                  if (foundShop?.owner.toString() !== (client_id as string)) {
                        await userProductSeeUnique({ user_id: new Types.ObjectId(client_id as string), product_id: new Types.ObjectId(id) })
                  }
            }

            const detailComment = await CommentRepository.getCommentDetail({ product_id: new Types.ObjectId(id) })

            if (!product) return { product: null }
            return {
                  product,
                  totalComment: product.totalComment,
                  avg: product.product_votes,
                  detailComment
                  // demo
            }
      }

      static async getProductWithIdUpdate(req: IRequestCustom) {
            const id = req.params.id
            const product = await productModel.findById({ _id: new mongoose.Types.ObjectId(id) }).populate('shop_id', 'shop_name')
            const { user } = req
            const foundShop = await shopModel.findOne({ owner: user?._id })
            if (!foundShop) {
                  throw new ForbiddenError({ detail: 'Sản phẩm thuộc về cửa hàng khác' })
            }

            return { product }
      }

      static async protectProduct(req: IRequestCustom) {
            const id = req.params.product_id
            const { user } = req

            const foundShop = await shopModel.findOne({ owner: user?._id })
            const foundProduct = await productModel.findOne({ _id: id, shop_id: foundShop?._id })
            if (!foundShop) {
                  // throw new ForbiddenError({ detail: 'Sản phẩm thuộc về cửa hàng khác' })
                  return { product: null }
            }
            return { product: foundProduct }
      }

      static async deleteProductWithId(req: IRequestCustom) {
            const { product_id } = req.params
            const { user } = req

            const deleteProduct = await productModel.findOneAndUpdate(
                  { _id: product_id },
                  { $set: { product_state: false } },
                  { new: true, upsert: true }
            )
            if (!deleteProduct) throw new BadRequestError({ detail: 'Xóa sản phẩm thất bại' })

            const foundShop = await shopModel.findOneAndUpdate(
                  { owner: new Types.ObjectId(user?._id) },
                  { inc: { shop_count_product: -1 } },
                  { new: true, upsert: true }
            )

            if (foundShop) {
                  const deleteProductShop = foundShop?.shop_products.filter((p) => p.toString() !== product_id.toString())
                  foundShop.shop_products = deleteProductShop
                  await foundShop.save()
                  const calcShop: { shop_vote: number; shop_total_comment: number } = await ShopRepository.getTotalCommentAndVote({
                        shop_id: new Types.ObjectId(foundShop._id)
                  })
                  foundShop.shop_vote = calcShop?.shop_vote || 4.5
                  foundShop.shop_count_total_vote = calcShop?.shop_total_comment || 0
                  await foundShop.save()
            }

            // const productShopQuery = { shop_id: new Types.ObjectId(foundShop?._id) }
            // const productShopUpdate = { $set: { products: { state: 'Delete' } } }
            // const productShopOptions = { new: true, upsert: true }

            // await productShopModel.findOneAndUpdate(productShopQuery, productShopUpdate, productShopOptions)

            const query = { notification_user_id: new Types.ObjectId(user?._id) }
            const update = {
                  $push: {
                        notifications_message: renderNotificationSystem('Bạn đã xóa thành công 1 sản phẩm')
                  },
                  $inc: { notification_count: 1 }
            }
            const optionNotification = { new: true, upsert: true }
            await notificationModel.findOneAndUpdate(query, update, optionNotification)
            return { message: 'Xóa thành công' }
      }

      static async getAllProductWithType(req: IRequestCustom) {
            const { product_type, minVote = 1, maxVote = 5, minPrice = 1, maxPrice = 1000000000, page } = req.query
            const limit = 2
            const skipDocument = limit * (Number(page) - 1)
            const products = await productModel
                  .find({
                        product_type
                  })
                  .skip(skipDocument)
                  .limit(limit)
                  .populate('shop_id')

            let featuredCategory: string[] = []

            const shops = await productModel.find({ product_type }).populate('shop_id')
            const set = new Set()
            const shop_id: TShopDoc[] = []
            shops.filter((product) => {
                  let index = shop_id.findIndex((shop) => shop._id === product.shop_id._id)
                  if (index <= -1) {
                        shop_id.push(product.shop_id as unknown as TShopDoc)
                        return
                  }
                  return null
            })

            // const type = await ProductRepository.countProductWithType({ product_type: product_type as ProductType })
            const count = (await productModel.find({ product_type: product_type as ProductType })).length
            const a = await productModel.find({ 'attribute.product_food_type': 'Fast food' })
            return { products, count, shops: shop_id }
      }

      static async getProductFilter(
            req: IRequestCustom<{ product_vote: number; minPrice: number; maxPrice: number; product_type: ProductType; page: number }>
      ) {
            const { page = 1, maxPrice, minPrice, product_type, vote } = req.query
            const LIMIT = 2
            const getDocument = LIMIT * (Number(page) - 1)
            const products = await productModel
                  .find({
                        product_type,
                        product_price: { $gte: Number(minPrice), $lte: Number(maxPrice) },
                        product_votes: { $gte: Number(vote) }
                  })
                  .skip(getDocument)
                  .limit(LIMIT)

            return { products }
      }

      static async getProductTopSearch(req: IRequestCustom) {
            const { limit } = req.query
            const LIMIT = Number(limit)
            const products = await productModel.find({}).sort({ product_is_bought: -1 }).skip(0).limit(LIMIT)

            return { products }
      }
}

export default ProductService

//  Created by Lai Huynh Phat Dat on 25/02/2024.
//
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//
//                _ooOoo_                       NAM MÔ A DI ĐÀ PHẬT !
//               o8888888o
//               88" . "88
//               (| -_- |)
//                O\ = /O
//            ____/`---'\____         Con lạy chín phương trời, con lạy mười phương đất
//            .' \\| |// `.             Chư Phật mười phương, mười phương chư Phật
//           / \\||| : |||// \        Con ơn nhờ Trời đất chổ che, Thánh Thần cứu độ
//         / _||||| -:- |||||- \    Xin nhất tâm kính lễ Hoàng thiên Hậu thổ, Tiên Phật Thánh Thần
//           | | \\\ - /// | |              Giúp đỡ con code sạch ít bug
//         | \_| ''\---/'' | |           Đồng nghiệp vui vẻ, sếp quý tăng lương
//         \ .-\__ `-` ___/-. /          Sức khoẻ dồi dào, tiền vào như nước
//       ___`. .' /--.--\ `. . __
//    ."" '< `.___\_<|>_/___.' >'"". NAM MÔ VIÊN THÔNG GIÁO CHỦ ĐẠI TỪ ĐẠI BI TẦM THANH CỨU KHỔ CỨU NẠN
//   | | : `- \`.;`\ _ /`;.`/ - ` : | |  QUẢNG ĐẠI LINH CẢM QUÁN THẾ ÂM BỒ TÁT
//     \ \ `-. \_ __\ /__ _/ .-` / /
//======`-.____`-.___\_____/___.-`____.-'======
//                `=---='
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//
