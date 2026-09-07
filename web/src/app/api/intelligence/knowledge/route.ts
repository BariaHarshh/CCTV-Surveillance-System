import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { indexDocument } from "@/lib/intelligence/rag";
import { getOrCreatePrivacy } from "@/lib/intelligence/orchestrator";
import { KnowledgeDocument } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    await connectDB();
    const docs = await KnowledgeDocument.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: { $ne: "ARCHIVED" },
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return apiSuccess({
      documents: docs.map((d) => ({
        documentId: d.documentId,
        title: d.title,
        type: d.type,
        version: d.version,
        status: d.status,
        chunkCount: d.chunkCount,
        mimeType: d.mimeType,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.string().min(1).max(64).default("POLICY"),
  text: z.string().min(1).max(200_000),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const privacy = await getOrCreatePrivacy(organizationId);
    if (!privacy.knowledgeBaseEnabled || !privacy.documentIndexingEnabled) {
      return apiError("Knowledge base is disabled for this organization.", 403, "FEATURE_NOT_AVAILABLE");
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    await connectDB();
    const documentId = `doc_${crypto.randomBytes(8).toString("hex")}`;
    const doc = await KnowledgeDocument.create({
      documentId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      title: parsed.data.title,
      type: parsed.data.type,
      version: 1,
      status: parsed.data.status,
      mimeType: "text/markdown",
      textContent: parsed.data.text,
      uploadedBy: user._id,
      chunkCount: 0,
    });

    if (parsed.data.status === "PUBLISHED") {
      const indexed = await indexDocument({
        organizationId,
        documentId,
        version: 1,
        text: parsed.data.text,
      });
      doc.chunkCount = indexed.chunkCount;
      await doc.save();
    }

    return apiSuccess({
      document: {
        documentId: doc.documentId,
        title: doc.title,
        type: doc.type,
        version: doc.version,
        status: doc.status,
        chunkCount: doc.chunkCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  documentId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const privacy = await getOrCreatePrivacy(organizationId);
    if (!privacy.knowledgeBaseEnabled) {
      return apiError("Knowledge base is disabled for this organization.", 403, "FEATURE_NOT_AVAILABLE");
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    await connectDB();
    const doc = await KnowledgeDocument.findOne({
      documentId: parsed.data.documentId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!doc) return apiError("Document not found.", 404, "RESOURCE_NOT_FOUND");

    doc.status = parsed.data.status;
    if (parsed.data.status === "PUBLISHED") {
      const indexed = await indexDocument({
        organizationId,
        documentId: doc.documentId,
        version: doc.version,
        text: doc.textContent,
      });
      doc.chunkCount = indexed.chunkCount;
    }
    await doc.save();

    return apiSuccess({
      document: {
        documentId: doc.documentId,
        title: doc.title,
        status: doc.status,
        chunkCount: doc.chunkCount,
        version: doc.version,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
