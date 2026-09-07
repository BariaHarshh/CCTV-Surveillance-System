/** Deep-link helpers for the digital campus map (Step 14). */

export function mapCampusHref(opts?: {
  campus?: string;
  building?: string;
  floor?: string | number;
  mode?: string;
  range?: string;
  camera?: string;
  incident?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}) {
  const sp = new URLSearchParams();
  if (opts?.campus) sp.set("campus", opts.campus);
  if (opts?.building) sp.set("building", opts.building);
  if (opts?.floor != null) sp.set("floor", String(opts.floor));
  if (opts?.mode) sp.set("mode", opts.mode);
  if (opts?.range) sp.set("range", opts.range);
  if (opts?.camera) sp.set("camera", opts.camera);
  if (opts?.incident) sp.set("incident", opts.incident);
  if (opts?.lat != null) sp.set("lat", String(opts.lat));
  if (opts?.lng != null) sp.set("lng", String(opts.lng));
  if (opts?.zoom != null) sp.set("zoom", String(opts.zoom));
  const q = sp.toString();
  return q ? `/map?${q}` : "/map";
}

export function mapIncidentHref(incidentId: string) {
  return mapCampusHref({ incident: incidentId, mode: "INCIDENT" });
}

export function mapCameraHref(cameraId: string) {
  return mapCampusHref({ camera: cameraId, mode: "CAMERA" });
}

export function mapBuildingHref(buildingId: string) {
  return mapCampusHref({ building: buildingId });
}

export function emergencyMapHref(emergencyId: string) {
  return `/emergency/${encodeURIComponent(emergencyId)}/map`;
}
