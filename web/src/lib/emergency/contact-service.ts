import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatContactId, formatMessageId } from "@/models/Counter";
import { EmergencyContact, type IEmergencyContact } from "@/models/EmergencyContact";
import { EmergencyMessage, type IEmergencyMessage } from "@/models/EmergencyMessage";
import { Emergency } from "@/models/Emergency";
import { broadcastEmergencyUpdated } from "@/lib/monitoring/socket-emitter";

function contactToPublic(c: IEmergencyContact) {
  return {
    id: c._id.toString(),
    contactId: c.contactId,
    name: c.name,
    department: c.department,
    role: c.role,
    phone: c.phone,
    email: c.email,
    availability: c.availability,
    priority: c.priority,
    enabled: c.enabled,
    source: c.source,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function messageToPublic(m: IEmergencyMessage) {
  return {
    id: m._id.toString(),
    messageId: m.messageId,
    emergencyId: m.emergencyId.toString(),
    senderId: m.senderId.toString(),
    senderName: m.senderName,
    message: m.message,
    editedAt: m.editedAt?.toISOString() ?? null,
    source: m.source,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function listContacts(organizationId: string) {
  await connectDB();
  const contacts = await EmergencyContact.find(orgFilter(organizationId)).sort({ priority: 1, name: 1 });
  return contacts.map(contactToPublic);
}

export async function createContact(
  organizationId: string,
  data: {
    name: string;
    department?: string;
    role?: string;
    phone?: string;
    email?: string;
    availability?: string;
    priority?: number;
  }
) {
  await connectDB();
  const seq = await getNextSequence("contact");
  const contact = await EmergencyContact.create({
    contactId: await formatContactId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    department: data.department ?? "",
    role: data.role ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    availability: data.availability ?? "24/7",
    priority: data.priority ?? 1,
    enabled: true,
  });
  return contactToPublic(contact);
}

export async function updateContact(
  organizationId: string,
  id: string,
  patch: Partial<{
    name: string;
    department: string;
    role: string;
    phone: string;
    email: string;
    availability: string;
    priority: number;
    enabled: boolean;
  }>
) {
  await connectDB();
  const contact = await EmergencyContact.findOne(orgFilter(organizationId, { _id: id }));
  if (!contact) return null;
  Object.assign(contact, patch);
  await contact.save();
  return contactToPublic(contact);
}

export async function listMessages(organizationId: string, emergencyId: string) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: emergencyId }));
  if (!emergency) return { error: "NOT_FOUND" as const };
  const messages = await EmergencyMessage.find(orgFilter(organizationId, { emergencyId })).sort({ createdAt: 1 });
  return { messages: messages.map(messageToPublic) };
}

export async function sendMessage(
  organizationId: string,
  emergencyId: string,
  actor: { id: string; name: string },
  message: string,
  source?: string
) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { _id: emergencyId }));
  if (!emergency) return { error: "NOT_FOUND" as const };

  const seq = await getNextSequence("message");
  const msg = await EmergencyMessage.create({
    messageId: await formatMessageId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    emergencyId: emergency._id,
    senderId: new mongoose.Types.ObjectId(actor.id),
    senderName: actor.name,
    message,
    source: source ?? "MANUAL",
  });

  emergency.timeline.push({
    action: "EMERGENCY_MESSAGE_SENT",
    description: `${actor.name}: ${message.slice(0, 120)}`,
    actorId: new mongoose.Types.ObjectId(actor.id),
    actorName: actor.name,
    timestamp: new Date(),
  });
  await emergency.save();
  broadcastEmergencyUpdated(organizationId, { id: emergency._id.toString(), emergencyId: emergency.emergencyId });

  return { message: messageToPublic(msg) };
}
