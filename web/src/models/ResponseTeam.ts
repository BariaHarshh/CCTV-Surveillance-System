import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { RESPONSE_TEAM_STATUSES, RESPONSE_TEAM_TYPES } from "@/lib/emergency/constants";

export interface IResponseTeamMember {
  userId: Types.ObjectId;
  name: string;
  role: string;
}

export interface ITeamMapLocation {
  lat: number | null;
  lng: number | null;
  source: string;
  accuracyM: number | null;
  lastUpdated: Date | null;
  /** True only when live GPS/tracking is actually configured for this team. */
  liveTrackingConfigured: boolean;
}

export interface IResponseTeam extends Document {
  _id: Types.ObjectId;
  teamId: string;
  organizationId: Types.ObjectId;
  name: string;
  type: (typeof RESPONSE_TEAM_TYPES)[number];
  members: IResponseTeamMember[];
  status: (typeof RESPONSE_TEAM_STATUSES)[number];
  description: string;
  source: string;
  currentAssignment: string;
  mapLocation: ITeamMapLocation;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IResponseTeamMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    role: { type: String, default: "Member" },
  },
  { _id: false }
);

const ResponseTeamSchema = new Schema<IResponseTeam>(
  {
    teamId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: RESPONSE_TEAM_TYPES, default: "SECURITY" },
    members: { type: [MemberSchema], default: [] },
    status: { type: String, enum: RESPONSE_TEAM_STATUSES, default: "AVAILABLE" },
    description: { type: String, default: "" },
    source: { type: String, default: "MANUAL" },
    currentAssignment: { type: String, default: "" },
    mapLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      source: { type: String, default: "ADMIN_CONFIGURATION" },
      accuracyM: { type: Number, default: null },
      lastUpdated: { type: Date, default: null },
      liveTrackingConfigured: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

ResponseTeamSchema.index({ organizationId: 1, name: 1 });

export const ResponseTeam: Model<IResponseTeam> =
  mongoose.models.ResponseTeam ?? mongoose.model<IResponseTeam>("ResponseTeam", ResponseTeamSchema);
