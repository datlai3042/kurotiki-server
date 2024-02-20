import { NextFunction, Request, Response } from 'express'
import { OK } from '~/Core/response.success'
import CartService from '~/services/cart.service'

class CartController {
      static async addcart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.addCart(req) }).send(res)
      }

      static async getCountProductCart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.getCountProductCart(req) }).send(res)
      }

      static async getMyCart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.getMyCart(req) }).send(res)
      }

      static async changeQuantityProductCart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.changeQuantityProductCart(req) }).send(res)
      }

      static async selectAllCart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.selectAllCart(req) }).send(res)
      }

      static async selectOneCart(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.selectOneCart(req) }).send(res)
      }

      static async calculatorPrice(req: Request, res: Response, next: NextFunction) {
            new OK({ metadata: await CartService.calculatorPrice(req) }).send(res)
      }
}

export default CartController
