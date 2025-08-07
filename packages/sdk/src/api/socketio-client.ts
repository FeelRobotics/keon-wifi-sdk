import { io, Socket } from 'socket.io-client';

interface SocketOptions {
  serverUrl: string;
  token: string;
  onMessage: (message: any) => void;
  onError: (error: any) => void;
  onDeviceStatus: (message: any) => void;
  onUserActivity: (message: any) => void;
}

class SocketClient {
  private socket: Socket;

  constructor(options: SocketOptions) {
    const {
      serverUrl,
      token,
      onMessage,
      onError,
      onDeviceStatus,
      onUserActivity,
    } = options;

    this.socket = io(serverUrl, {
      auth: { Authorization: `Bearer ${token}` },
      reconnectionAttempts: 5,
      transports: ['websocket'],
    });

    this.socket.on('message', (data: any) => {
      onMessage(data);
    });

    this.socket.on('device_status', (data: any) => {
      onDeviceStatus(data);
    });

    this.socket.on('user_activity_on_device', (data: any) => {
      onUserActivity(data);
    });

    this.socket.on('error', (error: any) => {
      onError(error);
    });

    this.socket.on('connect_error', (error: any) => {
      onError(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log(`Disconnected: ${reason}`);
    });
  }

  sendMessage(event: string, message: any): void {
    this.socket.emit(event, message);
  }

  close(): void {
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return this.socket.connected;
  }
}

interface SocketIOClientOptions {
  serverUrl: string;
  token: string;
  onDeviceStatus: (message: any) => void;
  onUserActivity: (message: any) => void;
}

const socketIOClient = async (options: SocketIOClientOptions) => {
  const { serverUrl, token, onDeviceStatus, onUserActivity } = options;

  const onMessage = (message: any) => {
    console.debug('Received message:', message);
  };

  const onError = (error: any) => {
    console.error('Socket error:', error);
  };

  return new SocketClient({
    serverUrl,
    token,
    onMessage,
    onError,
    onDeviceStatus,
    onUserActivity,
  });
};

export { SocketClient, socketIOClient, SocketIOClientOptions };
