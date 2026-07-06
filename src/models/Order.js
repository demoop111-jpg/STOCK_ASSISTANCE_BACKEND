import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    orderRequestId: { type: String, required: true, unique: true, index: true },
    productCode: { type: String, required: true, index: true },
    requestedQty: { type: Number, required: true },
    requestedUnit: { type: String, enum: ['PCS', 'BOX'], required: true },

    customerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, index: true },
    city: { type: String, required: true, trim: true },
    transportName: { type: String, required: true, trim: true },
    remark: { type: String, default: '' },

    availableStockAtBooking: { type: String, default: '' },
    status: { type: String, default: 'Pending Sales Confirmation' },

    whatsappMessage: { type: String, default: '' },
    whatsappLink: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Order', OrderSchema);
