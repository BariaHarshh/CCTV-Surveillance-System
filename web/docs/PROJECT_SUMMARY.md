# AI Campus Guardian — Project Architecture & Implementation Summary

This document provides a comprehensive technical overview of the AI Campus Guardian Web Application architecture, database configuration, live AI video pipeline, authentication system, and developer setup.

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NEXT.JS WEB APPLICATION                          │
│                                                                             │
│   ┌───────────────────────┐             ┌───────────────────────────────┐   │
│   │ Live AI Monitoring UI │             │ Internal Detection API        │   │
│   │ /admin/monitoring/live│             │ POST /api/internal/detection  │   │
│   └───────────┬───────────┘             └───────────────┬───────────────┘   │
│               │                                         │                   │
│               ▼                                         ▼                   │
│   ┌───────────────────────┐             ┌───────────────────────────────┐   │
│   │  Socket.IO Realtime   │             │   Detection & Event Engine    │   │
│   │  (detection:created)  │             │   (Rule Engine / Severity)    │   │
│   └───────────▲───────────┘             └───────────────┬───────────────┘   │
│               │                                         │                   │
└───────────────┼─────────────────────────────────────────┼───────────────────┘
                │                                         │
                │                                         ▼
┌───────────────┴──────────┐              ┌───────────────────────────────────┐
│ MongoDB Atlas Cloud DB   │              │ Python ML Backend (FastAPI)       │
│ Database:                │              │ - YOLOv8 Object Detection         │
│ ai-campus-guardian       │              │ - ByteTrack Multi-Object Tracking │
│ Mongoose Layer           │              │ - MJPEG Stream Server (Port 8000) │
└──────────────────────────┘              └───────────────────────────────────┘
```

---

## 2. Shared MongoDB Atlas Cloud Database Integration

### Configuration
- The application connects to MongoDB Atlas using **Mongoose** (no MongoClient refactoring).
- Connection string is loaded dynamically from `process.env.MONGODB_URI` stored locally in `.env.local`:
  ```env
  MONGODB_URI=mongodb+srv://<database-user>:<database-password>@ai-campus-guardian.i494qhq.mongodb.net/ai-campus-guardian?retryWrites=true&w=majority&appName=AI-Campus-Guardian
  ```
- **Localhost Fallback Removed**: Missing `MONGODB_URI` produces a clear error:
  `MONGODB_URI is not configured. Please create .env.local with a valid MongoDB Atlas connection string.`
- **Safe Logging**: Non-sensitive connection logs prevent secret leakage:
  ```text
  [DB] Connecting to MongoDB Atlas...
  [DB] MongoDB connection established
  ```

---

## 3. Live AI Crowd Monitoring Pipeline

### Video Streaming Proxy
- **MJPEG Proxy Session**: Frontend calls `GET /api/monitoring/cameras/:id/stream`, which generates a temporary authenticated stream proxy session (`/api/monitoring/streams/:sessionId`).
- **Credential Protection**: Next.js relays stream bytes from the Python ML FastAPI server without exposing backend stream URLs or passwords to browser clients.
- **Continuous Stream Fix**: Uses connection setup timeouts with automatic clearance upon receiving response headers, ensuring uninterrupted streaming.
- **Auto-Reconnect**: `<img onError={...} />` auto-reconnects seamlessly if temporary network resets occur.

### Metadata & Real-Time Analytics
- Python ML sends normalized detection JSON payloads to `POST /api/internal/detection`.
- Next.js evaluates rule engines (`evaluateRules` in `rule-engine.ts`), saves event records in MongoDB Atlas, and emits Socket.IO event `detection:created`.
- `LiveAIMonitoringClient` receives Socket.IO events and instantly updates:
  - **YOLOv8 People Count** & **ByteTrack Filtered Stable Count**
  - **Capacity Progress Bar** (% of threshold filled)
  - **AI Detection Status** (`NORMAL`, `CHECKING CROWD`, `CROWD DETECTED`)
  - **Recent AI Events Timeline**

---

## 4. Authentication & Role-Based Access Control (RBAC)

- **Authentication**: HTTP-only session cookies (`acg_session`), JWT tokens, salted Bcrypt password hashing.
- **Roles**:
  - `SUPER_ADMIN`: Platform-wide access (`permissions: ["*"]`).
  - `ADMIN`: Organization administration.
  - `STAFF`: Field operations staff.
- **Initial Super Admin Seeding**: Automatically creates the initial Super Admin user (`superadmin` / `superadmin@aicampusguardian.com`) on startup if no `SUPER_ADMIN` exists in MongoDB Atlas.

---

## 5. Summary of Key Files

| File | Role |
| :--- | :--- |
| `src/lib/db/connect.ts` | Single-connection Mongoose database connector with safe logging. |
| `src/lib/auth/config.ts` | Application and authentication environment configuration getter. |
| `src/components/monitoring/LiveAIMonitoringClient.tsx` | Main Live AI Crowd & Video Monitoring UI component. |
| `src/components/monitoring/CameraStreamView.tsx` | Camera stream viewer component with detection overlay support. |
| `src/app/api/monitoring/cameras/[id]/stream/route.ts` | Authenticated camera stream session API route. |
| `src/app/api/monitoring/streams/[sessionId]/route.ts` | Continuous MJPEG stream proxy route. |
| `src/app/api/internal/detection/route.ts` | Internal ML detection integration API. |
| `docs/MONGODB_ATLAS_SETUP.md` | Team setup guide for MongoDB Atlas credentials and IP whitelisting. |
