  'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TerminalCommand, TerminalResponse } from "@/lib/api-client";

interface UseTerminalOptions {
  onMessage?: (message: TerminalResponse) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  sessionId?: string;
  validateSession?: (sessionId: string) => Promise<boolean>;
}

interface ConnectionDiagnostics {
  url: string;
  attempts: number;
  lastError?: string;
  connectionTime?: number;
}

export function useTerminal(
  webSocketUrl: string,
  options: UseTerminalOptions = {}
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    url: webSocketUrl,
    attempts: 0,
  });
  const [isValidating, setIsValidating] = useState(false);
  const messageQueueRef = useRef<TerminalCommand[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds
  const pingInterval = 10000; // 10 seconds
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef<number>(0);

  const memoizedOptions = useMemo(() => options, [options.onConnect, options.onMessage, options.onError, options.onDisconnect]);

  // Connection timeout (25 seconds - slightly less than server timeout)
  const CONNECTION_TIMEOUT = 25000;
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (!webSocketUrl || isConnecting || isValidating || ws.current?.readyState === WebSocket.CONNECTING) return;

    // Validate session before connecting if validation function provided
    if (options.sessionId && options.validateSession) {
      setIsValidating(true);
      try {
        console.log(`[Terminal] Validating session ${options.sessionId} before connecting...`);
        const isValid = await options.validateSession(options.sessionId);
        if (!isValid) {
          const error = new Error("Session validation failed. The session may have expired or been destroyed.");
          console.error("[Terminal] Session validation failed");
          setError(error);
          setIsConnecting(false);
          setIsValidating(false);
          memoizedOptions.onError?.(error);
          return;
        }
        console.log("[Terminal] Session validation successful");
      } catch (err) {
        console.warn("[Terminal] Session validation error:", err);
        // Continue anyway - let WebSocket connection handle it
      } finally {
        setIsValidating(false);
      }
    }

    // Add small delay to ensure session is registered on server
    if (reconnectAttemptsRef.current === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsConnecting(true);
    setError(null);
    connectionStartTimeRef.current = Date.now();

    console.log(`[Terminal] Connecting to ${webSocketUrl} (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
    console.log(`[Terminal] Connection timeout: ${CONNECTION_TIMEOUT}ms`);

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      console.error(`[Terminal] Connection timeout after ${CONNECTION_TIMEOUT}ms`);
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close(1008, "Client connection timeout");
      }
      setIsConnecting(false);
      setIsConnected(false);
      const timeoutError = new Error(`Connection timeout - no response from server after ${CONNECTION_TIMEOUT}ms. The server may be busy or unreachable.`);
      setError(timeoutError);
      setDiagnostics(prev => ({
        ...prev,
        lastError: timeoutError.message,
        attempts: reconnectAttemptsRef.current,
      }));
      memoizedOptions.onError?.(timeoutError);
    }, CONNECTION_TIMEOUT);

    try {
      ws.current = new WebSocket(webSocketUrl);

      ws.current.onopen = () => {
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        const connectionTime = Date.now() - connectionStartTimeRef.current;
        console.log(`[Terminal] Connected in ${connectionTime}ms`);
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        setDiagnostics(prev => ({
          ...prev,
          attempts: 0,
          connectionTime,
          lastError: undefined,
        }));

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
        
        // Clear connection timeout on error
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setIsConnected(false);
        setIsConnecting(false);
        
        // Determine specific error message based on context
        let errorMessage = "WebSocket connection failed";
        let errorCode = "CONNECTION_FAILED";
        
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          errorMessage = "Failed to connect after maximum attempts. Please check your network connection and try again.";
          errorCode = "MAX_RETRIES_EXCEEDED";
        } else if (!navigator.onLine) {
          errorMessage = "You appear to be offline. Please check your internet connection.";
          errorCode = "OFFLINE";
        } else if (webSocketUrl.startsWith("wss://") && window.location.protocol === "http:") {
          errorMessage = "Mixed content error: Cannot connect to secure WebSocket from HTTP page.";
          errorCode = "MIXED_CONTENT";
        } else if (webSocketUrl.includes("awsapprunner.com")) {
          errorMessage = "AWS App Runner WebSocket connection failed. This may be due to: 1) Service still starting, 2) Session not found, 3) Network/proxy issues. Please try again in a few moments.";
          errorCode = "AWS_APP_RUNNER_ERROR";
        }
        
        setDiagnostics(prev => ({
          ...prev,
          attempts: reconnectAttemptsRef.current,
          lastError: errorMessage,
          errorCode,
        }));
        
        // Only call onError if we're not already in a reconnect attempt
        if (reconnectAttemptsRef.current === 0) {
          const error = new Error(errorMessage);
          (error as any).code = errorCode;
          setError(error);
          memoizedOptions.onError?.(error);
        }
      };

      ws.current.onclose = (event) => {
        console.log(`[Terminal] Disconnected: ${event.code} ${event.reason}`);
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setIsConnected(false);
        setIsConnecting(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        memoizedOptions.onDisconnect?.();

        // Handle specific error codes with detailed messages
        const isInvalidSession = event.code === 4000;
        const isServerError = event.code >= 4500;
        const isConnectionTimeout = event.code === 1008;
        const isAbnormalClosure = event.code === 1006;
        const isGoingAway = event.code === 1001;
        
        if (isInvalidSession) {
          console.error("[Terminal] Invalid session - will not retry");
          const errorMessage = "Session is invalid or has expired. Please start a new lab session.";
          const error = new Error(errorMessage);
          (error as any).code = "SESSION_INVALID";
          setError(error);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: errorMessage,
            errorCode: "SESSION_INVALID",
          }));
          memoizedOptions.onError?.(error);
          return; // Don't retry on invalid session
        }

        if (isConnectionTimeout) {
          console.error("[Terminal] Connection timeout from server");
          const errorMessage = "Connection timed out. The server took too long to respond. Please try again.";
          const error = new Error(errorMessage);
          (error as any).code = "CONNECTION_TIMEOUT";
          setError(error);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: errorMessage,
            errorCode: "CONNECTION_TIMEOUT",
          }));
          memoizedOptions.onError?.(error);
          return; // Don't retry on timeout
        }

        if (isAbnormalClosure) {
          console.error("[Terminal] Abnormal closure (1006) - possible network, proxy, or AWS load balancer issue");
          // 1006 is often caused by:
          // 1. AWS App Runner load balancer closing idle connections
          // 2. Proxy/firewall interference
          // 3. Socket timeout on server side
          // Still try to reconnect with shorter delay
        }

        if (isGoingAway) {
          console.log("[Terminal] Server is going away (page refresh/navigation)");
          // Don't show error for normal navigation
          return;
        }

        // Attempt to reconnect if not a normal closure and under max attempts
        const shouldRetry = event.code !== 1000 && event.code !== 1001 && !isServerError && !isConnectionTimeout && !isInvalidSession;
        
        if (shouldRetry && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          // Exponential backoff: base delay * 2^(attempt - 1)
          // Use shorter delay for 1006 errors (AWS App Runner specific)
          const isAbnormalClosure = event.code === 1006;
          const baseDelay = isAbnormalClosure ? 1000 : reconnectDelay;
          const backoffDelay = baseDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          const finalDelay = Math.min(backoffDelay, 30000); // Cap at 30 seconds
          
          console.log(`[Terminal] Reconnecting in ${finalDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: `Connection closed (code: ${event.code}${event.reason ? `: ${event.reason}` : ''}). Retrying...`,
            errorCode: `WS_CLOSE_${event.code}`,
          }));
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, finalDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts || isServerError) {
          console.error("[Terminal] Max reconnection attempts reached or server error");
          const errorMessage = isServerError 
            ? `Server error (code: ${event.code}). Please try again later.`
            : `Failed to connect after ${maxReconnectAttempts} attempts. Last close code: ${event.code}${event.reason ? ` (${event.reason})` : ''}. Please refresh the page or contact support.`;
          const error = new Error(errorMessage);
          (error as any).code = isServerError ? "SERVER_ERROR" : "MAX_RETRIES_EXCEEDED";
          setError(error);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: errorMessage,
            errorCode: isServerError ? "SERVER_ERROR" : "MAX_RETRIES_EXCEEDED",
          }));
          memoizedOptions.onError?.(error);
        }
      };
    } catch (err) {
      // Clear connection timeout on error
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      const error = err instanceof Error ? err : new Error("Failed to create WebSocket");
      console.error("[Terminal] Failed to connect:", error);
      (error as any).code = "WEBSOCKET_CREATION_FAILED";
      setError(error);
      setIsConnecting(false);
      setDiagnostics(prev => ({
        ...prev,
        lastError: error.message,
        errorCode: "WEBSOCKET_CREATION_FAILED",
      }));
      memoizedOptions.onError?.(error);
    }
  }, [webSocketUrl, isConnecting, memoizedOptions.onConnect, memoizedOptions.onMessage, memoizedOptions.onError, memoizedOptions.onDisconnect]);

  // Connect to WebSocket
  useEffect(() => {
    if (webSocketUrl) {
      console.log(`[Terminal] URL changed, connecting to: ${webSocketUrl}`);
      connect();
    } else {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
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
      console.log("[Terminal] Cleaning up WebSocket connection");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
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
    isValidating,
    error,
    executeCommand,
    resizeTerminal,
    diagnostics,
    reconnect: () => {
      reconnectAttemptsRef.current = 0;
      connect();
    },
  };
}
