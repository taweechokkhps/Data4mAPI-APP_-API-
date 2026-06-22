import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import customerRoutes from './routes/customer.routes';
import orderRoutes from './routes/order.routes';

const app = express();

app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

// API Routes will be registered here
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
// Global error handler must be last
app.use(errorHandler);

export default app;
