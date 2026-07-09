import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    salesPersonMobile: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
    lastLoginAtIST: { type: String, default: '' }
  },
  { timestamps: true, collection: 'users' }
);

UserSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.passwordSalt;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', UserSchema);
