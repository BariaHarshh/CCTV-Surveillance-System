import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const CAMPUS_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CampusStatus = (typeof CAMPUS_STATUSES)[number];

export interface ICampusCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface ICampus extends Document {
  _id: Types.ObjectId;
  campusId: string;
  organizationId: Types.ObjectId;
  name: string;
  type: string;
  address: string;
  coordinates: ICampusCoordinates;
  students: number;
  faculty: number;
  securityPersonnel: number;
  status: CampusStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CoordinatesSchema = new Schema<ICampusCoordinates>(
  { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  { _id: false }
);

const CampusSchema = new Schema<ICampus>(
  {
    campusId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    address: { type: String, default: "" },
    coordinates: { type: CoordinatesSchema, default: () => ({ lat: null, lng: null }) },
    students: { type: Number, default: 0, min: 0 },
    faculty: { type: Number, default: 0, min: 0 },
    securityPersonnel: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: CAMPUS_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

CampusSchema.index({ organizationId: 1 });

export const Campus: Model<ICampus> =
  mongoose.models.Campus ?? mongoose.model<ICampus>("Campus", CampusSchema);
