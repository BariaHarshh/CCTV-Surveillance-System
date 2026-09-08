import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IEmergencyMessage extends Document {
  _id: Types.ObjectId;
  messageId: string;
  organizationId: Types.ObjectId;
  emergencyId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  message: string;
  editedAt: Date | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyMessageSchema = new Schema<IEmergencyMessage>(
  {
    messageId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    emergencyId: { type: Schema.Types.ObjectId, ref: "Emergency", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true, maxlength: 2000 },
    editedAt: { type: Date, default: null },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

EmergencyMessageSchema.index({ organizationId: 1, emergencyId: 1, createdAt: 1 });

export const EmergencyMessage: Model<IEmergencyMessage> =
  mongoose.models.EmergencyMessage ??
  mongoose.model<IEmergencyMessage>("EmergencyMessage", EmergencyMessageSchema);
