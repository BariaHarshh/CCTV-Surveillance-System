import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatTeamId } from "@/models/Counter";
import { ResponseTeam, type IResponseTeam } from "@/models/ResponseTeam";
import type { ResponseTeamStatus, ResponseTeamType } from "@/lib/emergency/constants";

function toPublic(t: IResponseTeam) {
  return {
    id: t._id.toString(),
    teamId: t.teamId,
    name: t.name,
    type: t.type,
    status: t.status,
    description: t.description,
    members: t.members.map((m) => ({
      userId: m.userId.toString(),
      name: m.name,
      role: m.role,
    })),
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listResponseTeams(organizationId: string) {
  await connectDB();
  const teams = await ResponseTeam.find(orgFilter(organizationId)).sort({ name: 1 });
  return teams.map(toPublic);
}

export async function createResponseTeam(
  organizationId: string,
  data: {
    name: string;
    type?: ResponseTeamType;
    description?: string;
    members?: Array<{ userId: string; name: string; role?: string }>;
    source?: string;
  }
) {
  await connectDB();
  const seq = await getNextSequence("team");
  const team = await ResponseTeam.create({
    teamId: await formatTeamId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    type: data.type ?? "SECURITY",
    description: data.description ?? "",
    members: (data.members ?? []).map((m) => ({
      userId: new mongoose.Types.ObjectId(m.userId),
      name: m.name,
      role: m.role ?? "Member",
    })),
    status: "AVAILABLE",
    source: data.source ?? "MANUAL",
  });
  return toPublic(team);
}

export async function updateResponseTeam(
  organizationId: string,
  id: string,
  patch: {
    name?: string;
    type?: ResponseTeamType;
    status?: ResponseTeamStatus;
    description?: string;
    currentAssignment?: string;
    members?: Array<{ userId: string; name: string; role?: string }>;
  }
) {
  await connectDB();
  const team = await ResponseTeam.findOne(orgFilter(organizationId, { _id: id }));
  if (!team) return null;
  if (patch.name !== undefined) team.name = patch.name;
  if (patch.type !== undefined) team.type = patch.type;
  if (patch.status !== undefined) team.status = patch.status;
  if (patch.description !== undefined) team.description = patch.description;
  if (patch.currentAssignment !== undefined) team.currentAssignment = patch.currentAssignment;
  if (patch.members !== undefined) {
    team.members = patch.members.map((m) => ({
      userId: new mongoose.Types.ObjectId(m.userId),
      name: m.name,
      role: m.role ?? "Member",
    })) as IResponseTeam["members"];
  }
  await team.save();
  return toPublic(team);
}

export async function getResponseTeamById(organizationId: string, id: string) {
  await connectDB();
  const team = await ResponseTeam.findOne(orgFilter(organizationId, { _id: id }));
  return team ? toPublic(team) : null;
}
