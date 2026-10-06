/**
 * Remote Relay Client for Amiga XR
 * Connects Windows Chrome (Station) and Meta Quest 3 (VR/MR) over WebSocket
 */
export class RemoteRelay {
  constructor(options = {}) {
    this.customUrl = options.url || null;
    this.primaryUrl = options.url || `wss://${window.location.hostname}:5173/ws-relay`;
    this.fallbackUrl = `wss://${window.location.host}/ws-relay`;
    this.url = this.primaryUrl;
    this.attemptPrimary = true;
    this.ws = null;
    this.reconnectTimer = null;
    this.listeners = new Map();
    this.connected = false;
    this.peerCount = 0;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`[Amiga XR Relay] Connected to WebSocket relay at ${this.url}`);
        this.connected = true;
        this.trigger('connect', { connected: true, url: this.url });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'status') {
            this.peerCount = msg.peerCount;
            this.trigger('peer_count', { count: this.peerCount });
          } else {
            this.trigger(msg.type, msg);
          }
        } catch (e) {
          console.error('[Amiga XR Relay] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.trigger('disconnect', { connected: false });
        // If primary port failed without connecting, try current host fallback
        if (!wasConnected && this.attemptPrimary && this.url === this.primaryUrl && this.primaryUrl !== this.fallbackUrl) {
          console.log(`[Amiga XR Relay] Primary port unreachable, falling back to ${this.fallbackUrl}`);
          this.attemptPrimary = false;
          this.url = this.fallbackUrl;
          this.connect();
          return;
        }
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      };

      this.ws.onerror = (err) => {
        console.warn(`[Amiga XR Relay] WebSocket connection error on ${this.url}`);
      };
    } catch (e) {
      console.error('[Amiga XR Relay] Failed to initialize WebSocket:', e);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    }
  }

  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = { type, timestamp: Date.now(), ...payload };
    this.ws.send(JSON.stringify(msg));
  }

  sendDiskInsert(unit, file, title, dataBase64 = null) {
    this.send('insert_disk', { unit, file, title, dataBase64 });
  }

  sendDiskEject(unit) {
    this.send('eject_disk', { unit });
  }

  sendReset(hard = false) {
    this.send('reset_amiga', { hard });
  }

  sendRemoteKey(subType, eventData) {
    this.send('remote_key', { subType, ...eventData });
  }

  sendRemoteMouse(subType, eventData) {
    this.send('remote_mouse', { subType, ...eventData });
  }

  sendRemoteGamepad(gamepadData) {
    this.send('remote_gamepad', gamepadData);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  trigger(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(data);
      }
    }
  }
}
