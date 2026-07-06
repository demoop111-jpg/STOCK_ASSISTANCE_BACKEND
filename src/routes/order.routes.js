import express from 'express';
import Counter from '../models/Counter.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import StockItem from '../models/StockItem.js';
import { cleanMobile, isValidMobile, normalizeCode } from '../utils/normalize.js';
import { buildSalespersonWhatsAppLink } from '../utils/whatsapp.js';

const router = express.Router();

async function getNextOrderId() {
  const prefix = process.env.ORDER_PREFIX || 'ORG';
  const counter = await Counter.findOneAndUpdate(
    { key: 'order' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${counter.seq}`;
}

function validateOrder(body) {
  const errors = [];
  const productCode = normalizeCode(body.productCode);
  const requestedQty = Number(body.requestedQty);
  const requestedUnit = String(body.requestedUnit || '').toUpperCase();
  const mobile = cleanMobile(body.mobile);

  if (!productCode) errors.push('Product code is required');
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) errors.push('Valid quantity is required');
  if (!['PCS', 'BOX'].includes(requestedUnit)) errors.push('Unit must be PCS or BOX');
  if (!body.customerName || String(body.customerName).trim().length < 2) errors.push('Customer name is required');
  if (!isValidMobile(mobile)) errors.push('Valid 10 digit mobile is required');
  if (!body.city || String(body.city).trim().length < 2) errors.push('City is required');
  if (!body.transportName || String(body.transportName).trim().length < 2) errors.push('Transport name is required');

  return { errors, productCode, requestedQty, requestedUnit, mobile };
}

router.post('/book', async (req, res) => {
  try {
    const { errors, productCode, requestedQty, requestedUnit, mobile } = validateOrder(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const stock = await StockItem.findOne({ normalizedCode: productCode });
    const availableStockAtBooking = req.body.availableStockAtBooking || stock?.quantityText || '';

    await Customer.findOneAndUpdate(
      { mobile },
      {
        name: String(req.body.customerName).trim(),
        mobile,
        city: String(req.body.city).trim()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const orderRequestId = await getNextOrderId();
    const orderBase = {
      orderRequestId,
      productCode,
      requestedQty,
      requestedUnit,
      customerName: String(req.body.customerName).trim(),
      mobile,
      city: String(req.body.city).trim(),
      transportName: String(req.body.transportName).trim(),
      remark: String(req.body.remark || '').trim(),
      availableStockAtBooking,
      status: 'Pending Sales Confirmation'
    };

    const whatsapp = buildSalespersonWhatsAppLink(orderBase);
    const order = await Order.create({ ...orderBase, ...whatsapp });

    res.status(201).json({
      success: true,
      orderRequestId: order.orderRequestId,
      status: order.status,
      whatsappLink: order.whatsappLink,
      whatsappMessage: order.whatsappMessage,
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Booking failed', error: error.message });
  }
});

router.get('/', async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, orders });
});

router.get('/:orderRequestId', async (req, res) => {
  const order = await Order.findOne({ orderRequestId: req.params.orderRequestId });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order });
});

export default router;
