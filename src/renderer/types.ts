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

export type ChatType = 'private' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'card' | 'system';
