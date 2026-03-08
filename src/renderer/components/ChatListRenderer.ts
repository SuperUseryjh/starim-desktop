import type { User, Group, ChatType } from '../types';
import { store } from '../store';
import { getAvatarLetter } from '../utils/helpers';

export class ChatListRenderer {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  render(onChatSelect: (id: string, type: ChatType) => void): void {
    const state = store.getState();
    const list = state.currentChatType === 'private' ? state.users : state.groups;
    
    if (list.length === 0) {
      this.container.innerHTML = `<div class="chat-list-empty">暂无${state.currentChatType === 'private' ? '联系人' : '群组'}</div>`;
      return;
    }

    this.container.innerHTML = list.map(item => {
      const unread = state.unreadMessages[item.id] || 0;
      const isActive = state.currentChat?.id === item.id;
      const name = (item as User).username || (item as Group).name;
      
      return `
        <div class="chat-item ${isActive ? 'active' : ''}" data-id="${item.id}" data-type="${state.currentChatType}">
          <div class="chat-item-avatar">${getAvatarLetter(name)}</div>
          <div class="chat-item-info">
            <div class="chat-item-name">${name}</div>
            <div class="chat-item-preview">${(item as User).lastMessage || ''}</div>
          </div>
          <div class="chat-item-meta">
            ${unread > 0 ? `<span class="chat-item-badge">${unread}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.container.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id')!;
        const type = item.getAttribute('data-type') as ChatType;
        onChatSelect(id, type);
      });
    });
  }
}
