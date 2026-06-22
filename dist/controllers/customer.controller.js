"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomer = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const CustomerService_1 = require("../services/CustomerService");
const CustomerRepository_1 = require("../repositories/CustomerRepository");
// Manually initialize the dependencies and inject them
const customerRepo = new CustomerRepository_1.CustomerRepository();
const customerService = new CustomerService_1.CustomerService(customerRepo);
exports.getCustomer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.id);
    const customer = await customerService.getCustomerWithRecentOrders(id);
    res.status(200).json({ success: true, data: customer });
});
