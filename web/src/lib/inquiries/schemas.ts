import { z } from "zod";

export const inquiryCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().email("Valid email is required.").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  organizationName: z.string().trim().min(2, "Organization name is required.").max(200),
  campusType: z.string().trim().max(80).optional().or(z.literal("")),
  estimatedCameras: z.string().trim().max(40).optional().or(z.literal("")),
  requirements: z
    .string()
    .trim()
    .min(20, "Please describe your requirements (at least 20 characters).")
    .max(4000),
});

export const inquiryStatusSchema = z.object({
  status: z.enum(["NEW", "REVIEWED", "CONTACTED", "CLOSED"]),
  notes: z.string().trim().max(2000).optional(),
});
