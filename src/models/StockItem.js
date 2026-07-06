import mongoose from 'mongoose';

const StockItemSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: '', index: true },
    categoryName: { type: String, default: '', index: true },
    productCode: { type: String, required: true, index: true },
    normalizedCode: { type: String, required: true, index: true },
    tallyStockName: { type: String, required: true },
    godownName: { type: String, default: '', index: true },
    stockQty: { type: Number, default: 0 },
    stockUnit: { type: String, default: '' },
    quantityText: { type: String, default: '0' },
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Item Not Found'],
      default: 'Out of Stock'
    },
    closingValue: { type: String, default: '' },
    closingRate: { type: String, default: '' },
    source: { type: String, default: 'tally_stock_summary' },
    lastSyncAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'stockitems' }
);

StockItemSchema.index(
  { companyName: 1, categoryName: 1, godownName: 1, normalizedCode: 1 },
  { unique: true }
);

export default mongoose.model('StockItem', StockItemSchema);
