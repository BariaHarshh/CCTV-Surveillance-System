import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const ORGANIZATION_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE", "ARCHIVED"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export interface IBasicInformation {
  name: string;
  legalName: string;
  type: string;
  typeOther?: string;
  registrationNumber: string;
  website: string;
  email: string;
  phone: string;
  logo: string;
}

export interface ILocation {
  country: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
}

export interface ICampus {
  name: string;
  type: string;
  buildings: number;
  classrooms: number;
  laboratories: number;
  cameras: number;
  students: number;
  faculty: number;
  securityPersonnel: number;
}

export interface IPurpose {
  useCases: string[];
  description: string;
  safetyPriorities: string[];
}

export interface IPrimaryContact {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  preferredMethod: "Email" | "Phone" | "Both";
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  organizationId: string;
  slug: string;
  status: OrganizationStatus;
  basicInformation: IBasicInformation;
  location: ILocation;
  campus: ICampus;
  purpose: IPurpose;
  primaryContact: IPrimaryContact;
  lastActivityAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BasicInformationSchema = new Schema<IBasicInformation>(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: "", trim: true },
    type: { type: String, required: true },
    typeOther: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    website: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    logo: { type: String, default: "" },
  },
  { _id: false }
);

const LocationSchema = new Schema<ILocation>(
  {
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, default: "" },
    postalCode: { type: String, default: "" },
  },
  { _id: false }
);

const CampusSchema = new Schema<ICampus>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    buildings: { type: Number, default: 0, min: 0 },
    classrooms: { type: Number, default: 0, min: 0 },
    laboratories: { type: Number, default: 0, min: 0 },
    cameras: { type: Number, default: 0, min: 0 },
    students: { type: Number, default: 0, min: 0 },
    faculty: { type: Number, default: 0, min: 0 },
    securityPersonnel: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PurposeSchema = new Schema<IPurpose>(
  {
    useCases: { type: [String], default: [] },
    description: { type: String, default: "" },
    safetyPriorities: { type: [String], default: [] },
  },
  { _id: false }
);

const PrimaryContactSchema = new Schema<IPrimaryContact>(
  {
    name: { type: String, required: true },
    title: { type: String, default: "" },
    department: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    preferredMethod: { type: String, enum: ["Email", "Phone", "Both"], default: "Email" },
  },
  { _id: false }
);

const OrganizationSchema = new Schema<IOrganization>(
  {
    organizationId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    status: {
      type: String,
      enum: ORGANIZATION_STATUSES,
      default: "ACTIVE",
    },
    basicInformation: { type: BasicInformationSchema, required: true },
    location: { type: LocationSchema, required: true },
    campus: { type: CampusSchema, required: true },
    purpose: { type: PurposeSchema, default: () => ({}) },
    primaryContact: { type: PrimaryContactSchema, required: true },
    lastActivityAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrganizationSchema.index({ "basicInformation.name": "text", organizationId: "text", "location.city": "text" });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ createdAt: -1 });

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ??
  mongoose.model<IOrganization>("Organization", OrganizationSchema);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
