import { connectDB } from "@/lib/db/connect";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { authConfig } from "@/lib/auth/config";
import { Session } from "@/models/Session";
import { User, type IUser } from "@/models/User";

export async function authenticateSocketSession(cookieHeader: string | undefined): Promise<IUser | null> {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`${authConfig.cookieName}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;

  await connectDB();
  const lookup = hashLookupToken(token);
  const session = await Session.findOne({
    tokenLookup: lookup,
    isValid: true,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const user = await User.findById(session.userId);
  if (!user || user.status !== "ACTIVE") return null;

  session.lastActivity = new Date();
  await session.save();

  return user;
}
