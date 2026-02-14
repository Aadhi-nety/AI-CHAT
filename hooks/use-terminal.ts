  'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TerminalCommand, TerminalResponse } from "@/lib/api-client";

interface UseTerminalOptions {
  onMessage?: (message: TerminalResponse) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useTerminal(
  webSocketUrl: string,
  options: UseTerminalOptions = {}
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const messageQueueRef = useRef<TerminalCommand[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds
  const pingInterval = 10000; // 10 seconds
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const memoizedOptions = useMemo(() => options, [options.onConnect, options.onMessage, options.onError, options.onDisconnect]);

  const connect = useCallback(() => {
    if (!webSocketUrl || isConnecting || ws.current?.readyState === WebSocket.CONNECTING) return;

    setIsConnecting(true);
    setError(null);

    try {
      ws.current = new WebSocket(webSocketUrl);

      ws.current.onopen = () => {
        console.log("[Terminal] Connected");
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;

        // Start ping/pong keepalive
        pingIntervalRef.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "ping" }));
          }
        }, pingInterval);

        // Flush queued messages
        while (messageQueueRef.current.length > 0) {
          const msg = messageQueueRef.current.shift();
          if (msg) {
            ws.current?.send(JSON.stringify(msg));
          }
        }

        memoizedOptions.onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle pong response
          if (message.type === "pong") {
            console.log("[Terminal] Pong received");
            return;
          }

          // Handle ping from server
          if (message.type === "ping") {
            ws.current?.send(JSON.stringify({ type: "pong" }));
            console.log("[Terminal] Ping received, sent pong");
            return;
          }

          console.log("[Terminal] Message:", message);
          memoizedOptions.onMessage?.(message as TerminalResponse);
        } catch (err) {
          console.error("[Terminal] Failed to parse message:", err);
        }
      };

      ws.current.onerror = (event) => {
        console.error("[Terminal] WebSocket error:", event);
        setIsConnected(false);
        setIsConnecting(false);
        // Only call onError if we're not already in a reconnect attempt
        if (reconnectAttemptsRef.current === 0) {
          const error = new Error("WebSocket connection failed");
          setError(error);
          memoizedOptions.onError?.(error);
        }
      };

      ws.current.onclose = (event) => {
        console.log(`[Terminal] Disconnected: ${event.code} ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        memoizedOptions.onDisconnect?.();

        // Attempt to reconnect if not a normal closure and under max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          // Exponential backoff: base delay * 2^(attempt - 1)
          const backoffDelay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          console.log(`[Terminal] Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error("[Terminal] Max reconnection attempts reached");
          const error = new Error("Failed to connect after maximum attempts");
          setError(error);
          memoizedOptions.onError?.(error);
        }
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create WebSocket");
      console.error("[Terminal] Failed to connect:", error);
      setError(error);
      setIsConnecting(false);
      memoizedOptions.onError?.(error);
    }
  }, [webSocketUrl, isConnecting, memoizedOptions.onConnect, memoizedOptions.onMessage, memoizedOptions.onError, memoizedOptions.onDisconnect]);

  // Connect to WebSocket
  useEffect(() => {
    if (webSocketUrl) {
      connect();
    } else {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (ws.current) {
        ws.current.close(1000, "URL changed");
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (ws.current) {
        ws.current.close(1000, "Component unmount");
      }
    };
  }, [webSocketUrl]);

  // Send command
  const executeCommand = useCallback((command: string) => {
    const msg: TerminalCommand = {
      type: "command",
      command,
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    } else {
      messageQueueRef.current.push(msg);
      console.log("[Terminal] Message queued (not connected)");
    }
  }, []);

  // Resize terminal
  const resizeTerminal = useCallback((cols: number, rows: number) => {
    const msg: TerminalCommand = {
      type: "resize",
      cols,
      rows,
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    executeCommand,
    resizeTerminal,
  };
}
