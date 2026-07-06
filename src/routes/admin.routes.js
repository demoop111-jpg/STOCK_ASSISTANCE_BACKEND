import express from 'express';
import StockItem from '../models/StockItem.js';
import Order from '../models/Order.js';
import Inquiry from '../models/Inquiry.js';

const router = express.Router();

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

router.get('/dashboard', async (req, res) => {
  const today = startOfToday();

  const [stockItems, orders, inquiries, todayInquiries, latestStock, topInquiryItems] = await Promise.all([
    StockItem.countDocuments(),
    Order.countDocuments(),
    Inquiry.countDocuments(),
    Inquiry.countDocuments({ createdAt: { $gte: today } }),
    StockItem.findOne().sort({ lastSyncAt: -1 }),
    Inquiry.aggregate([
      { $group: { _id: '$normalizedCode', productCode: { $first: '$productCode' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  res.json({
    success: true,
    counts: { stockItems, orders, inquiries, todayInquiries },
    lastStockSyncAt: latestStock?.lastSyncAt || null,
    topInquiryItems
  });
});

router.get('/inquiries', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const inquiries = await Inquiry.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, inquiries });
});

router.get('/stock-items', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const search = String(req.query.search || '').trim().toUpperCase();
  const filter = search
    ? { $or: [{ normalizedCode: { $regex: search, $options: 'i' } }, { productCode: { $regex: search, $options: 'i' } }] }
    : {};
  const stockItems = await StockItem.find(filter).sort({ productCode: 1 }).limit(limit);
  res.json({ success: true, stockItems });
});

export default router;
