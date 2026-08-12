import mongoose, { Types } from 'mongoose'
import { BadRequestError } from '~/Core/response.error'
import { IRequestCustom } from '~/middlewares/authentication'
import { CartProduct, cartModel } from '~/models/cart.modal'
import productModel from '~/models/product.model'
import userModel from '~/models/user.model'

type TModeChangeCartQuantity = 'INCREASE' | 'DECREASE' | 'INPUT'

class CartService {
      static async createCart({ user_id, product }: { user_id: string; product: CartProduct }) {
            const query = { cart_user_id: new Types.ObjectId(user_id) }
            const update = {
                  $addToSet: {
                        cart_products: product
                  },
                  $inc: { cart_count_product: 1 }
            }

            const option = { new: true, upsert: true }

            const userCart = await cartModel.findOneAndUpdate(query, update, option)
            return { cart: userCart }
      }

      static async addCart(req: IRequestCustom<{ product: CartProduct }>) {
            const { user } = req
            const { product } = req.body

            const checkProduct = await productModel.findOne({ _id: new Types.ObjectId(product.product_id) })
            if (checkProduct!.product_available < product.quantity) {
                  throw new BadRequestError({ detail: 'Số lượng sản phẩm được chọn nhiều hơn số lượng trong kho' })
            }

            const userCart = await cartModel.findOne({ cart_user_id: new Types.ObjectId(user?._id) })
            
            // const

            if (!userCart) {
                  return await CartService.createCart({ user_id: user?._id, product })
            }

            if (userCart.cart_products.length === 0) {
                  userCart.cart_products = [product] as Types.DocumentArray<CartProduct>
                  userCart.cart_count_product += 1
                  return { cart: await userCart.save() }
            }

            const foundProduct = await cartModel.findOne({
                  cart_user_id: new Types.ObjectId(user?._id),
                  'cart_products.product_id': product.product_id
            })

            if (!foundProduct) {
                  const query = { cart_user_id: new Types.ObjectId(user?._id) }

                  const update = { $addToSet: { cart_products: product }, $inc: { cart_count_product: 1 } }
                  const option = { new: true, upsert: true }

                  const cart = await cartModel.findOneAndUpdate(query, update, option)

                  return { cart, user, product }
            }

            const query = { cart_user_id: new Types.ObjectId(user?._id), 'cart_products.product_id': product.product_id }

            const update = { $inc: { 'cart_products.$.quantity': product.quantity } }
            const option = { new: true, upsert: true }

            const cart = await cartModel.findOneAndUpdate(query, update, option)

            return { cart, user, product }
      }

      static async getCountProductCart(req: IRequestCustom) {
            const { user } = req
            const countCart = await cartModel.findOne({ cart_user_id: new mongoose.Types.ObjectId(user?._id) })
            return { count: countCart?.cart_count_product }
      }

      static async getMyCart(req: IRequestCustom) {
            const { user } = req
            const foundCart = await cartModel
                  .findOne({ cart_user_id: user?._id })
                  .populate({
                        path: 'cart_products.product_id',

                        select: {
                              product_thumb_image: 1,
                              product_price: 1,
                              product_name: 1,
                              product_id: 1,
                              product_state: 1
                        }
                  })
                  .populate({
                        path: 'cart_products.shop_id',
                        select: {
                              shop_name: 1,
                              shop_avatar: 1,
                              shop_avatar_default: 1
                        }
                  })
            return { cart: foundCart ? foundCart : { cart_products: [] } }
      }

      static async changeQuantityProductCart(req: IRequestCustom) {
            const { user } = req
            const { mode, quantity, product_id, cart_item_id } = req.body


            const userId = new Types.ObjectId(user?._id)
            const productId = new Types.ObjectId(product_id)
            const cartItemId = new Types.ObjectId(cart_item_id)

            const query = {
                  cart_user_id: userId,

                  cart_products: {
                        $elemMatch: {
                              _id: cartItemId,
                              product_id: productId,
                        },
                  },
            }
            // const query = { cart_user_id: new Types.ObjectId(user?._id), 'cart_products.product_id': product_id, 'cart_products._id': cart_item_id }
            const option = { new: true, }
            if (mode === 'DECREASE') {
                  const result = await cartModel.findOneAndUpdate(
                        {
                              cart_user_id: userId,

                              cart_products: {
                                    $elemMatch: {
                                          _id: cartItemId,
                                          product_id: productId,
                                          quantity: {
                                                $gt: 1,
                                          },
                                    },
                              },
                        },
                        {
                              $inc: {
                                    'cart_products.$.quantity': -1,
                              },
                        },
                        {
                              new: true,
                        },
                  )

                  if (!result) {
                        return {
                              quantity: 1,
                        }
                  }

                  const foundProduct = result.cart_products.id(cartItemId)

                  return {
                        quantity: foundProduct?.quantity,
                  }
            }
            if (mode === 'INCREASE') {
                  const update = { $inc: { 'cart_products.$.quantity': quantity } }
                  const result = await cartModel.findOneAndUpdate(query, update, option)
                  const foundProduct = result?.cart_products.find((product) => product.product_id.toString() === product_id && cart_item_id === product._id?.toString())
                  return { quantity: foundProduct?.quantity }
            }
            if (mode === 'INPUT') {
                  const update = { $set: { 'cart_products.$.quantity': quantity } }
                  const result = await cartModel.findOneAndUpdate(query, update, option)
                  const foundProduct = result?.cart_products.find((product) => product.product_id.toString() === product_id && cart_item_id === product._id?.toString())

                  return { quantity: foundProduct?.quantity }
            }
      }

      static async selectAllCart(req: IRequestCustom) {
            const { user } = req
            const { select } = req.body

            const product_list_id = await productModel.distinct('_id', { product_state: true })
            const updateAllCart = await cartModel.updateMany(
                  { cart_user_id: new Types.ObjectId(user?._id), cart_product_id: { $in: product_list_id } },
                  { $set: { cart_is_select: select } },
                  { new: true }
            )

            const cartSelectAll = await cartModel.findOneAndUpdate(
                  { cart_user_id: new Types.ObjectId(user?._id) },
                  { $set: { cart_select_all: select, 'cart_products.$[].isSelect': select } },
                  { new: true, upsert: true }
            )

            return { cart: cartSelectAll }
      }

      static async selectOneCart(req: IRequestCustom) {
            const { product_id, value } = req.body
            const { user } = req
            const query = { cart_user_id: new Types.ObjectId(user?._id), 'cart_products.product_id': product_id }
            const update = { $set: { 'cart_products.$.isSelect': value } }
            const option = { new: true, upsert: true }
            const updateCart = await cartModel.findOneAndUpdate(query, update, option)
            const result = updateCart?.cart_products.find((product) => product.product_id.toString() === product_id.toString())
            return { cartUpdateItem: result }
      }

      static async getCartWithId(req: IRequestCustom) {
            const { cart_id } = req.params
            const { user } = req

            const query = { user }

            const foundCart = await userModel.findOne({})
      }

      static async calculatorPrice(req: IRequestCustom) {
            const { user } = req
            const carts = await cartModel.findOne({ cart_user_id: new Types.ObjectId(user?._id) }).populate({
                  path: 'cart_products.product_id',
                  select: 'product_price product_thumb_image product_available'
            })

            const filterCarts = carts?.cart_products.filter((product) => product.isSelect === true)

            return { carts: { cart_products: filterCarts } }
      }

      static async deleteCart(req: IRequestCustom) {
            const { product_id } = req.params
            const { user } = req
            const query = { cart_user_id: new Types.ObjectId(user?._id), 'cart_products._id': product_id }
            const update = { $pull: { cart_products: { _id: product_id } }, $inc: { cart_count_product: -1 } }
            const option = { new: true, upsert: true }
            const deleteCart = await cartModel.findOneAndUpdate(query, update, option)

            if (!deleteCart) return { message: 'Xóa thất bại' }
            return { message: 'Xóa thành công' }
      }

      static async updateAddressCart(req: IRequestCustom) {
            const { payload } = req.body
            const { product_id, address_full } = payload
            const { user } = req
            const query = { cart_user_id: new Types.ObjectId(user?._id), 'cart_products.product_id': product_id }
            const update = { 'cart_products.$.cart_address': address_full }
            const option = { new: true, upsert: true }

            const cartItem = await cartModel.findOneAndUpdate(query, update, option)

            return { cart: cartItem }
      }
}

export default CartService
