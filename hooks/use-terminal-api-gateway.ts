'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TerminalCommand, TerminalResponse } from "@/lib/api-client";

interface UseTerminalOptions {
  onMessage?: (message: TerminalResponse) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface ConnectionDiagnostics {
  url: string;
  attempts: number;
  lastError?: string;
  connectionTime?: number;
  errorCode?: string;
}

interface UseTerminalApiGatewayOptions extends UseTerminalOptions {
  sessionId: string;
  token: string;
}

/**
 * API Gateway WebSocket URL
 * Set this via NEXT_PUBLIC_WS_API_URL environment variable
 * Format: wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}
 */
const DEFAULT_WS_API_URL = process.env.NEXT_PUBLIC_WS_API_URL || 
  "wss://your-api-id.execute-api.ap-south-1.amazonaws.com/prod";

/**
 * Frontend WebSocket hook for AWS API Gateway WebSocket connections
 * This replaces the direct App Runner WebSocket connection
 */
export function useTerminalApiGateway(
  options: UseTerminalApiGatewayOptions
) {
  const { sessionId, token, onMessage, onError, onConnect, onDisconnect } = options;
  
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    url: DEFAULT_WS_API_URL,
    attempts: 0,
  });
  
  const messageQueueRef = useRef<TerminalCommand[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectionStartTimeRef = useRef<number>(0);
  
  // Configuration
  const maxReconnectAttempts = 10;
  const initialReconnectDelay = 1000; // 1 second
  const maxReconnectDelay = 30000; // 30 seconds
  const pingInterval = 30000; // 30 seconds - API Gateway idle timeout
  const connectionTimeout = 20000; // 20 seconds
  
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Memoized callbacks
  const memoizedCallbacks = useMemo(() => ({
    onMessage,
    onError,
    onConnect,
    onDisconnect
  }), [onMessage, onError, onConnect, onDisconnect]);

  /**
   * Construct WebSocket URL with query parameters
   */
  const buildWebSocketUrl = useCallback(() => {
    try {
      const url = new URL(DEFAULT_WS_API_URL);
      url.searchParams.set("sessionId", sessionId);
      url.searchParams.set("token", token);
      return url.toString();
    } catch (err) {
      console.error("[Terminal] Failed to build WebSocket URL:", err);
      return DEFAULT_WS_API_URL;
    }
  }, [sessionId, token]);

  /**
   * Clear all timeouts and intervals
   */
  const clearAllTimers = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Start ping interval to keep connection alive
   */
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        console.log("[Terminal] Ping sent");
      }
    }, pingInterval);
  }, []);

  /**
   * Flush queued messages
   */
  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      if (msg && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(msg));
      }
    }
  }, []);

  /**
   * Handle reconnection with exponential backoff
   */
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error("[Terminal] Max reconnection attempts reached");
      const maxAttemptsError = new Error(
        `Failed to connect after ${maxReconnectAttempts} attempts. Please refresh the page or try again later.`
      );
      (maxAttemptsError as any).code = "MAX_RECONNECT_ATTEMPTS";
      setError(maxAttemptsError);
      setIsConnecting(false);
      memoizedCallbacks.onError?.(maxAttemptsError);
      return;
    }

    reconnectAttemptsRef.current++;
    
    // Exponential backoff with jitter
    const baseDelay = initialReconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
    const delayWithJitter = Math.min(
      exponentialDelay + Math.random() * 1000,
      maxReconnectDelay
    );
    
    console.log(
      `[Terminal] Reconnecting in ${Math.round(delayWithJitter)}ms ` +
      `(attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    );
    
    setDiagnostics(prev => ({
      ...prev,
      attempts: reconnectAttemptsRef.current,
      lastError: `Reconnecting... (attempt ${reconnectAttemptsRef.current})`
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delayWithJitter);
  }, [memoizedCallbacks]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (isConnecting || isConnected) {
      console.log("[Terminal] Already connected or connecting");
      return;
    }

    if (!sessionId || !token) {
      console.error("[Terminal] Missing sessionId or token");
      const authError = new Error("Session ID and token are required");
      (authError as any).code = "MISSING_AUTH";
      setError(authError);
      memoizedCallbacks.onError?.(authError);
      return;
    }

    setIsConnecting(true);
    setError(null);
    connectionStartTimeRef.current = Date.now();

    const webSocketUrl = buildWebSocketUrl();
    console.log(`[Terminal] Connecting to: ${webSocketUrl.replace(token, "***")}`);
    console.log(`[Terminal] Connection timeout: ${connectionTimeout}ms`);

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      console.error(`[Terminal] Connection timeout after ${connectionTimeout}ms`);
      if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
        ws.current.close(1008, "Connection timeout");
      }
      setIsConnecting(false);
      setIsConnected(false);
      const timeoutError = new Error(
        `Connection timeout - no response from server after ${connectionTimeout}ms. ` +
        "The service may be experiencing issues. Please try again."
      );
      (timeoutError as any).code = "CONNECTION_TIMEOUT";
      setError(timeoutError);
      setDiagnostics(prev => ({
        ...prev,
        attempts: reconnectAttemptsRef.current,
        lastError: timeoutError.message,
        errorCode: "CONNECTION_TIMEOUT"
      }));
      memoizedCallbacks.onError?.(timeoutError);
    }, connectionTimeout);

    try {
      ws.current = new WebSocket(webSocketUrl);

      ws.current.onopen = () => {
        console.log("[Terminal] WebSocket onopen fired");
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[Terminal] Message received:", message.type);

          // Handle connection confirmation
          if (message.type === "connected") {
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
              errorCode: undefined
            }));

            // Start ping interval
            startPingInterval();

            // Flush queued messages
            flushMessageQueue();

            // Notify callback
            onConnect?.();
            return;
          }

          // Handle pong
          if (message.type === "pong") {
            console.log("[Terminal] Pong received");
            return;
          }

          // Handle ping
          if (message.type === "ping") {
            ws.current?.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            console.log("[Terminal] Server ping, sent pong");
            return;
          }

          // Handle errors from server
          if (message.type === "error") {
            console.error("[Terminal] Server error:", message.message);
            const serverError = new Error(message.message || "Server error");
            (serverError as any).code = "SERVER_ERROR";
            setError(serverError);
            memoizedCallbacks.onError?.(serverError);
            return;
          }

          // Handle command results and other messages
          if (message.type === "command_result" || message.type === "resize_ack" || message.type === "ack") {
            memoizedCallbacks.onMessage?.(message as TerminalResponse);
            return;
          }

          // Default: pass to message handler
          memoizedCallbacks.onMessage?.(message as TerminalResponse);
        } catch (err) {
          console.error("[Terminal] Failed to parse message:", err);
        }
      };

      ws.current.onerror = (event) => {
        console.error("[Terminal] WebSocket error:", event);
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        setIsConnected(false);
        setIsConnecting(false);
        
        // Determine error message
        let errorMessage = "WebSocket connection failed";
        let errorCode = "CONNECTION_FAILED";
        
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          errorMessage = "Failed to connect after maximum attempts. Please check your network and try again.";
          errorCode = "MAX_RETRIES_EXCEEDED";
        } else if (!navigator.onLine) {
          errorMessage = "You appear to be offline. Please check your internet connection.";
          errorCode = "OFFLINE";
        } else if (webSocketUrl.startsWith("wss://") && typeof window !== "undefined" && window.location.protocol === "http:") {
          errorMessage = "Mixed content error: Cannot connect to secure WebSocket from HTTP page.";
          errorCode = "MIXED_CONTENT";
        } else {
          errorMessage = "WebSocket connection failed. Please check your network and try again.";
          errorCode = "WS_CONNECTION_FAILED";
        }
        
        setDiagnostics(prev => ({
          ...prev,
          attempts: reconnectAttemptsRef.current,
          lastError: errorMessage,
          errorCode
        }));
        
        // Only call onError on first attempt
        if (reconnectAttemptsRef.current === 0) {
          const error = new Error(errorMessage);
          (error as any).code = errorCode;
          setError(error);
          memoizedCallbacks.onError?.(error);
        }
      };

      ws.current.onclose = (event) => {
        console.log(`[Terminal] Disconnected: code=${event.code}, reason=${event.reason}`);
        
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

        // Notify disconnect
        memoizedCallbacks.onDisconnect?.();

        // Handle specific close codes
        const isNormalClosure = event.code === 1000;
        const isGoingAway = event.code === 1001;
        const isAbnormalClosure = event.code === 1006;
        const isConnectionTimeout = event.code === 1008;
        const isSessionInvalid = event.code === 4000;
        const isServerError = event.code >= 4500 && event.code < 5000;

        if (isNormalClosure) {
          console.log("[Terminal] Normal closure");
          return;
        }

        if (isGoingAway) {
          console.log("[Terminal] Server is going away");
          return;
        }

        if (isSessionInvalid) {
          console.error("[Terminal] Session invalid - will not retry");
          const sessionError = new Error(
            "Session is invalid or has expired. Please start a new lab session."
          );
          (sessionError as any).code = "SESSION_INVALID";
          setError(sessionError);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: sessionError.message,
            errorCode: "SESSION_INVALID"
          }));
          memoizedCallbacks.onError?.(sessionError);
          return;
        }

        if (isConnectionTimeout) {
          console.error("[Terminal] Connection timeout from server");
          const timeoutError = new Error(
            "Connection timed out. The server took too long to respond."
          );
          (timeoutError as any).code = "CONNECTION_TIMEOUT";
          setError(timeoutError);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: timeoutError.message,
            errorCode: "CONNECTION_TIMEOUT"
          }));
          memoizedCallbacks.onError?.(timeoutError);
          return;
        }

        if (isAbnormalClosure) {
          console.warn(
            "[Terminal] Abnormal closure (1006) - possible network issue or server restart"
          );
          // Attempt to reconnect
        }

        // Determine if we should retry
        const shouldRetry = 
          !isNormalClosure && 
          !isGoingAway && 
          !isServerError && 
          !isSessionInvalid &&
          reconnectAttemptsRef.current < maxReconnectAttempts;

        if (shouldRetry) {
          handleReconnect();
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts || isServerError) {
          console.error("[Terminal] Max reconnection attempts or server error");
          const finalError = new Error(
            isServerError 
              ? `Server error (code: ${event.code}). Please try again later.`
              : `Failed to connect after ${maxReconnectAttempts} attempts. ` +
                `Last close code: ${event.code}. Please refresh the page.`
          );
          (finalError as any).code = isServerError ? "SERVER_ERROR" : "MAX_RETRIES_EXCEEDED";
          setError(finalError);
          setDiagnostics(prev => ({
            ...prev,
            attempts: reconnectAttemptsRef.current,
            lastError: finalError.message,
            errorCode: isServerError ? "SERVER_ERROR" : "MAX_RETRIES_EXCEEDED"
          }));
          memoizedCallbacks.onError?.(finalError);
        }
      };
    } catch (err) {
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      const error = err instanceof Error ? err : new Error("Failed to create WebSocket");
      console.error("[Terminal] Failed to create WebSocket:", error);
      (error as any).code = "WEBSOCKET_CREATION_FAILED";
      setError(error);
      setIsConnecting(false);
      setDiagnostics(prev => ({
        ...prev,
        lastError: error.message,
        errorCode: "WEBSOCKET_CREATION_FAILED"
      }));
      memoizedCallbacks.onError?.(error);
    }
  }, [
    sessionId, 
    token, 
    isConnecting, 
    isConnected, 
    buildWebSocketUrl, 
    startPingInterval, 
    flushMessageQueue, 
    handleReconnect,
    memoizedCallbacks,
    onConnect,
    onDisconnect
  ]);

  // Connect on mount or when session/token changes
  useEffect(() => {
    if (sessionId && token) {
      console.log("[Terminal] Session/token changed, connecting...");
      connect();
    }

    return () => {
      console.log("[Terminal] Cleanup - closing WebSocket");
      clearAllTimers();
      if (ws.current) {
        ws.current.close(1000, "Component unmount");
        ws.current = null;
      }
    };
  }, [sessionId, token]);

  /**
   * Send command to server
   */
  const executeCommand = useCallback((command: string) => {
    const msg: TerminalCommand = {
      type: "command",
      command,
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
      console.log("[Terminal] Command sent:", command);
    } else {
      messageQueueRef.current.push(msg);
      console.log("[Terminal] Command queued (not connected)");
    }
  }, []);

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback((cols: number, rows: number) => {
    const msg: TerminalCommand = {
      type: "resize",
      cols,
      rows,
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
      console.log(`[Terminal] Resize sent: ${cols}x${rows}`);
    } else {
      messageQueueRef.current.push(msg);
      console.log("[Terminal] Resize queued (not connected)");
    }
  }, []);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    console.log("[Terminal] Manual reconnect requested");
    reconnectAttemptsRef.current = 0;
    clearAllTimers();
    
    if (ws.current) {
      ws.current.close(1000, "Reconnecting");
      ws.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    
    // Small delay before reconnecting
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect, clearAllTimers]);

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    console.log("[Terminal] Disconnecting");
    clearAllTimers();
    
    if (ws.current) {
      ws.current.close(1000, "User disconnect");
      ws.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, [clearAllTimers]);

  return {
    isConnected,
    isConnecting,
    error,
    executeCommand,
    resizeTerminal,
    diagnostics,
    reconnect,
    disconnect,
  };
}
