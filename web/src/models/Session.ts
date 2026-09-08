import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenLookup: string;
  rememberMe: boolean;
  userAgent: string;
  ipAddress: string;
  lastActivity: Date;
  expiresAt: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenLookup: { type: String, required: true, unique: true },
    rememberMe: { type: Boolean, default: false },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "unknown" },
    lastActivity: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isValid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  mongoose.models.Session ?? mongoose.model<ISession>("Session", SessionSchema);
