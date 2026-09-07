import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const AUDIT_ACTIONS = [
  "SUPER_ADMIN_LOGIN",
  "VIEW_DASHBOARD",
  "VIEW_USER",
  "ACTIVATE_USER",
  "SUSPEND_USER",
  "UNLOCK_USER",
  "REVOKE_SESSION",
  "PROFILE_UPDATED",
  "PASSWORD_CHANGED",
  "ORGANIZATION_CREATED",
  "ORGANIZATION_UPDATED",
  "ORGANIZATION_SUSPENDED",
  "ORGANIZATION_ACTIVATED",
  "ORGANIZATION_DELETED",
  "ADMIN_CREATED",
  "ADMIN_UPDATED",
  "ADMIN_SUSPENDED",
  "ADMIN_ACTIVATED",
  "ADMIN_PERMISSION_CHANGED",
  "ADMIN_LOGIN",
  "STAFF_CREATED",
  "STAFF_UPDATED",
  "STAFF_ACTIVATED",
  "STAFF_SUSPENDED",
  "STAFF_UNLOCKED",
  "STAFF_PERMISSION_CHANGED",
  "STAFF_PASSWORD_RESET",
  "ORGANIZATION_VIEWED",
  "STAFF_LOGIN",
  "CAMPUS_UPDATED",
  "BUILDING_CREATED",
  "BUILDING_UPDATED",
  "BUILDING_STATUS_CHANGED",
  "ROOM_CREATED",
  "ROOM_UPDATED",
  "ROOM_STATUS_CHANGED",
  "CAMERA_CREATED",
  "CAMERA_UPDATED",
  "CAMERA_TESTED",
  "CAMERA_ENABLED",
  "CAMERA_DISABLED",
  "CAMERA_REMOVED",
  "STAFF_PROFILE_UPDATED",
  "STAFF_PASSWORD_CHANGED",
  "STAFF_SESSION_REVOKED",
  "EVENT_CREATED",
  "EVENT_VIEWED",
  "ALERT_CREATED",
  "ALERT_ACKNOWLEDGED",
  "ALERT_INVESTIGATION_STARTED",
  "ALERT_RESOLVED",
  "ALERT_DISMISSED",
  "ALERT_ASSIGNED",
  "NOTIFICATION_READ",
  "INQUIRY_RECEIVED",
  "INQUIRY_VIEWED",
  "INQUIRY_STATUS_CHANGED",
  "AI_MODULE_ENABLED",
  "AI_MODULE_DISABLED",
  "AI_CONFIGURATION_UPDATED",
  "DETECTION_CREATED",
  "DETECTION_FEEDBACK_CREATED",
  "INCIDENT_CREATED",
  "INCIDENT_ASSIGNED",
  "INCIDENT_RESOLVED",
  "INCIDENT_DISMISSED",
  "AI_PROVIDER_CHANGED",
  "AI_CONFIGURATION_RESET",
  "EMERGENCY_CREATED",
  "EMERGENCY_ACTIVATED",
  "EMERGENCY_UPDATED",
  "EMERGENCY_RESOLVED",
  "EMERGENCY_CANCELLED",
  "INCIDENT_ESCALATED",
  "TEAM_ASSIGNED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "PLAYBOOK_STARTED",
  "PLAYBOOK_STEP_COMPLETED",
  "PLAYBOOK_UPDATED",
  "ESCALATION_TRIGGERED",
  "ESCALATION_ACKNOWLEDGED",
  "EMERGENCY_MESSAGE_SENT",
  "RESPONSE_TEAM_UPDATED",
  "EMERGENCY_CONTACT_UPDATED",
  "ANALYTICS_VIEWED",
  "REPORT_GENERATED",
  "REPORT_EXPORTED",
  "EXECUTIVE_DASHBOARD_VIEWED",
  "DATA_EXPORTED",
  "SAVED_VIEW_CREATED",
  "CORRECTIVE_ACTION_CREATED",
  "CORRECTIVE_ACTION_COMPLETED",
  "INSIGHT_FEEDBACK",
  "LOGIN_FAILED",
  "LOGOUT",
  "ACCOUNT_LOCKED",
  "PASSWORD_RESET_REQUEST",
  "LOGIN_SUCCESS",
  "BILLING_UPGRADED",
  "SETTINGS_UPDATED",
  "SECURITY_POLICY_UPDATED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "WEBHOOK_CREATED",
  "RETENTION_UPDATED",
  "INVITATION_CREATED",
  "DEPARTMENT_CREATED",
  "ONBOARDING_STEP_MARKED",
  "FEATURE_FLAG_UPDATED",
  "ANNOUNCEMENT_CREATED",
  "MAINTENANCE_UPDATED",
  "PLATFORM_INCIDENT_CREATED",
  "BACKUP_CREATED",
  "AI_COPILOT_QUERY",
  "AI_ACTION_CONFIRMED",
  "AI_ACTION_CANCELLED",
  "AI_KNOWLEDGE_UPLOADED",
  "AI_KNOWLEDGE_PUBLISHED",
  "AI_FEEDBACK_SUBMITTED",
  "AUTOMATION_CREATED",
  "AUTOMATION_UPDATED",
  "AUTOMATION_RUN",
  "APPROVAL_DECIDED",
  "POLICY_CREATED",
  "POLICY_UPDATED",
  "AGENT_DISABLED",
  "AGENT_EXECUTED",
  "WORKFLOW_FAILED",
  "EXPORT_CREATED",
  "SUPPORT_TICKET_CREATED",
  "DATA_DELETION_REQUESTED",
  "MAP_OBJECT_CREATED",
  "MAP_OBJECT_UPDATED",
  "ZONE_CREATED",
  "ZONE_UPDATED",
  "FLOOR_PLAN_UPLOADED",
  "FLOOR_PLAN_PUBLISHED",
  "LOCATION_VIEWED",
  "SENSITIVE_LOCATION_EXPORTED",
  "MAP_EXPORT",
  "GEOFENCE_CREATED",
  "ASSET_CREATED",
  "ASSET_UPDATED",
  "EXIT_UPDATED",
  "ASSEMBLY_UPDATED",
  "EVIDENCE_CREATED",
  "EVIDENCE_VIEWED",
  "EVIDENCE_DOWNLOADED",
  "EVIDENCE_SHARED",
  "VIDEO_DETECTION_CREATED",
  "VIDEO_DETECTION_REVIEWED",
  "PRIVACY_ZONE_CHANGED",
  "CAMERA_VIEWED",
  "STREAM_ACCESSED",
  "VIDEO_AI_POLICY_UPDATED",
  "VIDEO_MODEL_DEPLOYED",
  "VIDEO_MODEL_ROLLED_BACK",
  "CAMERA_BULK_UPDATED",
  "FIELD_STATUS_CHANGED",
  "LOCATION_PERMISSION",
  "EMERGENCY_CHECKIN",
  "TASK_UPDATED",
  "MESSAGE_SENT",
  "EVIDENCE_UPLOADED",
  "ANNOUNCEMENT_PUBLISHED",
  "PATROL_STARTED",
  "PATROL_COMPLETED",
  "PATROL_CHECKPOINT_MISSED",
  "INSPECTION_COMPLETED",
  "EQUIPMENT_CHECKOUT",
  "PUSH_SUBSCRIBED",
  "MOBILE_SYNC",
  "EMERGENCY_BROADCAST",
  "EXECUTIVE_DASHBOARD_VIEWED",
  "EXECUTIVE_DECISION_CREATED",
  "STRATEGIC_INITIATIVE_CREATED",
  "POLICY_EXCEPTION_APPROVED",
  "AFTER_ACTION_CREATED",
  "KPI_TARGETS_UPDATED",
  "REPORT_SCHEDULE_CREATED",
  "GOVERNANCE_VIEWED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId | null;
  actorId: Types.ObjectId | null;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  targetType: string | null;
  targetId: Types.ObjectId | null;
  targetLabel: string | null;
  description: string;
  severity: AuditSeverity;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorName: { type: String, default: "System" },
    actorRole: { type: String, default: "SYSTEM" },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: Schema.Types.ObjectId, default: null },
    targetLabel: { type: String, default: null },
    description: { type: String, required: true },
    severity: { type: String, enum: AUDIT_SEVERITIES, default: "info" },
    ipAddress: { type: String, default: "unknown" },
    userAgent: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ organizationId: 1, createdAt: -1 });

/** Append-only: block mutation/deletion through Mongoose. */
function rejectAuditMutation() {
  throw new Error("Audit logs are immutable");
}
AuditLogSchema.pre("findOneAndUpdate", rejectAuditMutation);
AuditLogSchema.pre("updateOne", rejectAuditMutation);
AuditLogSchema.pre("updateMany", rejectAuditMutation);
AuditLogSchema.pre("deleteOne", rejectAuditMutation);
AuditLogSchema.pre("deleteMany", rejectAuditMutation);
AuditLogSchema.pre("findOneAndDelete", rejectAuditMutation);

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
