import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const INQUIRY_STATUSES = ["NEW", "REVIEWED", "CONTACTED", "CLOSED"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export interface IPurchaseInquiry extends Document {
  _id: Types.ObjectId;
  inquiryId: string;
  name: string;
  email: string;
  phone: string;
  organizationName: string;
  campusType: string;
  estimatedCameras: string;
  requirements: string;
  status: InquiryStatus;
  readAt: Date | null;
  notes: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseInquirySchema = new Schema<IPurchaseInquiry>(
  {
    inquiryId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    organizationName: { type: String, required: true, trim: true, maxlength: 200 },
    campusType: { type: String, default: "", trim: true, maxlength: 80 },
    estimatedCameras: { type: String, default: "", trim: true, maxlength: 40 },
    requirements: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: INQUIRY_STATUSES, default: "NEW", index: true },
    readAt: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 2000 },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

PurchaseInquirySchema.index({ createdAt: -1 });
PurchaseInquirySchema.index({ status: 1, createdAt: -1 });

export const PurchaseInquiry: Model<IPurchaseInquiry> =
  mongoose.models.PurchaseInquiry ??
  mongoose.model<IPurchaseInquiry>("PurchaseInquiry", PurchaseInquirySchema);
