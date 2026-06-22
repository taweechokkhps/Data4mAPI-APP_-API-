import { Router } from 'express';
import { getAllProducts, getProductById, createProduct, getProductReviews } from '../controllers/product.controller';

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.get('/:id/reviews', getProductReviews);

export default router;
