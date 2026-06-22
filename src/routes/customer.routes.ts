import { Router } from 'express';
import { getCustomer } from '../controllers/customer.controller';

const router = Router();

router.get('/:id', getCustomer);

export default router;
