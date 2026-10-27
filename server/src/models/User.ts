import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true, versionKey: false });

export interface UserRecord extends mongoose.Document {
  name: string;
  email: string;
  passwordHash: string;
}

export const UserModel = mongoose.model<UserRecord>('User', UserSchema);
