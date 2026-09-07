import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { DetectionSchedule, type IDetectionSchedule } from "@/models/DetectionSchedule";
import { getNextSequence, formatScheduleId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";

function toPublic(s: IDetectionSchedule) {
  return {
    id: s._id.toString(),
    scheduleId: s.scheduleId,
    name: s.name,
    timezone: s.timezone,
    windows: s.windows,
    exceptions: s.exceptions,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function listSchedules(organizationId: string) {
  await connectDB();
  const items = await DetectionSchedule.find(orgFilter(organizationId)).sort({ name: 1 });
  return items.map(toPublic);
}

export async function createSchedule(organizationId: string, data: {
  name: string;
  timezone?: string;
  windows?: IDetectionSchedule["windows"];
  exceptions?: IDetectionSchedule["exceptions"];
}) {
  await connectDB();
  const seq = await getNextSequence("schedule");
  const schedule = await DetectionSchedule.create({
    scheduleId: await formatScheduleId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    timezone: data.timezone ?? "UTC",
    windows: data.windows ?? [{ dayOfWeek: 1, startTime: "08:00", endTime: "18:00" }],
    exceptions: data.exceptions ?? [],
  });
  return toPublic(schedule);
}

export async function updateSchedule(organizationId: string, id: string, patch: Partial<IDetectionSchedule>) {
  await connectDB();
  const schedule = await DetectionSchedule.findOne(orgFilter(organizationId, { _id: id }));
  if (!schedule) return null;
  if (patch.name) schedule.name = patch.name;
  if (patch.timezone) schedule.timezone = patch.timezone;
  if (patch.windows) schedule.windows = patch.windows;
  if (patch.exceptions) schedule.exceptions = patch.exceptions;
  if (patch.status) schedule.status = patch.status as "ACTIVE" | "INACTIVE";
  await schedule.save();
  return toPublic(schedule);
}

export async function deleteSchedule(organizationId: string, id: string) {
  await connectDB();
  const result = await DetectionSchedule.deleteOne(orgFilter(organizationId, { _id: id }));
  return result.deletedCount > 0;
}

/** Returns true if current time is within active hours */
export function isWithinSchedule(schedule: IDetectionSchedule, at: Date = new Date()): boolean {
  if (schedule.status !== "ACTIVE") return false;

  const dateStr = at.toISOString().slice(0, 10);
  const exception = schedule.exceptions.find((e) => e.date === dateStr);
  if (exception?.closed) return false;

  const day = at.getDay();
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;

  return schedule.windows.some((w) => {
    if (w.dayOfWeek !== day) return false;
    return time >= w.startTime && time <= w.endTime;
  });
}

export async function isAfterHours(organizationId: string, scheduleId: string | null, at = new Date()): Promise<boolean> {
  if (!scheduleId) return false;
  await connectDB();
  const schedule = await DetectionSchedule.findOne(orgFilter(organizationId, { _id: scheduleId }));
  if (!schedule) return false;
  return !isWithinSchedule(schedule, at);
}
