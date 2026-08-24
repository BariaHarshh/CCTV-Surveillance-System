"""
AI Campus Guard - Polygon ROI Zone Geometry Engine
Manages single and multiple polygon ROI zones and performs multi-anchor point & bounding-box area intrusion checks.
Supports both absolute pixel and normalized [0.0 - 1.0] coordinate representations with auto-scaling to active frame shape.
"""

from typing import List, Dict, Tuple, Optional, Any, Union
import numpy as np
import cv2

class RestrictedZone:
    """
    Represents a single polygon restricted zone with resolution-aware contour conversion.
    """
    def __init__(
        self,
        name: str,
        points: List[List[Any]],
        enabled: bool = True,
        severity: str = "high",
        frame_shape: Optional[Tuple[int, int]] = None
    ):
        self.name = name
        self.raw_points = points
        self.enabled = enabled
        self.severity = severity
        self.frame_shape = frame_shape
        self.contour = self._build_contour(points, frame_shape)

    def _build_contour(self, points: List[List[Any]], frame_shape: Optional[Tuple[int, int]]) -> np.ndarray:
        if not points or len(points) < 3:
            return np.array([], dtype=np.int32).reshape((-1, 1, 2))

        first_pt = points[0]
        is_normalized = isinstance(first_pt[0], float) and first_pt[0] <= 1.0 and first_pt[1] <= 1.0

        if is_normalized and frame_shape is not None:
            w, h = frame_shape
            pixel_pts = [[int(p[0] * w), int(p[1] * h)] for p in points]
        else:
            pixel_pts = [[int(p[0]), int(p[1])] for p in points]

        return np.array(pixel_pts, dtype=np.int32).reshape((-1, 1, 2))

    def update_frame_shape(self, frame_shape: Tuple[int, int]):
        """Updates contour geometry when frame resolution changes."""
        self.frame_shape = frame_shape
        self.contour = self._build_contour(self.raw_points, frame_shape)

    def contains_point(self, point: Tuple[float, float]) -> bool:
        """
        Tests if a 2D point (x, y) lies inside or on the edge of the polygon using cv2.pointPolygonTest.
        """
        if not self.enabled or self.contour.shape[0] < 3:
            return False

        pt = (float(point[0]), float(point[1]))
        res = cv2.pointPolygonTest(self.contour, pt, measureDist=False)
        return res >= 0

    def contains_box(self, box: Tuple[int, int, int, int]) -> bool:
        """
        Multi-anchor inspection: Checks if a person bounding box (x1, y1, x2, y2) overlaps or is inside the zone.
        Evaluates Center, Bottom-Center, Mid-Low, and Top-Center points to handle sitting/half-body posture.
        """
        if not self.enabled or self.contour.shape[0] < 3:
            return False

        x1, y1, x2, y2 = box
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        h = y2 - y1

        # Evaluate 4 key anchor points in native video coordinates:
        anchors = [
            (cx, cy),
            (cx, y2),
            (cx, y1 + 0.75 * h),
            (cx, y1 + 0.25 * h)
        ]

        for pt in anchors:
            if self.contains_point(pt):
                return True

        return False

class ZoneManager:
    """
    Manages multiple RestrictedZone instances and evaluates point/box intrusions across dynamic resolutions.
    """
    def __init__(
        self,
        zone_configs: Optional[List[Dict[str, Any]]] = None,
        frame_shape: Optional[Tuple[int, int]] = None
    ):
        self.zones: List[RestrictedZone] = []
        self.frame_shape = frame_shape
        if zone_configs:
            self.load_zones(zone_configs, frame_shape=frame_shape)

    def load_zones(
        self,
        zone_configs: List[Dict[str, Any]],
        frame_shape: Optional[Tuple[int, int]] = None
    ):
        """Loads and initializes zone objects from dictionary configuration data."""
        self.zones.clear()
        if frame_shape is not None:
            self.frame_shape = frame_shape

        for cfg in zone_configs:
            name = cfg.get("name", "UNNAMED ZONE")
            points = cfg.get("points", [])
            enabled = cfg.get("enabled", True)
            severity = cfg.get("severity", "high")

            if points and len(points) >= 3:
                zone = RestrictedZone(
                    name=name,
                    points=points,
                    enabled=enabled,
                    severity=severity,
                    frame_shape=self.frame_shape
                )
                self.zones.append(zone)

    def update_frame_shape(self, frame_shape: Tuple[int, int]):
        """Notifies all zones of the active frame resolution."""
        if self.frame_shape != frame_shape:
            self.frame_shape = frame_shape
            for zone in self.zones:
                zone.update_frame_shape(frame_shape)

    def get_zones_for_point(self, point: Tuple[float, float]) -> List[RestrictedZone]:
        """Returns a list of all enabled RestrictedZone objects containing the given 2D point."""
        matching = []
        for zone in self.zones:
            if zone.contains_point(point):
                matching.append(zone)
        return matching

    def get_zones_for_box(self, box: Tuple[int, int, int, int]) -> List[RestrictedZone]:
        """Returns a list of all enabled RestrictedZone objects containing/overlapping the given person box."""
        matching = []
        for zone in self.zones:
            if zone.contains_box(box):
                matching.append(zone)
        return matching
