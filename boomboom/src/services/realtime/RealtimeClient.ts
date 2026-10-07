import { REALTIME } from '@/config/constants';
import { logger } from '@/services/logger/logger';

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

type EventMap = Record<string, unknown>;

type Envelope = { type: string; data?: unknown };

type Options = {
  url: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
};

export class RealtimeClient<
  ServerEvents extends EventMap,
  ClientEvents extends EventMap,
> {
  private socket: WebSocket | null = null;
  private status: RealtimeStatus = 'idle';
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Map<string, Set<(data: never) => void>>();
  private readonly statusListeners = new Set<
    (status: RealtimeStatus) => void
  >();

  constructor(private readonly options: Options) {}

  connect() {
    this.shouldReconnect = true;
    if (this.socket || this.reconnectTimer) {
      return;
    }
    this.open();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearTimers();
    this.reconnectAttempts = 0;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'client disconnect');
    this.setStatus('idle');
  }

  on<E extends keyof ServerEvents & string>(
    event: E,
    listener: (data: ServerEvents[E]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (data: never) => void);
    return () => set.delete(listener as (data: never) => void);
  }

  onStatusChange(listener: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  send<E extends keyof ClientEvents & string>(event: E, data: ClientEvents[E]) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify({ type: event, data }));
    return true;
  }

  getStatus() {
    return this.status;
  }

  private open() {
    const token = this.options.getToken();
    if (!token) {
      this.setStatus('idle');
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(
      `${this.options.url}?token=${encodeURIComponent(token)}`,
    );
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('open');
      this.startHeartbeat();
    };

    socket.onmessage = event => this.dispatch(event.data);

    socket.onerror = () => {
      logger.debug('Realtime socket error');
    };

    socket.onclose = event => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.clearTimers();
      if (event.code === REALTIME.unauthorizedCloseCode) {
        this.shouldReconnect = false;
        this.setStatus('idle');
        this.options.onUnauthorized?.();
        return;
      }
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      } else {
        this.setStatus('idle');
      }
    };
  }

  private dispatch(raw: unknown) {
    if (typeof raw !== 'string') {
      return;
    }
    let envelope: Envelope;
    try {
      envelope = JSON.parse(raw) as Envelope;
    } catch {
      logger.warn('Dropped malformed realtime message');
      return;
    }
    if (envelope.type === 'pong') {
      return;
    }
    this.listeners.get(envelope.type)?.forEach(listener => {
      try {
        listener(envelope.data as never);
      } catch (error) {
        logger.error(`Realtime listener for "${envelope.type}" failed`, error);
      }
    });
  }

  private scheduleReconnect() {
    const exponential =
      REALTIME.initialReconnectDelayMs * 2 ** this.reconnectAttempts;
    const capped = Math.min(exponential, REALTIME.maxReconnectDelayMs);
    // Jitter spreads reconnects out so a server restart doesn't get a thundering herd.
    const delay = capped / 2 + Math.random() * (capped / 2);
    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, REALTIME.heartbeatIntervalMs);
  }

  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
}
