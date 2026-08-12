import { Schema, model, Document, Types } from 'mongoose'

const DOCUMENT_NAME = 'User'
const COLLECTION_NAME = 'users'

interface IAvaterUsed extends Document {
      public_id: string
      secure_url: string
}

interface UserAddress {
      address_street: string
      address_ward: string
      address_district: string
      address_province: string
      address_type: 'Home' | 'Company' | 'Private'
      address_creation_time: Date
      address_default: boolean
}

export interface UserDocument extends Document {
      email: string
      password: string
      fullName: string
      nickName: string
      verify_email?: boolean
      bob?: Date
      roles: string[]
      avatar_url_default: string
      avatar: {
            secure_url?: string
            public_id: string
            date_update: Date
      }
      avatar_used: {
            secure_url: string
            public_id: string
            date_update: Date
      }[]
      user_address: Types.DocumentArray<UserAddress>
      gender: string
      isOpenShop?: boolean
      isCartSelectAll: boolean
      user_address_count: number
      product_see: [Types.ObjectId]
}

export const avatarUsedSchema = new Schema<IAvaterUsed>({
      public_id: { type: String },
      secure_url: { type: String }
})

type UserAddressDoc = UserAddress & Document

// const userAddressSchema = new Schema<UserAddressDoc>({
//       address_street: { type: String, required: true },
//       address_ward: { type: String, required: true },
//       address_district: { type: String, required: true },
//       address_province: { type: String, required: true },
//       address_type: { type: String, enum: ['Home', 'Company', 'Private'], default: 'Private' },
//       address_default: { type: Boolean, default: false },
//       address_creation_time: { type: Date, default: Date.now() }
// })

export const userSchema = new Schema<UserDocument>(
      {
            email: {
                  type: String,
                  require: true
            },
            password: {
                  type: String,
                  maxlength: 60,
                  require: true
            },
            fullName: { type: String },
            nickName: { type: String },
            verify_email: { type: Boolean, default: false },
            bob: { type: Date, default: Date.now() },
            roles: { type: [String], enum: ['user', 'shop', 'admin'], default: ['user'] },
            gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
            avatar: {
                  secure_url: String,
                  public_id: String,
                  date_update: Date
            },
            avatar_url_default: {
                  type: String,
                  default: 'https://res.cloudinary.com/cloud304/image/upload/v1722613508/tiki-project/avatar-default.png'
            },
            avatar_used: {
                  type: [
                        {
                              secure_url: String,
                              public_id: String,
                              date_update: Date
                        }
                  ],
                  default: []
            },
            isOpenShop: { type: Boolean, default: false },
            isCartSelectAll: { type: Boolean, default: false },

            user_address: {
                  type: [
                        {
                              address_text: { type: String, required: true },
                              address_street: { type: String, required: true },


                              address_receiver_name: { type: String, required: true },
                              address_receiver_tel: { type: String, required: true },
                              address_email_vat: { type: String, required: true, default: '' },
                              address_ward: {
                                    type: {
                                          code: String,
                                          text: String
                                    },
                                    required: true
                              },
                              address_district: {
                                    type: {
                                          code: String,
                                          text: String
                                    },

                                    required: true
                              },
                              address_province: {
                                    type: {
                                          code: String,
                                          text: String
                                    },
                                    required: true
                              },
                              address_type: { type: String, enum: ['Home', 'Company', 'Private'], default: 'Private' },
                              address_default: { type: Boolean, default: false },
                              address_creation_time: { type: Date, default: Date.now() }
                        }
                  ]
            },
            product_see: [{ type: Schema.Types.ObjectId, ref: 'Product', require: true }],
            user_address_count: { type: Number, default: 0 }
      },
      { timestamps: true, collection: COLLECTION_NAME }
)

const userModel = model<UserDocument>(DOCUMENT_NAME, userSchema)

export default userModel
