import { Router } from 'express'
import { upload } from '~/configs/cloundinary.config'
import ProductController from '~/controllers/product.controller'
import { asyncHandler } from '~/helpers/asyncHandler'
import authentication from '~/middlewares/authentication'

const productRouter = Router()
productRouter.use(authentication)
productRouter.post('/upload-product-thumb', upload.single('image'), asyncHandler(ProductController.uploadProductThumb))
productRouter.post('/upload-product-full', asyncHandler(ProductController.uploadProductFull))
productRouter.get('/shop-product-all', asyncHandler(ProductController.getAllProduct))
productRouter.post('/delete-product-thumb', asyncHandler(ProductController.deleteProductThumb))

export default productRouter
