document.addEventListener('DOMContentLoaded', () => {
    const docList = document.getElementById('document-list');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusBadge = document.getElementById('status-badge');

    // FIXED_MODEL은 chat.html에서 전역으로 주입됨
    const MODEL_ID = typeof FIXED_MODEL !== 'undefined' ? FIXED_MODEL : 'gemini-flash-latest';

    let welcomeScreen = chatMessages.querySelector('.welcome-screen');
    let isProcessing = false;

    // 초기 문서 목록 로드
    loadFiles();

    // ── 추천 칩 클릭 ──
    chatMessages.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) {
            const text = chip.dataset.text;
            userInput.value = text;
            sendMessage();
        }
    });

    // ── 전송 이벤트 ──
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ── 대화 초기화 ──
    clearBtn.addEventListener('click', () => {
        chatMessages.innerHTML = '';
        welcomeScreen = document.createElement('div');
        welcomeScreen.className = 'welcome-screen';
        welcomeScreen.innerHTML = `
            <div class="welcome-icon"><i class="fas fa-comments"></i></div>
            <h3>무엇이든 물어보세요</h3>
            <p>등록된 문서를 기반으로 AI가 정확한 답변을 제공합니다.</p>
            <div class="suggestion-chips">
                <button class="chip" data-text="업로드된 문서들을 간략히 요약해줘">
                    <i class="fas fa-list"></i> 문서 요약
                </button>
                <button class="chip" data-text="주요 내용이 뭐야?">
                    <i class="fas fa-star"></i> 핵심 내용
                </button>
                <button class="chip" data-text="자주 묻는 질문이 있어?">
                    <i class="fas fa-question-circle"></i> FAQ
                </button>
            </div>
        `;
        chatMessages.appendChild(welcomeScreen);
        setStatus('ready', '준비됨');
    });

    // ── textarea 자동 높이 조절 ──
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
    });

    // ── 파일 목록 로드 ──
    async function loadFiles() {
        try {
            const resp = await fetch('/api/files');
            const files = await resp.json();

            if (files.length === 0) {
                docList.innerHTML = `
                    <li class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        등록된 문서가 없습니다.
                    </li>`;
            } else {
                docList.innerHTML = files.map(f => `
                    <li class="doc-item">
                        <i class="fas fa-file-alt"></i>
                        <span>${f.display_name}</span>
                    </li>
                `).join('');
            }
        } catch (err) {
            console.error('Failed to load files', err);
            docList.innerHTML = `<li class="empty-state"><i class="fas fa-exclamation-triangle"></i> 문서 목록을 불러올 수 없습니다.</li>`;
        }
    }

    // ── 메시지 전송 ──
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isProcessing) return;

        // 웰컴 스크린 제거
        if (welcomeScreen && welcomeScreen.parentNode) {
            welcomeScreen.remove();
            welcomeScreen = null;
        }

        isProcessing = true;
        setStatus('processing', '처리 중...');
        appendMessage('user', text);
        userInput.value = '';
        userInput.style.height = 'auto';

        const loadingMsg = appendMessage('ai', `답변을 생성하고 있습니다...`);

        try {
            const resp = await fetch(`/api/chat?query=${encodeURIComponent(text)}&model=${MODEL_ID}`);
            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || '답변 생성 중 오류가 발생했습니다.');
            }

            loadingMsg.remove();
            appendMessage('ai', data.answer, data.citations);
            setStatus('ready', '준비됨');
        } catch (err) {
            console.error('Chat error:', err);
            loadingMsg.classList.add('error-message');
            loadingMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`;
            setStatus('ready', '준비됨');
        } finally {
            isProcessing = false;
        }
    }

    // ── 메시지 DOM 추가 ──
    function appendMessage(sender, text, citations = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        let content = text;
        if (sender === 'ai' && typeof marked !== 'undefined') {
            try { content = marked.parse(text); } catch (e) { /* fallback raw */ }
        }

        if (citations && citations.length > 0) {
            content += `<br><div class="citations"><strong>참조 문서:</strong> ${citations.join(', ')}</div>`;
        }

        if (sender === 'ai') {
            msgDiv.innerHTML = `<div class="ai-message-content">${content}</div>`;
        } else {
            msgDiv.textContent = text;
        }

        chatMessages.appendChild(msgDiv);

        setTimeout(() => {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }, 100);

        return msgDiv;
    }

    // ── 상태 배지 업데이트 ──
    function setStatus(state, label) {
        statusBadge.className = `status-badge ${state}`;
        statusBadge.textContent = label;
    }
});
