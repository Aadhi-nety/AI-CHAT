'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { TerminalCommand, TerminalResponse } from "@/lib/api-client";

interface UseTerminalHttpOptions {
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

/**
 * HTTP Polling Terminal Hook
 * 
 * Uses HTTP requests instead of WebSocket to communicate with the terminal.
 * This works with AWS App Runner which doesn't support WebSocket connections.
 * 
 * Instead of maintaining a persistent connection, we:
 * 1. Send commands via POST /api/ws/message
 * 2. Poll for status via GET /api/ws/status/:sessionId
 * 3. Use the terminal's in-memory state for output
 */
export function useTerminalHttp(
  apiBaseUrl: string,
  sessionId: string,
  options: UseTerminalHttpOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    url: apiBaseUrl,
    attempts: 0,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const commandQueueRef = useRef<TerminalCommand[]>([]);
  const lastStatusRef = useRef<any>(null);
  const isPollingRef = useRef(false);
  
  // Poll interval - check for updates every 1 second
  const POLL_INTERVAL = 1000;
  const connectionTimeout = 10000;

  /**
   * Make HTTP request to backend
   */
  const makeRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> => {
    const url = `${apiBaseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[Terminal HTTP] Request failed: ${endpoint}`, err);
      throw err;
    }
  }, [apiBaseUrl]);

  /**
   * Check session status and get terminal output
   */
  const pollStatus = useCallback(async () => {
    if (!sessionId || isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const status = await makeRequest(`/api/ws/status/${sessionId}`);
      lastStatusRef.current = status;

      if (status.valid && status.terminalActive) {
        if (!isConnected) {
          setIsConnected(true);
          options.onConnect?.();
        }
      } else if (status.valid && !status.terminalActive) {
        // Session valid but terminal not active - might need to create it
        console.log('[Terminal HTTP] Terminal not active, will create on first command');
      }
    } catch (err) {
      console.error('[Terminal HTTP] Poll error:', err);
      // Don't set error on poll failure - might be temporary
    } finally {
      isPollingRef.current = false;
    }
  }, [sessionId, makeRequest, isConnected, options]);

  /**
   * Connect - validate session and start polling
   */
  const connect = useCallback(async () => {
    if (!apiBaseUrl || !sessionId) {
      const error = new Error("API URL and session ID are required");
      setError(error);
      options.onError?.(error);
      return;
    }

    setIsConnecting(true);
    setError(null);

    console.log(`[Terminal HTTP] Connecting to ${apiBaseUrl} for session ${sessionId}`);

    try {
      // Validate session
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), connectionTimeout)
      );

      const statusPromise = makeRequest(`/api/ws/status/${sessionId}`);

      await Promise.race([statusPromise, timeoutPromise]);

      const connectionTime = Date.now();
      console.log(`[Terminal HTTP] Connected in ${connectionTime}ms`);

      setIsConnected(true);
      setIsConnecting(false);
      setDiagnostics(prev => ({
        ...prev,
        attempts: 0,
        connectionTime,
        lastError: undefined,
      }));

      // Start polling for status updates
      pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL);

      options.onConnect?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to connect");
      console.error('[Terminal HTTP] Connection error:', error);
      
      setIsConnected(false);
      setIsConnecting(false);
      setError(error);
      setDiagnostics(prev => ({
        ...prev,
        attempts: 1,
        lastError: error.message,
      }));
      
      options.onError?.(error);
    }
  }, [apiBaseUrl, sessionId, makeRequest, pollStatus, connectionTimeout, options]);

  /**
   * Disconnect - stop polling and cleanup
   */
  const disconnect = useCallback(async () => {
    console.log('[Terminal HTTP] Disconnecting...');

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Notify backend
    if (apiBaseUrl && sessionId) {
      try {
        await makeRequest('/api/ws/disconnect', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('[Terminal HTTP] Disconnect notification failed:', err);
      }
    }

    setIsConnected(false);
    setIsConnecting(false);
    options.onDisconnect?.();
  }, [apiBaseUrl, sessionId, makeRequest, options]);

  /**
   * Execute command - send via HTTP POST
   */
  const executeCommand = useCallback(async (command: string): Promise<string> => {
    if (!sessionId) {
      throw new Error("No active session");
    }

    console.log(`[Terminal HTTP] Executing command: ${command}`);

    try {
      const result = await makeRequest('/api/ws/message', {
        method: 'POST',
        body: JSON.stringify({
          type: 'command',
          command,
          sessionId,
        }),
      });

      if (result.type === 'error') {
        throw new Error(result.message || 'Command execution failed');
      }

      // Return the command result
      const output = result.result || '';
      console.log(`[Terminal HTTP] Command result:`, output);

      // Notify via callback
      options.onMessage?.({
        type: 'output',
        data: output,
        timestamp: result.timestamp,
      });

      return output;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Command failed');
      console.error('[Terminal HTTP] Command error:', error);
      
      options.onMessage?.({
        type: 'error',
        message: error.message,
        timestamp: Date.now(),
      });
      
      throw error;
    }
  }, [sessionId, makeRequest, options]);

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    if (!sessionId) {
      throw new Error("No active session");
    }

    console.log(`[Terminal HTTP] Resizing to ${cols}x${rows}`);

    try {
      await makeRequest('/api/ws/message', {
        method: 'POST',
        body: JSON.stringify({
          type: 'resize',
          cols,
          rows,
          sessionId,
        }),
      });

      console.log('[Terminal HTTP] Resize acknowledged');
    } catch (err) {
      console.error('[Terminal HTTP] Resize error:', err);
      // Non-fatal, don't throw
    }
  }, [sessionId, makeRequest]);

  /**
   * Ping - keep-alive check
   */
  const ping = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await makeRequest('/api/ws/message', {
        method: 'POST',
        body: JSON.stringify({
          type: 'ping',
          sessionId,
        }),
      });

      return result;
    } catch (err) {
      console.error('[Terminal HTTP] Ping error:', err);
      return null;
    }
  }, [sessionId, makeRequest]);

  // Connect on mount
  useEffect(() => {
    if (apiBaseUrl && sessionId) {
      connect();
    }

    return () => {
      // Cleanup on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      disconnect();
    };
  }, [apiBaseUrl, sessionId]);

  return {
    isConnected,
    isConnecting,
    error,
    executeCommand,
    resizeTerminal,
    ping,
    diagnostics,
    reconnect: connect,
    disconnect,
  };
}
