import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { KnowledgeChunk, KnowledgeDocument } from "@/models/Intelligence";

const DIM = 64;

/** Local deterministic embedding — org-scoped RAG without requiring an external embedding API. */
export function embedText(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const t of tokens) {
    const h = crypto.createHash("sha256").update(t).digest();
    for (let i = 0; i < DIM; i++) {
      vec[i] += (h[i % h.length] / 255) * 2 - 1;
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

export function chunkText(text: string, size = 800): Array<{ section: string; content: string }> {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const parts: Array<{ section: string; content: string }> = [];
  const paragraphs = cleaned.split(/\n{2,}/);
  let buf = "";
  let idx = 1;
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > size && buf) {
      parts.push({ section: `Section ${idx++}`, content: buf.trim() });
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) parts.push({ section: `Section ${idx}`, content: buf.trim() });
  return parts;
}

export async function indexDocument(opts: {
  organizationId: string;
  documentId: string;
  version: number;
  text: string;
}) {
  await connectDB();
  await KnowledgeChunk.deleteMany({
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    documentId: opts.documentId,
  });
  const chunks = chunkText(opts.text);
  for (const c of chunks) {
    await KnowledgeChunk.create({
      chunkId: `chk_${crypto.randomBytes(8).toString("hex")}`,
      documentId: opts.documentId,
      organizationId: new mongoose.Types.ObjectId(opts.organizationId),
      version: opts.version,
      section: c.section,
      content: c.content,
      embedding: embedText(c.content),
      tokenEstimate: Math.ceil(c.content.length / 4),
    });
  }
  await KnowledgeDocument.updateOne(
    { documentId: opts.documentId, organizationId: new mongoose.Types.ObjectId(opts.organizationId) },
    { $set: { chunkCount: chunks.length } }
  );
  return { chunkCount: chunks.length };
}

/** Always organization-scoped — never cross-org retrieval. */
export async function searchKnowledge(organizationId: string, query: string, limit = 5) {
  await connectDB();
  const published = await KnowledgeDocument.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    status: "PUBLISHED",
  })
    .sort({ title: 1, version: -1 })
    .lean();

  // Prefer latest published version per title
  const latestByTitle = new Map<string, (typeof published)[0]>();
  for (const d of published) {
    if (!latestByTitle.has(d.title)) latestByTitle.set(d.title, d);
  }
  const allowedIds = new Set([...latestByTitle.values()].map((d) => d.documentId));

  const qVec = embedText(query);
  const chunks = await KnowledgeChunk.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    documentId: { $in: [...allowedIds] },
  })
    .limit(200)
    .lean();

  const scored = chunks
    .map((c) => ({
      ...c,
      score: cosine(qVec, c.embedding?.length ? c.embedding : embedText(c.content)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const docMap = new Map([...latestByTitle.values()].map((d) => [d.documentId, d]));
  return scored.map((c) => {
    const doc = docMap.get(c.documentId);
    return {
      documentId: c.documentId,
      title: doc?.title ?? "Document",
      section: c.section,
      version: `v${c.version}`,
      content: c.content,
      score: c.score,
      href: `/admin/ai/knowledge`,
    };
  });
}
