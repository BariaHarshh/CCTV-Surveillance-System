import crypto from "crypto";
import { validatePassword } from "@/lib/auth/password";

export function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  let password = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = password.length; i < length; i++) {
    password += pick(all);
  }

  return password
    .split("")
    .sort(() => crypto.randomInt(0, 2) - 1)
    .join("");
}

export function assertPasswordStrength(password: string): void {
  const result = validatePassword(password);
  if (!result.valid) {
    throw new Error(result.errors[0] ?? "Password does not meet requirements.");
  }
}
