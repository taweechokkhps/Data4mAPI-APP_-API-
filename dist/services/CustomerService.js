"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const AppError_1 = require("../utils/AppError");
class CustomerService {
    customerRepo;
    constructor(customerRepo) {
        this.customerRepo = customerRepo;
    }
    async getCustomerWithRecentOrders(id) {
        const customer = await this.customerRepo.getByIdWithOrders(id);
        if (!customer) {
            throw new AppError_1.AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
        }
        return customer;
    }
}
exports.CustomerService = CustomerService;
