import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IEmergencyContact extends Document {
  _id: Types.ObjectId;
  contactId: string;
  organizationId: Types.ObjectId;
  name: string;
  department: string;
  role: string;
  phone: string;
  email: string;
  availability: string;
  priority: number;
  enabled: boolean;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    contactId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, default: "" },
    role: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    availability: { type: String, default: "24/7" },
    priority: { type: Number, default: 1, min: 1, max: 10 },
    enabled: { type: Boolean, default: true },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

EmergencyContactSchema.index({ organizationId: 1, priority: 1 });

export const EmergencyContact: Model<IEmergencyContact> =
  mongoose.models.EmergencyContact ??
  mongoose.model<IEmergencyContact>("EmergencyContact", EmergencyContactSchema);
