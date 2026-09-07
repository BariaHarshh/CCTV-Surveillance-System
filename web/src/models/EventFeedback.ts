import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { FEEDBACK_TYPES } from "@/lib/ai/constants";

export interface IEventFeedback extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  feedbackType: (typeof FEEDBACK_TYPES)[number];
  reason: string;
  useful: boolean | null;
  createdAt: Date;
}

const EventFeedbackSchema = new Schema<IEventFeedback>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    feedbackType: { type: String, enum: FEEDBACK_TYPES, required: true },
    reason: { type: String, default: "", maxlength: 1000 },
    useful: { type: Boolean, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EventFeedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const EventFeedback: Model<IEventFeedback> =
  mongoose.models.EventFeedback ?? mongoose.model<IEventFeedback>("EventFeedback", EventFeedbackSchema);
