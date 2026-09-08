import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatPlaybookId } from "@/models/Counter";
import { Playbook, type IPlaybook } from "@/models/Playbook";
import { DEFAULT_PLAYBOOKS, type PlaybookCategory } from "@/lib/emergency/constants";

function toPublic(p: IPlaybook) {
  return {
    id: p._id.toString(),
    playbookId: p.playbookId,
    name: p.name,
    category: p.category,
    description: p.description,
    steps: p.steps,
    version: p.version,
    enabled: p.enabled,
    createdByName: p.createdByName,
    updatedByName: p.updatedByName,
    source: p.source,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function ensureDefaultPlaybooks(organizationId: string, actor?: { id: string; name: string }) {
  await connectDB();
  const count = await Playbook.countDocuments(orgFilter(organizationId));
  if (count > 0) return;
  for (const def of DEFAULT_PLAYBOOKS) {
    const seq = await getNextSequence("playbook");
    await Playbook.create({
      playbookId: await formatPlaybookId(seq),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: def.name,
      category: def.category,
      description: def.description,
      steps: def.steps.map((title, i) => ({ order: i + 1, title, description: "" })),
      version: 1,
      enabled: true,
      createdBy: actor ? new mongoose.Types.ObjectId(actor.id) : null,
      createdByName: actor?.name ?? "System",
      source: "SYSTEM",
    });
  }
}

export async function listPlaybooks(organizationId: string) {
  await ensureDefaultPlaybooks(organizationId);
  const items = await Playbook.find(orgFilter(organizationId)).sort({ category: 1, name: 1 });
  return items.map(toPublic);
}

export async function createPlaybook(
  organizationId: string,
  data: {
    name: string;
    category: PlaybookCategory;
    description?: string;
    steps?: Array<{ order?: number; title: string; description?: string }>;
  },
  actor: { id: string; name: string }
) {
  await connectDB();
  const seq = await getNextSequence("playbook");
  const playbook = await Playbook.create({
    playbookId: await formatPlaybookId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    category: data.category,
    description: data.description ?? "",
    steps: (data.steps ?? []).map((s, i) => ({
      order: s.order ?? i + 1,
      title: s.title,
      description: s.description ?? "",
    })),
    version: 1,
    enabled: true,
    createdBy: new mongoose.Types.ObjectId(actor.id),
    createdByName: actor.name,
    updatedBy: new mongoose.Types.ObjectId(actor.id),
    updatedByName: actor.name,
  });
  return toPublic(playbook);
}

export async function updatePlaybook(
  organizationId: string,
  id: string,
  patch: {
    name?: string;
    category?: PlaybookCategory;
    description?: string;
    steps?: Array<{ order: number; title: string; description?: string }>;
    enabled?: boolean;
  },
  actor: { id: string; name: string }
) {
  await connectDB();
  const playbook = await Playbook.findOne(orgFilter(organizationId, { _id: id }));
  if (!playbook) return null;
  if (patch.name !== undefined) playbook.name = patch.name;
  if (patch.category !== undefined) playbook.category = patch.category;
  if (patch.description !== undefined) playbook.description = patch.description;
  if (patch.enabled !== undefined) playbook.enabled = patch.enabled;
  if (patch.steps !== undefined) {
    playbook.steps = patch.steps.map((s) => ({
      order: s.order,
      title: s.title,
      description: s.description ?? "",
    }));
    playbook.version += 1;
  }
  playbook.updatedBy = new mongoose.Types.ObjectId(actor.id);
  playbook.updatedByName = actor.name;
  await playbook.save();
  return toPublic(playbook);
}

export async function duplicatePlaybook(
  organizationId: string,
  id: string,
  actor: { id: string; name: string }
) {
  await connectDB();
  const original = await Playbook.findOne(orgFilter(organizationId, { _id: id }));
  if (!original) return null;
  return createPlaybook(
    organizationId,
    {
      name: `${original.name} (Copy)`,
      category: original.category,
      description: original.description,
      steps: original.steps.map((s) => ({ order: s.order, title: s.title, description: s.description })),
    },
    actor
  );
}

export async function getPlaybookById(organizationId: string, id: string) {
  await connectDB();
  const p = await Playbook.findOne(orgFilter(organizationId, { _id: id }));
  return p ? toPublic(p) : null;
}
