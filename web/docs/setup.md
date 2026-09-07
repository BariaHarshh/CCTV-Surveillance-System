# Setup

## Prerequisites

- Node.js 22+
- MongoDB 7+

## Local

```bash
cp .env.example .env.local
# Start MongoDB (example)
mongod --dbpath ./.mongodb-data --port 27017 --bind_ip 127.0.0.1 --nounixsocket

npm install
npm run dev
```

Open http://localhost:3000

Default Super Admin comes from `INITIAL_SUPER_ADMIN_*` env vars (dev only).

## Docker

```bash
docker compose up --build
```
