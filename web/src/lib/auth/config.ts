export const authConfig = {
  get mongodbUri() {
    return process.env.MONGODB_URI ?? "";
  },
  sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production-min-32",
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production-min-32",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ?? "dev-jwt-refresh-secret-change-in-production-min-32",
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? "5", 10),
  lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES ?? "15", 10),
  sessionExpiresMinutes: parseInt(process.env.SESSION_EXPIRES_MINUTES ?? "60", 10),
  rememberMeDays: parseInt(process.env.REMEMBER_ME_DAYS ?? "30", 10),
  cookieName: "acg_session",
  initialSuperAdmin: {
    email: process.env.INITIAL_SUPER_ADMIN_EMAIL,
    password: process.env.INITIAL_SUPER_ADMIN_PASSWORD,
    name: process.env.INITIAL_SUPER_ADMIN_NAME ?? "Platform Super Admin",
    userId: process.env.INITIAL_SUPER_ADMIN_USER_ID ?? "superadmin",
  },
  isProduction: process.env.NODE_ENV === "production",
} as const;

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED", "PENDING"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_ACTIVITY_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "ACCOUNT_LOCKED",
  "PASSWORD_RESET_REQUEST",
  "PASSWORD_CHANGED",
] as const;
export type AuthActivityType = (typeof AUTH_ACTIVITY_TYPES)[number];
