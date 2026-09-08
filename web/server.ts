import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { loadEnvConfig } from "@next/env";
import { Server as SocketIOServer } from "socket.io";
import { authenticateSocketSession } from "./src/lib/monitoring/socket-auth";
import { orgChannel } from "./src/lib/monitoring/constants";
import { setSocketIO } from "./src/lib/monitoring/socket-emitter";
import { assertEnvironmentOrThrow } from "./src/lib/platform/secret-manager";

// Load .env* before startup validation (custom server runs outside next CLI env bootstrap).
loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

try {
  assertEnvironmentOrThrow();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  if (!dev) process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: dev
        ? true
        : process.env.NEXT_PUBLIC_APP_URL
          ? [process.env.NEXT_PUBLIC_APP_URL]
          : false,
      credentials: true,
    },
  });

  setSocketIO(io);

  io.use(async (socket, nextFn) => {
    try {
      const user = await authenticateSocketSession(socket.handshake.headers.cookie);
      if (!user) return nextFn(new Error("Unauthorized"));
      socket.data.user = user;
      if (user.role !== "SUPER_ADMIN" && user.organizationId) {
        socket.data.organizationId = user.organizationId.toString();
      }
      nextFn();
    } catch (e) {
      nextFn(e instanceof Error ? e : new Error("Auth failed"));
    }
  });

  io.on("connection", (socket) => {
    const orgId = socket.data.organizationId as string | undefined;
    if (orgId) socket.join(orgChannel(orgId));
    socket.emit("connected", { organizationId: orgId ?? null });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (Socket.IO enabled)`);

    const runAnalyticsJob = async () => {
      try {
        const { analyticsAggregationWorker } = await import("./src/lib/analytics/aggregation-worker");
        await analyticsAggregationWorker.run();
      } catch (err) {
        console.error("[AnalyticsAggregationWorker]", err instanceof Error ? err.message : err);
      }
    };

    const runRetentionJob = async () => {
      try {
        const { runRetentionWorker } = await import("./src/lib/platform/retention-worker");
        await runRetentionWorker();
      } catch (err) {
        console.error("[RetentionWorker]", err instanceof Error ? err.message : err);
      }
    };

    setTimeout(runAnalyticsJob, 60_000);
    setInterval(runAnalyticsJob, 6 * 60 * 60 * 1000);
    setTimeout(runRetentionJob, 120_000);
    setInterval(runRetentionJob, 24 * 60 * 60 * 1000);

    void (async () => {
      try {
        const { startEnterpriseJobWorker } = await import("./src/lib/enterprise/job-queue");
        startEnterpriseJobWorker();
        const { ensureDefaultAgents } = await import("./src/lib/enterprise/agent-service");
        await ensureDefaultAgents();
      } catch (err) {
        console.error("[EnterpriseWorker]", err instanceof Error ? err.message : err);
      }
    })();
  });
});
