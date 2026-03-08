import type { Message, ChatType } from '../types';

type MessageCallback = (message: Message) => void;
type UserStatusCallback = (userId: string, online: boolean) => void;

interface Socket {
  on(event: string, callback: (...args: any[]) => void): Socket;
  emit(event: string, data?: any): Socket;
  disconnect(): void;
}

declare global {
  interface Window {
    io: {
      connect(url: string, options?: any): Socket;
    };
  }
}

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  
  private onChatHistoryStart?: () => void;
  private onChatHistoryMessage?: (data: { ok: boolean; message: Message }) => void;
  private onChatHistoryEnd?: () => void;
  private onPrivateMessage?: MessageCallback;
  private onGroupMessage?: MessageCallback;
  private onUserOnline?: UserStatusCallback;
  private onUserOffline?: UserStatusCallback;

  connect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = window.io.connect('https://starim.wu.airoe.cn', {
      pingInterval: 25000,
      pingTimeout: 60000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnection: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
    });

    this.socket.on('authenticated', () => {
      console.log('WebSocket authenticated');
    });

    this.socket.on('chat_history_start', () => {
      this.onChatHistoryStart?.();
    });

    this.socket.on('chat_history_message', (data: { ok: boolean; message: Message }) => {
      this.onChatHistoryMessage?.(data);
    });

    this.socket.on('chat_history_end', () => {
      this.onChatHistoryEnd?.();
    });

    this.socket.on('private_message', (message: Message) => {
      this.onPrivateMessage?.(message);
    });

    this.socket.on('group_message', (message: Message) => {
      this.onGroupMessage?.(message);
    });

    this.socket.on('user_online', (userId: string) => {
      this.onUserOnline?.(userId, true);
    });

    this.socket.on('user_offline', (userId: string) => {
      this.onUserOffline?.(userId, false);
    });
  }

  authenticate(userId: string, token: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('authenticate', { userId, token });
    }
  }

  getChatHistory(chatId: string, type: ChatType, userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('get_chat_history', { userId, chatId, type });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  setCallbacks(callbacks: {
    onChatHistoryStart?: () => void;
    onChatHistoryMessage?: (data: { ok: boolean; message: Message }) => void;
    onChatHistoryEnd?: () => void;
    onPrivateMessage?: MessageCallback;
    onGroupMessage?: MessageCallback;
    onUserOnline?: UserStatusCallback;
    onUserOffline?: UserStatusCallback;
  }): void {
    this.onChatHistoryStart = callbacks.onChatHistoryStart;
    this.onChatHistoryMessage = callbacks.onChatHistoryMessage;
    this.onChatHistoryEnd = callbacks.onChatHistoryEnd;
    this.onPrivateMessage = callbacks.onPrivateMessage;
    this.onGroupMessage = callbacks.onGroupMessage;
    this.onUserOnline = callbacks.onUserOnline;
    this.onUserOffline = callbacks.onUserOffline;
  }
}

export const wsService = new WebSocketService();
