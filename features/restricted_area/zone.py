"""
AI Campus Guard - Polygon ROI Zone Geometry Engine
Manages single and multiple polygon ROI zones and performs multi-anchor point & bounding-box area intrusion checks.
"""

from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import cv2

class RestrictedZone:
    """
    Represents a single polygon restricted zone.
    """
    def __init__(
        self,
        name: str,
        points: List[List[int]],
        enabled: bool = True,
        severity: str = "high"
    ):
        self.name = name
        self.raw_points = points
        self.enabled = enabled
        self.severity = severity
        
        # Convert points to int32 numpy contour for OpenCV functions
        self.contour = np.array(points, dtype=np.int32).reshape((-1, 1, 2))
        
    def contains_point(self, point: Tuple[float, float]) -> bool:
        """
        Tests if a 2D point (x, y) lies inside or on the edge of the polygon using cv2.pointPolygonTest.
        
        Args:
            point: (x, y) tuple/coordinates.
            
        Returns:
            bool: True if point is inside or on the boundary of the polygon zone.
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

        # Evaluate 4 key anchor points:
        # 1. Center Point (cx, cy)
        # 2. Bottom-Center Point (cx, y2)
        # 3. Mid-Low Point (cx, y1 + 0.75 * h) - perfect for sitting persons at desks
        # 4. Top-Center Point (cx, y1)
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
    Manages multiple RestrictedZone instances and evaluates point/box intrusions.
    """
    def __init__(self, zone_configs: Optional[List[Dict[str, Any]]] = None):
        self.zones: List[RestrictedZone] = []
        if zone_configs:
            self.load_zones(zone_configs)

    def load_zones(self, zone_configs: List[Dict[str, Any]]):
        """Loads and initializes zone objects from dictionary configuration data."""
        self.zones.clear()
        for cfg in zone_configs:
            name = cfg.get("name", "UNNAMED ZONE")
            points = cfg.get("points", [])
            enabled = cfg.get("enabled", True)
            severity = cfg.get("severity", "high")

            if points and len(points) >= 3:
                zone = RestrictedZone(name=name, points=points, enabled=enabled, severity=severity)
                self.zones.append(zone)

    def get_zones_for_point(self, point: Tuple[float, float]) -> List[RestrictedZone]:
        """
        Returns a list of all enabled RestrictedZone objects containing the given 2D point.
        """
        matching = []
        for zone in self.zones:
            if zone.contains_point(point):
                matching.append(zone)
        return matching

    def get_zones_for_box(self, box: Tuple[int, int, int, int]) -> List[RestrictedZone]:
        """
        Returns a list of all enabled RestrictedZone objects containing/overlapping the given person box.
        """
        matching = []
        for zone in self.zones:
            if zone.contains_box(box):
                matching.append(zone)
        return matching
