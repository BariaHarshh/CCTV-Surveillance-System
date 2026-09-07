import { z } from "zod";
import {
  BUILDING_TYPES,
  CAMERA_CONNECTION_TYPES,
  CAMERA_PROTOCOLS,
  CAMERA_TYPES,
  ROOM_TYPES,
} from "@/lib/campus/constants";

export const campusUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  address: z.string().optional(),
  coordinates: z.object({ lat: z.number().nullable(), lng: z.number().nullable() }).optional(),
  students: z.coerce.number().int().min(0).optional(),
  faculty: z.coerce.number().int().min(0).optional(),
  securityPersonnel: z.coerce.number().int().min(0).optional(),
});

export const buildingCreateSchema = z.object({
  name: z.string().min(2, "Building name is required."),
  code: z.string().min(1, "Building code is required."),
  type: z.enum(BUILDING_TYPES),
  description: z.string().optional().default(""),
  floors: z.coerce.number().int().min(0).default(1),
  entrances: z.coerce.number().int().min(0).default(1),
  exits: z.coerce.number().int().min(0).default(1),
  address: z.string().optional().default(""),
  coordinates: z.object({ lat: z.number().nullable(), lng: z.number().nullable() }).optional(),
});

export const buildingUpdateSchema = buildingCreateSchema.partial();

export const buildingStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const roomCreateSchema = z.object({
  buildingId: z.string().min(1, "Building is required."),
  floor: z.coerce.number().int().min(0).default(1),
  name: z.string().min(1, "Room name is required."),
  roomNumber: z.string().min(1, "Room number is required."),
  code: z.string().min(1, "Room code is required."),
  type: z.enum(ROOM_TYPES),
  maxCapacity: z.coerce.number().int().min(0).default(0),
  normalCapacity: z.coerce.number().int().min(0).default(0),
  purpose: z.string().optional().default(""),
});

export const roomUpdateSchema = roomCreateSchema.partial().omit({ buildingId: true }).extend({
  buildingId: z.string().optional(),
});

export const roomStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const cameraCreateSchema = z.object({
  name: z.string().min(2, "Camera name is required."),
  type: z.enum(CAMERA_TYPES),
  manufacturer: z.string().optional().default(""),
  model: z.string().optional().default(""),
  serialNumber: z.string().optional().default(""),
  buildingId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  floor: z.coerce.number().int().min(0).nullable().optional(),
  areaLabel: z.string().optional().default(""),
  connection: z.object({
    streamUrl: z.string().min(1, "Stream URL is required."),
    protocol: z.enum(CAMERA_PROTOCOLS),
    connectionType: z.enum(CAMERA_CONNECTION_TYPES).default("Wired"),
    username: z.string().optional().default(""),
    password: z.string().optional().default(""),
  }),
});

export const cameraUpdateSchema = cameraCreateSchema.partial();

export const cameraStatusSchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE", "CONNECTING", "ERROR", "DISABLED", "MAINTENANCE"]),
  action: z.enum(["enable", "disable"]).optional(),
});

export type CampusUpdateInput = z.infer<typeof campusUpdateSchema>;
export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>;
export type BuildingUpdateInput = z.infer<typeof buildingUpdateSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type CameraCreateInput = z.infer<typeof cameraCreateSchema>;
export type CameraUpdateInput = z.infer<typeof cameraUpdateSchema>;
