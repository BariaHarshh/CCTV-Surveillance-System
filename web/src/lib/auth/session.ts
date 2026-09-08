import crypto from "crypto";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { Session } from "@/models/Session";
import { User, type IUser } from "@/models/User";
import { connectDB } from "@/lib/db/connect";

function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function getSessionExpiry(rememberMe: boolean): Date {
  const now = new Date();
  if (rememberMe) {
    now.setDate(now.getDate() + authConfig.rememberMeDays);
  } else {
    now.setMinutes(now.getMinutes() + authConfig.sessionExpiresMinutes);
  }
  return now;
}

export async function createSession(
  userId: string,
  rememberMe: boolean,
  userAgent: string,
  ipAddress: string
): Promise<string> {
  await connectDB();

  const rawToken = generateSessionToken();
  const tokenLookup = hashLookupToken(rawToken);
  const expiresAt = getSessionExpiry(rememberMe);

  await Session.create({
    userId,
    tokenLookup,
    rememberMe,
    userAgent,
    ipAddress,
    lastActivity: new Date(),
    expiresAt,
    isValid: true,
  });

  return rawToken;
}

export async function setSessionCookie(token: string, rememberMe: boolean): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = rememberMe
    ? authConfig.rememberMeDays * 24 * 60 * 60
    : authConfig.sessionExpiresMinutes * 60;

  cookieStore.set(authConfig.cookieName, token, {
    httpOnly: true,
    secure: authConfig.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(authConfig.cookieName, "", {
    httpOnly: true,
    secure: authConfig.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(authConfig.cookieName)?.value ?? null;
}

export async function invalidateSession(token: string): Promise<void> {
  await connectDB();
  const tokenLookup = hashLookupToken(token);
  await Session.updateOne({ tokenLookup, isValid: true }, { isValid: false });
}

export async function invalidateAllUserSessions(
  userId: string,
  exceptToken?: string
): Promise<void> {
  await connectDB();

  if (exceptToken) {
    const exceptLookup = hashLookupToken(exceptToken);
    await Session.updateMany(
      { userId, isValid: true, tokenLookup: { $ne: exceptLookup } },
      { isValid: false }
    );
  } else {
    await Session.updateMany({ userId, isValid: true }, { isValid: false });
  }
}

export interface AuthSessionResult {
  user: IUser;
  sessionId: string;
}

export async function getAuthSession(): Promise<AuthSessionResult | null> {
  const token = await getSessionTokenFromCookie();
  if (!token) return null;

  await connectDB();

  const tokenLookup = hashLookupToken(token);
  const session = await Session.findOne({
    tokenLookup,
    isValid: true,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const user = await User.findById(session.userId);
  if (!user) {
    session.isValid = false;
    await session.save();
    return null;
  }

  if (user.status !== "ACTIVE") {
    session.isValid = false;
    await session.save();
    return null;
  }

  session.lastActivity = new Date();
  await session.save();

  user.lastActive = new Date();
  await user.save();

  return { user, sessionId: session._id.toString() };
}

export async function requireAuth(): Promise<IUser> {
  const session = await getAuthSession();
  if (!session) {
    throw new AuthError("UNAUTHORIZED", "Authentication required.");
  }
  return session.user;
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}