import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CorrectiveAction, type ICorrectiveAction } from "@/models/CorrectiveAction";
import { getNextSequence, formatActionId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { ActionPriority, ActionStatus } from "@/lib/analytics/constants";
import { mean } from "@/lib/analytics/filters";

function toPublic(a: ICorrectiveAction) {
  const overdue =
    a.status !== "COMPLETED" &&
    a.status !== "CANCELLED" &&
    a.dueAt != null &&
    a.dueAt.getTime() < Date.now();
  return {
    id: a._id.toString(),
    actionId: a.actionId,
    sourceType: a.sourceType,
    sourceId: a.sourceId?.toString() ?? null,
    title: a.title,
    description: a.description,
    priority: a.priority,
    assignedTo: a.assignedTo?.toString() ?? null,
    assignedToName: a.assignedToName,
    assignedTeam: a.assignedTeam?.toString() ?? null,
    assignedTeamName: a.assignedTeamName,
    dueAt: a.dueAt?.toISOString() ?? null,
    status: overdue && a.status !== "OVERDUE" ? "OVERDUE" : a.status,
    completedAt: a.completedAt?.toISOString() ?? null,
    createdByName: a.createdByName,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listActions(organizationId: string, status?: string) {
  await connectDB();
  const q: Record<string, unknown> = { ...orgFilter(organizationId) };
  if (status) q.status = status;
  const items = await CorrectiveAction.find(q).sort({ createdAt: -1 });
  // Mark overdue
  for (const a of items) {
    if (
      a.dueAt &&
      a.status !== "COMPLETED" &&
      a.status !== "CANCELLED" &&
      a.dueAt.getTime() < Date.now() &&
      a.status !== "OVERDUE"
    ) {
      a.status = "OVERDUE";
      await a.save();
    }
  }
  const open = items.filter((a) => ["OPEN", "IN_PROGRESS", "OVERDUE"].includes(a.status)).length;
  const dueSoon = items.filter((a) => {
    if (!a.dueAt || a.status === "COMPLETED" || a.status === "CANCELLED") return false;
    const ms = a.dueAt.getTime() - Date.now();
    return ms > 0 && ms < 3 * 24 * 60 * 60 * 1000;
  }).length;
  const overdue = items.filter((a) => a.status === "OVERDUE").length;
  const completed = items.filter((a) => a.status === "COMPLETED");
  const closureTimes = completed
    .filter((a) => a.completedAt)
    .map((a) => a.completedAt!.getTime() - a.createdAt.getTime());

  return {
    actions: items.map(toPublic),
    stats: {
      open,
      dueSoon,
      overdue,
      completed: completed.length,
      completionRate: items.length ? Math.round((completed.length / items.length) * 1000) / 10 : null,
      avgClosureMs: mean(closureTimes),
    },
  };
}

export async function createAction(
  organizationId: string,
  data: {
    title: string;
    description?: string;
    priority?: ActionPriority;
    sourceType?: string;
    sourceId?: string | null;
    assignedTo?: string | null;
    assignedToName?: string;
    assignedTeam?: string | null;
    assignedTeamName?: string;
    dueAt?: string | null;
    source?: string;
  },
  actor: { id: string; name: string }
) {
  await connectDB();
  const seq = await getNextSequence("action");
  const action = await CorrectiveAction.create({
    actionId: await formatActionId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: data.title,
    description: data.description ?? "",
    priority: data.priority ?? "MEDIUM",
    sourceType: data.sourceType ?? "MANUAL",
    sourceId: data.sourceId ? new mongoose.Types.ObjectId(data.sourceId) : null,
    assignedTo: data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo) : null,
    assignedToName: data.assignedToName ?? "",
    assignedTeam: data.assignedTeam ? new mongoose.Types.ObjectId(data.assignedTeam) : null,
    assignedTeamName: data.assignedTeamName ?? "",
    dueAt: data.dueAt ? new Date(data.dueAt) : null,
    createdBy: new mongoose.Types.ObjectId(actor.id),
    createdByName: actor.name,
    source: data.source ?? "MANUAL",
  });
  return toPublic(action);
}

export async function updateAction(
  organizationId: string,
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    priority: ActionPriority;
    status: ActionStatus;
    assignedTo: string | null;
    assignedToName: string;
    dueAt: string | null;
  }>
) {
  await connectDB();
  const action = await CorrectiveAction.findOne(orgFilter(organizationId, { _id: id }));
  if (!action) return null;
  if (patch.title !== undefined) action.title = patch.title;
  if (patch.description !== undefined) action.description = patch.description;
  if (patch.priority !== undefined) action.priority = patch.priority;
  if (patch.status !== undefined) action.status = patch.status;
  if (patch.assignedTo !== undefined) {
    action.assignedTo = patch.assignedTo ? new mongoose.Types.ObjectId(patch.assignedTo) : null;
  }
  if (patch.assignedToName !== undefined) action.assignedToName = patch.assignedToName;
  if (patch.dueAt !== undefined) action.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
  await action.save();
  return toPublic(action);
}

export async function completeAction(organizationId: string, id: string) {
  await connectDB();
  const action = await CorrectiveAction.findOne(orgFilter(organizationId, { _id: id }));
  if (!action) return null;
  action.status = "COMPLETED";
  action.completedAt = new Date();
  await action.save();
  return toPublic(action);
}
