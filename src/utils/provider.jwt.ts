import jwt from 'jsonwebtoken'

export interface JwtPayload {
      email: string
      _id: string
}

interface IKeySecret {
      public_key: string
      private_key: string
}

export interface IToken {
      access_token: string
      refresh_token: string
}

class ProviderJWT {
      static createPairToken({ payload, key }: { payload: JwtPayload; key: IKeySecret }): IToken | unknown {
            try {
                  const access_token = jwt.sign(payload, key.public_key, { expiresIn: '2d' })
                  const refresh_token = jwt.sign(payload, key.private_key, { expiresIn: '7d' })
                  console.log(refresh_token)
                  return { access_token, refresh_token }
            } catch (e) {
                  console.log('e:', e)
                  return e
            }
      }
}

export default ProviderJWT
