import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, index: true },
    city: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Customer', CustomerSchema);
