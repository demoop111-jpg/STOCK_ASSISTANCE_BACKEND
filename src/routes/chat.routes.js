import express from 'express';
import StockItem from '../models/StockItem.js';
import StockBatch from '../models/StockBatch.js';
import Inquiry from '../models/Inquiry.js';
import { normalizeCode, normalizeSearchCode } from '../utils/normalize.js';
import { buildAvailabilityMessage, calculateRequiredPcs } from '../utils/stockRules.js';
import {
  PRODUCT_CATEGORIES,
  getCategoryById,
  getCategoryByName,
  isBatchAllowed,
  itemGroupKey,
  itemMatchesSearch,
  stockItemPayload
} from '../utils/productRules.js';

const router = express.Router();

function requestMeta(req) {
  return {
    sessionId: String(req.body.sessionId || req.headers['x-session-id'] || ''),
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

async function logInquiry(data) {
  try {
    await Inquiry.create({ inquiryDate: new Date(), ...data });
  } catch (error) {
    console.warn('Inquiry log failed:', error.message);
  }
}

function getBaseProductCode(code = '') {
  return normalizeSearchCode(code)
    .replace(/95FT$/i, '')
    .replace(/8FT$/i, '')
    .trim();
}

function getVariantLabel(productCode = '') {
  const code = normalizeCode(productCode);

  if (/\(\s*9\.5\s*FT\s*\)/i.test(code)) {
    return '9.5 Feet';
  }

  return '8 Feet';
}

function sortVariants(a, b) {
  if (a.label.startsWith('8 Feet')) return -1;
  if (b.label.startsWith('8 Feet')) return 1;
  return a.label.localeCompare(b.label);
}

function contextFilter(body = {}) {
  const filter = {};

  for (const key of ['companyName', 'categoryName', 'godownName']) {
    if (body[key]) filter[key] = String(body[key]).trim();
  }

  if (body.categoryId) {
    const category = getCategoryById(body.categoryId);
    if (category) {
      filter.companyName = category.companyName;
      filter.categoryName = category.categoryName;
    }
  }

  return filter;
}

async function withBatchFlag(payload) {
  if (!payload?.hasBatches) return { ...payload, hasBatches: false, batchCount: 0 };

  const count = await StockBatch.countDocuments({
    companyName: payload.companyName || '',
    categoryName: payload.categoryName || '',
    normalizedCode: payload.normalizedCode,
    godownName: payload.godownName || '',
    stockQty: { $gt: 0 }
  });

  return { ...payload, hasBatches: count > 0, batchCount: count };
}

async function findMatchingItems(productCode, filter = {}) {
  const query = normalizeSearchCode(productCode);
  const baseCode = getBaseProductCode(productCode);
  const allItems = await StockItem.find(filter).lean();

  return allItems.filter((item) => {
    if (!query) return false;

    const normalizedProduct = normalizeSearchCode(item.productCode);
    const normalizedName = normalizeSearchCode(item.tallyStockName || '');
    const normalizedDisplay = normalizeSearchCode(stockItemPayload(item).displayCode);
    const itemBaseCode = getBaseProductCode(item.productCode);

    return (
      normalizedProduct === query ||
      normalizedName === query ||
      normalizedDisplay === query ||
      itemBaseCode === baseCode ||
      normalizedProduct.startsWith(query) ||
      normalizedDisplay.startsWith(query)
    );
  });
}

function groupCatalogItems(items = []) {
  const groups = new Map();

  for (const item of items) {
    const payload = stockItemPayload(item);
    const key = payload.groupKey || 'OTHER';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(payload);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, groupItems]) => ({
      key,
      label: key,
      totalItems: groupItems.length,
      items: groupItems.sort((a, b) => a.displayCode.localeCompare(b.displayCode, undefined, { numeric: true }))
    }));
}

router.get('/product-categories', (req, res) => {
  res.json({ success: true, categories: PRODUCT_CATEGORIES });
});

router.get('/bulk-catalog', async (req, res) => {
  try {
    const categories = [];

    for (const category of PRODUCT_CATEGORIES) {
      const rawItems = await StockItem.find({
        companyName: category.companyName,
        categoryName: category.categoryName
      })
        .sort({ productCode: 1 })
        .lean();

      categories.push({
        ...category,
        totalItems: rawItems.length,
        groups: groupCatalogItems(rawItems)
      });
    }

    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Bulk catalog failed', error: error.message });
  }
});

router.post('/search-items', async (req, res) => {
  try {
    const category = getCategoryById(req.body.categoryId) || getCategoryByName(req.body.categoryName);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Valid category is required' });
    }

    const query = String(req.body.query || '').trim();
    const groupKey = String(req.body.groupKey || '').trim().toUpperCase();

    const rawItems = await StockItem.find({
      companyName: category.companyName,
      categoryName: category.categoryName
    }).lean();

    const items = rawItems
      .map(stockItemPayload)
      .filter((item) => !groupKey || item.groupKey === groupKey)
      .filter((item) => itemMatchesSearch(item, query))
      .sort((a, b) => a.displayCode.localeCompare(b.displayCode, undefined, { numeric: true }));

    res.json({ success: true, category, totalItems: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Item search failed', error: error.message });
  }
});

router.post('/check-stock', async (req, res) => {
  try {
    const productCode = normalizeCode(req.body.productCode);
    if (!productCode) {
      return res.status(400).json({ success: false, message: 'productCode is required' });
    }

    const filter = contextFilter(req.body);
    const matchedItems = await findMatchingItems(productCode, filter);

    if (!matchedItems.length) {
      await logInquiry({
        ...requestMeta(req),
        productCode,
        normalizedCode: productCode,
        itemFound: false,
        available: false,
        stockStatus: 'Item Not Found',
        responseMessage: 'Item Not Found'
      });

      return res.json({
        success: true,
        productCode,
        available: false,
        quantityText: 'Not found',
        stockStatus: 'Item Not Found',
        hasBatches: false
      });
    }

    const variants = await Promise.all(matchedItems.map(async (item) => {
      const payload = stockItemPayload(item);
      const sizeLabel = item.categoryName === 'Louvers' ? getVariantLabel(item.productCode) : payload.displayCode;
      const contextLabel = [payload.companyName, payload.categoryName].filter(Boolean).join(' - ');
      const label = contextLabel ? `${sizeLabel} (${contextLabel})` : sizeLabel;
      return withBatchFlag({ ...payload, label });
    }));

    variants.sort(sortVariants);

    if (variants.length > 1) {
      return res.json({
        success: true,
        needsVariantSelection: true,
        message: 'Please select item',
        baseCode: getBaseProductCode(productCode),
        variants
      });
    }

    return res.json({
      success: true,
      needsVariantSelection: false,
      ...variants[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Stock check failed', error: error.message });
  }
});

router.post('/check-stock-batches', async (req, res) => {
  try {
    const productCode = normalizeCode(req.body.productCode);

    if (!productCode) {
      return res.status(400).json({ success: false, message: 'productCode is required' });
    }

    const filter = {
      ...contextFilter(req.body),
      stockQty: { $gt: 0 }
    };

    if (filter.categoryName && !isBatchAllowed(filter)) {
      return res.json({ success: true, productCode, totalBatches: 0, batches: [] });
    }

    const allBatches = await StockBatch.find(filter).sort({ companyName: 1, categoryName: 1, batchCode: 1 }).lean();
    const searchCode = normalizeSearchCode(productCode);

    const batches = allBatches.filter((batch) => {
      return normalizeSearchCode(batch.productCode) === searchCode ||
        normalizeSearchCode(batch.normalizedCode) === searchCode ||
        normalizeSearchCode(batch.productCode).startsWith(searchCode);
    });

    return res.json({
      success: true,
      productCode,
      totalBatches: batches.length,
      batches: batches.map((batch) => ({
        companyName: batch.companyName || '',
        categoryName: batch.categoryName || '',
        godownName: batch.godownName || '',
        batchCode: batch.batchCode,
        stockQty: batch.stockQty,
        stockUnit: batch.stockUnit || 'Nos.',
        quantityText: batch.quantityText || `${batch.stockQty} ${batch.stockUnit || 'Nos.'}`,
        stockStatus: batch.stockStatus,
        lastSyncAt: batch.lastSyncAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Batch check failed', error: error.message });
  }
});

router.post('/check-availability', async (req, res) => {
  try {
    const productCode = normalizeCode(req.body.productCode);
    const requestedUnit = String(req.body.requestedUnit || 'PCS').toUpperCase();
    const requestedQty = Number(req.body.requestedQty);

    if (!productCode) {
      return res.status(400).json({ success: false, message: 'productCode is required' });
    }

    const calculation = calculateRequiredPcs(productCode, requestedQty, requestedUnit);
    if (calculation.error) {
      return res.status(400).json({ success: false, message: calculation.error });
    }

    const matchedItems = await findMatchingItems(productCode, contextFilter(req.body));
    const item = matchedItems[0];

    if (!item) {
      const responseMessage = 'Item Not Found';
      await logInquiry({
        ...requestMeta(req),
        productCode,
        normalizedCode: productCode,
        itemFound: false,
        requestedQty: calculation.requestedQty,
        requestedUnit: calculation.requestedUnit,
        requestedPcs: calculation.requestedPcs,
        pcsPerBox: calculation.pcsPerBox,
        available: false,
        stockStatus: 'Item Not Found',
        responseMessage
      });

      return res.json({ success: true, productCode, available: false, stockStatus: 'Item Not Found', responseMessage });
    }

    const available = Number(item.stockQty || 0) >= calculation.requestedPcs;
    const responseMessage = buildAvailabilityMessage({
      productCode: item.productCode,
      requestedQty: calculation.requestedQty,
      requestedUnit: calculation.requestedUnit,
      available,
      stockQty: item.stockQty,
      pcsPerBox: calculation.pcsPerBox
    });

    await logInquiry({
      ...requestMeta(req),
      companyName: item.companyName || '',
      categoryName: item.categoryName || '',
      productCode: item.productCode,
      normalizedCode: item.normalizedCode,
      itemFound: true,
      requestedQty: calculation.requestedQty,
      requestedUnit: calculation.requestedUnit,
      requestedPcs: calculation.requestedPcs,
      pcsPerBox: calculation.pcsPerBox,
      stockQty: item.stockQty,
      stockUnit: item.stockUnit || 'NOS',
      quantityText: item.quantityText,
      available,
      stockStatus: item.stockStatus,
      responseMessage
    });

    const payload = stockItemPayload(item);
    return res.json({
      success: true,
      ...payload,
      available,
      requestedQty: calculation.requestedQty,
      requestedUnit: calculation.requestedUnit,
      requestedPcs: calculation.requestedPcs,
      pcsPerBox: calculation.pcsPerBox,
      responseMessage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Availability check failed', error: error.message });
  }
});

router.post('/check-bulk-stock', async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (!rawItems.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const results = [];

    for (const raw of rawItems) {
      const requestedQty = Number(raw.requestedQty || raw.qty || 0);
      const productCode = normalizeCode(raw.productCode || raw.displayCode || '');
      const category = getCategoryById(raw.categoryId) || getCategoryByName(raw.categoryName);

      if (!productCode || !Number.isFinite(requestedQty) || requestedQty <= 0 || !category) {
        results.push({
          productCode: productCode || raw.productCode || '',
          displayCode: raw.displayCode || productCode,
          requestedQty,
          available: false,
          found: false,
          message: 'Invalid item/category/quantity'
        });
        continue;
      }

      const matches = await findMatchingItems(productCode, {
        companyName: category.companyName,
        categoryName: category.categoryName
      });

      const item = matches[0];

      if (!item) {
        results.push({
          ...raw,
          categoryId: category.id,
          categoryName: category.categoryName,
          companyName: category.companyName,
          requestedQty,
          available: false,
          found: false,
          stockQty: 0,
          shortageQty: requestedQty,
          message: 'Item not found'
        });
        continue;
      }

      const payload = stockItemPayload(item);
      const stockQty = Number(item.stockQty || 0);
      const available = stockQty >= requestedQty;

      results.push({
        ...payload,
        categoryId: category.id,
        requestedQty,
        requestedUnit: 'PCS',
        available,
        found: true,
        shortageQty: available ? 0 : Math.max(0, requestedQty - stockQty),
        message: available ? 'Available' : `Only ${stockQty} ${item.stockUnit || 'PCS'} available`
      });
    }

    const availableItems = results.filter((item) => item.available);
    const notAvailableItems = results.filter((item) => !item.available);

    res.json({
      success: true,
      totalItems: results.length,
      availableCount: availableItems.length,
      notAvailableCount: notAvailableItems.length,
      items: results,
      availableItems,
      notAvailableItems
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Bulk stock check failed', error: error.message });
  }
});

export default router;
