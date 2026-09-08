import { connectDB } from "@/lib/db/connect";
import { authConfig } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password";
import { User } from "@/models/User";

let initialized = false;

export async function initializeSuperAdmin(): Promise<void> {
  if (initialized) return;

  const { email, password, name, userId } = authConfig.initialSuperAdmin;
  if (!email || !password) {
    initialized = true;
    return;
  }

  await connectDB();

  const existingSuperAdmin = await User.findOne({ role: "SUPER_ADMIN" });
  if (existingSuperAdmin) {
    initialized = true;
    return;
  }

  const passwordHash = await hashPassword(password);

  await User.create({
    name,
    userId: userId.toLowerCase(),
    email: email.toLowerCase(),
    passwordHash,
    role: "SUPER_ADMIN",
    permissions: ["*"],
    organizationId: null,
    status: "ACTIVE",
    passwordChangedAt: new Date(),
  });

  console.info("[AI Campus Guardian] Initial Super Admin account created.");
  initialized = true;
}

export async function ensureDbReady(): Promise<void> {
  await connectDB();
  await initializeSuperAdmin();
}
