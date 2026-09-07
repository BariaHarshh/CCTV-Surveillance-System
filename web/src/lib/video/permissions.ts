import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { VIDEO_PERMISSIONS } from "@/lib/video/constants";

function isAdmin(user: Pick<IUser, "role">) {
  return user.role === "ADMIN";
}

export function canViewVideo(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.view]);
}

export function canLiveView(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.live]);
}

export function canViewEvidence(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.evidence]);
}

export function canDownloadEvidence(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.evidenceDownload]);
}

export function canConfigureVideo(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.configure]);
}

export function canReviewDetections(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.review]) || can(user, "event:feedback");
}

export function canConfigureVideoAI(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...VIDEO_PERMISSIONS.aiConfigure]);
}
