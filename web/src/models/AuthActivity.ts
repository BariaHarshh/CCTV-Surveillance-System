import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { AuthActivityType } from "@/lib/auth/config";

export interface IAuthActivity extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  type: AuthActivityType;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuthActivitySchema = new Schema<IAuthActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    type: {
      type: String,
      enum: [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGOUT",
        "ACCOUNT_LOCKED",
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_CHANGED",
      ],
      required: true,
    },
    ipAddress: { type: String, default: "unknown" },
    userAgent: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AuthActivitySchema.index({ createdAt: -1 });

export const AuthActivity: Model<IAuthActivity> =
  mongoose.models.AuthActivity ??
  mongoose.model<IAuthActivity>("AuthActivity", AuthActivitySchema);
