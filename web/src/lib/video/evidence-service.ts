import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { Evidence } from "@/models/Platform";
import {
  VideoEvidenceAccessLog,
  VideoEvidenceMeta,
  VideoEvent,
  VideoLegalHold,
  newVideoId,
} from "@/models/Video";
import { getOrCreateVideoPolicy } from "@/lib/video/pipeline";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";
import { newEnterpriseId } from "@/models/Enterprise";

const EVIDENCE_ROOT = path.join(process.cwd(), ".data", "video-evidence");

function hashBuffer(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function createSnapshotEvidence(opts: {
  organizationId: string;
  user: IUser;
  cameraId: string;
  videoEventId?: string;
  incidentId?: string;
  /** If no real frame bytes, mark unavailable — never fabricate imagery */
  imageBuffer?: Buffer | null;
  demo?: boolean;
}) {
  await connectDB();
  const policy = await getOrCreateVideoPolicy(opts.organizationId);

  if (!opts.imageBuffer || opts.imageBuffer.length === 0) {
    const videoEvidenceId = newVideoId("vdev");
    const meta = await VideoEvidenceMeta.create({
      videoEvidenceId,
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      evidenceId: `pending_${videoEvidenceId}`,
      cameraId: mongoose.Types.ObjectId.isValid(opts.cameraId)
        ? new mongoose.Types.ObjectId(opts.cameraId)
        : null,
      videoEventId: opts.videoEventId ?? null,
      incidentId: opts.incidentId ?? null,
      type: "SNAPSHOT",
      hash: "unavailable",
      available: false,
      unavailableReason: "Recording unavailable.",
      demo: Boolean(opts.demo || policy.demoMode),
      retentionUntil: new Date(
        Date.now() + policy.snapshotRetentionDays * 864e5
      ),
      createdBy: opts.user._id,
    });
    await logAccess(opts.organizationId, videoEvidenceId, "CREATED", opts.user, "snapshot request");
    return meta;
  }

  const hash = hashBuffer(opts.imageBuffer);
  const evidenceId = newEnterpriseId("evd");
  const videoEvidenceId = newVideoId("vdev");
  const storageReference = `video-evidence:${videoEvidenceId}`;
  const dest = path.join(EVIDENCE_ROOT, opts.organizationId, videoEvidenceId);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, opts.imageBuffer);

  await Evidence.create({
    evidenceId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    incidentId: opts.incidentId ?? null,
    type: "SNAPSHOT",
    storageReference,
    hash,
    size: opts.imageBuffer.length,
    uploadedBy: opts.user._id,
    legalHold: false,
    retentionUntil: new Date(Date.now() + policy.snapshotRetentionDays * 864e5),
  });

  const meta = await VideoEvidenceMeta.create({
    videoEvidenceId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    evidenceId,
    cameraId: mongoose.Types.ObjectId.isValid(opts.cameraId)
      ? new mongoose.Types.ObjectId(opts.cameraId)
      : null,
    videoEventId: opts.videoEventId ?? null,
    incidentId: opts.incidentId ?? null,
    type: "SNAPSHOT",
    hash,
    sourceCameraId: opts.cameraId,
    available: true,
    demo: Boolean(opts.demo),
    retentionUntil: new Date(Date.now() + policy.snapshotRetentionDays * 864e5),
    createdBy: opts.user._id,
  });

  if (opts.videoEventId) {
    await VideoEvent.findOneAndUpdate(
      orgFilter(opts.organizationId, { videoEventId: opts.videoEventId }),
      { $set: { evidenceReference: videoEvidenceId } }
    );
  }

  await logAccess(opts.organizationId, videoEvidenceId, "CREATED", opts.user, "snapshot");
  await logAuditEvent({
    actor: opts.user,
    action: "EVIDENCE_CREATED",
    description: `Created video snapshot evidence ${videoEvidenceId}`,
    targetType: "VideoEvidence",
    targetId: videoEvidenceId,
  });

  return meta;
}

export async function requestClip(opts: {
  organizationId: string;
  user: IUser;
  cameraId: string;
  eventAt: Date;
  beforeSec?: number;
  afterSec?: number;
  videoEventId?: string;
}) {
  await connectDB();
  // Historical footage not available without recording store
  const videoEvidenceId = newVideoId("vdev");
  const meta = await VideoEvidenceMeta.create({
    videoEvidenceId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    evidenceId: `clip_unavailable_${videoEvidenceId}`,
    cameraId: mongoose.Types.ObjectId.isValid(opts.cameraId)
      ? new mongoose.Types.ObjectId(opts.cameraId)
      : null,
    videoEventId: opts.videoEventId ?? null,
    type: "VIDEO_CLIP",
    hash: "unavailable",
    clipStart: new Date(opts.eventAt.getTime() - (opts.beforeSec ?? 30) * 1000),
    clipEnd: new Date(opts.eventAt.getTime() + (opts.afterSec ?? 30) * 1000),
    available: false,
    unavailableReason: "Recording unavailable.",
    demo: false,
    createdBy: opts.user._id,
  });
  await logAccess(opts.organizationId, videoEvidenceId, "CREATED", opts.user, "clip request");
  return meta;
}

async function logAccess(
  organizationId: string,
  videoEvidenceId: string,
  action: "CREATED" | "VIEWED" | "DOWNLOADED" | "SHARED" | "ATTACHED_TO_INCIDENT" | "ARCHIVED" | "DELETED" | "EXPORTED",
  user: IUser | null,
  purpose: string,
  extra?: { recipient?: string; expiresAt?: Date; tokenHash?: string }
) {
  await VideoEvidenceAccessLog.create({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    videoEvidenceId,
    action,
    actorId: user?._id ?? null,
    actorName: user?.name ?? "System",
    purpose,
    recipient: extra?.recipient ?? null,
    expiresAt: extra?.expiresAt ?? null,
    tokenHash: extra?.tokenHash ?? null,
    consumedAt: null,
  });
}

function hashDownloadToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function consumeDownloadToken(opts: {
  organizationId: string;
  videoEvidenceId: string;
  token: string;
  actorId?: string;
}) {
  await connectDB();
  if (!opts.token || opts.token.length < 16) return null;
  const tokenHash = hashDownloadToken(opts.token);
  const grant = await VideoEvidenceAccessLog.findOne(
    orgFilter(opts.organizationId, {
      videoEvidenceId: opts.videoEvidenceId,
      action: { $in: ["DOWNLOADED", "SHARED"] },
      tokenHash,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    })
  ).sort({ createdAt: -1 });

  if (!grant) return null;

  grant.consumedAt = new Date();
  await grant.save();
  return grant;
}

export async function listEvidence(organizationId: string) {
  await connectDB();
  const rows = await VideoEvidenceMeta.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(200);
  return rows.map((e) => ({
    videoEvidenceId: e.videoEvidenceId,
    type: e.type,
    available: e.available,
    unavailableReason: e.unavailableReason,
    hash: e.hash,
    demo: e.demo,
    legalHold: e.legalHold,
    retentionUntil: e.retentionUntil?.toISOString() ?? null,
    videoEventId: e.videoEventId,
    createdAt: e.createdAt.toISOString(),
    integrityNote: "Hash detects unexpected modification — not automatic legal validity",
  }));
}

export async function viewEvidence(organizationId: string, user: IUser, videoEvidenceId: string) {
  await connectDB();
  const meta = await VideoEvidenceMeta.findOne(orgFilter(organizationId, { videoEvidenceId }));
  if (!meta) return null;
  await logAccess(organizationId, videoEvidenceId, "VIEWED", user, "view");
  await logAuditEvent({
    actor: user,
    action: "EVIDENCE_VIEWED",
    description: `Viewed video evidence ${videoEvidenceId}`,
    targetType: "VideoEvidence",
    targetId: videoEvidenceId,
  });
  if (!meta.available) {
    return { meta, content: null, message: meta.unavailableReason || "Recording unavailable." };
  }
  const dest = path.join(EVIDENCE_ROOT, organizationId, videoEvidenceId);
  try {
    const buf = await fs.readFile(dest);
    return { meta, content: buf, message: null };
  } catch {
    return { meta, content: null, message: "Recording unavailable." };
  }
}

export async function createDownloadToken(
  organizationId: string,
  user: IUser,
  videoEvidenceId: string
) {
  await connectDB();
  const meta = await VideoEvidenceMeta.findOne(orgFilter(organizationId, { videoEvidenceId }));
  if (!meta || !meta.available) return null;
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashDownloadToken(token);
  await logAccess(organizationId, videoEvidenceId, "DOWNLOADED", user, "download", {
    expiresAt,
    tokenHash,
  });
  await logAuditEvent({
    actor: user,
    action: "EVIDENCE_DOWNLOADED",
    description: `Download authorized for ${videoEvidenceId} (expires ${expiresAt.toISOString()})`,
    targetType: "VideoEvidence",
    targetId: videoEvidenceId,
    severity: "warning",
    metadata: { organizationId },
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    url: `/api/video/evidence/${videoEvidenceId}/download?token=${token}`,
    note: "Time-limited single-use — not a permanent public URL",
  };
}

export async function createLegalHold(
  organizationId: string,
  user: IUser,
  resourceType: string,
  resourceId: string,
  reason: string
) {
  await connectDB();
  const hold = await VideoLegalHold.create({
    holdId: newVideoId("hold"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    resourceType,
    resourceId,
    reason,
    status: "ACTIVE",
    createdBy: user._id,
  });
  if (resourceType === "VideoEvidence") {
    await VideoEvidenceMeta.findOneAndUpdate(
      orgFilter(organizationId, { videoEvidenceId: resourceId }),
      { $set: { legalHold: true } }
    );
    await Evidence.updateMany(
      { organizationId: new mongoose.Types.ObjectId(organizationId), evidenceId: resourceId },
      { $set: { legalHold: true } }
    );
  }
  return hold;
}

export async function cleanupExpiredEvidence(organizationId: string) {
  await connectDB();
  const now = new Date();
  const candidates = await VideoEvidenceMeta.find(
    orgFilter(organizationId, {
      legalHold: false,
      retentionUntil: { $lt: now },
      available: true,
    })
  ).limit(100);

  let deleted = 0;
  for (const c of candidates) {
    const hold = await VideoLegalHold.findOne(
      orgFilter(organizationId, {
        resourceId: c.videoEvidenceId,
        status: "ACTIVE",
      })
    );
    if (hold) continue;
    c.available = false;
    c.unavailableReason = "Expired per retention policy";
    await c.save();
    deleted++;
  }
  return { scanned: candidates.length, expired: deleted };
}

export async function createEvidencePackage(opts: {
  organizationId: string;
  user: IUser;
  incidentId: string;
  videoEventIds?: string[];
  evidenceIds?: string[];
}) {
  await connectDB();
  const videoEvidenceId = newVideoId("vpkg");
  const related = await VideoEvidenceMeta.find(
    orgFilter(opts.organizationId, {
      $or: [
        { incidentId: opts.incidentId },
        ...(opts.videoEventIds?.length
          ? [{ videoEventId: { $in: opts.videoEventIds } }]
          : []),
        ...(opts.evidenceIds?.length
          ? [{ videoEvidenceId: { $in: opts.evidenceIds } }]
          : []),
      ],
    })
  ).limit(50);

  const packagePayload = {
    incidentId: opts.incidentId,
    items: related.map((r) => ({
      videoEvidenceId: r.videoEvidenceId,
      type: r.type,
      hash: r.hash,
      videoEventId: r.videoEventId,
      available: r.available,
    })),
    note: "Permission-controlled package — not automatic legal validity",
  };

  const hash = hashBuffer(Buffer.from(JSON.stringify(packagePayload)));
  const meta = await VideoEvidenceMeta.create({
    videoEvidenceId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    evidenceId: `pkg_${videoEvidenceId}`,
    incidentId: opts.incidentId,
    type: "PACKAGE",
    hash,
    available: true,
    demo: related.some((r) => r.demo),
    createdBy: opts.user._id,
  });

  const dest = path.join(EVIDENCE_ROOT, opts.organizationId, videoEvidenceId);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, JSON.stringify(packagePayload, null, 2));

  await logAccess(opts.organizationId, videoEvidenceId, "CREATED", opts.user, "evidence package");
  await logAuditEvent({
    actor: opts.user,
    action: "EVIDENCE_CREATED",
    description: `Created evidence package ${videoEvidenceId} for incident ${opts.incidentId}`,
    targetType: "VideoEvidence",
    targetId: videoEvidenceId,
  });

  return { meta, packagePayload };
}

export async function shareEvidence(opts: {
  organizationId: string;
  user: IUser;
  videoEvidenceId: string;
  recipient: string;
  purpose: string;
  expiresInMinutes?: number;
}) {
  await connectDB();
  const meta = await VideoEvidenceMeta.findOne(
    orgFilter(opts.organizationId, { videoEvidenceId: opts.videoEvidenceId })
  );
  if (!meta) return null;
  const expiresAt = new Date(Date.now() + (opts.expiresInMinutes ?? 60) * 60_000);
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashDownloadToken(token);
  await logAccess(opts.organizationId, opts.videoEvidenceId, "SHARED", opts.user, opts.purpose, {
    recipient: opts.recipient,
    expiresAt,
    tokenHash,
  });
  await logAuditEvent({
    actor: opts.user,
    action: "EVIDENCE_SHARED",
    description: `Shared ${opts.videoEvidenceId} with ${opts.recipient} until ${expiresAt.toISOString()}`,
    targetType: "VideoEvidence",
    targetId: opts.videoEvidenceId,
    severity: "warning",
    metadata: { organizationId: opts.organizationId },
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    recipient: opts.recipient,
    purpose: opts.purpose,
    url: `/api/video/evidence/${opts.videoEvidenceId}/download?token=${token}`,
    note: "Time-limited single-use controlled access — not a permanent public URL",
  };
}
