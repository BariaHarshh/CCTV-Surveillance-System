import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IDailySafetyMetric extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  campusId: string | null;
  buildingId: string | null;
  incidents: number;
  alerts: number;
  emergencies: number;
  criticalEvents: number;
  events: number;
  responseTimeMsAvg: number | null;
  cameraAvailability: number | null;
  aiEvents: number;
  correctiveActions: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailySafetyMetricSchema = new Schema<IDailySafetyMetric>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    date: { type: String, required: true, index: true },
    campusId: { type: String, default: null },
    buildingId: { type: String, default: null },
    incidents: { type: Number, default: 0 },
    alerts: { type: Number, default: 0 },
    emergencies: { type: Number, default: 0 },
    criticalEvents: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    responseTimeMsAvg: { type: Number, default: null },
    cameraAvailability: { type: Number, default: null },
    aiEvents: { type: Number, default: 0 },
    correctiveActions: { type: Number, default: 0 },
    source: { type: String, default: "AGGREGATED" },
  },
  { timestamps: true }
);

DailySafetyMetricSchema.index(
  { organizationId: 1, date: 1, campusId: 1, buildingId: 1 },
  { unique: true }
);

export const DailySafetyMetric: Model<IDailySafetyMetric> =
  mongoose.models.DailySafetyMetric ??
  mongoose.model<IDailySafetyMetric>("DailySafetyMetric", DailySafetyMetricSchema);

export interface IMetricBaseline extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  metric: string;
  location: string;
  baselinePeriod: string;
  mean: number;
  median: number;
  standardDeviation: number;
  sampleCount: number;
  updatedAt: Date;
  createdAt: Date;
}

const MetricBaselineSchema = new Schema<IMetricBaseline>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    metric: { type: String, required: true },
    location: { type: String, default: "ORG" },
    baselinePeriod: { type: String, default: "30d" },
    mean: { type: Number, default: 0 },
    median: { type: Number, default: 0 },
    standardDeviation: { type: Number, default: 0 },
    sampleCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MetricBaselineSchema.index({ organizationId: 1, metric: 1, location: 1 }, { unique: true });

export const MetricBaseline: Model<IMetricBaseline> =
  mongoose.models.MetricBaseline ?? mongoose.model<IMetricBaseline>("MetricBaseline", MetricBaselineSchema);

function periodMetricSchema() {
  return new Schema(
    {
      organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
      date: { type: String, required: true, index: true },
      campusId: { type: String, default: null },
      buildingId: { type: String, default: null },
      incidents: { type: Number, default: 0 },
      alerts: { type: Number, default: 0 },
      emergencies: { type: Number, default: 0 },
      criticalEvents: { type: Number, default: 0 },
      events: { type: Number, default: 0 },
      responseTimeMsAvg: { type: Number, default: null },
      cameraAvailability: { type: Number, default: null },
      aiEvents: { type: Number, default: 0 },
      correctiveActions: { type: Number, default: 0 },
      source: { type: String, default: "AGGREGATED" },
    },
    { timestamps: true }
  );
}

const WeeklySchema = periodMetricSchema();
WeeklySchema.index({ organizationId: 1, date: 1, campusId: 1, buildingId: 1 }, { unique: true });
export const WeeklySafetyMetric =
  mongoose.models.WeeklySafetyMetric ?? mongoose.model("WeeklySafetyMetric", WeeklySchema);

const MonthlySchema = periodMetricSchema();
MonthlySchema.index({ organizationId: 1, date: 1, campusId: 1, buildingId: 1 }, { unique: true });
export const MonthlySafetyMetric =
  mongoose.models.MonthlySafetyMetric ?? mongoose.model("MonthlySafetyMetric", MonthlySchema);
