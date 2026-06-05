// WebSocket service — connects to the live update stream
// Falls back gracefully when disconnected.
// Uses socket.io polling fallback for poor connections.

import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const WS_URL = Constants.expoConfig?.extra?.wsBaseUrl ?? 'ws://localhost:3000';

type ReportListener = (report: any) => void;

class LiveUpdateService {
  private socket: Socket | null = null;
  private reportListeners: ReportListener[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(`${WS_URL}/live`, {
      transports: ['websocket', 'polling'], // polling is fallback for weak connections
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
    });

    // Incoming crowd report
    this.socket.on('report:new', (report: any) => {
      this.reportListeners.forEach((l) => l(report));
    });

    // Report has expired
    this.socket.on('report:expired', ({ id }: { id: string }) => {
      // Notify listeners to remove stale report from UI
      this.reportListeners.forEach((l) => l({ id, _expired: true }));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }

  subscribeToCity(cityId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('subscribe:city', { cityId });
  }

  subscribeToRoute(routeId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('subscribe:route', { routeId });
  }

  unsubscribeFromRoute(routeId: string) {
    this.socket?.emit('unsubscribe:route', { routeId });
  }

  onReport(listener: ReportListener): () => void {
    this.reportListeners.push(listener);
    return () => {
      this.reportListeners = this.reportListeners.filter((l) => l !== listener);
    };
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' {
    if (this.isConnected) return 'connected';
    if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) return 'reconnecting';
    return 'disconnected';
  }
}

export const liveUpdateService = new LiveUpdateService();
