import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IScheduleWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface IScheduleException {
  date: string;
  label: string;
  closed: boolean;
}

export interface IDetectionSchedule extends Document {
  _id: Types.ObjectId;
  scheduleId: string;
  organizationId: Types.ObjectId;
  name: string;
  timezone: string;
  windows: IScheduleWindow[];
  exceptions: IScheduleException[];
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const WindowSchema = new Schema<IScheduleWindow>(
  { dayOfWeek: Number, startTime: String, endTime: String },
  { _id: false }
);

const ExceptionSchema = new Schema<IScheduleException>(
  { date: String, label: String, closed: Boolean },
  { _id: false }
);

const DetectionScheduleSchema = new Schema<IDetectionSchedule>(
  {
    scheduleId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    timezone: { type: String, default: "UTC" },
    windows: { type: [WindowSchema], default: [] },
    exceptions: { type: [ExceptionSchema], default: [] },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

export const DetectionSchedule: Model<IDetectionSchedule> =
  mongoose.models.DetectionSchedule ??
  mongoose.model<IDetectionSchedule>("DetectionSchedule", DetectionScheduleSchema);
