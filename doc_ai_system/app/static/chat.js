document.addEventListener('DOMContentLoaded', () => {
    const docList = document.getElementById('document-list');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusBadge = document.getElementById('status-badge');

    // FIXED_MODEL은 chat.html에서 전역으로 주입됨
    const MODEL_ID = typeof FIXED_MODEL !== 'undefined' ? FIXED_MODEL : 'gemini-1.5-flash';

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
            <h3>(주)우리소프트에 대해<br>무엇이든 물어보세요</h3>
            <p>우리소프트의 기업 정보, 서비스 및 솔루션에 대해<br>AI가 실시간으로 답변해 드립니다.</p>
            <div class="suggestion-chips">
                <button class="chip" data-text="(주)우리소프트는 어떤 회사인가요?"><i class="fas fa-building"></i> 회사 소개</button>
                <button class="chip" data-text="우리소프트의 주요 솔루션 및 서비스를 알려주세요."><i class="fas fa-microchip"></i> 주요 솔루션</button>
                <button class="chip" data-text="서비스 도입 및 PoC 신청 절차가 어떻게 되나요?"><i class="fas fa-handshake"></i> 도입 및 PoC 문의</button>
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

        const loadingMsg = appendTypingIndicator();

        try {
            const resp = await fetch(`/api/chat?query=${encodeURIComponent(text)}&model=${MODEL_ID}`);
            if (!resp.ok) {
                let errorMsg = '서버 응답 오류가 발생했습니다.';
                try {
                    const errData = await resp.json(); // Changed 'response' to 'resp'
                    if (errData && errData.error) errorMsg = errData.error;
                } catch (e) { }
                throw new Error(errorMsg);
            }
            loadingMsg.remove();

            // 스트리밍을 위한 빈 AI 메시지 버블 생성
            const aiMsgDiv = appendMessage('ai', '');
            const contentDiv = aiMsgDiv.querySelector('.ai-message-content');
            let fullText = '';
            let streamError = null;

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();

            // 스트리밍 루프: 서버로부터 SSE 청크를 순서대로 읽음
            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim().startsWith('data: ')) continue;

                    let data;
                    try {
                        data = JSON.parse(line.trim().slice(6));
                    } catch (parseErr) {
                        // JSON 파싱 실패한 라인은 무시
                        continue;
                    }

                    // 서버 에러 이벤트: 루프를 즉시 탈출해 바깥 catch로 전달
                    if (data.error) {
                        streamError = new Error(data.error);
                        break outer;
                    }

                    if (data.text) {
                        fullText += data.text;
                        if (typeof marked !== 'undefined') {
                            contentDiv.innerHTML = marked.parse(fullText);
                        } else {
                            contentDiv.textContent = fullText;
                        }
                        chatMessages.scrollTo({ top: chatMessages.scrollHeight });
                    }
                }
            }

            // 스트리밍 중 에러가 발생했으면 바깥 catch(err)로 전파
            if (streamError) throw streamError;
            setStatus('ready', '준비됨');
        } catch (err) {
            console.error('Chat error:', err);
            if (loadingMsg) loadingMsg.remove();
            const errorDiv = appendMessage('ai', `오류: ${err.message}`);
            errorDiv.classList.add('error-message');
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

    // ── 타이핑 인디케이터 추가 ──
    function appendTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ai-message typing-msg';
        msgDiv.innerHTML = `
            <div class="ai-message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        return msgDiv;
    }
});
