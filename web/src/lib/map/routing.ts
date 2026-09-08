/**
 * Evacuation routing foundation.
 * Returns a reliable route only when complete graph data exists.
 * Never fabricates safe paths.
 */

export interface RouteNode {
  id: string;
  lat: number;
  lng: number;
  kind: "START" | "EXIT" | "ASSEMBLY" | "WAYPOINT";
}

export interface RouteEdge {
  from: string;
  to: string;
  lengthM: number;
  blocked?: boolean;
}

export interface RouteRequest {
  start: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  nodes: RouteNode[];
  edges: RouteEdge[];
  blockedAreaIds?: string[];
}

export interface RouteResult {
  ok: boolean;
  message: string;
  isRecommendation: true;
  path: Array<{ lat: number; lng: number; nodeId?: string }>;
  distanceM: number | null;
}

export function suggestEvacuationRoute(req: RouteRequest): RouteResult {
  if (!req.nodes.length || !req.edges.length) {
    return {
      ok: false,
      message: "Route cannot be reliably calculated.",
      isRecommendation: true,
      path: [],
      distanceM: null,
    };
  }

  const openEdges = req.edges.filter((e) => !e.blocked);
  if (!openEdges.length) {
    return {
      ok: false,
      message: "Route cannot be reliably calculated.",
      isRecommendation: true,
      path: [],
      distanceM: null,
    };
  }

  // Find nearest start/destination nodes
  const nearest = (p: { lat: number; lng: number }) => {
    let best: RouteNode | null = null;
    let bestD = Infinity;
    for (const n of req.nodes) {
      const d = (n.lat - p.lat) ** 2 + (n.lng - p.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };

  const startNode = nearest(req.start);
  const endNode = nearest(req.destination);
  if (!startNode || !endNode) {
    return {
      ok: false,
      message: "Route cannot be reliably calculated.",
      isRecommendation: true,
      path: [],
      distanceM: null,
    };
  }

  // Dijkstra
  const adj = new Map<string, Array<{ to: string; w: number }>>();
  for (const e of openEdges) {
    const a = adj.get(e.from) ?? [];
    a.push({ to: e.to, w: e.lengthM });
    adj.set(e.from, a);
    const b = adj.get(e.to) ?? [];
    b.push({ to: e.from, w: e.lengthM });
    adj.set(e.to, b);
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const q = new Set(req.nodes.map((n) => n.id));
  for (const n of req.nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(startNode.id, 0);

  while (q.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of q) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    if (u == null || best === Infinity) break;
    q.delete(u);
    if (u === endNode.id) break;
    for (const { to, w } of adj.get(u) ?? []) {
      if (!q.has(to)) continue;
      const alt = best + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, u);
      }
    }
  }

  if ((dist.get(endNode.id) ?? Infinity) === Infinity) {
    return {
      ok: false,
      message: "Route cannot be reliably calculated.",
      isRecommendation: true,
      path: [],
      distanceM: null,
    };
  }

  const ids: string[] = [];
  let cur: string | null = endNode.id;
  while (cur) {
    ids.push(cur);
    cur = prev.get(cur) ?? null;
  }
  ids.reverse();
  const byId = new Map(req.nodes.map((n) => [n.id, n]));
  const path = ids.map((id) => {
    const n = byId.get(id)!;
    return { lat: n.lat, lng: n.lng, nodeId: id };
  });

  return {
    ok: true,
    message: "Suggested route (recommendation — verify before use).",
    isRecommendation: true,
    path,
    distanceM: dist.get(endNode.id) ?? null,
  };
}
