import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { AnalyticsReport, SavedView } from "@/models/AnalyticsReport";
import { getNextSequence, formatReportId, formatExportId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import type { ReportFormat, ReportType } from "@/lib/analytics/constants";
import {
  getIncidentAnalytics,
  getAlertAnalytics,
  getCameraAnalytics,
  getAIAnalytics,
  getResponseAnalytics,
  getEmergencyAnalytics,
  getLocationRisk,
  getExecutiveOverview,
} from "@/lib/analytics/analytics-service";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import { Incident } from "@/models/Incident";
import { Alert } from "@/models/Alert";
import { baseMatch } from "@/lib/analytics/filters";
import * as XLSX from "xlsx";

const reportQueue: Array<() => Promise<void>> = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (reportQueue.length) {
    const job = reportQueue.shift();
    if (job) await job().catch(console.error);
  }
  processing = false;
}

function toPublic(r: {
  _id: mongoose.Types.ObjectId;
  reportId: string;
  type: string;
  format: string;
  filters: Record<string, unknown>;
  generatedByName: string;
  generatedAt: Date | null;
  version: number;
  status: string;
  error: string | null;
  createdAt: Date;
}) {
  return {
    id: r._id.toString(),
    reportId: r.reportId,
    type: r.type,
    format: r.format,
    filters: r.filters,
    generatedByName: r.generatedByName,
    generatedAt: r.generatedAt?.toISOString() ?? null,
    version: r.version,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    downloadable: r.status === "COMPLETED",
  };
}

async function buildReportPayload(
  organizationId: string,
  type: ReportType,
  filters: AnalyticsFilters
) {
  switch (type) {
    case "INCIDENT":
      return { summary: await getIncidentAnalytics(organizationId, filters) };
    case "ALERT":
      return { summary: await getAlertAnalytics(organizationId, filters) };
    case "CAMERA_HEALTH":
      return { summary: await getCameraAnalytics(organizationId, filters) };
    case "AI_PERFORMANCE":
      return { summary: await getAIAnalytics(organizationId, filters) };
    case "RESPONSE":
      return { summary: await getResponseAnalytics(organizationId, filters) };
    case "EMERGENCY":
      return { summary: await getEmergencyAnalytics(organizationId, filters) };
    case "RISK":
      return { summary: await getLocationRisk(organizationId, filters) };
    case "EXECUTIVE":
      return { summary: await getExecutiveOverview(organizationId, filters) };
    default:
      return { summary: await getIncidentAnalytics(organizationId, filters) };
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "message\nNo data available for this period.\n";
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => JSON.stringify(row[k] ?? "")).join(","));
  }
  return lines.join("\n");
}

async function generateContent(
  organizationId: string,
  type: ReportType,
  format: ReportFormat,
  filters: AnalyticsFilters,
  meta: { generatedBy: string; organizationName?: string }
): Promise<string> {
  const payload = await buildReportPayload(organizationId, type, filters);
  const generatedAt = new Date().toISOString();

  if (type === "INCIDENT" || type === "ALERT") {
    const match = baseMatch(organizationId, filters, type === "INCIDENT" ? "startedAt" : "createdAt");
    const rows =
      type === "INCIDENT"
        ? (await Incident.find(match).sort({ startedAt: -1 }).limit(5000).lean()).map((i) => ({
            incidentId: i.incidentId,
            date: i.startedAt.toISOString().slice(0, 10),
            time: i.startedAt.toISOString().slice(11, 19),
            building: i.location?.building ?? "",
            room: i.location?.room ?? "",
            camera: i.location?.camera ?? "",
            severity: i.severity,
            risk: i.riskScore,
            status: i.status,
            title: i.title,
          }))
        : (await Alert.find(match).sort({ createdAt: -1 }).limit(5000).lean()).map((a) => ({
            alertId: a.alertId,
            date: a.createdAt.toISOString().slice(0, 10),
            time: a.createdAt.toISOString().slice(11, 19),
            type: a.type,
            severity: a.severity,
            status: a.status,
            title: a.title,
          }));

    if (format === "CSV") return toCsv(rows as Record<string, unknown>[]);
    if (format === "EXCEL") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, type);
      return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    }
  }

  // PDF / default: structured text report (jspdf for PDF)
  const lines = [
    "AI CAMPUS GUARDIAN",
    "Safety Intelligence Report",
    `Type: ${type}`,
    `Generated: ${generatedAt}`,
    `Generated By: ${meta.generatedBy}`,
    `Organization: ${meta.organizationName ?? organizationId}`,
    `Filters: ${JSON.stringify(filters)}`,
    "",
    "Summary:",
    JSON.stringify(payload.summary, null, 2),
    "",
    "Confidential — Authorized Users Only",
  ];

  if (format === "PDF") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("AI CAMPUS GUARDIAN", 14, 20);
    doc.setFontSize(11);
    doc.text("Safety Intelligence Report", 14, 28);
    doc.setFontSize(9);
    let y = 40;
    for (const line of lines.slice(2)) {
      const wrapped = doc.splitTextToSize(line, 180);
      for (const w of wrapped) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(w, 14, y);
        y += 5;
      }
    }
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedAt}  |  Confidential — Authorized Users Only`, 14, 290);
    return doc.output("datauristring");
  }

  if (format === "EXCEL") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  }

  return toCsv([{ type, generatedAt, summary: JSON.stringify(payload.summary) }]);
}

export async function createReportJob(
  organizationId: string,
  data: { type: ReportType; format?: ReportFormat; filters?: AnalyticsFilters },
  actor: { id: string; name: string }
) {
  await connectDB();
  const seq = await getNextSequence("report");
  const report = await AnalyticsReport.create({
    reportId: await formatReportId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    type: data.type,
    format: data.format ?? "CSV",
    filters: (data.filters ?? {}) as Record<string, unknown>,
    generatedBy: new mongoose.Types.ObjectId(actor.id),
    generatedByName: actor.name,
    status: "QUEUED",
  });

  const reportId = report._id.toString();
  reportQueue.push(async () => {
    await connectDB();
    const r = await AnalyticsReport.findById(reportId);
    if (!r || r.status === "CANCELLED") return;
    r.status = "GENERATING";
    await r.save();
    try {
      const content = await generateContent(
        organizationId,
        r.type,
        r.format,
        (r.filters ?? {}) as AnalyticsFilters,
        { generatedBy: actor.name }
      );
      r.content = content;
      r.status = "COMPLETED";
      r.generatedAt = new Date();
      r.storageReference = `report:${r.reportId}`;
      r.error = null;
      await r.save();
    } catch (err) {
      r.status = "FAILED";
      r.error = "Report generation failed.";
      await r.save();
      console.error("[report]", err);
    }
  });
  void processQueue();

  return toPublic(report);
}

export async function listReports(organizationId: string) {
  await connectDB();
  const items = await AnalyticsReport.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(50);
  return items.map(toPublic);
}

export async function getReport(organizationId: string, id: string) {
  await connectDB();
  const r = await AnalyticsReport.findOne(orgFilter(organizationId, { _id: id }));
  return r ? toPublic(r) : null;
}

export async function getReportDownload(organizationId: string, id: string) {
  await connectDB();
  const r = await AnalyticsReport.findOne(orgFilter(organizationId, { _id: id }));
  if (!r || r.status !== "COMPLETED" || !r.content) return null;
  return {
    reportId: r.reportId,
    format: r.format,
    content: r.content,
    type: r.type,
  };
}

export async function cancelReport(organizationId: string, id: string) {
  await connectDB();
  const r = await AnalyticsReport.findOne(orgFilter(organizationId, { _id: id }));
  if (!r) return null;
  if (r.status === "COMPLETED" || r.status === "FAILED" || r.status === "CANCELLED") return toPublic(r);
  r.status = "CANCELLED";
  r.error = "Cancelled by user";
  await r.save();
  return toPublic(r);
}

export async function createExportJob(
  organizationId: string,
  data: { type: "INCIDENT" | "ALERT"; filters?: AnalyticsFilters },
  actor: { id: string; name: string }
) {
  // Reuse report pipeline for exports
  return createReportJob(organizationId, { type: data.type, format: "CSV", filters: data.filters }, actor);
}

export async function listSavedViews(organizationId: string, userId: string, dashboard?: string) {
  await connectDB();
  const q: Record<string, unknown> = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (dashboard) q.dashboard = dashboard;
  const items = await SavedView.find(q).sort({ updatedAt: -1 });
  return items.map((v) => ({
    id: v._id.toString(),
    name: v.name,
    dashboard: v.dashboard,
    filters: v.filters,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));
}

export async function saveView(
  organizationId: string,
  userId: string,
  data: { name: string; dashboard: string; filters: Record<string, unknown> }
) {
  await connectDB();
  const view = await SavedView.create({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    name: data.name,
    dashboard: data.dashboard,
    filters: data.filters,
  });
  return {
    id: view._id.toString(),
    name: view.name,
    dashboard: view.dashboard,
    filters: view.filters,
    createdAt: view.createdAt.toISOString(),
  };
}

export async function deleteSavedView(organizationId: string, userId: string, id: string) {
  await connectDB();
  const res = await SavedView.deleteOne({
    _id: id,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  return res.deletedCount > 0;
}

export { formatExportId };
