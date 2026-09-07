import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { EventFeedback } from "@/models/EventFeedback";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import type { FeedbackType } from "@/lib/ai/constants";

export async function submitEventFeedback(
  organizationId: string,
  eventId: string,
  user: { id: string; name: string },
  input: { feedbackType: FeedbackType; reason?: string; useful?: boolean | null }
) {
  await connectDB();
  const event = await Event.findOne(orgFilter(organizationId, { _id: eventId }));
  if (!event) return null;

  const feedback = await EventFeedback.findOneAndUpdate(
    { eventId: new mongoose.Types.ObjectId(eventId), userId: new mongoose.Types.ObjectId(user.id) },
    {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      eventId: new mongoose.Types.ObjectId(eventId),
      userId: new mongoose.Types.ObjectId(user.id),
      userName: user.name,
      feedbackType: input.feedbackType,
      reason: input.reason ?? "",
      useful: input.useful ?? null,
    },
    { upsert: true, new: true }
  );

  if (input.feedbackType === "FALSE_POSITIVE") {
    event.status = "FALSE_POSITIVE";
    await event.save();
  }

  return {
    id: feedback._id.toString(),
    feedbackType: feedback.feedbackType,
    reason: feedback.reason,
    useful: feedback.useful,
    createdAt: feedback.createdAt.toISOString(),
  };
}
