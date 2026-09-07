import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter, getOrCreateCampus } from "@/lib/campus/service";
import { Campus } from "@/models/Campus";
import { Building } from "@/models/Building";
import { Camera } from "@/models/Camera";
import { Incident } from "@/models/Incident";
import { Alert } from "@/models/Alert";
import { Emergency } from "@/models/Emergency";
import { ResponseTeam } from "@/models/ResponseTeam";
import { Room } from "@/models/Room";
import {
  AssemblyArea,
  EmergencyExit,
  EmergencyMapOverlay,
  Floor,
  FloorPlan,
  MapAsset,
  MapObject,
  Zone,
  newMapId,
} from "@/models/Map";
import {
  clusterPoints,
  dayPartFromHour,
  fromGeoPoint,
  inBounds,
  parseBounds,
  resolveTimeRange,
  riskLevelFromScore,
  type Bounds,
} from "@/lib/map/geo";
import { MAP_VIEWPORT_LIMIT } from "@/lib/map/constants";
import type { IUser } from "@/models/User";
import { redactCoordinates, resolveLocationPrecision } from "@/lib/map/privacy";
import { canViewTeamLocations } from "@/lib/map/permissions";

function mapCameraHealthStatus(status: string): string {
  if (status === "ONLINE") return "ONLINE";
  if (status === "OFFLINE" || status === "DISABLED") return "OFFLINE";
  if (status === "ERROR" || status === "CONNECTING") return "DEGRADED";
  if (status === "MAINTENANCE") return "MAINTENANCE";
  return "UNKNOWN";
}

function mapTeamStatus(status: string, assignment: string): string {
  if (status === "AVAILABLE") return "AVAILABLE";
  if (status === "BUSY") return assignment ? "ASSIGNED" : "RESPONDING";
  return "UNAVAILABLE";
}

async function ensureFloorsForBuilding(
  organizationId: string,
  campusId: mongoose.Types.ObjectId,
  building: { _id: mongoose.Types.ObjectId; floors: number; name: string }
) {
  const count = Math.max(1, building.floors || 1);
  const floors = [];
  for (let level = 1; level <= count; level++) {
    const existing = await Floor.findOne(
      orgFilter(organizationId, { buildingId: building._id, level })
    );
    if (existing) {
      floors.push(existing);
      continue;
    }
    const created = await Floor.create({
      floorId: newMapId("flr"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      campusId,
      buildingId: building._id,
      level,
      name: `Floor ${level}`,
      status: "ACTIVE",
    });
    floors.push(created);
  }
  return floors;
}

export async function getMapBootstrap(organizationId: string, user: IUser) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const buildings = await Building.find(orgFilter(organizationId, { campusId: campus._id })).sort({
    name: 1,
  });

  const activeEmergency = await Emergency.findOne(
    orgFilter(organizationId, {
      status: { $in: ["ACTIVE", "CONTAINED"] },
    })
  )
    .sort({ createdAt: -1 })
    .lean();

  const center =
    campus.coordinates?.lat != null && campus.coordinates?.lng != null
      ? { lat: campus.coordinates.lat, lng: campus.coordinates.lng }
      : buildings.find((b) => b.coordinates?.lat != null && b.coordinates?.lng != null)
        ? {
            lat: buildings.find((b) => b.coordinates?.lat != null)!.coordinates.lat!,
            lng: buildings.find((b) => b.coordinates?.lng != null)!.coordinates.lng!,
          }
        : null;

  return {
    campus: {
      id: campus._id.toString(),
      campusId: campus.campusId,
      name: campus.name,
      address: campus.address,
      coordinates: campus.coordinates,
      status: campus.status,
      hasCoordinates: campus.coordinates?.lat != null && campus.coordinates?.lng != null,
    },
    campuses: [
      {
        id: campus._id.toString(),
        campusId: campus.campusId,
        name: campus.name,
        coordinates: campus.coordinates,
      },
    ],
    buildings: buildings.map((b) => ({
      id: b._id.toString(),
      buildingId: b.buildingId,
      name: b.name,
      code: b.code,
      floors: b.floors,
      address: b.address,
      coordinates: b.coordinates,
      status: b.status,
      hasCoordinates: b.coordinates?.lat != null && b.coordinates?.lng != null,
    })),
    center,
    mapDataQuality: {
      message: center
        ? "Map center from configured campus/building coordinates."
        : "No geographic coordinates configured. Add campus or building lat/lng to enable geographic map.",
      source: "Admin Configuration",
    },
    activeEmergency: activeEmergency
      ? {
          emergencyId: activeEmergency.emergencyId,
          type: activeEmergency.type,
          severity: activeEmergency.severity,
          status: activeEmergency.status,
          location: activeEmergency.location,
        }
      : null,
    permissions: {
      canEdit: user.role === "ADMIN",
      canExport: user.role === "ADMIN",
      canViewTeamLocations: resolveLocationPrecision(user, "team") !== "HIDDEN",
      canViewSensitive: resolveLocationPrecision(user, "sensitive") === "EXACT",
    },
    legend: true,
    serverNow: new Date().toISOString(),
  };
}

export async function getViewportObjects(
  organizationId: string,
  user: IUser,
  params: {
    campusId?: string | null;
    bounds?: string | null;
    zoom?: number;
    layers?: string[];
    severity?: string | null;
    cameraStatus?: string | null;
    timeRange?: string;
    from?: string | null;
    to?: string | null;
    q?: string | null;
  }
) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const bounds = parseBounds(params.bounds ?? undefined);
  const zoom = params.zoom ?? 15;
  const layers = new Set(params.layers?.length ? params.layers : ["buildings", "cameras", "incidents", "alerts", "responseTeams", "exits", "assemblyAreas", "assets", "zones"]);
  const { from, to } = resolveTimeRange(params.timeRange ?? "7D", params.from, params.to);

  const filterLatLng = <T extends { lat: number; lng: number }>(items: T[]) =>
    bounds ? items.filter((i) => inBounds(i.lat, i.lng, bounds)) : items;

  const result: Record<string, unknown> = {
    campusId: campus._id.toString(),
    bounds,
    zoom,
    timeRange: { from: from.toISOString(), to: to.toISOString() },
    coverageDisclaimer:
      "Camera coverage areas are configuration estimates, not calibrated physical coverage.",
    liveTrackingNote:
      "Team markers show last known location only unless live tracking is configured.",
  };

  if (layers.has("buildings")) {
    const buildings = await Building.find(orgFilter(organizationId)).limit(500);
    const markers = filterLatLng(
      buildings
        .filter((b) => b.coordinates?.lat != null && b.coordinates?.lng != null)
        .map((b) => ({
          id: b._id.toString(),
          buildingId: b.buildingId,
          name: b.name,
          type: "BUILDING",
          lat: b.coordinates.lat!,
          lng: b.coordinates.lng!,
          floors: b.floors,
          status: b.status,
        }))
    );
    result.buildings = markers.slice(0, MAP_VIEWPORT_LIMIT);
  }

  if (layers.has("cameras")) {
    const cams = await Camera.find(orgFilter(organizationId)).limit(5000);
    const camPrecision = resolveLocationPrecision(user, "camera");
    const markers = filterLatLng(
      cams
        .map((c) => {
          const lat = c.mapLocation?.lat ?? null;
          const lng = c.mapLocation?.lng ?? null;
          // Fallback: inherit building coordinates when camera mapLocation unset
          return { c, lat, lng };
        })
        .filter((x) => x.lat != null && x.lng != null)
        .map(({ c, lat, lng }) => {
          const red = redactCoordinates(lat, lng, camPrecision);
          return {
            id: c._id.toString(),
            cameraId: c.cameraId,
            name: c.name,
            type: "CAMERA",
            lat: red.lat!,
            lng: red.lng!,
            redacted: red.redacted,
            status: mapCameraHealthStatus(c.status),
            rawStatus: c.status,
            floor: c.floor,
            buildingId: c.buildingId?.toString() ?? null,
            href: `/video/cameras/${encodeURIComponent(c.cameraId)}`,
            coverage: {
              radiusM: c.mapLocation?.coverageRadiusM ?? null,
              angleDeg: c.mapLocation?.coverageAngleDeg ?? null,
              directionDeg: c.mapLocation?.viewingDirectionDeg ?? null,
              calibrated: Boolean(c.mapLocation?.calibrated),
              estimate: !c.mapLocation?.calibrated,
            },
            locationMeta: {
              source: c.mapLocation?.source ?? "ADMIN_CONFIGURATION",
              accuracyM: c.mapLocation?.accuracyM ?? null,
              lastUpdated: c.mapLocation?.lastUpdated?.toISOString() ?? null,
            },
          };
        })
    );

    // Fill missing camera coords from buildings
    const buildingCoords = new Map(
      (await Building.find(orgFilter(organizationId)).select("_id coordinates")).map((b) => [
        b._id.toString(),
        b.coordinates,
      ])
    );
    const withFallback = cams
      .filter((c) => {
        const hasOwn = c.mapLocation?.lat != null && c.mapLocation?.lng != null;
        if (hasOwn) return false;
        const bc = c.buildingId ? buildingCoords.get(c.buildingId.toString()) : null;
        return bc?.lat != null && bc?.lng != null;
      })
      .map((c) => {
        const bc = buildingCoords.get(c.buildingId!.toString())!;
        const red = redactCoordinates(bc.lat, bc.lng, camPrecision);
        return {
          id: c._id.toString(),
          cameraId: c.cameraId,
          name: c.name,
          type: "CAMERA",
          lat: red.lat!,
          lng: red.lng!,
          redacted: red.redacted,
          status: mapCameraHealthStatus(c.status),
          rawStatus: c.status,
          floor: c.floor,
          buildingId: c.buildingId?.toString() ?? null,
          href: `/video/cameras/${encodeURIComponent(c.cameraId)}`,
          positionSource: "BUILDING_FALLBACK",
          coverage: {
            radiusM: null,
            angleDeg: null,
            directionDeg: null,
            calibrated: false,
            estimate: true,
          },
          locationMeta: {
            source: "BUILDING_FALLBACK",
            accuracyM: null,
            lastUpdated: null,
          },
        };
      });

    const allCams = filterLatLng([...markers, ...withFallback]);
    const filtered =
      params.cameraStatus && params.cameraStatus !== "ALL"
        ? allCams.filter((c) => c.status === params.cameraStatus)
        : allCams;
    result.cameras = clusterPoints(filtered.slice(0, MAP_VIEWPORT_LIMIT), zoom);
    result.cameraCount = filtered.length;
  }

  if (layers.has("incidents")) {
    const incidents = await Incident.find(
      orgFilter(organizationId, {
        createdAt: { $gte: from, $lte: to },
        ...(params.severity ? { severity: params.severity } : {}),
      })
    )
      .sort({ createdAt: -1 })
      .limit(2000);

    const buildings = await Building.find(orgFilter(organizationId)).select(
      "_id name buildingId coordinates"
    );

    const markers = incidents
      .map((inc) => {
        const locLabel = (inc.location?.building || "").toLowerCase();
        const match =
          buildings.find(
            (x) =>
              locLabel &&
              (x.name.toLowerCase() === locLabel || x.buildingId.toLowerCase() === locLabel)
          ) || null;
        if (!match || match.coordinates?.lat == null || match.coordinates?.lng == null) {
          return null;
        }
        return {
          id: inc._id.toString(),
          incidentId: inc.incidentId,
          name: inc.title,
          type: "INCIDENT",
          lat: match.coordinates.lat,
          lng: match.coordinates.lng,
          severity: inc.severity,
          status: inc.status,
          createdAt: inc.createdAt.toISOString(),
          locationLabel: inc.location?.label || inc.location?.building || null,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      lat: number;
      lng: number;
      [k: string]: unknown;
    }>;

    const filtered = filterLatLng(markers);
    result.incidents = clusterPoints(filtered.slice(0, MAP_VIEWPORT_LIMIT), zoom);
    result.incidentCount = filtered.length;
    result.unlocatedIncidents = incidents.length - markers.length;
  }

  if (layers.has("alerts")) {
    const alerts = await Alert.find(
      orgFilter(organizationId, {
        createdAt: { $gte: from, $lte: to },
        status: { $in: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING"] },
      })
    )
      .sort({ createdAt: -1 })
      .limit(1000);
    const buildings = await Building.find(orgFilter(organizationId)).select("name buildingId coordinates");
    const markers = alerts
      .map((a) => {
        const bid = a.location?.buildingId;
        const bname = (a.location?.building || "").toLowerCase();
        const match = buildings.find(
          (b) =>
            (bid && b._id.toString() === bid) ||
            (bname && b.name.toLowerCase() === bname)
        );
        if (!match?.coordinates?.lat || !match?.coordinates?.lng) return null;
        return {
          id: a._id.toString(),
          alertId: a.alertId,
          name: a.type || "Alert",
          type: "ALERT",
          lat: match.coordinates.lat,
          lng: match.coordinates.lng,
          severity: a.severity,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        };
      })
      .filter(Boolean) as Array<{ id: string; lat: number; lng: number; [k: string]: unknown }>;
    result.alerts = clusterPoints(filterLatLng(markers).slice(0, MAP_VIEWPORT_LIMIT), zoom);
  }

  if (layers.has("responseTeams")) {
    const precision = resolveLocationPrecision(user, "team");
    if (precision === "HIDDEN") {
      result.responseTeams = [];
      result.responseTeamsHidden = true;
    } else {
      const teams = await ResponseTeam.find(orgFilter(organizationId)).limit(200);
      const markers = filterLatLng(
        teams
          .filter((t) => t.mapLocation?.lat != null && t.mapLocation?.lng != null)
          .map((t) => {
            const red = redactCoordinates(t.mapLocation.lat, t.mapLocation.lng, precision);
            return {
              id: t._id.toString(),
              teamId: t.teamId,
              name: t.name,
              type: "RESPONSE_TEAM",
              lat: red.lat!,
              lng: red.lng!,
              redacted: red.redacted,
              status: mapTeamStatus(t.status, t.currentAssignment || ""),
              assignment: t.currentAssignment || null,
              liveTracking: Boolean(t.mapLocation?.liveTrackingConfigured),
              locationLabel: t.mapLocation?.liveTrackingConfigured
                ? "Live tracking configured"
                : "Last known location",
              lastUpdated: t.mapLocation?.lastUpdated?.toISOString() ?? null,
            };
          })
      );
      result.responseTeams = markers;
    }
  }

  if (layers.has("exits")) {
    const precision = resolveLocationPrecision(user, "exit");
    const allExits = await EmergencyExit.find(orgFilter(organizationId)).limit(500);
    result.exits = filterLatLng(
      allExits
        .map((e) => {
          const pos = fromGeoPoint(e.location);
          if (!pos) return null;
          const red = redactCoordinates(pos.lat, pos.lng, precision);
          if (red.lat == null) return null;
          return {
            id: e._id.toString(),
            exitId: e.exitId,
            name: e.name,
            type: "EXIT",
            lat: red.lat,
            lng: red.lng,
            status: e.status,
            accessible: e.accessible,
            capacity: e.capacity,
          };
        })
        .filter(Boolean) as Array<{ id: string; lat: number; lng: number; [k: string]: unknown }>
    );
  }

  if (layers.has("assemblyAreas")) {
    const areas = await AssemblyArea.find(orgFilter(organizationId)).limit(200);
    result.assemblyAreas = filterLatLng(
      areas
        .map((a) => {
          const pos = fromGeoPoint(a.location);
          if (!pos) return null;
          return {
            id: a._id.toString(),
            assemblyId: a.assemblyId,
            name: a.name,
            type: "ASSEMBLY_AREA",
            lat: pos.lat,
            lng: pos.lng,
            status: a.status,
            capacity: a.capacity,
            accessibility: a.accessibility,
          };
        })
        .filter(Boolean) as Array<{ id: string; lat: number; lng: number; [k: string]: unknown }>
    );
  }

  if (layers.has("assets")) {
    const precision = resolveLocationPrecision(user, "asset");
    const assets = await MapAsset.find(orgFilter(organizationId)).limit(2000);
    result.assets = filterLatLng(
      assets
        .map((a) => {
          const pos = fromGeoPoint(a.location);
          if (!pos) return null;
          const red = redactCoordinates(pos.lat, pos.lng, precision);
          if (red.lat == null) return null;
          return {
            id: a._id.toString(),
            assetId: a.assetId,
            name: a.name,
            type: a.type,
            lat: red.lat,
            lng: red.lng,
            status: a.status,
            equipmentSubtype: a.equipmentSubtype,
          };
        })
        .filter(Boolean) as Array<{ id: string; lat: number; lng: number; [k: string]: unknown }>
    );
  }

  if (layers.has("zones")) {
    const zones = await Zone.find(orgFilter(organizationId, { status: "ACTIVE" })).limit(200);
    result.zones = zones.map((z) => ({
      zoneId: z.zoneId,
      name: z.name,
      type: z.type,
      status: z.status,
      geometry: z.geometry,
      rules: z.rules,
    }));
  }

  if (layers.has("mapObjects")) {
    const objects = await MapObject.find(orgFilter(organizationId, { status: "ACTIVE" })).limit(2000);
    result.mapObjects = filterLatLng(
      objects
        .map((o) => {
          const pos = fromGeoPoint(o.position);
          if (!pos) return null;
          return {
            id: o.objectId,
            name: o.name,
            type: o.type,
            lat: pos.lat,
            lng: pos.lng,
            status: o.status,
            metadata: o.metadata,
          };
        })
        .filter(Boolean) as Array<{ id: string; lat: number; lng: number; [k: string]: unknown }>
    );
  }

  // Accessibility list alternative
  const listItems: Array<{ kind: string; id: string; title: string; meta: string }> = [];
  const pushList = (kind: string, arr: unknown, titleFn: (x: Record<string, unknown>) => string, metaFn: (x: Record<string, unknown>) => string) => {
    const raw = arr as Array<Record<string, unknown>> | undefined;
    if (!raw) return;
    const flat = raw.flatMap((x) => (x.isCluster ? (x.items as Record<string, unknown>[]) ?? [] : [x]));
    for (const x of flat.slice(0, 100)) {
      listItems.push({ kind, id: String(x.id), title: titleFn(x), meta: metaFn(x) });
    }
  };
  pushList("incident", result.incidents, (x) => String(x.name || x.incidentId), (x) => `${x.severity} · ${x.status}`);
  pushList("camera", result.cameras, (x) => String(x.name || x.cameraId), (x) => String(x.status));
  result.accessibilityList = {
    summary: `${listItems.length} items currently in view/list`,
    items: listItems,
  };

  return result;
}

export async function getRiskHeatmap(
  organizationId: string,
  params: { timeRange?: string; from?: string | null; to?: string | null; dayPart?: string | null }
) {
  await connectDB();
  const { from, to } = resolveTimeRange(params.timeRange ?? "30D", params.from, params.to);
  const buildings = await Building.find(orgFilter(organizationId));
  const incidents = await Incident.find(
    orgFilter(organizationId, { createdAt: { $gte: from, $lte: to } })
  ).select("location severity createdAt");
  const alerts = await Alert.find(
    orgFilter(organizationId, { createdAt: { $gte: from, $lte: to } })
  ).select("location severity createdAt");
  const cameras = await Camera.find(orgFilter(organizationId)).select("buildingId status");

  const cells = buildings
    .filter((b) => b.coordinates?.lat != null && b.coordinates?.lng != null)
    .map((b) => {
      const name = b.name.toLowerCase();
      let incidentScore = 0;
      let sample = 0;
      const factors: string[] = [];

      for (const inc of incidents) {
        const label = (inc.location?.building || "").toLowerCase();
        if (label && label === name) {
          sample++;
          const sev =
            inc.severity === "CRITICAL" ? 25 : inc.severity === "HIGH" ? 15 : inc.severity === "MEDIUM" ? 8 : 3;
          if (params.dayPart) {
            const part = dayPartFromHour(new Date(inc.createdAt).getHours());
            if (part !== params.dayPart) continue;
          }
          incidentScore += sev;
        }
      }
      for (const a of alerts) {
        const label = (a.location?.building || "").toLowerCase();
        if (label && label === name) {
          sample++;
          incidentScore += a.severity === "CRITICAL" ? 12 : a.severity === "HIGH" ? 8 : 3;
        }
      }
      const buildingCams = cameras.filter((c) => c.buildingId?.equals(b._id));
      const offline = buildingCams.filter((c) => c.status === "OFFLINE" || c.status === "ERROR").length;
      if (offline > 0) {
        incidentScore += offline * 5;
        factors.push(`+ ${offline} offline/degraded camera(s)`);
        sample += offline;
      }
      if (incidentScore > 0) factors.unshift(`+ weighted incidents/alerts`);

      const level = riskLevelFromScore(incidentScore, sample);
      return {
        buildingId: b.buildingId,
        id: b._id.toString(),
        name: b.name,
        lat: b.coordinates.lat,
        lng: b.coordinates.lng,
        score: level === "INSUFFICIENT_DATA" ? null : incidentScore,
        level,
        factors: level === "INSUFFICIENT_DATA" ? ["Insufficient Data"] : factors,
        sampleSize: sample,
      };
    });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    dayPart: params.dayPart ?? null,
    explanation:
      "Risk uses historical incidents, alerts, severity weighting, and camera health for buildings with enough samples. Insufficient data is shown explicitly.",
    cells,
  };
}

export async function getBuildingMapDetail(organizationId: string, buildingId: string) {
  await connectDB();
  const or: Record<string, unknown>[] = [{ buildingId }];
  if (mongoose.Types.ObjectId.isValid(buildingId)) or.push({ _id: buildingId });
  const building = await Building.findOne(orgFilter(organizationId, { $or: or }));
  if (!building) return null;

  const campus = await Campus.findById(building.campusId);
  const floors = await ensureFloorsForBuilding(organizationId, building.campusId, building);
  const rooms = await Room.countDocuments(orgFilter(organizationId, { buildingId: building._id }));
  const cameras = await Camera.find(orgFilter(organizationId, { buildingId: building._id }));
  const incidents = await Incident.find(
    orgFilter(organizationId, {
      "location.building": { $regex: new RegExp(`^${building.name}$`, "i") },
      status: { $nin: ["RESOLVED", "DISMISSED", "CLOSED"] },
    })
  ).limit(20);
  const alerts = await Alert.countDocuments(
    orgFilter(organizationId, {
      status: { $in: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING"] },
      $or: [
        { "location.buildingId": building._id.toString() },
        { "location.building": building.name },
      ],
    })
  );

  const heatmap = await getRiskHeatmap(organizationId, { timeRange: "30D" });
  const risk = heatmap.cells.find((c) => c.id === building._id.toString());

  const floorPlans = await FloorPlan.find(
    orgFilter(organizationId, { buildingId: building._id, status: "PUBLISHED" })
  ).select("-imageReference");

  return {
    building: {
      id: building._id.toString(),
      buildingId: building.buildingId,
      name: building.name,
      address: building.address,
      floors: building.floors,
      coordinates: building.coordinates,
      status: building.status,
      campusName: campus?.name ?? null,
    },
    floors: floors.map((f) => ({
      floorId: f.floorId,
      level: f.level,
      name: f.name,
      status: f.status,
    })),
    rooms,
    cameras: {
      total: cameras.length,
      online: cameras.filter((c) => c.status === "ONLINE").length,
      offline: cameras.filter((c) => c.status === "OFFLINE").length,
    },
    incidents: incidents.map((i) => ({
      incidentId: i.incidentId,
      title: i.title,
      severity: i.severity,
      status: i.status,
    })),
    alerts,
    risk: risk ?? { level: "INSUFFICIENT_DATA", factors: ["Insufficient Data"], score: null },
    floorPlans: floorPlans.map((fp) => ({
      floorPlanId: fp.floorPlanId,
      floorId: fp.floorId,
      version: fp.version,
      status: fp.status,
      width: fp.width,
      height: fp.height,
    })),
    emergencyStatus: "NONE",
  };
}

export async function getMapActivity(organizationId: string, limit = 40) {
  await connectDB();
  const [incidents, cameras, teams] = await Promise.all([
    Incident.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(15),
    Camera.find(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR"] } }))
      .sort({ updatedAt: -1 })
      .limit(10),
    ResponseTeam.find(orgFilter(organizationId)).sort({ updatedAt: -1 }).limit(10),
  ]);

  const events = [
    ...incidents.map((i) => ({
      at: i.createdAt.toISOString(),
      kind: "INCIDENT",
      text: `Incident created: ${i.title}`,
      ref: i.incidentId,
    })),
    ...cameras.map((c) => ({
      at: (c.updatedAt ?? c.lastSeen ?? new Date()).toISOString(),
      kind: "CAMERA",
      text: `Camera ${c.cameraId} ${c.status.toLowerCase()}`,
      ref: c.cameraId,
    })),
    ...teams
      .filter((t) => t.currentAssignment)
      .map((t) => ({
        at: t.updatedAt.toISOString(),
        kind: "TEAM",
        text: `Response team ${t.name} assigned`,
        ref: t.teamId,
      })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);

  return { events, serverNow: new Date().toISOString() };
}

export async function getEmergencyMapData(organizationId: string, emergencyId: string) {
  await connectDB();
  const emergency = await Emergency.findOne(orgFilter(organizationId, { emergencyId }));
  if (!emergency) return null;

  const overlay = await EmergencyMapOverlay.findOne(orgFilter(organizationId, { emergencyId }));
  const exits = await EmergencyExit.find(orgFilter(organizationId)).limit(100);
  const assemblies = await AssemblyArea.find(orgFilter(organizationId)).limit(50);
  const teams = await ResponseTeam.find(orgFilter(organizationId)).limit(50);
  const cameras = await Camera.find(orgFilter(organizationId)).limit(200);

  // Nearby cameras only when we have explicit overlay point + camera coords
  const center = overlay?.point ? fromGeoPoint(overlay.point) : null;

  return {
    emergency: {
      emergencyId: emergency.emergencyId,
      type: emergency.type,
      severity: emergency.severity,
      status: emergency.status,
      location: emergency.location,
      mode: emergency.mode,
    },
    affectedArea: overlay
      ? {
          kind: overlay.kind,
          point: fromGeoPoint(overlay.point),
          radiusM: overlay.radiusM,
          polygon: overlay.polygon,
          source: overlay.source,
          blockedAreas: overlay.blockedAreas,
          knownHazards: overlay.knownHazards,
        }
      : {
          kind: null,
          message:
            "No verified affected area configured. Boundaries are not invented automatically.",
        },
    exits: exits.map((e) => ({
      exitId: e.exitId,
      name: e.name,
      status: e.status,
      location: fromGeoPoint(e.location),
      accessible: e.accessible,
    })),
    assemblyAreas: assemblies.map((a) => ({
      assemblyId: a.assemblyId,
      name: a.name,
      status: a.status,
      location: fromGeoPoint(a.location),
      capacity: a.capacity,
    })),
    responseTeams: teams.map((t) => ({
      teamId: t.teamId,
      name: t.name,
      status: mapTeamStatus(t.status, t.currentAssignment || ""),
      location: t.mapLocation?.lat != null ? { lat: t.mapLocation.lat, lng: t.mapLocation.lng } : null,
      liveTracking: Boolean(t.mapLocation?.liveTrackingConfigured),
      assignment: t.currentAssignment || null,
    })),
    nearbyCameras: center
      ? cameras
          .filter((c) => c.mapLocation?.lat != null)
          .slice(0, 20)
          .map((c) => ({
            cameraId: c.cameraId,
            name: c.name,
            status: mapCameraHealthStatus(c.status),
            lat: c.mapLocation.lat,
            lng: c.mapLocation.lng,
            href: `/video/cameras/${encodeURIComponent(c.cameraId)}`,
          }))
      : [],
    routingNote:
      "Evacuation routes are recommendations only when a complete routing graph is configured.",
  };
}

export async function searchMap(
  organizationId: string,
  user: IUser,
  q: string
) {
  await connectDB();
  const query = q.trim();
  if (!query || query.length < 2) return { results: [] };
  const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const [buildings, cameras, incidents, exits, assets, rooms] = await Promise.all([
    Building.find(orgFilter(organizationId, { $or: [{ name: rx }, { code: rx }, { buildingId: rx }] })).limit(10),
    Camera.find(orgFilter(organizationId, { $or: [{ name: rx }, { cameraId: rx }] })).limit(10),
    Incident.find(orgFilter(organizationId, { $or: [{ title: rx }, { incidentId: rx }] })).limit(10),
    EmergencyExit.find(orgFilter(organizationId, { name: rx })).limit(10),
    MapAsset.find(orgFilter(organizationId, { $or: [{ name: rx }, { assetId: rx }] })).limit(10),
    Room.find(orgFilter(organizationId, { $or: [{ name: rx }, { roomNumber: rx }] })).limit(10),
  ]);

  const results = [
    ...buildings.map((b) => ({
      kind: "building",
      id: b._id.toString(),
      label: b.name,
      href: `/map?building=${encodeURIComponent(b.buildingId)}`,
      meta: b.code,
    })),
    ...cameras.map((c) => ({
      kind: "camera",
      id: c._id.toString(),
      label: c.name,
      href: `/map?camera=${encodeURIComponent(c.cameraId)}&mode=CAMERA`,
      meta: c.cameraId,
    })),
    ...incidents.map((i) => ({
      kind: "incident",
      id: i._id.toString(),
      label: i.title,
      href: `/map?incident=${encodeURIComponent(i.incidentId)}&mode=INCIDENT`,
      meta: i.severity,
    })),
    ...rooms.map((r) => ({
      kind: "room",
      id: r._id.toString(),
      label: `${r.roomNumber} — ${r.name}`,
      href: `/map?building=${r.buildingId}&q=${encodeURIComponent(r.roomNumber)}`,
      meta: `Floor ${r.floor}`,
    })),
    ...exits.map((e) => ({
      kind: "exit",
      id: e.exitId,
      label: e.name,
      href: `/map?mode=EMERGENCY`,
      meta: e.status,
    })),
    ...assets.map((a) => ({
      kind: "asset",
      id: a.assetId,
      label: a.name,
      href: `/assets/map?asset=${encodeURIComponent(a.assetId)}`,
      meta: a.type,
    })),
  ];

  if (canViewTeamLocations(user)) {
    const teams = await ResponseTeam.find(orgFilter(organizationId, { name: rx })).limit(10);
    results.push(
      ...teams.map((t) => ({
        kind: "team",
        id: t.teamId,
        label: t.name,
        href: `/map?mode=RESPONSE`,
        meta: t.status,
      }))
    );
  }

  return { results: results.slice(0, 40) };
}

export { ensureFloorsForBuilding, mapCameraHealthStatus };
