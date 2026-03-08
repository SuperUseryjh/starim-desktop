export interface User {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  online?: boolean;
  isSVIP?: boolean;
  lastMessage?: string;
}

export interface Group {
  id: string;
  name: string;
  avatar?: string;
  members: string[];
  type?: 'public' | 'verify' | 'private';
  createdAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'card' | 'system';
  subtype?: string;
  fileName?: string;
  timestamp: string;
  createdAt?: string;
  isRecalled?: boolean;
  read?: boolean;
  cardUser?: User;
  cardGroup?: Group;
  svipUser?: User;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name?: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  online?: boolean;
  members?: string[];
  lastMessage?: string;
}

export interface LoginResponse {
  ok: boolean;
  user: User;
  token: string;
  msg?: string;
}

export interface RegisterResponse {
  ok: boolean;
  user?: User;
  token?: string;
  msg?: string;
}

export interface UserSelfResponse {
  ok: boolean;
  info: {
    id: string;
    username: string;
    nickname?: string;
    avatar?: string;
    friends: User[];
    groups: Group[];
  };
}

export interface UserInfoResponse {
  ok: boolean;
  info: User;
}

export interface GroupInfoResponse {
  ok: boolean;
  group: Group;
}

export interface SendMessageResponse {
  ok: boolean;
  message?: Message;
  msg?: string;
}

export interface ChatHistoryMessage {
  ok: boolean;
  message: Message;
}

export type ChatType = 'private' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'card' | 'system';
