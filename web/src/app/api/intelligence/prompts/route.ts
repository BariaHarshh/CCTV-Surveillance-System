import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { AIPromptVersion } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";
import { SYSTEM_GUARDRAILS } from "@/lib/intelligence/safety";

const DEFAULT_PROMPTS: Record<string, string> = {
  system: SYSTEM_GUARDRAILS,
  copilot: "Answer using tool results and published knowledge only. Never invent metrics.",
  incident_summary: "Summarize only confirmed incident fields. Label gaps as unknown.",
  report: "Generate report sections from provided metrics. Do not invent compliance claims.",
  risk: "Describe estimated risk with confidence. Never guarantee future incidents.",
};

/** Seed default published prompts if missing. */
async function ensureDefaultPrompts() {
  for (const [promptKey, content] of Object.entries(DEFAULT_PROMPTS)) {
    const existing = await AIPromptVersion.findOne({ promptKey, status: "PUBLISHED" });
    if (!existing) {
      await AIPromptVersion.create({
        promptKey,
        version: 1,
        content,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireOrgMember();
    await connectDB();
    await ensureDefaultPrompts();
    const key = request.nextUrl.searchParams.get("key");
    const q = key ? { promptKey: key } : {};
    const prompts = await AIPromptVersion.find(q).sort({ promptKey: 1, version: -1 }).limit(100).lean();
    return apiSuccess({
      prompts: prompts.map((p) => ({
        promptKey: p.promptKey,
        version: p.version,
        status: p.status,
        content: p.content,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        createdAt: p.createdAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await connectDB();
    const body = await request.json();
    const promptKey = String(body.promptKey ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!promptKey || !content) return apiError("promptKey and content required.", 400, "VALIDATION_ERROR");
    const latest = await AIPromptVersion.findOne({ promptKey }).sort({ version: -1 });
    const version = (latest?.version ?? 0) + 1;
    const status = body.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const doc = await AIPromptVersion.create({
      promptKey,
      version,
      content,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    });
    return apiSuccess({
      prompt: {
        promptKey: doc.promptKey,
        version: doc.version,
        status: doc.status,
      },
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
