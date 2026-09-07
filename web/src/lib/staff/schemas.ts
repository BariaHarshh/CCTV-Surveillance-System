import { z } from "zod";
import { EMPLOYMENT_TYPES } from "@/lib/staff/constants";

export const staffCreateSchema = z.object({
  personal: z.object({
    name: z.string().min(2, "Full name is required."),
    email: z.string().email("Valid email is required."),
    phone: z.string().min(1, "Phone is required."),
    dateOfBirth: z.string().optional().default(""),
    gender: z.string().optional().default(""),
    address: z.string().optional().default(""),
    photo: z.string().optional().default(""),
    emergencyContactName: z.string().optional().default(""),
    emergencyContactPhone: z.string().optional().default(""),
  }),
  professional: z.object({
    employeeId: z.string().min(1, "Employee ID is required."),
    jobTitle: z.string().min(1, "Job title is required."),
    department: z.string().min(1, "Department is required."),
    designation: z.string().optional().default(""),
    employmentType: z.enum(EMPLOYMENT_TYPES).default("Full Time"),
    joiningDate: z.string().optional().default(""),
    responsibilities: z.string().optional().default(""),
  }),
  account: z.object({
    userId: z.string().min(1, "Staff ID is required."),
    password: z.string().min(12, "Password must be at least 12 characters."),
  }),
  permissions: z.array(z.string()).min(1, "Select at least one permission."),
});

export const staffUpdateSchema = z.object({
  personal: z
    .object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
      gender: z.string().optional(),
      address: z.string().optional(),
      photo: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
    })
    .optional(),
  professional: z
    .object({
      employeeId: z.string().optional(),
      jobTitle: z.string().optional(),
      department: z.string().optional(),
      designation: z.string().optional(),
      employmentType: z.string().optional(),
      joiningDate: z.string().optional(),
      responsibilities: z.string().optional(),
    })
    .optional(),
  permissions: z.array(z.string()).optional(),
});

export const staffStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  action: z.enum(["activate", "suspend", "unlock"]).optional(),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
