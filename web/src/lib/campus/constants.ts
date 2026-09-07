export const BUILDING_TYPES = [
  "Academic",
  "Administration",
  "Laboratory",
  "Library",
  "Hostel",
  "Sports",
  "Cafeteria",
  "Parking",
  "Security",
  "Other",
] as const;

export const ROOM_TYPES = [
  "Classroom",
  "Laboratory",
  "Office",
  "Conference Room",
  "Library",
  "Storage",
  "Security Room",
  "Corridor",
  "Entrance",
  "Exit",
  "Parking",
  "Other",
] as const;

export const CAMERA_TYPES = ["Fixed", "PTZ", "Dome", "Bullet", "Thermal", "Other"] as const;

export const CAMERA_PROTOCOLS = ["RTSP", "HTTP", "HTTPS", "ONVIF"] as const;

export const CAMERA_CONNECTION_TYPES = ["Wired", "Wireless", "PoE", "Other"] as const;

export const CAMERA_STATUSES = [
  "ONLINE",
  "OFFLINE",
  "CONNECTING",
  "ERROR",
  "DISABLED",
  "MAINTENANCE",
] as const;

export const CAMPUS_PERMISSIONS = {
  campus: ["campus:view", "campus:edit"],
  building: ["building:view", "building:create", "building:edit", "building:status"],
  room: ["room:view", "room:create", "room:edit", "room:status"],
  camera: [
    "camera:view",
    "camera:create",
    "camera:edit",
    "camera:test",
    "camera:delete",
    "camera:status",
  ],
} as const;

export const ALL_CAMPUS_ADMIN_PERMISSIONS = Object.values(CAMPUS_PERMISSIONS).flat();

/** Staff read permissions (spec dot notation aliases handled in can()) */
export const STAFF_CAMPUS_PERMISSIONS = [
  "campus:view",
  "building:view",
  "room:view",
  "camera:view",
] as const;

export const DEFAULT_ADMIN_CAMPUS_PERMISSIONS = [
  "campus:view",
  "campus:edit",
  "building:view",
  "building:create",
  "building:edit",
  "building:status",
  "room:view",
  "room:create",
  "room:edit",
  "room:status",
  "camera:view",
  "camera:create",
  "camera:edit",
  "camera:test",
  "camera:status",
  "camera:delete",
];

export {
  EVENT_TYPES,
} from "@/lib/monitoring/constants";
