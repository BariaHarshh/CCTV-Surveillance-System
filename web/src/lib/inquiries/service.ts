import { connectDB } from "@/lib/db/connect";
import { PurchaseInquiry, type IPurchaseInquiry, type InquiryStatus } from "@/models/PurchaseInquiry";
import { getNextSequence, formatInquiryId } from "@/models/Counter";

export interface CreateInquiryInput {
  name: string;
  email: string;
  phone?: string;
  organizationName: string;
  campusType?: string;
  estimatedCameras?: string;
  requirements: string;
  ipAddress?: string;
  userAgent?: string;
}

function toPublic(doc: IPurchaseInquiry) {
  return {
    id: doc._id.toString(),
    inquiryId: doc.inquiryId,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    organizationName: doc.organizationName,
    campusType: doc.campusType,
    estimatedCameras: doc.estimatedCameras,
    requirements: doc.requirements,
    status: doc.status,
    readAt: doc.readAt?.toISOString() ?? null,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function createInquiry(input: CreateInquiryInput) {
  await connectDB();
  const seq = await getNextSequence("inquiry");
  const inquiry = await PurchaseInquiry.create({
    inquiryId: await formatInquiryId(seq),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() ?? "",
    organizationName: input.organizationName.trim(),
    campusType: input.campusType?.trim() ?? "",
    estimatedCameras: input.estimatedCameras?.trim() ?? "",
    requirements: input.requirements.trim(),
    status: "NEW",
    ipAddress: input.ipAddress ?? "",
    userAgent: (input.userAgent ?? "").slice(0, 500),
  });
  return toPublic(inquiry);
}

export async function listInquiries(params: {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  await connectDB();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = {};

  if (params.status && params.status !== "ALL") filter.status = params.status;

  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { inquiryId: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { organizationName: { $regex: q, $options: "i" } },
      { requirements: { $regex: q, $options: "i" } },
    ];
  }

  const [items, total, unread] = await Promise.all([
    PurchaseInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PurchaseInquiry.countDocuments(filter),
    PurchaseInquiry.countDocuments({ status: "NEW" }),
  ]);

  return {
    inquiries: items.map(toPublic),
    unread,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getInquiryById(id: string) {
  await connectDB();
  if (!id.match(/^[a-f\d]{24}$/i)) return null;
  const inquiry = await PurchaseInquiry.findById(id);
  return inquiry ? toPublic(inquiry) : null;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
  notes?: string
) {
  await connectDB();
  const inquiry = await PurchaseInquiry.findById(id);
  if (!inquiry) return null;

  inquiry.status = status;
  if (status !== "NEW" && !inquiry.readAt) inquiry.readAt = new Date();
  if (typeof notes === "string") inquiry.notes = notes.slice(0, 2000);
  await inquiry.save();
  return toPublic(inquiry);
}

export async function getInquiryStats() {
  await connectDB();
  const [total, unread, contacted] = await Promise.all([
    PurchaseInquiry.countDocuments(),
    PurchaseInquiry.countDocuments({ status: "NEW" }),
    PurchaseInquiry.countDocuments({ status: "CONTACTED" }),
  ]);
  return { total, unread, contacted };
}
