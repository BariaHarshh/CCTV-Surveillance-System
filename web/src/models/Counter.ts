import mongoose, { Schema, type Model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<ICounter> =
  mongoose.models.Counter ?? mongoose.model<ICounter>("Counter", CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

export async function formatOrgId(seq: number): Promise<string> {
  return `ORG-${String(seq).padStart(6, "0")}`;
}

export async function formatAdminId(seq: number): Promise<string> {
  return `ADM-${String(seq).padStart(6, "0")}`;
}

export async function formatStaffId(seq: number): Promise<string> {
  return `STF-${String(seq).padStart(6, "0")}`;
}

export async function formatBuildingId(seq: number): Promise<string> {
  return `BLD-${String(seq).padStart(6, "0")}`;
}

export async function formatRoomId(seq: number): Promise<string> {
  return `ROOM-${String(seq).padStart(6, "0")}`;
}

export async function formatCameraId(seq: number): Promise<string> {
  return `CAM-${String(seq).padStart(6, "0")}`;
}

export async function formatCampusId(seq: number): Promise<string> {
  return `CMP-${String(seq).padStart(6, "0")}`;
}

export async function formatEventId(seq: number): Promise<string> {
  return `EVT-${String(seq).padStart(6, "0")}`;
}

export async function formatAlertId(seq: number): Promise<string> {
  return `ALT-${String(seq).padStart(6, "0")}`;
}

export async function formatNotificationId(seq: number): Promise<string> {
  return `NTF-${String(seq).padStart(6, "0")}`;
}

export async function formatInquiryId(seq: number): Promise<string> {
  return `INQ-${String(seq).padStart(6, "0")}`;
}

export async function formatIncidentId(seq: number): Promise<string> {
  return `INC-${String(seq).padStart(6, "0")}`;
}

export async function formatZoneId(seq: number): Promise<string> {
  return `ZON-${String(seq).padStart(6, "0")}`;
}

export async function formatScheduleId(seq: number): Promise<string> {
  return `SCH-${String(seq).padStart(6, "0")}`;
}

export async function formatEmergencyId(seq: number): Promise<string> {
  return `EMG-${String(seq).padStart(6, "0")}`;
}

export async function formatTeamId(seq: number): Promise<string> {
  return `TEM-${String(seq).padStart(6, "0")}`;
}

export async function formatTaskId(seq: number): Promise<string> {
  return `TSK-${String(seq).padStart(6, "0")}`;
}

export async function formatPlaybookId(seq: number): Promise<string> {
  return `PBK-${String(seq).padStart(6, "0")}`;
}

export async function formatEscalationRuleId(seq: number): Promise<string> {
  return `ESC-${String(seq).padStart(6, "0")}`;
}

export async function formatContactId(seq: number): Promise<string> {
  return `ECT-${String(seq).padStart(6, "0")}`;
}

export async function formatMessageId(seq: number): Promise<string> {
  return `MSG-${String(seq).padStart(6, "0")}`;
}

export async function formatPatternId(seq: number): Promise<string> {
  return `PAT-${String(seq).padStart(6, "0")}`;
}

export async function formatActionId(seq: number): Promise<string> {
  return `ACT-${String(seq).padStart(6, "0")}`;
}

export async function formatReportId(seq: number): Promise<string> {
  return `RPT-${String(seq).padStart(6, "0")}`;
}

export async function formatInsightId(seq: number): Promise<string> {
  return `INS-${String(seq).padStart(6, "0")}`;
}

export async function formatExportId(seq: number): Promise<string> {
  return `EXP-${String(seq).padStart(6, "0")}`;
}
