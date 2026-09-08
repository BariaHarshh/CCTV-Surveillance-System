import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { OfflineSyncItem, newMobileId } from "@/models/Mobile";
import { applyTaskAction } from "@/lib/mobile/field-service";
import type { IUser } from "@/models/User";
import { createIncidentDraftFromSync } from "@/lib/mobile/incident-draft";

/**
 * Server-side sync for offline outbox.
 * Conflicts are never silently overwritten.
 */
export async function enqueueOfflineOp(
  organizationId: string,
  user: IUser,
  item: {
    clientOpId: string;
    operation: "CREATE" | "UPDATE" | "COMPLETE" | "UPLOAD";
    resourceType: string;
    payload: Record<string, unknown>;
  }
) {
  await connectDB();
  const existing = await OfflineSyncItem.findOne(
    orgFilter(organizationId, { userId: user._id, clientOpId: item.clientOpId })
  );
  if (existing) {
    return {
      syncId: existing.syncId,
      status: existing.status,
      duplicate: true,
    };
  }

  const row = await OfflineSyncItem.create({
    syncId: newMobileId("sync"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: user._id,
    clientOpId: item.clientOpId,
    operation: item.operation,
    resourceType: item.resourceType,
    payload: item.payload,
    status: "PENDING",
  });
  return { syncId: row.syncId, status: row.status, duplicate: false };
}

export async function processSyncQueue(organizationId: string, user: IUser) {
  await connectDB();
  const pending = await OfflineSyncItem.find(
    orgFilter(organizationId, { userId: user._id, status: "PENDING" })
  )
    .sort({ createdAt: 1 })
    .limit(50);

  const results: Array<Record<string, unknown>> = [];

  for (const item of pending) {
    try {
      if (item.resourceType === "TASK" && item.operation === "COMPLETE") {
        const r = await applyTaskAction(
          organizationId,
          user,
          String(item.payload.taskId || ""),
          "complete",
          item.payload
        );
        if ("error" in r) {
          item.status = "CONFLICT";
          item.error = String(r.error);
        } else {
          item.status = "APPLIED";
          item.appliedAt = new Date();
        }
      } else if (item.resourceType === "TASK" && item.operation === "UPDATE") {
        const r = await applyTaskAction(
          organizationId,
          user,
          String(item.payload.taskId || ""),
          String(item.payload.action || "note"),
          item.payload
        );
        if ("error" in r) {
          item.status = r.error === "INVALID_TRANSITION" ? "CONFLICT" : "FAILED";
          item.error = String(r.error);
        } else {
          item.status = "APPLIED";
          item.appliedAt = new Date();
        }
      } else if (item.resourceType === "INCIDENT_DRAFT" && item.operation === "CREATE") {
        const draft = await createIncidentDraftFromSync(organizationId, user, item.payload);
        if (draft.conflict) {
          item.status = "CONFLICT";
          item.error = draft.reason || "Conflict";
        } else {
          item.status = "APPLIED";
          item.appliedAt = new Date();
          item.payload = { ...item.payload, serverIncidentId: draft.incidentId };
        }
      } else {
        item.status = "FAILED";
        item.error = "Unsupported offline operation for real-time authorization";
      }
    } catch (e) {
      item.status = "FAILED";
      item.error = e instanceof Error ? e.message : "sync failed";
    }
    await item.save();
    results.push({
      syncId: item.syncId,
      clientOpId: item.clientOpId,
      status: item.status,
      error: item.error,
    });
  }

  return { processed: results.length, results };
}

export async function resolveConflict(
  organizationId: string,
  user: IUser,
  syncId: string,
  resolution: "KEEP_SERVER" | "KEEP_LOCAL" | "REVIEW"
) {
  await connectDB();
  const item = await OfflineSyncItem.findOne(orgFilter(organizationId, { syncId, userId: user._id }));
  if (!item) return null;
  if (item.status !== "CONFLICT") return { error: "NOT_CONFLICT" as const };

  item.conflictResolution = resolution;
  if (resolution === "KEEP_SERVER") {
    item.status = "APPLIED";
    item.appliedAt = new Date();
    item.error = "Resolved: kept server version";
  } else if (resolution === "KEEP_LOCAL") {
    item.status = "PENDING";
    item.error = null;
  } else {
    item.error = "Marked for review — not auto-applied";
  }
  await item.save();
  return {
    syncId: item.syncId,
    status: item.status,
    conflictResolution: item.conflictResolution,
  };
}

export async function listSyncState(organizationId: string, userId: string) {
  await connectDB();
  const items = await OfflineSyncItem.find(
    orgFilter(organizationId, { userId: new mongoose.Types.ObjectId(userId) })
  )
    .sort({ createdAt: -1 })
    .limit(50);
  return {
    pending: items.filter((i) => i.status === "PENDING").length,
    conflicts: items.filter((i) => i.status === "CONFLICT").length,
    items: items.map((i) => ({
      syncId: i.syncId,
      clientOpId: i.clientOpId,
      operation: i.operation,
      resourceType: i.resourceType,
      status: i.status,
      error: i.error,
      conflictResolution: i.conflictResolution,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}
