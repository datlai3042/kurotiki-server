import keyStoreModel from '~/models/keyStore.model'

interface IKeyStore {
      user_id: string
      public_key: string
      private_key: string
      refresh_token: string
      refresh_token_used?: string[]
      access_token: string
}

class KeyStoreService {
      static async findKeyByUserId({ user_id }: { user_id: string }) {
            const foundKey = await keyStoreModel.findOne({ user_id }).lean()
            return foundKey ? foundKey : null
      }

      static async createKeyStoreUser({
            user_id,
            private_key,
            public_key,
            refresh_token,
            access_token,
            refresh_token_used = []
      }: IKeyStore) {
            const keyStore = keyStoreModel.create({
                  user_id,
                  private_key,
                  public_key,
                  refresh_token,
                  access_token,

                  refresh_token_used
            })

            if (!keyStore) throw Error('Create key faild')

            return (await keyStore).toObject()
      }

      static async updateKey() {}

      static async deleteKeyStore({ user_id }: Pick<IKeyStore, 'user_id'>) {
            const del = await keyStoreModel.deleteOne({ user_id })
            console.log('del', del)
            return del
      }

      static async findKeyByRf({ refresh_token }: Pick<IKeyStore, 'refresh_token'>) {
            const foundKey = await keyStoreModel.findOne({ refresh_token })
            return foundKey ? foundKey : null
      }
}

export default KeyStoreService
