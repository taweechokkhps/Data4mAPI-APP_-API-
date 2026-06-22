import { Router } from 'express';
import { getCustomer, getAllCustomers, createCustomer } from '../controllers/customer.controller';

const router = Router();

router.get('/', getAllCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);

export default router;
