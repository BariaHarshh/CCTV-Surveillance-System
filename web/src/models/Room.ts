import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const ROOM_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export interface IRoom extends Document {
  _id: Types.ObjectId;
  roomId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId;
  floor: number;
  name: string;
  roomNumber: string;
  code: string;
  type: string;
  maxCapacity: number;
  normalCapacity: number;
  purpose: string;
  status: RoomStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building", required: true, index: true },
    floor: { type: Number, default: 1, min: 0 },
    name: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    maxCapacity: { type: Number, default: 0, min: 0 },
    normalCapacity: { type: Number, default: 0, min: 0 },
    purpose: { type: String, default: "" },
    status: { type: String, enum: ROOM_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

RoomSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const Room: Model<IRoom> =
  mongoose.models.Room ?? mongoose.model<IRoom>("Room", RoomSchema);
