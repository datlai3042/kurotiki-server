/* eslint-disable no-extra-boolean-cast */
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { InferSchemaType } from 'mongoose'
import { AuthFailedError, ForbiddenError } from '~/Core/response.error'
import { asyncHandler } from '~/helpers/asyncHandler'
import { keyStoreSchema } from '~/models/keyStore.model'
import { userSchema } from '~/models/user.model'
import KeyStoreService from '~/services/keyStore.service'
import UserService from '~/services/user.service'
import { IJwtPayload } from '~/utils/provider.jwt'
interface IHEADER {
      CLIENT_ID: string
      AUTHORIZATION: string
}

export const HEADER: IHEADER = {
      CLIENT_ID: 'x-client-id',
      AUTHORIZATION: 'authorization'
}

// type user = InferSchemaType<typeof userSchema>
interface IKey {
      key: Pick<InferSchemaType<typeof keyStoreSchema>, 'public_key'>
}

// const key: IRequestCustom = { keyStore: {} }

export interface IRequestCustom<T = any> extends Request {
      user?: InferSchemaType<typeof userSchema>
      //   key: Pick<InferSchemaType<typeof keyStoreSchema>, 'public_key'>
      keyStore?: InferSchemaType<typeof keyStoreSchema>
      refresh_token?: string
      body: T
}

// type IParamsAuthentication = {}

export const authentication = asyncHandler(async (req: IRequestCustom, res: Response, next: NextFunction) => {
      const client_id = req.cookies['client_id'] as string
      const access_token = req.cookies['access_token'] as string

      const refresh_token = req.cookies['refresh_token'] as string
      if (!client_id || !access_token) {
            throw new ForbiddenError({ detail: 'Phiên đăng nhập hết hạn client' })
      }

      // tim user
      const user = await UserService.findUserById({ _id: client_id as string })
      if (!user) throw new ForbiddenError({ detail: 'Không tìm thấy tài khoản' })

      // tim key
      const keyStore = await KeyStoreService.findKeyByUserId({ user_id: user._id })
      if (!keyStore) throw new ForbiddenError({ detail: 'Phiên đăng nhập hết hạn key' })

      // case: refresh_token

      if (req.originalUrl === '/v1/api/auth/rf') {
            //console.log(([^)]+))
            if (!req?.cookies['refresh_token']) {
                  return next(new ForbiddenError({ detail: 'Token không đúng' }))
            }

            if (req?.cookies['refresh_token']) {
                  jwt.verify(refresh_token, keyStore.private_key, (error, decode) => {
                        if (error) {
                              // req.user = user
                              if (req.originalUrl === '/v1/api/auth/logout') {
                                    req.user = user
                                    return next()
                              }
                              return next(new ForbiddenError({ detail: 'Token không đúng' }))
                        }
                        //console.log(([^)]+))
                        const decodeType = decode as IJwtPayload
                        // if (decodeType._id !== client_id) throw new AuthFailedError({})
                        req.user = user
                        req.keyStore = keyStore
                        req.refresh_token = refresh_token
                  })
                  return next()
            }
      }
      // case authentication thông thường
      if (access_token) {
            jwt.verify(access_token, keyStore.public_key, (error, decode) => {
                  if (error) {
                        return next(new AuthFailedError({ detail: 'Token hết hạn' }))
                  }
                  const decodeType = decode as IJwtPayload
                  if (decodeType._id !== client_id) throw new AuthFailedError({ detail: 'client-id not match user' })
                  req.user = user
                  req.keyStore = keyStore
            })

            return next()
      }

      return next()
})

export default authentication
