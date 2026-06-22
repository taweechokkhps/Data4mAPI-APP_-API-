import { Router } from 'express';
import { getAllOrders, createOrder, getOrderById } from '../controllers/order.controller';

const router = Router();

router.get('/', getAllOrders);
router.post('/', createOrder);
router.get('/:id', getOrderById);

export default router;
