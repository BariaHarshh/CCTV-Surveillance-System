import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { getCameraById } from "@/lib/campus/camera-service";
import { decryptSecret } from "@/lib/security/encrypt";
import { Camera } from "@/models/Camera";
import { orgFilter } from "@/lib/campus/service";

interface StreamSession {
  id: string;
  cameraId: string;
  organizationId: string;
  type: "PROXY" | "HLS" | "NONE";
  proxyPath: string | null;
  expiresAt: number;
}

const sessions = new Map<string, StreamSession>();
const SESSION_TTL_MS = 5 * 60 * 1000;

export async function createStreamSession(organizationId: string, cameraDbId: string) {
  await connectDB();
  const isObjectId = mongoose.Types.ObjectId.isValid(cameraDbId);
  const query = isObjectId ? { _id: cameraDbId } : { cameraId: cameraDbId };
  const camera = await Camera.findOne(orgFilter(organizationId, query))
    .select("+connection.usernameEncrypted +connection.passwordEncrypted");
  if (!camera) return null;

  if (camera.status !== "ONLINE") {
    return {
      available: false,
      type: "NONE" as const,
      message: "Camera offline",
      cameraId: camera.cameraId,
      status: camera.status,
    };
  }

  const protocol = camera.connection.protocol;
  const sessionId = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;

  if (protocol === "HTTP" || protocol === "HTTPS") {
    const rawUrl = camera.connection.streamUrl || "";
    let streamUrl = rawUrl;

    // Decrypt credentials if embedded
    const user = decryptSecret(camera.connection.usernameEncrypted);
    const pass = decryptSecret(camera.connection.passwordEncrypted);
    if (user && pass && rawUrl.startsWith("http")) {
      try {
        const u = new URL(rawUrl);
        u.username = user;
        u.password = pass;
        streamUrl = u.toString();
      } catch {
        streamUrl = rawUrl;
      }
    }

    const session: StreamSession = {
      id: sessionId,
      cameraId: cameraDbId,
      organizationId,
      type: "PROXY",
      proxyPath: `/api/monitoring/streams/${sessionId}`,
      expiresAt,
    };
    sessions.set(sessionId, session);
    scheduleCleanup(sessionId, SESSION_TTL_MS);

    return {
      available: true,
      type: "DIRECT" as const,
      streamId: sessionId,
      url: streamUrl || session.proxyPath,
      proxyUrl: session.proxyPath,
      expiresAt: new Date(expiresAt).toISOString(),
      cameraId: camera.cameraId,
      status: camera.status,
      note: "Authorized direct ML stream URL",
    };
  }

  return {
    available: false,
    type: "NONE" as const,
    message: "Stream gateway required for RTSP/ONVIF. HLS/WebRTC conversion will be provided by the media gateway.",
    cameraId: camera.cameraId,
    status: camera.status,
    streamId: null,
  };
}

export async function getStreamSessionProxy(sessionId: string, organizationId: string) {
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  // Prevent cross-organization stream IDOR when a sessionId is leaked/shared.
  if (session.organizationId !== organizationId) {
    return null;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(session.cameraId);
  const query = isObjectId ? { _id: session.cameraId } : { cameraId: session.cameraId };
  const cam = await Camera.findOne(orgFilter(session.organizationId, query))
    .select("+connection.usernameEncrypted +connection.passwordEncrypted");

  if (!cam || cam.status !== "ONLINE") return null;

  const url = cam.connection.streamUrl;
  if (!url.startsWith("http")) return null;

  let fetchUrl = url;
  const user = decryptSecret(cam.connection.usernameEncrypted);
  const pass = decryptSecret(cam.connection.passwordEncrypted);
  if (user && pass) {
    try {
      const u = new URL(url);
      u.username = user;
      u.password = pass;
      fetchUrl = u.toString();
    } catch {
      fetchUrl = url;
    }
  }

  return { fetchUrl, contentType: "multipart/x-mixed-replace" };
}

export function stopStreamSession(sessionId: string): void {
  sessions.delete(sessionId);
}

function scheduleCleanup(sessionId: string, delay: number) {
  setTimeout(() => sessions.delete(sessionId), delay);
}

export async function listMonitoringCameras(organizationId: string) {
  await connectDB();
  const { listCameras } = await import("@/lib/campus/camera-service");
  const cameras = await listCameras(organizationId);
  return cameras.map((c) => ({
    id: c.id,
    cameraId: c.cameraId,
    name: c.name,
    status: c.status,
    type: c.type,
    location: c.location,
    lastSeen: c.lastSeen,
    hasActiveEvents: false,
  }));
}

