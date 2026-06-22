"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const AppError_1 = require("../utils/AppError");
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    if (err instanceof AppError_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: { message: err.message, code: err.code },
        });
    }
    // Unknown error — do not leak details to client
    console.error('[Unhandled Error]', err);
    return res.status(500).json({
        success: false,
        error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    });
};
exports.errorHandler = errorHandler;
