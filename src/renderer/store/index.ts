import type { User, Group, Message, Chat, ChatType } from '../types';

type StateChangeListener = () => void;

interface AppState {
  currentUser: User | null;
  currentChat: Chat | null;
  currentChatType: ChatType;
  users: User[];
  groups: Group[];
  usersMap: Map<string, User>;
  messages: Message[];
  unreadMessages: Record<string, number>;
  isLoading: boolean;
}

class Store {
  private state: AppState = {
    currentUser: null,
    currentChat: null,
    currentChatType: 'private',
    users: [],
    groups: [],
    usersMap: new Map(),
    messages: [],
    unreadMessages: {},
    isLoading: false
  };

  private listeners: StateChangeListener[] = [];

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  setCurrentUser(user: User | null): void {
    this.state.currentUser = user;
    if (user) {
      this.state.usersMap.set(user.id, user);
    }
    this.notify();
  }

  getCurrentUser(): User | null {
    return this.state.currentUser;
  }

  setCurrentChat(chat: Chat | null): void {
    this.state.currentChat = chat;
    this.notify();
  }

  getCurrentChat(): Chat | null {
    return this.state.currentChat;
  }

  setCurrentChatType(type: ChatType): void {
    this.state.currentChatType = type;
    this.notify();
  }

  getCurrentChatType(): ChatType {
    return this.state.currentChatType;
  }

  setUsers(users: User[]): void {
    this.state.users = users;
    users.forEach(user => this.state.usersMap.set(user.id, user));
    this.notify();
  }

  getUsers(): User[] {
    return this.state.users;
  }

  setGroups(groups: Group[]): void {
    this.state.groups = groups;
    this.notify();
  }

  getGroups(): Group[] {
    return this.state.groups;
  }

  addUserToMap(user: User): void {
    this.state.usersMap.set(user.id, user);
  }

  getUserFromMap(userId: string): User | undefined {
    return this.state.usersMap.get(userId);
  }

  setMessages(messages: Message[]): void {
    this.state.messages = messages;
    this.notify();
  }

  getMessages(): Message[] {
    return this.state.messages;
  }

  addMessage(message: Message): void {
    this.state.messages.push(message);
    this.notify();
  }

  prependMessage(message: Message): void {
    this.state.messages.unshift(message);
    this.notify();
  }

  clearMessages(): void {
    this.state.messages = [];
    this.notify();
  }

  setUnread(chatId: string, count: number): void {
    this.state.unreadMessages[chatId] = count;
    this.notify();
  }

  getUnread(chatId: string): number {
    return this.state.unreadMessages[chatId] || 0;
  }

  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.notify();
  }

  isLoading(): boolean {
    return this.state.isLoading;
  }

  reset(): void {
    this.state = {
      currentUser: null,
      currentChat: null,
      currentChatType: 'private',
      users: [],
      groups: [],
      usersMap: new Map(),
      messages: [],
      unreadMessages: {},
      isLoading: false
    };
    this.notify();
  }
}

export const store = new Store();
