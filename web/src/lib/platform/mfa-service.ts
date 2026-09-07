import crypto from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import { connectDB } from "@/lib/db/connect";
import { UserMfa, hashToken, generateOpaqueToken } from "@/models/Platform";
import { encryptSecret, decryptSecret } from "@/lib/security/encrypt";
import { MFA_RECOVERY_CODE_COUNT } from "@/lib/platform/constants";
import mongoose from "mongoose";

async function verifyTotp(token: string, secret: string) {
  const result = await verify({ token, secret });
  return Boolean(result?.valid);
}

export async function getMfaStatus(userId: string) {
  await connectDB();
  const doc = await UserMfa.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  return {
    enabled: Boolean(doc?.enabled),
    verifiedAt: doc?.verifiedAt?.toISOString() ?? null,
  };
}

export async function beginMfaEnrollment(userId: string, organizationId: string | null, email: string) {
  await connectDB();
  const secret = generateSecret();
  const encrypted = encryptSecret(secret);
  await UserMfa.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        organizationId: organizationId ? new mongoose.Types.ObjectId(organizationId) : null,
        enabled: false,
        secretEncrypted: encrypted,
        recoveryCodeHashes: [],
        verifiedAt: null,
      },
    },
    { upsert: true, new: true }
  );
  const otpauth = generateURI({
    issuer: "AI Campus Guardian",
    label: email,
    secret,
  });
  return { secret, otpauth };
}

export async function verifyAndEnableMfa(userId: string, code: string) {
  await connectDB();
  const doc = await UserMfa.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  if (!doc?.secretEncrypted) throw new Error("MFA enrollment not started");
  const secret = decryptSecret(doc.secretEncrypted);
  const ok = await verifyTotp(code, secret);
  if (!ok) throw new Error("Invalid MFA code");

  const recoveryCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < MFA_RECOVERY_CODE_COUNT; i++) {
    const codeRaw = generateOpaqueToken(10);
    recoveryCodes.push(codeRaw);
    hashes.push(hashToken(codeRaw));
  }
  doc.enabled = true;
  doc.verifiedAt = new Date();
  doc.recoveryCodeHashes = hashes;
  await doc.save();
  return { recoveryCodes };
}

export async function verifyMfaLogin(userId: string, code: string) {
  await connectDB();
  const doc = await UserMfa.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  if (!doc?.enabled || !doc.secretEncrypted) return false;
  const secret = decryptSecret(doc.secretEncrypted);
  if (await verifyTotp(code, secret)) return true;

  const hashed = hashToken(code);
  const idx = doc.recoveryCodeHashes.indexOf(hashed);
  if (idx >= 0) {
    doc.recoveryCodeHashes.splice(idx, 1);
    await doc.save();
    return true;
  }
  return false;
}

export async function disableMfa(userId: string) {
  await connectDB();
  await UserMfa.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId) },
    { $set: { enabled: false, secretEncrypted: "", recoveryCodeHashes: [], verifiedAt: null } }
  );
}

export async function regenerateRecoveryCodes(userId: string) {
  await connectDB();
  const doc = await UserMfa.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  if (!doc?.enabled) throw new Error("MFA is not enabled");
  const recoveryCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < MFA_RECOVERY_CODE_COUNT; i++) {
    const codeRaw = generateOpaqueToken(10);
    recoveryCodes.push(codeRaw);
    hashes.push(hashToken(codeRaw));
  }
  doc.recoveryCodeHashes = hashes;
  await doc.save();
  return { recoveryCodes };
}

export function hashApiKey(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
