export interface AuthState {
  isLoggedIn: boolean;
  currentUser: User | null;
  token: string | null;
}

export interface ChatState {
  currentChat: Chat | null;
  currentChatType: ChatType;
  messages: Message[];
  unreadMessages: Record<string, number>;
}

export interface ContactsState {
  users: User[];
  groups: Group[];
  usersMap: Map<string, User>;
}

export interface AppState extends AuthState, ChatState, ContactsState {
  isLoading: boolean;
  error: string | null;
}

import { User, Group, Message, Chat, ChatType } from './index';
