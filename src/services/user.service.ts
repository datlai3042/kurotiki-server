import userModel, { UserDocument } from '~/models/user.model'
import bcrypt from 'bcrypt'
import mongoose, { Types } from 'mongoose'
import { BadRequestError, NotFoundError } from '~/Core/response.error'

type UserInfo = {
      email: string
      password: string
}

class UserService {
      static async createUser({ email, password }: UserInfo) {
            const hashPassword = await bcrypt.hash(password, 8)
            const user = await userModel.create({ email, password: hashPassword })

            if (!user) throw Error('Tạo user thất bại')
            return user // object
      }

      static async findUserByEmail({ email }: Pick<UserInfo, 'email'>) {
            const foundEmail = await userModel.findOne({ email }).lean()
            return foundEmail ? foundEmail : null
      }

      static async findUserById({ _id }: { _id: string }) {
            const user = await userModel.findOne({ _id: new mongoose.Types.ObjectId(_id) }).lean()
            return user
      }
}

export default UserService
