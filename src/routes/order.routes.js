import express from 'express';
import Counter from '../models/Counter.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import StockItem from '../models/StockItem.js';
import { requireAuth } from '../middleware/auth.js';
import { getIndianDateTime } from '../utils/auth.js';
import { cleanMobile, isValidMobile, normalizeCode } from '../utils/normalize.js';
import { buildSalespersonWhatsAppLink } from '../utils/whatsapp.js';

const router = express.Router();
router.use(requireAuth);

async function getNextOrderId() {
  const prefix = process.env.ORDER_PREFIX || 'ORG';
  const counter = await Counter.findOneAndUpdate(
    { key: 'order' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${counter.seq}`;
}

function clientFields(req) {
  return {
    clientId: req.user?.id || '',
    clientName: req.user?.name || '',
    clientUsername: req.user?.username || ''
  };
}

function whatsappNumber() {
  return process.env.SALESPERSON_WHATSAPP || process.env.HELPDESK_WHATSAPP || '917623853955';
}

function buildBulkWhatsApp({ orderRequestId, clientName, transportName, items = [], orderDateIST = '' }) {
  const lines = [
    'New Bulk Order Request',
    '',
    `Order ID: ${orderRequestId}`,
    `Client: ${clientName}`,
    `Transport: ${transportName}`,
    `Date/Time: ${orderDateIST}`,
    '',
    'Selected Items:'
  ];

  items.forEach((item, index) => {
    const status = item.available
      ? `Available - Current: ${item.stockQty || 0} ${item.stockUnit || 'PCS'}`
      : `Short/Not Available - Current: ${item.stockQty || 0} ${item.stockUnit || 'PCS'}`;
    lines.push(`${index + 1}. ${item.displayCode || item.productCode} - Qty: ${item.requestedQty} PCS - ${status}`);
  });

  lines.push('', 'Please confirm this order.');

  const whatsappMessage = lines.join('\n');
  return {
    whatsappMessage,
    whatsappLink: `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(whatsappMessage)}`
  };
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

    const now = new Date();
    const orderRequestId = await getNextOrderId();
    const orderBase = {
      ...clientFields(req),
      orderRequestId,
      orderType: 'Single',
      productCode,
      requestedQty,
      requestedUnit,
      customerName: String(req.body.customerName).trim(),
      mobile,
      city: String(req.body.city).trim(),
      transportName: String(req.body.transportName).trim(),
      remark: String(req.body.remark || '').trim(),
      availableStockAtBooking,
      status: 'Pending Sales Confirmation',
      orderDate: now,
      orderDateIST: getIndianDateTime(now)
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

router.post('/bulk', async (req, res) => {
  try {
    const transportName = String(req.body.transportName || '').trim();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const rawResults = Array.isArray(req.body.results) ? req.body.results : [];

    if (transportName.length < 2) {
      return res.status(400).json({ success: false, message: 'Transport name is required' });
    }
    if (!rawItems.length) {
      return res.status(400).json({ success: false, message: 'At least one order item is required' });
    }

    const resultMap = new Map(rawResults.map((item) => [String(item.productCode || item.displayCode || ''), item]));
    const items = rawItems.map((item) => {
      const checked = resultMap.get(String(item.productCode || item.displayCode || '')) || {};
      return {
        productCode: item.productCode || checked.productCode || '',
        displayCode: item.displayCode || checked.displayCode || item.productCode || '',
        categoryId: item.categoryId || checked.categoryId || '',
        categoryName: item.categoryName || checked.categoryName || '',
        companyName: item.companyName || checked.companyName || '',
        requestedQty: Number(item.requestedQty || 0),
        requestedUnit: 'PCS',
        stockQty: Number(checked.stockQty || item.stockQty || 0),
        stockUnit: checked.stockUnit || item.stockUnit || 'PCS',
        quantityText: checked.quantityText || item.quantityText || '',
        available: Boolean(checked.available),
        message: checked.message || ''
      };
    });

    const now = new Date();
    const orderRequestId = await getNextOrderId();
    const client = clientFields(req);
    const orderDateIST = getIndianDateTime(now);
    const whatsapp = buildBulkWhatsApp({
      orderRequestId,
      clientName: client.clientName || 'Client',
      transportName,
      items,
      orderDateIST
    });

    const totalQty = items.reduce((sum, item) => sum + Number(item.requestedQty || 0), 0);
    const order = await Order.create({
      ...client,
      orderRequestId,
      orderType: 'Bulk',
      productCode: 'BULK_ORDER',
      requestedQty: totalQty,
      requestedUnit: 'PCS',
      customerName: client.clientName || 'Client',
      mobile: '',
      city: '',
      transportName,
      remark: String(req.body.remark || '').trim(),
      items,
      availableStockAtBooking: `${items.length} items checked`,
      status: 'Pending Sales Confirmation',
      orderDate: now,
      orderDateIST,
      ...whatsapp
    });

    res.status(201).json({
      success: true,
      orderRequestId: order.orderRequestId,
      status: order.status,
      whatsappLink: order.whatsappLink,
      whatsappMessage: order.whatsappMessage,
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Bulk order booking failed', error: error.message });
  }
});

router.get('/', async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { clientId: req.user.id };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, orders });
});

router.get('/:orderRequestId', async (req, res) => {
  const order = await Order.findOne({ orderRequestId: req.params.orderRequestId });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order });
});

export default router;
