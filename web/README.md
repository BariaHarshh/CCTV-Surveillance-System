# AI Campus Guardian Web Application

Enterprise multi-tenant campus safety and AI operations platform (**v1.0.0**).

---

## Technical Stack & Architecture

- **Frontend**: Next.js 15 (App Router, React 19, Tailwind CSS, Framer Motion, Lucide Icons)
- **Database**: MongoDB Atlas (Cloud Database) via **Mongoose** (no MongoClient migration)
- **Real-Time Communication**: Socket.IO server & client with organization isolation channels
- **Authentication**: Custom HTTP-only session cookies, JWT, salted Bcrypt password hashing, and RBAC (`SUPER_ADMIN`, `ADMIN`, `STAFF`)
- **AI & ML Integration**: Python FastAPI Backend + YOLOv8 + ByteTrack Crowd Detection Pipeline

---

## Key Features & Recent Updates

### 1. Shared MongoDB Atlas Cloud Database Integration
- **Zero Local MongoDB Dependency**: Configured Next.js frontend database connection layer to target a shared MongoDB Atlas cloud database via `MONGODB_URI` stored securely in `.env.local`.
- **Fail-Closed Missing URI Error**: Explicit configuration error when `MONGODB_URI` is missing (`MONGODB_URI is not configured. Please create .env.local with a valid MongoDB Atlas connection string.`).
- **Safe Database Connection Logging**: Non-sensitive connection logs without exposing passwords or authentication credentials (`[DB] Connecting to MongoDB Atlas...`, `[DB] MongoDB connection established`).
- **Protected Environment Secrets**: `.env.local` is explicitly ignored in `.gitignore` to prevent credential leakage.

### 2. Live AI Crowd & Video Monitoring Screen
- **Dedicated Live AI Monitoring Page**: Accessible at `/dashboard/monitoring`, `/admin/monitoring/live`, and `/staff/monitoring/live`.
- **Live AI Video Stream Panel**: Streams live annotated video feed (with YOLOv8 bounding boxes and ByteTrack IDs) proxied securely via Next.js `/api/monitoring/cameras/:id/stream` and `/api/monitoring/streams/:sessionId`.
- **Crowd & Occupancy Analytics Panel**:
  - **Real-Time People Count**: Live YOLOv8 count & ByteTrack filtered stable count.
  - **Occupancy Capacity Progress Bar**: Animated capacity progress bar (color-coded Green <70%, Amber 70-99%, Red >=100%).
  - **Crowd Detection State**: Badges for `NORMAL` (Green), `CHECKING CROWD` (Amber), and `CROWD DETECTED` (Red).
- **Real-Time Socket.IO Updates**: Instant updates for `detection:created`, `event:created`, and `camera:status` events without aggressive polling.
- **Recent AI Events Timeline**: Real-time event log powered by MongoDB Atlas event history.

### 3. Initial Super Admin Seeding
- Built-in automatic initial Super Admin account creation via `initializeSuperAdmin()` in `src/lib/auth/init-super-admin.ts`.
- Configured via `INITIAL_SUPER_ADMIN_*` variables in `.env.local`.

---

## Quickstart Guide for Team Developers

### Prerequisites
1. Node.js (v18 or higher)
2. Access to the team's MongoDB Atlas project and whitelisted public IP address in Atlas Network Access
3. Python 3.10+ (for running the ML backend service)

---

### Step 1: Configure & Start Next.js Web App

1. **Clone the repository**:
   ```bash
   git clone https://github.com/meetk8048/AI_Campus_Guardian_Web_app.git
   cd AI_Campus_Guardian_Web_app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create local environment file (`.env.local`)**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Set your MongoDB Atlas connection string in `.env.local`:
   ```env
   MONGODB_URI=mongodb+srv://<database-user>:<database-password>@ai-campus-guardian.i494qhq.mongodb.net/ai-campus-guardian?retryWrites=true&w=majority&appName=AI-Campus-Guardian
   ```
   *(Replace `<database-user>` and `<database-password>` with your Atlas credentials. Never commit `.env.local` to Git.)*

4. **Start the Next.js development server**:
   ```bash
   npm run dev
   ```
   The application starts on `http://localhost:3000`.

---

### Step 2: Start the Python ML Backend & Stream Server

Open a terminal in the `AI-Campus-Guard` Python ML repository:

```bash
cd C:\Workshop\AI-Campus-Guard
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*Starts the FastAPI ML backend on `http://localhost:8000`.*

---

### Step 3: Run the Crowd Detection AI Pipeline

Open a second terminal in `AI-Campus-Guard`:

```bash
cd C:\Workshop\AI-Campus-Guard
python app/run_crowd_detection.py
```
*Runs YOLOv8 + ByteTrack crowd detection, streams annotated frames to FastAPI, and dispatches detection events to `http://localhost:3000/api/internal/detection`.*

---

### Step 4: Access Live AI Monitoring

1. Open your browser and go to `http://localhost:3000/login`.
2. Log in using the initial Super Admin credentials:
   - **User ID / Email**: `superadmin` *(or `superadmin@aicampusguardian.com`)*
   - **Password**: `ChangeMe123!` *(or the password set in `.env.local`)*
3. Navigate to `http://localhost:3000/admin/monitoring/live` (or `/dashboard/monitoring`).

---

## Development & Test Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Custom Next.js server + Socket.IO server |
| `npm run typecheck` | TypeScript compilation check (`tsc --noEmit`) |
| `npm test` | Vitest unit test suite |
| `npm run lint` | ESLint static analysis |

---

## Technical Documentation Index

- [docs/MONGODB_ATLAS_SETUP.md](docs/MONGODB_ATLAS_SETUP.md) — Team MongoDB Atlas configuration & security guide.
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — Organization Admin operations guide.
- [SUPER_ADMIN_GUIDE.md](SUPER_ADMIN_GUIDE.md) — Platform Super Admin operations guide.
- [STAFF_GUIDE.md](STAFF_GUIDE.md) — Field / Operations staff guide.
- [SECURITY.md](SECURITY.md) — Security controls & secret management policy.
