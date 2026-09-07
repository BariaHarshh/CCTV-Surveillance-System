import { z } from "zod";
import {
  CAMPUS_TYPES,
  ORGANIZATION_TYPES,
  SAFETY_PRIORITIES,
  USE_CASES,
} from "@/lib/organizations/constants";

const nonNegativeInt = z.coerce.number().int().min(0);

export const organizationCreateSchema = z.object({
  basicInformation: z.object({
    name: z.string().min(2, "Organization name is required."),
    legalName: z.string().optional().default(""),
    type: z.string().min(1, "Organization type is required."),
    typeOther: z.string().optional().default(""),
    registrationNumber: z.string().optional().default(""),
    website: z.string().optional().default(""),
    email: z.string().email("Valid official email is required."),
    phone: z.string().optional().default(""),
    logo: z.string().optional().default(""),
  }),
  location: z.object({
    country: z.string().min(1, "Country is required."),
    state: z.string().min(1, "State is required."),
    city: z.string().min(1, "City is required."),
    address: z.string().optional().default(""),
    postalCode: z.string().optional().default(""),
  }),
    campus: z.object({
    name: z.string().min(1, "Campus name is required."),
    type: z.string().min(1, "Campus type is required."),
    buildings: nonNegativeInt,
    classrooms: nonNegativeInt,
    laboratories: nonNegativeInt,
    cameras: nonNegativeInt,
    students: nonNegativeInt,
    faculty: nonNegativeInt,
    securityPersonnel: nonNegativeInt,
  }),
  purpose: z.object({
    useCases: z.array(z.string()).min(1, "Select at least one use case."),
    description: z.string().optional().default(""),
    safetyPriorities: z.array(z.string()).default([]),
  }),
  primaryContact: z.object({
    name: z.string().min(1, "Contact name is required."),
    title: z.string().optional().default(""),
    department: z.string().optional().default(""),
    email: z.string().email("Valid contact email is required."),
    phone: z.string().optional().default(""),
    preferredMethod: z.enum(["Email", "Phone", "Both"]).default("Email"),
  }),
  status: z.enum(["ACTIVE", "PENDING"]).optional().default("ACTIVE"),
});

export const adminCreateSchema = z.object({
  personal: z.object({
    name: z.string().min(2, "Full name is required."),
    email: z.string().email("Valid email is required."),
    phone: z.string().min(1, "Phone is required."),
    dateOfBirth: z.string().optional().default(""),
    gender: z.string().optional().default(""),
    address: z.string().optional().default(""),
    photo: z.string().optional().default(""),
  }),
  professional: z.object({
    employeeId: z.string().min(1, "Employee ID is required."),
    jobTitle: z.string().min(1, "Job title is required."),
    jobTitleOther: z.string().optional().default(""),
    department: z.string().min(1, "Department is required."),
    joiningDate: z.string().optional().default(""),
    responsibilities: z.string().optional().default(""),
  }),
  account: z.object({
    userId: z.string().min(1, "Admin ID is required."),
    password: z.string().min(12, "Password must be at least 12 characters."),
  }),
  permissions: z.array(z.string()).min(1, "Select at least one permission."),
});

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;

export { ORGANIZATION_TYPES, USE_CASES, SAFETY_PRIORITIES, CAMPUS_TYPES };
