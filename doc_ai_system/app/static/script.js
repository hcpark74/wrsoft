document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const docList = document.getElementById('document-list');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // 초기 목록 로드
    loadFiles();

    // 파일 선택 이벤트
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUpload(e.target.files[0]);
        }
    });

    // 드래그 앤 드롭 (추가 가능)

    // 채팅 전송
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function loadFiles() {
        try {
            const resp = await fetch('/api/files');
            const files = await resp.json();
            docList.innerHTML = files.map(f => `
                <li class="doc-item">
                    <i class="fas fa-file-alt"></i>
                    <span>${f.display_name}</span>
                </li>
            `).join('') || '<li class="doc-item">문서가 없습니다.</li>';
        } catch (err) {
            console.error('Failed to load files', err);
        }
    }

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('display_name', file.name);

        // UI 즉시 반영 (임시)
        const loadingItem = document.createElement('li');
        loadingItem.className = 'doc-item';
        loadingItem.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>업로드 중...</span>`;
        docList.prepend(loadingItem);

        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                loadFiles();
            } else {
                alert('업로드 실패');
                loadingItem.remove();
            }
        } catch (err) {
            console.error('Upload error', err);
            loadingItem.remove();
        }
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        const modelId = document.getElementById('model-select').value;
        if (!text) return;

        appendMessage('user', text);
        userInput.value = '';

        // AI 로딩 표시
        const loadingMsg = appendMessage('ai', `${modelId}가 답변을 생성하고 있습니다...`);

        try {
            const resp = await fetch(`/api/chat?query=${encodeURIComponent(text)}&model=${modelId}`);
            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || '답변 생성 중 오류가 발생했습니다.');
            }

            loadingMsg.remove();
            appendMessage('ai', data.answer, data.citations);
        } catch (err) {
            console.error('Chat error:', err);
            loadingMsg.classList.add('error-message');
            loadingMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`;
        }
    }

    function appendMessage(sender, text, citations = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        // Markdown 렌더링 적용 (AI 메시지만)
        let content = text;
        if (sender === 'ai' && typeof marked !== 'undefined') {
            try {
                content = marked.parse(text);
            } catch (e) {
                console.error('Markdown parse error:', e);
            }
        }

        if (citations && citations.length > 0) {
            content += `<br><div class="citations"><strong>참조 문서:</strong> ${citations.join(', ')}</div>`;
        }

        if (sender === 'ai') {
            msgDiv.innerHTML = `<div class="ai-message-content">${content}</div>`;
        } else {
            msgDiv.innerHTML = content;
        }

        chatMessages.appendChild(msgDiv);

        // 스크롤 하단 이동 (부드럽게)
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);

        return msgDiv;
    }
});
