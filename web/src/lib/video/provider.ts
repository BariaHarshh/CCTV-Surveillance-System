/**
 * Camera provider abstraction — vendor-agnostic.
 * Credentials stay server-side; never returned to clients.
 */

export type ProviderProtocol = "RTSP" | "ONVIF" | "HTTP" | "HTTPS" | "CLOUD" | "DEMO";

export interface ProviderConnectionConfig {
  protocol: ProviderProtocol;
  streamUrl: string;
  /** Encrypted or secret-ref — never plaintext passwords in API responses */
  usernameSecretRef?: string;
  passwordSecretRef?: string;
}

export interface ProviderStatus {
  online: boolean;
  latencyMs: number | null;
  lastHeartbeat: Date | null;
  message: string;
}

export interface ProviderStreamHandle {
  type: "PROXY" | "HLS" | "NONE" | "DEMO";
  url: string | null;
  expiresAt: Date | null;
  live: boolean;
  demo: boolean;
  message?: string;
}

export interface ProviderMetadata {
  resolution: string | null;
  frameRate: number | null;
  codec: string | null;
}

export interface CameraProvider {
  readonly id: string;
  readonly protocol: ProviderProtocol;
  connect(config: ProviderConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ProviderStatus>;
  getStream(): Promise<ProviderStreamHandle>;
  getMetadata(): Promise<ProviderMetadata>;
  healthCheck(): Promise<{ result: "PASS" | "WARNING" | "FAIL"; details: string }>;
}

export class HttpCameraProvider implements CameraProvider {
  readonly id = "http";
  readonly protocol: ProviderProtocol = "HTTP";
  private config: ProviderConnectionConfig | null = null;
  private connected = false;

  async connect(config: ProviderConnectionConfig) {
    this.config = config;
    this.connected = Boolean(config.streamUrl);
  }

  async disconnect() {
    this.connected = false;
    this.config = null;
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.connected || !this.config?.streamUrl) {
      return { online: false, latencyMs: null, lastHeartbeat: null, message: "Not connected" };
    }
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(this.config.streamUrl, {
        method: "HEAD",
        signal: ctrl.signal,
      }).catch(() => null);
      clearTimeout(t);
      const latencyMs = Date.now() - start;
      if (res && res.ok) {
        return {
          online: true,
          latencyMs,
          lastHeartbeat: new Date(),
          message: "HTTP stream reachable",
        };
      }
      return {
        online: false,
        latencyMs,
        lastHeartbeat: new Date(),
        message: "HTTP stream not reachable",
      };
    } catch {
      return {
        online: false,
        latencyMs: Date.now() - start,
        lastHeartbeat: new Date(),
        message: "Health check failed",
      };
    }
  }

  async getStream(): Promise<ProviderStreamHandle> {
    if (!this.connected) {
      return { type: "NONE", url: null, expiresAt: null, live: false, demo: false, message: "Not connected" };
    }
    return {
      type: "PROXY",
      url: null, // filled by stream-service session
      expiresAt: new Date(Date.now() + 5 * 60_000),
      live: true,
      demo: false,
    };
  }

  async getMetadata(): Promise<ProviderMetadata> {
    return { resolution: null, frameRate: null, codec: null };
  }

  async healthCheck() {
    const status = await this.getStatus();
    if (status.online) return { result: "PASS" as const, details: status.message };
    if (status.latencyMs != null) return { result: "WARNING" as const, details: status.message };
    return { result: "FAIL" as const, details: status.message };
  }
}

export class DemoCameraProvider implements CameraProvider {
  readonly id = "demo";
  readonly protocol: ProviderProtocol = "DEMO";

  async connect() {}
  async disconnect() {}

  async getStatus(): Promise<ProviderStatus> {
    return {
      online: true,
      latencyMs: 40,
      lastHeartbeat: new Date(),
      message: "DEMO DATA — synthetic stream",
    };
  }

  async getStream(): Promise<ProviderStreamHandle> {
    return {
      type: "DEMO",
      url: null,
      expiresAt: null,
      live: false,
      demo: true,
      message: "DEMO DATA — not a live camera feed",
    };
  }

  async getMetadata(): Promise<ProviderMetadata> {
    return { resolution: "1280x720", frameRate: 15, codec: "demo" };
  }

  async healthCheck() {
    return { result: "PASS" as const, details: "DEMO DATA provider healthy" };
  }
}

export class RtspGatewayProvider implements CameraProvider {
  readonly id = "rtsp-gateway";
  readonly protocol: ProviderProtocol = "RTSP";
  private config: ProviderConnectionConfig | null = null;

  async connect(config: ProviderConnectionConfig) {
    this.config = config;
  }
  async disconnect() {
    this.config = null;
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      online: false,
      latencyMs: null,
      lastHeartbeat: null,
      message: "RTSP/ONVIF requires media gateway — not live until gateway is configured",
    };
  }

  async getStream(): Promise<ProviderStreamHandle> {
    return {
      type: "NONE",
      url: null,
      expiresAt: null,
      live: false,
      demo: false,
      message: "Stream gateway required for RTSP/ONVIF",
    };
  }

  async getMetadata(): Promise<ProviderMetadata> {
    return { resolution: null, frameRate: null, codec: null };
  }

  async healthCheck() {
    if (!this.config?.streamUrl) return { result: "FAIL" as const, details: "No stream URL" };
    return { result: "WARNING" as const, details: "Gateway not configured — connection metadata present only" };
  }
}

export function createCameraProvider(protocol: string, demoMode: boolean): CameraProvider {
  if (demoMode) return new DemoCameraProvider();
  const p = protocol.toUpperCase();
  if (p === "HTTP" || p === "HTTPS") return new HttpCameraProvider();
  if (p === "RTSP" || p === "ONVIF") return new RtspGatewayProvider();
  return new RtspGatewayProvider();
}
