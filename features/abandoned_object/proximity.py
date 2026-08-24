"""
AI Campus Guard - Person-to-Object Proximity Analyzer Module
Evaluates spatial proximity between stationary objects and detected persons to determine Attended vs Unattended states.
"""

from typing import List, Dict, Tuple, Any, Optional
import math

class ProximityAnalyzer:
    """
    Evaluates spatial distance between target objects and nearby persons.
    Uses fast spatial pre-filtering and dual-anchor point calculation (center-to-center and person-base-to-object).
    """
    def __init__(self, proximity_threshold_px: float = 130.0):
        self.proximity_threshold_px = proximity_threshold_px

    def check_proximity(
        self,
        object_box: Tuple[int, int, int, int],
        tracked_persons: List[Dict[str, Any]]
    ) -> Tuple[bool, List[int], Optional[int], Optional[float]]:
        """
        Evaluates proximity between a target object and all active tracked persons.

        Args:
            object_box: (x1, y1, x2, y2) bounding box of target object
            tracked_persons: List of tracked person dicts {'track_id', 'box', ...}

        Returns:
            Tuple of:
                is_attended (bool): True if at least one person is within proximity threshold
                nearby_person_ids (List[int]): IDs of all persons within proximity threshold
                closest_person_id (Optional[int]): ID of nearest person (if any detected)
                closest_person_dist (Optional[float]): Distance in pixels to nearest person
        """
        if not tracked_persons:
            return False, [], None, None

        ox1, oy1, ox2, oy2 = object_box
        ocx = (ox1 + ox2) / 2.0
        ocy = (oy1 + oy2) / 2.0

        thresh = self.proximity_threshold_px
        nearby_ids: List[int] = []
        closest_id: Optional[int] = None
        min_dist = float("inf")

        for p in tracked_persons:
            pid = p.get("track_id")
            px1, py1, px2, py2 = p["box"]
            pcx = (px1 + px2) / 2.0
            pcy = (py1 + py2) / 2.0
            p_feet_y = float(py2)

            dx = abs(ocx - pcx)
            dy = abs(ocy - pcy)

            # Spatial pre-filtering: skip calculation if clearly beyond threshold
            if dx > (thresh + 100) or dy > (thresh + 150):
                continue

            # 1. Center-to-center distance
            d_center = math.sqrt(dx * dx + dy * dy)

            # 2. Base/feet-to-center distance (person standing beside bag)
            dx_feet = ocx - pcx
            dy_feet = ocy - p_feet_y
            d_feet = math.sqrt(dx_feet * dx_feet + dy_feet * dy_feet)

            # 3. Minimum edge-to-edge box overlap or distance
            effective_dist = min(d_center, d_feet)

            if effective_dist < min_dist:
                min_dist = effective_dist
                closest_id = pid

            if effective_dist <= thresh:
                if pid is not None:
                    nearby_ids.append(pid)

        is_attended = (len(nearby_ids) > 0)
        closest_dist = min_dist if min_dist != float("inf") else None

        return is_attended, nearby_ids, closest_id, closest_dist
