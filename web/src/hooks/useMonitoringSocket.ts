"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@/lib/monitoring/constants";

export type RealtimeStatus = "connected" | "disconnected" | "reconnecting";

export function useMonitoringSocket(handlers?: {
  onCameraStatus?: (payload: Record<string, unknown>) => void;
  onDetectionCreated?: (payload: Record<string, unknown>) => void;
  onEventCreated?: (payload: Record<string, unknown>) => void;
  onEventUpdated?: (payload: Record<string, unknown>) => void;
  onAlertCreated?: (payload: Record<string, unknown>) => void;
  onAlertUpdated?: (payload: Record<string, unknown>) => void;
  onNotification?: (payload: Record<string, unknown>) => void;
  onIncidentUpdated?: (payload: Record<string, unknown>) => void;
  onEmergencyCreated?: (payload: Record<string, unknown>) => void;
  onEmergencyUpdated?: (payload: Record<string, unknown>) => void;
  onEmergencyResolved?: (payload: Record<string, unknown>) => void;
  onIncidentAssigned?: (payload: Record<string, unknown>) => void;
  onTaskCreated?: (payload: Record<string, unknown>) => void;
  onTaskUpdated?: (payload: Record<string, unknown>) => void;
  onEscalationTriggered?: (payload: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io({
      path: "/api/socket",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.io.on("reconnect", () => setStatus("connected"));

    socket.on(SOCKET_EVENTS.CAMERA_STATUS, (p) => handlersRef.current?.onCameraStatus?.(p));
    socket.on(SOCKET_EVENTS.DETECTION_CREATED, (p) => handlersRef.current?.onDetectionCreated?.(p));
    socket.on(SOCKET_EVENTS.EVENT_CREATED, (p) => handlersRef.current?.onEventCreated?.(p));
    socket.on(SOCKET_EVENTS.EVENT_UPDATED, (p) => handlersRef.current?.onEventUpdated?.(p));
    socket.on(SOCKET_EVENTS.ALERT_CREATED, (p) => handlersRef.current?.onAlertCreated?.(p));
    socket.on(SOCKET_EVENTS.ALERT_UPDATED, (p) => handlersRef.current?.onAlertUpdated?.(p));
    socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, (p) => handlersRef.current?.onNotification?.(p));
    socket.on(SOCKET_EVENTS.INCIDENT_UPDATED, (p) => handlersRef.current?.onIncidentUpdated?.(p));
    socket.on(SOCKET_EVENTS.EMERGENCY_CREATED, (p) => handlersRef.current?.onEmergencyCreated?.(p));
    socket.on(SOCKET_EVENTS.EMERGENCY_UPDATED, (p) => handlersRef.current?.onEmergencyUpdated?.(p));
    socket.on(SOCKET_EVENTS.EMERGENCY_RESOLVED, (p) => handlersRef.current?.onEmergencyResolved?.(p));
    socket.on(SOCKET_EVENTS.INCIDENT_ASSIGNED, (p) => handlersRef.current?.onIncidentAssigned?.(p));
    socket.on(SOCKET_EVENTS.INCIDENT_TASK_CREATED, (p) => handlersRef.current?.onTaskCreated?.(p));
    socket.on(SOCKET_EVENTS.INCIDENT_TASK_UPDATED, (p) => handlersRef.current?.onTaskUpdated?.(p));
    socket.on(SOCKET_EVENTS.ESCALATION_TRIGGERED, (p) => handlersRef.current?.onEscalationTriggered?.(p));

    socketRef.current = socket;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  return { status, reconnect: connect };
}
