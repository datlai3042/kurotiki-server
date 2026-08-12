import { Document, Schema, Types, model } from 'mongoose'

const DOCUMENT_NAME = 'Cart'
const COLLECTION_NAME = 'carts'

export type Address = {
      address_receiver_name: string
      address_receiver_tel: string
      address_email_vat: string

      address_street: string

      address_ward: {
            code: string
            text: string
      }

      address_district: {
            code: string
            text: string
      }

      address_province: {
            code: string
            text: string
      }

      address_text: string

      type: 'Home' | 'Company' | 'Private'
}

export interface CartProduct {
      shop_id: Types.ObjectId
      product_id: Types.ObjectId
      cart_state: 'active' | 'pending' | 'complete'
      cart_total: number
      quantity: number
      product_price: number
      isSelect: boolean
      cart_date: Date
      cart_address: Address
}

export interface CartProductWithId {
      _id: Types.ObjectId
      shop_id: Types.ObjectId
      product_id: Types.ObjectId
      cart_state: 'active' | 'pending' | 'complete'
      product_price: number
      quantity: number
      new_quantity: number
      isSelect: boolean
      cart_date: Date
      cart_address: Address
}

interface CartModel {
      cart_user_id: Types.ObjectId
      cart_products: Types.DocumentArray<CartProductDoc>
      cart_count_product: number
      cart_select_all: boolean
}

type CartModelDoc = CartModel & Document
type CartProductDoc = CartProduct & Document

const cartAdressSchema = new Schema(
      {
            address_receiver_name: {
                  type: String,
                  required: true,
                  trim: true,
                  maxlength: 50,
            },

            address_receiver_tel: {
                  type: String,
                  required: true,
                  trim: true,
                  match: [
                        /^(0|\+84)[0-9]{9}$/,
                        'Số điện thoại người nhận không đúng định dạng',
                  ],
            },

            address_email_vat: {
                  type: String,
                  default: '',
                  trim: true,
                  lowercase: true,
                  validate: {
                        validator: (value: string) => {
                              if (!value) return true

                              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                        },
                        message: 'Email nhận VAT không đúng định dạng',
                  },
            },

            address_street: {
                  type: String,
                  required: true,
                  trim: true,
            },

            address_ward: {
                  code: {
                        type: String,
                        required: true,
                  },
                  text: {
                        type: String,
                        required: true,
                        trim: true,
                  },
            },

            address_district: {
                  code: {
                        type: String,
                        required: true,
                  },
                  text: {
                        type: String,
                        required: true,
                        trim: true,
                  },
            },

            address_province: {
                  code: {
                        type: String,
                        required: true,
                  },
                  text: {
                        type: String,
                        required: true,
                        trim: true,
                  },
            },

            address_text: {
                  type: String,
                  required: true,
                  trim: true,
            },

            type: {
                  type: String,
                  enum: ['Home', 'Company', 'Private'],
                  default: 'Home',
                  required: true,
            },
      },
      {
            _id: false,
      },
)

export const cartProductSchema = new Schema({
      shop_id: {
            type: Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
      },

      product_id: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
      },

      cart_state: {
            type: String,
            enum: ['active', 'pending', 'complete'],
            default: 'active',
            required: true,
      },

      quantity: {
            type: Number,
            required: true,
            min: 1,
      },

      product_price: {
            type: Number,
            required: true,
            min: 0,
      },

      isSelect: {
            type: Boolean,
            default: false,
      },

      cart_address: {
            type: cartAdressSchema,
            required: false,
      },

      cart_date: {
            type: Date,
            default: Date.now,
            required: true,
      },
})

cartProductSchema.virtual('product', {
      ref: 'Product',
      localField: 'product_id',
      foreignField: '_id',
      justOne: true,
})

const cartSchema = new Schema({
      cart_user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
      },

      cart_count_product: {
            type: Number,
            default: 0,
      },

      cart_select_all: {
            type: Boolean,
            default: false,
      },

      cart_products: [cartProductSchema],
})

const cartModel = model(DOCUMENT_NAME, cartSchema)

export { cartModel, cartSchema }