import type { Message, User } from '../types';
import { store } from '../store';
import { escapeHtml, getAvatarLetter, formatTime } from '../utils/helpers';

export class MessageRenderer {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  clear(): void {
    this.container.innerHTML = '';
  }

  showLoading(): void {
    this.container.innerHTML = '<div class="loading">加载中</div>';
  }

  showEmpty(): void {
    this.container.innerHTML = `
      <div class="messages-empty">
        <div class="empty-icon">💬</div>
        <p>开始聊天吧</p>
      </div>
    `;
  }

  renderMessage(message: Message, prepend: boolean = false): void {
    const state = store.getState();
    const isSent = message.senderId === state.currentUser?.id;
    const sender: User | undefined = store.getUserFromMap(message.senderId);
    
    let content: string;
    switch (message.type) {
      case 'image':
        content = `<img src="${escapeHtml(message.content)}" style="max-width: 200px; border-radius: 8px; cursor: pointer;">`;
        break;
      case 'file':
        content = `<a href="${escapeHtml(message.content)}" target="_blank" style="color: inherit;">📎 ${escapeHtml(message.fileName || '文件')}</a>`;
        break;
      default:
        content = escapeHtml(message.content);
    }

    const showSender = !isSent && state.currentChat?.type === 'group';
    const senderName = sender?.nickname || sender?.username || '未知用户';
    
    const messageHtml = `
      <div class="message ${isSent ? 'sent' : 'received'}">
        <div class="message-avatar">${getAvatarLetter(senderName)}</div>
        <div class="message-content">
          ${showSender ? `<span class="message-sender">${escapeHtml(senderName)}</span>` : ''}
          <div class="message-bubble">${content}</div>
          <span class="message-time">${formatTime(message.timestamp || message.createdAt || '')}</span>
        </div>
      </div>
    `;

    const emptyMsg = this.container.querySelector('.messages-empty');
    if (emptyMsg) emptyMsg.remove();

    if (prepend) {
      this.container.insertAdjacentHTML('afterbegin', messageHtml);
    } else {
      this.container.insertAdjacentHTML('beforeend', messageHtml);
    }
  }

  scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }
}
