# Digital campus map & geospatial intelligence (Step 14)

## Purpose

Unified visual command surface for campus safety:

- Geographic campus map (`/map`)
- Building / floor plans
- Camera placement & **estimated** coverage
- Live incidents, alerts, risk heatmap
- Emergency / evacuation visualization
- Assets, exits, assembly areas, zones, geofences

Uses **real configured organization data only**. No invented production locations, GPS tracks, calibrated coverage, or safe routes.

## Architecture

```
Campus → Building → Floor → Room → Asset / Camera → Event
```

Models live in `src/models/Map.ts` (+ optional geo fields on existing `Camera` / `ResponseTeam`).

Services: `src/lib/map/*`  
APIs: `/api/map/*`, `/api/analytics/map`  
UI: `/map`, `/map/building/:id/floor/:floorId`, `/emergency/:id/map`, `/assets/map`, `/campus/:id`, `/building/:id`, `/floor/:id`, `/analytics/map`

## Honesty rules

| Claim | Behavior |
|-------|----------|
| Camera coverage | Shown only as configuration estimate unless `mapLocation.calibrated` |
| Team movement | Last known location unless `liveTrackingConfigured` |
| Evacuation route | Dijkstra on configured graph; otherwise "Route cannot be reliably calculated." |
| Affected area | Only from `EmergencyMapOverlay` verified config |
| Risk | `INSUFFICIENT_DATA` when sample size &lt; 3 |

## Security

- Every API uses `requireOrgMember` + `orgFilter`
- Location precision redaction via `src/lib/map/privacy.ts`
- Floor plan binaries served only through authenticated `/api/map/floor-plans/:id/image` (no public storage paths)
- Map exports audited (`MAP_EXPORT` / `SENSITIVE_LOCATION_EXPORTED`)
- CSP allows OSM/Carto/Esri tiles for basemap images

## Map modes

`STANDARD` · `SATELLITE` · `DARK` · `EMERGENCY` · `RISK` · `CAMERA` · `INCIDENT` · `RESPONSE` · `ASSET`

URL state: `/map?campus=&building=&floor=&mode=&range=&lat=&lng=&zoom=`

## AI tools

- `getMapRisk` — building risk heatmap from real incidents/alerts/camera health  
- `getMapSummary` — campus map bootstrap + recent activity  

Write actions still go through existing policy / approval paths.

## Offline / realtime

- Socket events refresh map layers; if the client loses connectivity, UI shows **Connection Lost** + last updated time (never pretend live).
- PWA may cache safe metadata; emergency state must not be shown as current when offline.

## Future 3D

`SpatialNode3DAdapter` in `geo.ts` reserves elevation/mesh fields. 2D Leaflet remains the primary surface.
