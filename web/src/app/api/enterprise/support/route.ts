import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { SupportTicket, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember();
    const tickets = await SupportTicket.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return apiSuccess({ tickets });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  subject: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid ticket.", 400, "VALIDATION_ERROR");

    const ticket = await SupportTicket.create({
      ticketId: newEnterpriseId("tkt"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      createdBy: user._id,
      subject: parsed.data.subject,
      description: parsed.data.description ?? "",
      category: parsed.data.category ?? "GENERAL",
      priority: parsed.data.priority ?? "MEDIUM",
      status: "OPEN",
    });
    return apiSuccess({ ticket }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedTo: z.string().nullable().optional(),
  description: z.string().max(5000).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid ticket update.", 400, "VALIDATION_ERROR");

    const ticket = await SupportTicket.findOne({
      ticketId: parsed.data.ticketId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!ticket) return apiError("Ticket not found.", 404, "NOT_FOUND");

    if (parsed.data.status != null) {
      ticket.status = parsed.data.status;
      if (parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED") {
        ticket.resolvedAt = new Date();
      }
    }
    if (parsed.data.priority != null) ticket.priority = parsed.data.priority;
    if (parsed.data.description != null) ticket.description = parsed.data.description;
    if (parsed.data.assignedTo !== undefined) {
      ticket.assignedTo = parsed.data.assignedTo
        ? new mongoose.Types.ObjectId(parsed.data.assignedTo)
        : null;
    }
    await ticket.save();
    return apiSuccess({ ticket });
  } catch (error) {
    return handleApiError(error);
  }
}
