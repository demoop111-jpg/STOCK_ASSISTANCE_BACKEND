import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    productCode: { type: String, default: '' },
    displayCode: { type: String, default: '' },
    categoryId: { type: String, default: '' },
    categoryName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    requestedQty: { type: Number, default: 0 },
    requestedUnit: { type: String, default: 'PCS' },
    stockQty: { type: Number, default: 0 },
    stockUnit: { type: String, default: 'PCS' },
    quantityText: { type: String, default: '' },
    available: { type: Boolean, default: false },
    message: { type: String, default: '' }
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderRequestId: { type: String, required: true, unique: true, index: true },
    orderType: { type: String, enum: ['Single', 'Bulk'], default: 'Single', index: true },

    clientId: { type: String, default: '', index: true },
    clientName: { type: String, default: '', index: true },
    clientUsername: { type: String, default: '', index: true },

    productCode: { type: String, required: true, index: true },
    requestedQty: { type: Number, required: true },
    requestedUnit: { type: String, enum: ['PCS', 'BOX'], required: true },

    customerName: { type: String, required: true, trim: true },
    mobile: { type: String, default: '', index: true },
    city: { type: String, default: '', trim: true },
    transportName: { type: String, required: true, trim: true },
    remark: { type: String, default: '' },

    items: { type: [OrderItemSchema], default: [] },
    availableStockAtBooking: { type: String, default: '' },
    status: { type: String, default: 'Pending Sales Confirmation' },

    whatsappMessage: { type: String, default: '' },
    whatsappLink: { type: String, default: '' },

    orderDate: { type: Date, default: Date.now, index: true },
    orderDateIST: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Order', OrderSchema);
