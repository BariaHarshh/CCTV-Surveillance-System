import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { UserRole, UserStatus } from "@/lib/auth/config";

export interface IUserProfile {
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  photo: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface IUserProfessional {
  employeeId: string;
  jobTitle: string;
  jobTitleOther: string;
  department: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  responsibilities: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  userId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: string[];
  organizationId: Types.ObjectId | null;
  status: UserStatus;
  mustChangePassword: boolean;
  profile: IUserProfile;
  professional: IUserProfessional;
  lastLogin: Date | null;
  lastActive: Date | null;
  passwordChangedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IUserProfile>(
  {
    phone: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, default: "" },
    address: { type: String, default: "" },
    photo: { type: String, default: "" },
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
  },
  { _id: false }
);

const ProfessionalSchema = new Schema<IUserProfessional>(
  {
    employeeId: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    jobTitleOther: { type: String, default: "" },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    employmentType: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    responsibilities: { type: String, default: "" },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "STAFF"],
      required: true,
    },
    permissions: { type: [String], default: [] },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED", "PENDING"],
      default: "ACTIVE",
    },
    mustChangePassword: { type: Boolean, default: false },
    profile: { type: ProfileSchema, default: () => ({}) },
    professional: { type: ProfessionalSchema, default: () => ({}) },
    lastLogin: { type: Date, default: null },
    lastActive: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ organizationId: 1 });
UserSchema.index({ role: 1, organizationId: 1 });
UserSchema.index({ organizationId: 1, "professional.employeeId": 1 }, { unique: true, sparse: true });

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);
