import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatTaskId } from "@/models/Counter";
import { ResponseTask, type IResponseTask } from "@/models/ResponseTask";
import { RESPONSE_TASK_TRANSITIONS, type ResponseTaskStatus, type TaskPriority } from "@/lib/emergency/constants";
import { broadcastTaskCreated, broadcastTaskUpdated } from "@/lib/monitoring/socket-emitter";
import { Emergency } from "@/models/Emergency";

function toPublic(t: IResponseTask) {
  return {
    id: t._id.toString(),
    taskId: t.taskId,
    incidentId: t.incidentId?.toString() ?? null,
    emergencyId: t.emergencyId?.toString() ?? null,
    title: t.title,
    description: t.description,
    assignedTo: t.assignedTo?.toString() ?? null,
    assignedToName: t.assignedToName,
    assignedTeam: t.assignedTeam?.toString() ?? null,
    assignedTeamName: t.assignedTeamName,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listTasks(
  organizationId: string,
  filters: { emergencyId?: string; incidentId?: string; status?: string } = {}
) {
  await connectDB();
  const q: Record<string, unknown> = { ...orgFilter(organizationId) };
  if (filters.emergencyId) q.emergencyId = filters.emergencyId;
  if (filters.incidentId) q.incidentId = filters.incidentId;
  if (filters.status) q.status = filters.status;
  const tasks = await ResponseTask.find(q).sort({ createdAt: -1 });
  return tasks.map(toPublic);
}

export async function createTask(
  organizationId: string,
  data: {
    title: string;
    description?: string;
    emergencyId?: string | null;
    incidentId?: string | null;
    assignedTo?: string | null;
    assignedToName?: string;
    assignedTeam?: string | null;
    assignedTeamName?: string;
    priority?: TaskPriority;
    dueAt?: string | null;
    source?: string;
  },
  actor?: { id: string; name: string }
) {
  await connectDB();
  const seq = await getNextSequence("task");
  const task = await ResponseTask.create({
    taskId: await formatTaskId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    title: data.title,
    description: data.description ?? "",
    emergencyId: data.emergencyId ? new mongoose.Types.ObjectId(data.emergencyId) : null,
    incidentId: data.incidentId ? new mongoose.Types.ObjectId(data.incidentId) : null,
    assignedTo: data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo) : null,
    assignedToName: data.assignedToName ?? "",
    assignedTeam: data.assignedTeam ? new mongoose.Types.ObjectId(data.assignedTeam) : null,
    assignedTeamName: data.assignedTeamName ?? "",
    priority: data.priority ?? "MEDIUM",
    dueAt: data.dueAt ? new Date(data.dueAt) : null,
    source: data.source ?? "MANUAL",
    checklist: (data as { checklist?: Array<{ key: string; label: string }> }).checklist?.map((c) => ({
      key: c.key,
      label: c.label,
      done: false,
      doneAt: null,
      doneBy: null,
    })) ?? [],
    timeline: [
      {
        action: "ASSIGNED",
        at: new Date(),
        userId: actor ? new mongoose.Types.ObjectId(actor.id) : null,
        userName: actor?.name ?? "System",
        note: "",
      },
    ],
  });

  if (data.emergencyId && actor) {
    await Emergency.findOneAndUpdate(orgFilter(organizationId, { _id: data.emergencyId }), {
      $push: {
        timeline: {
          action: "TASK_CREATED",
          description: `Task created: ${data.title}`,
          actorId: new mongoose.Types.ObjectId(actor.id),
          actorName: actor.name,
          timestamp: new Date(),
        },
      },
    });
  }

  const pub = toPublic(task);
  broadcastTaskCreated(organizationId, pub);
  return pub;
}

export async function updateTask(
  organizationId: string,
  taskId: string,
  patch: {
    status?: ResponseTaskStatus;
    title?: string;
    description?: string;
    assignedTo?: string | null;
    assignedToName?: string;
    assignedTeam?: string | null;
    assignedTeamName?: string;
    priority?: TaskPriority;
  },
  actor?: { id: string; name: string }
) {
  await connectDB();
  const task = await ResponseTask.findOne(orgFilter(organizationId, { _id: taskId }));
  if (!task) return { error: "NOT_FOUND" as const };

  if (patch.status !== undefined && patch.status !== task.status) {
    const allowed = RESPONSE_TASK_TRANSITIONS[task.status];
    if (!allowed.includes(patch.status)) {
      return { error: "INVALID_TRANSITION" as const, from: task.status, to: patch.status };
    }
    task.status = patch.status;
    if (patch.status === "COMPLETED") {
      task.completedAt = new Date();
      if (actor) task.completedBy = new mongoose.Types.ObjectId(actor.id);
      if (task.emergencyId && actor) {
        await Emergency.findOneAndUpdate(orgFilter(organizationId, { _id: task.emergencyId }), {
          $push: {
            timeline: {
              action: "TASK_COMPLETED",
              description: `Task completed: ${task.title}`,
              actorId: new mongoose.Types.ObjectId(actor.id),
              actorName: actor.name,
              timestamp: new Date(),
            },
          },
        });
      }
    }
  }

  if (patch.title !== undefined) task.title = patch.title;
  if (patch.description !== undefined) task.description = patch.description;
  if (patch.assignedTo !== undefined) {
    task.assignedTo = patch.assignedTo ? new mongoose.Types.ObjectId(patch.assignedTo) : null;
  }
  if (patch.assignedToName !== undefined) task.assignedToName = patch.assignedToName;
  if (patch.assignedTeam !== undefined) {
    task.assignedTeam = patch.assignedTeam ? new mongoose.Types.ObjectId(patch.assignedTeam) : null;
  }
  if (patch.assignedTeamName !== undefined) task.assignedTeamName = patch.assignedTeamName;
  if (patch.priority !== undefined) task.priority = patch.priority;

  await task.save();
  const pub = toPublic(task);
  broadcastTaskUpdated(organizationId, pub);
  return { task: pub };
}
