import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const BUILDING_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BuildingStatus = (typeof BUILDING_STATUSES)[number];

export interface IBuilding extends Document {
  _id: Types.ObjectId;
  buildingId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId;
  name: string;
  code: string;
  type: string;
  description: string;
  floors: number;
  roomCount: number;
  entrances: number;
  exits: number;
  address: string;
  coordinates: { lat: number | null; lng: number | null };
  status: BuildingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BuildingSchema = new Schema<IBuilding>(
  {
    buildingId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    description: { type: String, default: "" },
    floors: { type: Number, default: 1, min: 0 },
    roomCount: { type: Number, default: 0, min: 0 },
    entrances: { type: Number, default: 1, min: 0 },
    exits: { type: Number, default: 1, min: 0 },
    address: { type: String, default: "" },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    status: { type: String, enum: BUILDING_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

BuildingSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const Building: Model<IBuilding> =
  mongoose.models.Building ?? mongoose.model<IBuilding>("Building", BuildingSchema);
