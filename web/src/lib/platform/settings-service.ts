import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import {
  OrganizationProfile,
  OnboardingProgress,
  Invitation,
  Department,
  CustomRole,
  generateOpaqueToken,
  hashToken,
} from "@/models/Platform";
import { Organization } from "@/models/Organization";
import { Campus } from "@/models/Campus";
import { Building } from "@/models/Building";
import { Camera } from "@/models/Camera";
import { User } from "@/models/User";
import { ResponseTeam } from "@/models/ResponseTeam";
import { Playbook } from "@/models/Playbook";
import { getNextSequence } from "@/models/Counter";
import { sendEmailWithRetry } from "@/lib/platform/email-service";

const ONBOARDING_STEPS = [
  "organizationProfile",
  "adminProfile",
  "campus",
  "building",
  "camera",
  "aiProvider",
  "alertRule",
  "responseTeam",
  "playbook",
  "staff",
] as const;

export async function getOrCreateOrgProfile(organizationId: string) {
  await connectDB();
  let profile = await OrganizationProfile.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
  });
  if (!profile) {
    profile = await OrganizationProfile.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
  }
  return profile;
}

export async function updateOrgSettings(
  organizationId: string,
  input: {
    basicInformation?: Partial<{
      name: string;
      legalName: string;
      website: string;
      email: string;
      phone: string;
      logo: string;
    }>;
    location?: Partial<{ country: string; state: string; city: string; address: string }>;
    timezone?: string;
    language?: string;
    currency?: string;
    dateFormat?: string;
    branding?: Partial<{
      logo: string;
      favicon: string;
      primaryColor: string;
      secondaryColor: string;
      emailLogo: string;
      reportLogo: string;
    }>;
    passwordPolicy?: Partial<{
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumber: boolean;
      requireSpecial: boolean;
      expiryDays: number | null;
      historyCount: number;
    }>;
  }
) {
  await connectDB();
  const org = await Organization.findById(organizationId);
  if (!org) throw new Error("Organization not found");

  if (input.basicInformation) {
    org.basicInformation = { ...org.basicInformation, ...input.basicInformation };
  }
  if (input.location) {
    org.location = { ...org.location, ...input.location };
  }
  await org.save();

  const profile = await getOrCreateOrgProfile(organizationId);
  if (input.timezone) profile.timezone = input.timezone;
  if (input.language) profile.language = input.language;
  if (input.currency) profile.currency = input.currency;
  if (input.dateFormat) profile.dateFormat = input.dateFormat;
  if (input.branding) profile.branding = { ...profile.branding, ...input.branding };
  if (input.passwordPolicy) profile.passwordPolicy = { ...profile.passwordPolicy, ...input.passwordPolicy };
  await profile.save();

  return { organization: org, profile };
}

export async function getOnboardingStatus(organizationId: string) {
  await connectDB();
  const oid = new mongoose.Types.ObjectId(organizationId);
  const [org, campusCount, buildingCount, cameraCount, staffCount, teams, playbooks, progress] =
    await Promise.all([
      Organization.findById(oid).lean(),
      Campus.countDocuments({ organizationId: oid }),
      Building.countDocuments({ organizationId: oid }),
      Camera.countDocuments({ organizationId: oid }),
      User.countDocuments({ organizationId: oid, role: "STAFF", deletedAt: null }),
      ResponseTeam.countDocuments({ organizationId: oid }),
      Playbook.countDocuments({ organizationId: oid }),
      OnboardingProgress.findOne({ organizationId: oid }),
    ]);

  const computed: Record<string, boolean> = {
    organizationProfile: Boolean(org?.basicInformation?.name && org?.basicInformation?.email),
    adminProfile: true,
    campus: campusCount > 0,
    building: buildingCount > 0,
    camera: cameraCount > 0,
    aiProvider: false,
    alertRule: false,
    responseTeam: teams > 0,
    playbook: playbooks > 0,
    staff: staffCount > 0,
  };

  const steps = { ...computed, ...(progress?.steps ?? {}) };
  const completed = ONBOARDING_STEPS.filter((s) => steps[s]).length;

  return {
    steps,
    stepOrder: ONBOARDING_STEPS,
    completed,
    total: ONBOARDING_STEPS.length,
    percent: Math.round((completed / ONBOARDING_STEPS.length) * 100),
    completedAt: progress?.completedAt?.toISOString() ?? null,
  };
}

export async function markOnboardingStep(organizationId: string, step: string, done = true) {
  await connectDB();
  const progress = await OnboardingProgress.findOneAndUpdate(
    { organizationId: new mongoose.Types.ObjectId(organizationId) },
    { $set: { [`steps.${step}`]: done } },
    { upsert: true, new: true }
  );
  const status = await getOnboardingStatus(organizationId);
  if (status.completed === status.total && !progress.completedAt) {
    progress.completedAt = new Date();
    await progress.save();
  }
  return getOnboardingStatus(organizationId);
}

export async function createInvitation(
  organizationId: string,
  input: {
    email: string;
    role: "ADMIN" | "STAFF";
    department?: string;
    campusId?: string | null;
    permissions?: string[];
    expiresInDays?: number;
  },
  actor: { id: string; name: string }
) {
  await connectDB();
  const raw = generateOpaqueToken(32);
  const seq = await getNextSequence("invitation");
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000);
  const doc = await Invitation.create({
    invitationId: `INV-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    email: input.email.toLowerCase(),
    role: input.role,
    department: input.department ?? "",
    campusId: input.campusId ?? null,
    permissions: input.permissions ?? [],
    tokenHash: hashToken(raw),
    status: "PENDING",
    expiresAt,
    invitedBy: new mongoose.Types.ObjectId(actor.id),
    invitedByName: actor.name,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendEmailWithRetry({
    to: input.email,
    subject: "You're invited to AI Campus Guardian",
    text: `You have been invited. Accept: ${appUrl}/invite/${raw}`,
  }).catch(() => undefined);

  return {
    id: doc._id.toString(),
    invitationId: doc.invitationId,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    expiresAt: doc.expiresAt.toISOString(),
    /** Dev-only convenience — never log in production pipelines */
    acceptPath: `/invite/${raw}`,
  };
}

export async function listInvitations(organizationId: string) {
  await connectDB();
  const items = await Invitation.find({ organizationId: new mongoose.Types.ObjectId(organizationId) })
    .sort({ createdAt: -1 })
    .lean();
  // Expire stale
  const now = Date.now();
  for (const i of items) {
    if (i.status === "PENDING" && i.expiresAt.getTime() < now) {
      await Invitation.updateOne({ _id: i._id }, { $set: { status: "EXPIRED" } });
      i.status = "EXPIRED";
    }
  }
  return items.map((i) => ({
    id: i._id.toString(),
    invitationId: i.invitationId,
    email: i.email,
    role: i.role,
    department: i.department,
    status: i.status,
    expiresAt: i.expiresAt.toISOString(),
    invitedByName: i.invitedByName,
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function listDepartments(organizationId: string) {
  await connectDB();
  return Department.find({ organizationId: new mongoose.Types.ObjectId(organizationId) })
    .sort({ name: 1 })
    .lean()
    .then((rows) =>
      rows.map((d) => ({
        id: d._id.toString(),
        departmentId: d.departmentId,
        name: d.name,
        description: d.description,
      }))
    );
}

export async function createDepartment(organizationId: string, name: string, description = "") {
  await connectDB();
  const seq = await getNextSequence("department");
  const doc = await Department.create({
    departmentId: `DEP-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name,
    description,
  });
  return {
    id: doc._id.toString(),
    departmentId: doc.departmentId,
    name: doc.name,
    description: doc.description,
  };
}

export async function listCustomRoles(organizationId: string) {
  await connectDB();
  return CustomRole.find({ organizationId: new mongoose.Types.ObjectId(organizationId) })
    .sort({ name: 1 })
    .lean()
    .then((rows) =>
      rows.map((r) => ({
        id: r._id.toString(),
        roleId: r.roleId,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
      }))
    );
}

export async function createCustomRole(
  organizationId: string,
  input: { name: string; description?: string; permissions: string[] }
) {
  await connectDB();
  const seq = await getNextSequence("customrole");
  const doc = await CustomRole.create({
    roleId: `ROLE-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: input.name,
    description: input.description ?? "",
    permissions: input.permissions,
  });
  return {
    id: doc._id.toString(),
    roleId: doc.roleId,
    name: doc.name,
    description: doc.description,
    permissions: doc.permissions,
  };
}
