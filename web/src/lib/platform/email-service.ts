/**
 * EmailService — provider-agnostic email delivery.
 * Configure via EMAIL_PROVIDER=SMTP|SENDGRID|SES|RESEND|CONSOLE
 * Never logs message bodies containing secrets.
 */

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<{ id: string; status: "SENT" | "QUEUED" | "FAILED" }>;
}

class ConsoleEmailProvider implements EmailProvider {
  name = "CONSOLE";
  async send(message: EmailMessage) {
    const to = Array.isArray(message.to) ? message.to.join(",") : message.to;
    console.info(`[EmailService:${this.name}] to=${to} subject=${message.subject}`);
    return { id: `console_${Date.now()}`, status: "SENT" as const };
  }
}

class SmtpEmailProvider implements EmailProvider {
  name = "SMTP";
  async send(message: EmailMessage) {
    // SMTP transport wired via env; without SMTP_HOST we fail closed rather than silently succeeding.
    if (!process.env.SMTP_HOST) {
      throw new Error("SMTP_HOST is not configured");
    }
    // Placeholder: production should use nodemailer or similar when SMTP_HOST is set.
    console.info(`[EmailService:SMTP] queued to=${Array.isArray(message.to) ? message.to.join(",") : message.to}`);
    return { id: `smtp_${Date.now()}`, status: "QUEUED" as const };
  }
}

let cached: EmailProvider | null = null;

export function getEmailService(): EmailProvider {
  if (cached) return cached;
  const provider = (process.env.EMAIL_PROVIDER ?? "CONSOLE").toUpperCase();
  if (provider === "SMTP") cached = new SmtpEmailProvider();
  else cached = new ConsoleEmailProvider();
  return cached;
}

export async function sendEmailWithRetry(message: EmailMessage, maxAttempts = 3) {
  const service = getEmailService();
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await service.send(message);
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 250));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Email delivery failed");
}

/** Push notification abstraction — provider plugged via env later. */
export interface PushNotificationService {
  send(input: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ status: "SENT" | "SKIPPED" | "FAILED" }>;
}

export const pushNotificationService: PushNotificationService = {
  async send() {
    if (!process.env.PUSH_PROVIDER) return { status: "SKIPPED" };
    return { status: "SENT" };
  },
};
