import mongoose from 'mongoose';

const StockBatchSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: '', index: true },
    categoryName: { type: String, default: '', index: true },
    productCode: { type: String, required: true, index: true },
    normalizedCode: { type: String, required: true, index: true },
    tallyStockName: { type: String, default: '' },
    batchCode: { type: String, required: true, index: true },
    godownName: { type: String, required: true, index: true },
    stockQty: { type: Number, default: 0 },
    stockUnit: { type: String, default: 'Nos.' },
    quantityText: { type: String, default: '0 Nos.' },
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Item Not Found'],
      default: 'Out of Stock'
    },
    source: { type: String, default: 'tally_stock_summary' },
    lastSyncAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'stockbatches' }
);

StockBatchSchema.index(
  { companyName: 1, categoryName: 1, normalizedCode: 1, batchCode: 1, godownName: 1 }
);

export default mongoose.model('StockBatch', StockBatchSchema);
