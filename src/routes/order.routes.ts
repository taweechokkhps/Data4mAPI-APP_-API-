import { Router } from 'express';
import { getAllOrders } from '../controllers/order.controller';

const router = Router();

router.get('/', getAllOrders);

export default router;
