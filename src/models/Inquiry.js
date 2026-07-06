import mongoose from 'mongoose';

const InquirySchema = new mongoose.Schema(
  {
    sessionId: { type: String, default: '', index: true },
    companyName: { type: String, default: '', index: true },
    categoryName: { type: String, default: '', index: true },
    productCode: { type: String, required: true, index: true },
    normalizedCode: { type: String, required: true, index: true },

    itemFound: { type: Boolean, default: false },
    requestedQty: { type: Number, default: null },
    requestedUnit: { type: String, enum: ['PCS', 'BOX', ''], default: '' },
    requestedPcs: { type: Number, default: null },
    pcsPerBox: { type: Number, default: null },

    stockQty: { type: Number, default: 0 },
    stockUnit: { type: String, default: 'NOS' },
    quantityText: { type: String, default: '' },

    available: { type: Boolean, default: false },
    stockStatus: { type: String, default: '' },
    responseMessage: { type: String, default: '' },

    source: { type: String, default: 'chat_frontend' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    inquiryDate: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: 'inquiries' }
);

export default mongoose.model('Inquiry', InquirySchema);
