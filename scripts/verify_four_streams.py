import urllib.request
import json
import time
import os
import psutil

cams = [
    ("CAM-000001", "66d550000000000000000002"),
    ("CAM-000002", "66d550000000000000000003"),
    ("CAM-000003", "66d550000000000000000004"),
    ("CAM-000004", "66d550000000000000000005"),
]

print("=== 1. VERIFYING 4 CONCURRENT STREAM STATUSES ===")
for app_id, ml_id in cams:
    r = urllib.request.urlopen(f"http://127.0.0.1:8000/api/cameras/{app_id}/stream/status")
    st = json.loads(r.read().decode())
    print(f"Camera {app_id} (ML: {ml_id}): active={st['active']}, age={st['lastFrameAge']}s, res={st['resolution']}")

print("\n=== 2. VERIFYING MJPEG MULTIPART STREAMS ===")
for app_id, ml_id in cams:
    stream_req = urllib.request.urlopen(f"http://127.0.0.1:8000/api/cameras/{app_id}/stream")
    ct = stream_req.headers.get("Content-Type")
    chunk = stream_req.read(1000)
    has_boundary = b"--frame" in chunk
    has_jpeg = b"image/jpeg" in chunk
    print(f"{app_id}: status=200, Content-Type='{ct}', boundary={has_boundary}, jpeg={has_jpeg}, bytes={len(chunk)}")

print("\n=== 3. HARDWARE RESOURCE TELEMETRY ===")
cpu_pct = psutil.cpu_percent(interval=1.0)
mem = psutil.virtual_memory()
print(f"System CPU Usage    : {cpu_pct}%")
print(f"System Memory Usage : {mem.percent}% ({round(mem.used / (1024**3), 2)} GB / {round(mem.total / (1024**3), 2)} GB)")
