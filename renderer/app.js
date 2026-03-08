const API = 'https://starim.wu.airoe.cn/api';

let currentUser = null;
let currentChat = null;
let usersCache = [];
let usersCacheMap = new Map();
let groupsCache = [];
let messagesCache = [];
let socket = null;
let unreadMessages = {};
let currentChatType = 'private';

const elements = {
    authPage: document.getElementById('auth-page'),
    chatPage: document.getElementById('chat-page'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    chatList: document.getElementById('chat-list'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    searchInput: document.getElementById('search-input'),
    currentUserName: document.getElementById('current-user-name'),
    currentUserAvatar: document.getElementById('current-user-avatar'),
    chatTitle: document.getElementById('chat-title'),
    chatStatus: document.getElementById('chat-status'),
    chatAvatar: document.getElementById('chat-avatar'),
    messageInputArea: document.getElementById('message-input-area'),
    modalOverlay: document.getElementById('modal-overlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
    toastContainer: document.getElementById('toast-container')
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showModal(title, content) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.modalOverlay.classList.remove('hidden');
}

function hideModal() {
    elements.modalOverlay.classList.add('hidden');
}

function getAvatarLetter(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(data.message || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function login(username, password) {
    const data = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (data.ok !== false) {
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        currentUser = data.user || data;
        initApp();
        showToast('登录成功', 'success');
    } else {
        throw new Error(data.msg || '登录失败');
    }
}

async function register(username, password) {
    const data = await apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (data.ok !== false) {
        if (data.token) {
            localStorage.setItem('token', data.token);
            currentUser = data.user || data;
            initApp();
            showToast('注册成功', 'success');
        } else {
            showToast('注册成功，请登录', 'success');
        }
    } else {
        throw new Error(data.msg || '注册失败');
    }
}

async function fetchUsers() {
    const data = await apiRequest('/user/self', { method: 'POST' });
    const info = data.info || data;
    usersCache = info.friends || [];
    groupsCache = info.groups || [];
    
    usersCacheMap.clear();
    usersCacheMap.set(currentUser.id, currentUser);
    usersCache.forEach(user => usersCacheMap.set(user.id, user));
    
    return usersCache;
}

async function getUserInfo(userId) {
    if (usersCacheMap.has(userId)) {
        return usersCacheMap.get(userId);
    }
    
    try {
        const data = await apiRequest('/user/info', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
        const info = data.info || data;
        usersCacheMap.set(userId, info);
        return info;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
}

async function fetchGroups() {
    return groupsCache;
}

async function sendMessage(content, receiverId, type = 'private') {
    return await apiRequest('/message/send', {
        method: 'POST',
        body: JSON.stringify({
            senderId: currentUser.id,
            receiverId: type === 'private' ? receiverId : null,
            groupId: type === 'group' ? receiverId : null,
            content
        })
    });
}

async function createGroup(name, memberIds) {
    return await apiRequest('/group/create', {
        method: 'POST',
        body: JSON.stringify({ 
            name, 
            members: memberIds,
            creatorId: currentUser.id 
        })
    });
}

function connectWebSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io('https://starim.wu.airoe.cn', {
        pingInterval: 25000,
        pingTimeout: 60000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnection: true
    });

    socket.on('connect', () => {
        console.log('WebSocket connected');
        if (currentUser && currentUser.id) {
            const token = localStorage.getItem('token');
            socket.emit('authenticate', { userId: currentUser.id, token });
        }
    });

    socket.on('authenticated', () => {
        console.log('WebSocket authenticated');
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });

    socket.on('private_message', (message) => {
        if (currentChat && currentChat.id === message.senderId) {
            displayMessage(message, 'received');
            messagesCache.push(message);
        } else {
            unreadMessages[message.senderId] = (unreadMessages[message.senderId] || 0) + 1;
            updateChatList();
        }
    });

    socket.on('group_message', (message) => {
        if (currentChat && currentChat.id === message.groupId) {
            displayMessage(message, 'received');
            messagesCache.push(message);
        } else {
            unreadMessages[message.groupId] = (unreadMessages[message.groupId] || 0) + 1;
            updateChatList();
        }
    });

    socket.on('user_online', (userId) => {
        const user = usersCache.find(u => u.id === userId);
        if (user) user.online = true;
        updateChatList();
    });

    socket.on('user_offline', (userId) => {
        const user = usersCache.find(u => u.id === userId);
        if (user) user.online = false;
        updateChatList();
    });

    socket.on('chat_history_start', () => {
        messagesCache = [];
        elements.messagesContainer.innerHTML = '';
    });

    socket.on('chat_history_message', (data) => {
        if (data.ok && data.message) {
            messagesCache.unshift(data.message);
            displayMessage(data.message, data.message.senderId === currentUser.id ? 'sent' : 'received');
        }
    });

    socket.on('chat_history_end', () => {
        if (messagesCache.length === 0) {
            elements.messagesContainer.innerHTML = `
                <div class="messages-empty">
                    <div class="empty-icon">💬</div>
                    <p>开始聊天吧</p>
                </div>
            `;
        }
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    });
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    currentChat = null;
    usersCache = [];
    usersCacheMap.clear();
    groupsCache = [];
    messagesCache = [];
    unreadMessages = {};
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    elements.authPage.classList.add('active');
    elements.chatPage.classList.remove('active');
}

async function initApp() {
    elements.authPage.classList.remove('active');
    elements.chatPage.classList.add('active');

    elements.currentUserName.textContent = currentUser.username;
    elements.currentUserAvatar.textContent = getAvatarLetter(currentUser.username);

    connectWebSocket();

    await fetchUsers();
    updateChatList();
}

function updateChatList() {
    const list = currentChatType === 'private' ? usersCache : groupsCache;
    
    if (list.length === 0) {
        elements.chatList.innerHTML = `<div class="chat-list-empty">暂无${currentChatType === 'private' ? '联系人' : '群组'}</div>`;
        return;
    }

    elements.chatList.innerHTML = list.map(item => {
        const isUser = currentChatType === 'private';
        const lastMessage = item.lastMessage || '';
        const unread = unreadMessages[item.id] || 0;
        const isActive = currentChat && currentChat.id === item.id;
        
        return `
            <div class="chat-item ${isActive ? 'active' : ''}" data-id="${item.id}" data-type="${currentChatType}">
                <div class="chat-item-avatar">${getAvatarLetter(item.username || item.name)}</div>
                <div class="chat-item-info">
                    <div class="chat-item-name">${item.username || item.name}</div>
                    <div class="chat-item-preview">${lastMessage}</div>
                </div>
                <div class="chat-item-meta">
                    ${unread > 0 ? `<span class="chat-item-badge">${unread}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => selectChat(item.dataset.id, item.dataset.type));
    });
}

async function selectChat(id, type) {
    currentChat = { id, type };

    elements.messagesContainer.innerHTML = '<div class="loading">加载中</div>';

    try {
        let info;
        if (type === 'private') {
            const r = await apiRequest('/user/info', {
                method: 'POST',
                body: JSON.stringify({ userId: id })
            });
            info = r.info || r;
            usersCacheMap.set(id, info);
        } else {
            const r = await apiRequest('/group/info', {
                method: 'POST',
                body: JSON.stringify({ groupId: id })
            });
            info = r.group || r;
            
            if (info.members && Array.isArray(info.members)) {
                preloadMembers(info.members);
            }
        }
        
        currentChat = { id, type, ...info };
    } catch (error) {
        console.error('获取聊天信息失败:', error);
        currentChat = {
            id,
            type,
            ...(type === 'private' 
                ? usersCache.find(u => u.id === id) 
                : groupsCache.find(g => g.id === id))
        };
    }

    unreadMessages[id] = 0;
    updateChatList();

    const name = currentChat.username || currentChat.nickname || currentChat.name;
    elements.chatTitle.textContent = name;
    elements.chatAvatar.textContent = getAvatarLetter(name);
    
    if (type === 'private') {
        elements.chatStatus.textContent = currentChat.online ? '在线' : '离线';
        elements.chatStatus.style.color = currentChat.online ? 'var(--success)' : 'var(--text-muted)';
    } else {
        elements.chatStatus.textContent = `${currentChat.members?.length || 0} 成员`;
        elements.chatStatus.style.color = 'var(--text-muted)';
    }

    try {
        await apiRequest('/message/read', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                chatId: id,
                type: type === 'group' ? 'group' : undefined
            })
        });
    } catch (e) {
        console.error('标记已读失败:', e);
    }

    if (socket && socket.connected) {
        socket.emit('get_chat_history', { userId: currentUser.id, chatId: id, type });
    } else {
        elements.messagesContainer.innerHTML = '<div class="messages-empty"><p>WebSocket 未连接</p></div>';
    }
}

async function preloadMembers(memberIds) {
    for (const memberId of memberIds) {
        if (!usersCacheMap.has(memberId)) {
            getUserInfo(memberId).catch(() => {});
        }
    }
}

function displayMessages(messages) {
    if (!messages || messages.length === 0) {
        elements.messagesContainer.innerHTML = `
            <div class="messages-empty">
                <div class="empty-icon">💬</div>
                <p>开始聊天吧</p>
            </div>
        `;
        return;
    }

    elements.messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.senderId === currentUser.id;
        const sender = usersCacheMap.get(msg.senderId) || {};
        
        const content = msg.type === 'image' 
            ? `<img src="${escapeHtml(msg.content)}" style="max-width: 200px; border-radius: 8px; cursor: pointer;">`
            : msg.type === 'file'
            ? `<a href="${escapeHtml(msg.content)}" target="_blank" style="color: inherit;">📎 ${escapeHtml(msg.fileName || '文件')}</a>`
            : escapeHtml(msg.content);
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-avatar">${getAvatarLetter(sender.username || sender.nickname || '?')}</div>
                <div class="message-content">
                    ${!isSent && currentChat?.type === 'group' ? `<span class="message-sender">${escapeHtml(sender.nickname || sender.username || '未知用户')}</span>` : ''}
                    <div class="message-bubble">${content}</div>
                    <span class="message-time">${formatTime(msg.timestamp || msg.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');

    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function displayMessage(message, type) {
    const isSent = type === 'sent';
    const sender = usersCacheMap.get(message.senderId) || {};
    
    const content = message.type === 'image' 
        ? `<img src="${escapeHtml(message.content)}" style="max-width: 200px; border-radius: 8px; cursor: pointer;">`
        : message.type === 'file'
        ? `<a href="${escapeHtml(message.content)}" target="_blank" style="color: inherit;">📎 ${escapeHtml(message.fileName || '文件')}</a>`
        : escapeHtml(message.content);

    const messageHtml = `
        <div class="message ${isSent ? 'sent' : 'received'}">
            <div class="message-avatar">${getAvatarLetter(sender.username || sender.nickname || '?')}</div>
            <div class="message-content">
                ${!isSent && currentChat?.type === 'group' ? `<span class="message-sender">${escapeHtml(sender.nickname || sender.username || '未知用户')}</span>` : ''}
                <div class="message-bubble">${content}</div>
                <span class="message-time">${formatTime(message.timestamp || message.createdAt)}</span>
            </div>
        </div>
    `;

    const emptyMsg = elements.messagesContainer.querySelector('.messages-empty');
    if (emptyMsg) emptyMsg.remove();

    elements.messagesContainer.insertAdjacentHTML('afterbegin', messageHtml);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleSendMessage() {
    const content = elements.messageInput.value.trim();
    if (!content || !currentChat) return;

    const message = {
        content,
        senderId: currentUser.id,
        receiverId: currentChat.type === 'private' ? currentChat.id : null,
        groupId: currentChat.type === 'group' ? currentChat.id : null,
        createdAt: new Date().toISOString()
    };

    elements.messageInput.value = '';
    displayMessage(message, 'sent');

    try {
        await sendMessage(content, currentChat.id, currentChat.type);
        messagesCache.push(message);
    } catch (error) {
        showToast('发送失败: ' + error.message, 'error');
    }
}

function showCreateGroupModal() {
    const usersHtml = usersCache.map(user => `
        <label class="user-list-item">
            <input type="checkbox" value="${user.id}" name="members">
            <div class="avatar">${getAvatarLetter(user.username)}</div>
            <span class="name">${user.username}</span>
        </label>
    `).join('');

    showModal('创建群组', `
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

    document.getElementById('create-group-submit').addEventListener('click', async () => {
        const name = document.getElementById('group-name').value.trim();
        const members = Array.from(document.querySelectorAll('input[name="members"]:checked'))
            .map(cb => cb.value);

        if (!name) {
            showToast('请输入群组名称', 'error');
            return;
        }

        if (members.length === 0) {
            showToast('请至少选择一个成员', 'error');
            return;
        }

        try {
            await createGroup(name, members);
            await fetchGroups();
            updateChatList();
            hideModal();
            showToast('群组创建成功', 'success');
        } catch (error) {
            showToast('创建失败: ' + error.message, 'error');
        }
    });
}

function showSettingsModal() {
    showModal('设置', `
        <div class="user-list">
            <div class="user-list-item" style="cursor: default;">
                <div class="avatar">${getAvatarLetter(currentUser?.username)}</div>
                <div class="name">${currentUser?.username}</div>
            </div>
        </div>
        <button class="btn-modal" id="logout-btn" style="margin-top: 16px; background: var(--danger);">退出登录</button>
    `);

    document.getElementById('logout-btn').addEventListener('click', () => {
        hideModal();
        logout();
    });
}

document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
    });
});

elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showToast('请填写完整信息', 'error');
        return;
    }

    try {
        await login(username, password);
    } catch (error) {
        showToast(error.message, 'error');
    }
});

elements.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!username || !password || !confirm) {
        showToast('请填写完整信息', 'error');
        return;
    }

    if (password !== confirm) {
        showToast('两次密码不一致', 'error');
        return;
    }

    try {
        await register(username, password);
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentChatType = tab.dataset.type;
        updateChatList();
    });
});

elements.sendBtn.addEventListener('click', handleSendMessage);

elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const list = currentChatType === 'private' ? usersCache : groupsCache;
    
    if (!query) {
        updateChatList();
        return;
    }

    const filtered = list.filter(item => {
        const name = (item.username || item.name || '').toLowerCase();
        return name.includes(query);
    });

    if (filtered.length === 0) {
        elements.chatList.innerHTML = '<div class="chat-list-empty">未找到结果</div>';
        return;
    }

    elements.chatList.innerHTML = filtered.map(item => `
        <div class="chat-item" data-id="${item.id}" data-type="${currentChatType}">
            <div class="chat-item-avatar">${getAvatarLetter(item.username || item.name)}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${item.username || item.name}</div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => selectChat(item.dataset.id, item.dataset.type));
    });
});

document.getElementById('create-group-btn').addEventListener('click', showCreateGroupModal);
document.getElementById('settings-btn').addEventListener('click', showSettingsModal);
elements.modalClose.addEventListener('click', hideModal);
elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) hideModal();
});

async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const data = await apiRequest('/user/self', { method: 'POST' });
        currentUser = data.info || data.user || data;
        initApp();
    } catch (error) {
        localStorage.removeItem('token');
    }
}

checkAuth();
