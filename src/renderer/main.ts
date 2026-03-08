import { apiService } from './services/ApiService';
import { wsService } from './services/WebSocketService';
import { store } from './store';
import { MessageRenderer } from './components/MessageRenderer';
import { ChatListRenderer } from './components/ChatListRenderer';
import { toast } from './components/ToastManager';
import { modal } from './components/ModalManager';
import { getAvatarLetter, escapeHtml } from './utils/helpers';
import type { ChatType } from './types';

declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      getPlatform: () => Promise<string>;
    };
  }
}

class App {
  private messageRenderer: MessageRenderer;
  private chatListRenderer: ChatListRenderer;
  
  private authPage: HTMLElement;
  private chatPage: HTMLElement;
  private loginForm: HTMLFormElement;
  private registerForm: HTMLFormElement;
  private messageInput: HTMLTextAreaElement;
  private searchInput: HTMLInputElement;

  constructor() {
    this.authPage = document.getElementById('auth-page')!;
    this.chatPage = document.getElementById('chat-page')!;
    this.loginForm = document.getElementById('login-form') as HTMLFormElement;
    this.registerForm = document.getElementById('register-form') as HTMLFormElement;
    this.messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    
    this.messageRenderer = new MessageRenderer('messages-container');
    this.chatListRenderer = new ChatListRenderer('chat-list');
    
    this.init();
  }

  private init(): void {
    this.setupEventListeners();
    this.setupWebSocketCallbacks();
    this.checkAuth();
  }

  private setupEventListeners(): void {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        const form = document.getElementById(`${tab.getAttribute('data-tab')}-form`);
        form?.classList.add('active');
      });
    });

    document.querySelectorAll('.chat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        store.setCurrentChatType(tab.getAttribute('data-type') as ChatType);
        this.chatListRenderer.render(this.selectChat.bind(this));
      });
    });

    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = (document.getElementById('login-username') as HTMLInputElement).value.trim();
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      this.handleLogin(username, password);
    });

    this.registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = (document.getElementById('reg-username') as HTMLInputElement).value.trim();
      const password = (document.getElementById('reg-password') as HTMLInputElement).value;
      const confirm = (document.getElementById('reg-confirm') as HTMLInputElement).value;
      this.handleRegister(username, password, confirm);
    });

    document.getElementById('send-btn')?.addEventListener('click', () => this.handleSendMessage());
    
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.searchInput.addEventListener('input', () => this.handleSearch());

    document.getElementById('create-group-btn')?.addEventListener('click', () => this.showCreateGroupModal());
    document.getElementById('settings-btn')?.addEventListener('click', () => this.showSettingsModal());
  }

  private setupWebSocketCallbacks(): void {
    wsService.setCallbacks({
      onChatHistoryStart: () => {
        this.messageRenderer.clear();
        store.clearMessages();
      },
      onChatHistoryMessage: (data) => {
        if (data.ok && data.message) {
          store.prependMessage(data.message);
          this.messageRenderer.renderMessage(data.message, true);
        }
      },
      onChatHistoryEnd: () => {
        if (store.getMessages().length === 0) {
          this.messageRenderer.showEmpty();
        }
        this.messageRenderer.scrollToBottom();
      },
      onPrivateMessage: (message) => {
        const state = store.getState();
        if (state.currentChat?.id === message.senderId) {
          store.addMessage(message);
          this.messageRenderer.renderMessage(message);
          this.messageRenderer.scrollToBottom();
        } else {
          const unread = store.getUnread(message.senderId);
          store.setUnread(message.senderId, unread + 1);
          this.chatListRenderer.render(this.selectChat.bind(this));
        }
      },
      onGroupMessage: (message) => {
        const state = store.getState();
        if (state.currentChat?.id === message.groupId) {
          store.addMessage(message);
          this.messageRenderer.renderMessage(message);
          this.messageRenderer.scrollToBottom();
        } else {
          const unread = store.getUnread(message.groupId || '');
          store.setUnread(message.groupId || '', unread + 1);
          this.chatListRenderer.render(this.selectChat.bind(this));
        }
      },
      onUserOnline: (userId) => {
        const user = store.getUserFromMap(userId);
        if (user) {
          user.online = true;
          this.chatListRenderer.render(this.selectChat.bind(this));
        }
      },
      onUserOffline: (userId) => {
        const user = store.getUserFromMap(userId);
        if (user) {
          user.online = false;
          this.chatListRenderer.render(this.selectChat.bind(this));
        }
      }
    });
  }

  private async checkAuth(): Promise<void> {
    const token = apiService.getToken();
    if (!token) return;

    try {
      const data = await apiService.getUserSelf();
      store.setCurrentUser(data.info);
      await this.initApp();
    } catch (error) {
      apiService.setToken(null);
    }
  }

  private async handleLogin(username: string, password: string): Promise<void> {
    if (!username || !password) {
      toast.show('请填写完整信息', 'error');
      return;
    }

    try {
      const data = await apiService.login(username, password);
      if (data.ok !== false) {
        if (data.token) {
          apiService.setToken(data.token);
        }
        store.setCurrentUser(data.user);
        await this.initApp();
        toast.show('登录成功', 'success');
      } else {
        toast.show(data.msg || '登录失败', 'error');
      }
    } catch (error: any) {
      toast.show(error.message || '登录失败', 'error');
    }
  }

  private async handleRegister(username: string, password: string, confirm: string): Promise<void> {
    if (!username || !password || !confirm) {
      toast.show('请填写完整信息', 'error');
      return;
    }

    if (password !== confirm) {
      toast.show('两次密码不一致', 'error');
      return;
    }

    try {
      const data = await apiService.register(username, password);
      if (data.ok !== false) {
        if (data.token) {
          apiService.setToken(data.token);
          store.setCurrentUser(data.user || null);
          await this.initApp();
          toast.show('注册成功', 'success');
        } else {
          toast.show('注册成功，请登录', 'success');
        }
      } else {
        toast.show(data.msg || '注册失败', 'error');
      }
    } catch (error: any) {
      toast.show(error.message || '注册失败', 'error');
    }
  }

  private async initApp(): Promise<void> {
    this.authPage.classList.remove('active');
    this.chatPage.classList.add('active');

    const currentUser = store.getState().currentUser!;
    
    const userNameEl = document.getElementById('current-user-name');
    const userAvatarEl = document.getElementById('current-user-avatar');
    if (userNameEl) userNameEl.textContent = currentUser.username;
    if (userAvatarEl) userAvatarEl.textContent = getAvatarLetter(currentUser.username);

    wsService.connect();
    
    setTimeout(() => {
      wsService.authenticate(currentUser.id, apiService.getToken() || '');
    }, 500);

    await this.loadContacts();
  }

  private async loadContacts(): Promise<void> {
    try {
      const data = await apiService.getUserSelf();
      const info = data.info;
      store.setUsers(info.friends || []);
      store.setGroups(info.groups || []);
      this.chatListRenderer.render(this.selectChat.bind(this));
    } catch (error) {
      console.error('加载联系人失败:', error);
    }
  }

  private async selectChat(id: string, type: ChatType): Promise<void> {
    store.setCurrentChat({ id, type });
    store.setUnread(id, 0);
    this.chatListRenderer.render(this.selectChat.bind(this));

    const state = store.getState();
    let name: string;
    
    try {
      if (type === 'private') {
        const data = await apiService.getUserInfo(id);
        const user = data.info;
        store.addUserToMap(user);
        name = user.nickname || user.username;
        
        const statusEl = document.getElementById('chat-status');
        if (statusEl) {
          statusEl.textContent = user.online ? '在线' : '离线';
          statusEl.style.color = user.online ? 'var(--success)' : 'var(--text-muted)';
        }
      } else {
        const data = await apiService.getGroupInfo(id);
        const group = data.group;
        name = group.name;
        
        const statusEl = document.getElementById('chat-status');
        if (statusEl) {
          statusEl.textContent = `${group.members?.length || 0} 成员`;
          statusEl.style.color = 'var(--text-muted)';
        }
        
        this.preloadMembers(group.members || []);
      }
    } catch (error) {
      const list = type === 'private' ? state.users : state.groups;
      const item = list.find(i => i.id === id);
      name = (item as any)?.username || (item as any)?.name || '未知';
    }

    const titleEl = document.getElementById('chat-title');
    const avatarEl = document.getElementById('chat-avatar');
    if (titleEl) titleEl.textContent = name;
    if (avatarEl) avatarEl.textContent = getAvatarLetter(name);

    this.messageRenderer.showLoading();

    try {
      await apiService.markAsRead(id, type);
    } catch (e) {
      console.error('标记已读失败:', e);
    }

    if (wsService.isSocketConnected()) {
      wsService.getChatHistory(id, type, state.currentUser!.id);
    } else {
      this.messageRenderer.showEmpty();
    }
  }

  private async preloadMembers(memberIds: string[]): Promise<void> {
    for (const memberId of memberIds) {
      if (!store.getUserFromMap(memberId)) {
        try {
          const data = await apiService.getUserInfo(memberId);
          store.addUserToMap(data.info);
        } catch (e) {
          console.error('获取成员信息失败:', memberId);
        }
      }
    }
  }

  private async handleSendMessage(): Promise<void> {
    const content = this.messageInput.value.trim();
    const state = store.getState();
    
    if (!content || !state.currentChat || !state.currentUser) return;

    const message = {
      senderId: state.currentUser.id,
      receiverId: state.currentChat.type === 'private' ? state.currentChat.id : undefined,
      groupId: state.currentChat.type === 'group' ? state.currentChat.id : undefined,
      content,
      type: 'text' as const,
      timestamp: new Date().toISOString()
    };

    this.messageInput.value = '';
    this.messageRenderer.renderMessage(message as any);
    this.messageRenderer.scrollToBottom();

    try {
      await apiService.sendMessage(message);
    } catch (error: any) {
      toast.show('发送失败: ' + error.message, 'error');
    }
  }

  private handleSearch(): void {
    const query = this.searchInput.value.toLowerCase().trim();
    const state = store.getState();
    const list = state.currentChatType === 'private' ? state.users : state.groups;
    
    if (!query) {
      this.chatListRenderer.render(this.selectChat.bind(this));
      return;
    }

    const filtered = list.filter(item => {
      const name = ((item as any).username || (item as any).name || '').toLowerCase();
      return name.includes(query);
    });

    const container = document.getElementById('chat-list')!;
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chat-list-empty">未找到结果</div>';
      return;
    }

    container.innerHTML = filtered.map(item => {
      const name = (item as any).username || (item as any).name;
      return `
        <div class="chat-item" data-id="${item.id}" data-type="${state.currentChatType}">
          <div class="chat-item-avatar">${getAvatarLetter(name)}</div>
          <div class="chat-item-info">
            <div class="chat-item-name">${name}</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id')!;
        const type = item.getAttribute('data-type') as ChatType;
        this.selectChat(id, type);
      });
    });
  }

  private showCreateGroupModal(): void {
    const state = store.getState();
    const usersHtml = state.users.map(user => `
      <label class="user-list-item">
        <input type="checkbox" value="${user.id}" name="members">
        <div class="avatar">${getAvatarLetter(user.username)}</div>
        <span class="name">${user.username}</span>
      </label>
    `).join('');

    modal.show('创建群组', `
      <div class="form-group-modal">
        <label>群组名称</label>
        <input type="text" id="group-name" placeholder="请输入群组名称">
      </div>
      <div class="form-group-modal">
        <label>选择成员</label>
        <div class="user-list">${usersHtml}</div>
      </div>
      <button class="btn-modal" id="create-group-submit">创建</button>
    `);

    document.getElementById('create-group-submit')?.addEventListener('click', async () => {
      const name = (document.getElementById('group-name') as HTMLInputElement).value.trim();
      const members = Array.from(document.querySelectorAll('input[name="members"]:checked'))
        .map(cb => (cb as HTMLInputElement).value);

      if (!name) {
        toast.show('请输入群组名称', 'error');
        return;
      }

      if (members.length === 0) {
        toast.show('请至少选择一个成员', 'error');
        return;
      }

      try {
        const state = store.getState();
        await apiService.createGroup(name, members, state.currentUser!.id);
        await this.loadContacts();
        modal.hide();
        toast.show('群组创建成功', 'success');
      } catch (error: any) {
        toast.show('创建失败: ' + error.message, 'error');
      }
    });
  }

  private showSettingsModal(): void {
    const state = store.getState();
    modal.show('设置', `
      <div class="user-list">
        <div class="user-list-item" style="cursor: default;">
          <div class="avatar">${getAvatarLetter(state.currentUser?.username)}</div>
          <div class="name">${state.currentUser?.username}</div>
        </div>
      </div>
      <button class="btn-modal" id="logout-btn" style="margin-top: 16px; background: var(--danger);">退出登录</button>
    `);

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      modal.hide();
      this.logout();
    });
  }

  private logout(): void {
    apiService.setToken(null);
    wsService.disconnect();
    store.reset();
    
    this.authPage.classList.add('active');
    this.chatPage.classList.remove('active');
  }
}

new App();
