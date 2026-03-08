const API_BASE = 'https://starim.wu.airoe.cn/api';

export class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        throw new Error('登录已过期，请重新登录');
      }
      throw new Error(data.msg || data.message || '请求失败');
    }

    return data;
  }

  async login(username: string, password: string) {
    const data = await this.request<{ ok: boolean; user: any; token: string; msg?: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return data;
  }

  async register(username: string, password: string) {
    const data = await this.request<{ ok: boolean; user?: any; token?: string; msg?: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return data;
  }

  async getUserSelf() {
    const data = await this.request<{ ok: boolean; info: any }>('/user/self', {
      method: 'POST'
    });
    return data;
  }

  async getUserInfo(userId: string) {
    const data = await this.request<{ ok: boolean; info: any }>('/user/info', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    return data;
  }

  async getGroupInfo(groupId: string) {
    const data = await this.request<{ ok: boolean; group: any }>('/group/info', {
      method: 'POST',
      body: JSON.stringify({ groupId })
    });
    return data;
  }

  async sendMessage(params: { senderId: string; receiverId?: string; groupId?: string; content: string }) {
    const data = await this.request<{ ok: boolean; message?: any; msg?: string }>('/message/send', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return data;
  }

  async markAsRead(chatId: string, type: 'private' | 'group' = 'private') {
    const body: any = { userId: this.token ? JSON.parse(atob(this.token.split('.')[0])).id : null, chatId: chatId };
    if (type === 'group') {
      body.type = 'group';
    }
    await this.request('/message/read', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async createGroup(name: string, members: string[], creatorId: string) {
    const data = await this.request<{ ok: boolean; group?: any; msg?: string }>('/group/create', {
      method: 'POST',
      body: JSON.stringify({ name, members, creatorId })
    });
    return data;
  }
}

export const apiService = new ApiService();
