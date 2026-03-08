export interface IApiService {
  login(username: string, password: string): Promise<LoginResponse>;
  register(username: string, password: string): Promise<RegisterResponse>;
  getUserSelf(): Promise<UserSelfResponse>;
  getUserInfo(userId: string): Promise<UserInfoResponse>;
  getGroupInfo(groupId: string): Promise<GroupInfoResponse>;
  sendMessage(params: SendMessageParams): Promise<SendMessageResponse>;
  markAsRead(chatId: string, type: ChatType): Promise<void>;
  createGroup(name: string, members: string[]): Promise<GroupInfoResponse>;
}

export interface SendMessageParams {
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  type?: MessageType;
}

export interface IWebSocketService {
  connect(): void;
  disconnect(): void;
  authenticate(userId: string, token: string): void;
  getChatHistory(chatId: string, type: ChatType): void;
  isConnected(): boolean;
}

import { LoginResponse, RegisterResponse, UserSelfResponse, UserInfoResponse, GroupInfoResponse, SendMessageResponse, ChatType, MessageType } from './index';
