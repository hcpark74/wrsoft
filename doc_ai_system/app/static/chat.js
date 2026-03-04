document.addEventListener('DOMContentLoaded', () => {
    const getTranslateCat = (cat) => {
        const map = {
            'marketing': '마케팅',
            'legal': '법무',
            'tech': '기술',
            'hr': '인사',
            'company': '회사소개'
        };
        return map[cat] || cat;
    };
    const docList = document.getElementById('document-list');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusBadge = document.getElementById('status-badge');

    const modelSelect = document.getElementById('model-select');

    let welcomeScreen = chatMessages.querySelector('.welcome-screen');
    let isProcessing = false;

    // 초기 문서 목록 로드
    loadFiles();

    // ── 추천 칩 클릭 ──
    chatMessages.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) {
            const text = chip.dataset.text;
            const category = chip.dataset.category;

            if (category) {
                const filterSelect = document.getElementById('filter-category');
                if (filterSelect) filterSelect.value = category;
            }

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
            <p>카테고리를 선택하거나 직접 궁금한 점을 입력해 주세요.</p>
            <div class="suggestion-chips">
                <button class="chip" data-category="company" data-text="회사 소개와 연혁을 알려줘">
                    <i class="fas fa-building"></i> 회사소개
                </button>
                <button class="chip" data-category="hr" data-text="우리 회사의 복리후생 제도가 뭐야?">
                    <i class="fas fa-users"></i> 인사/복지
                </button>
                <button class="chip" data-category="tech" data-text="제품 기술 가이드를 요약해줘">
                    <i class="fas fa-microchip"></i> 기술지원
                </button>
                <button class="chip" data-category="legal" data-text="최근 계약 관련 규정을 알려줘">
                    <i class="fas fa-file-contract"></i> 법무/규정
                </button>
            </div>
        `;
        chatMessages.appendChild(welcomeScreen);
        setStatus('ready', '준비됨');

        // 필터 초기화
        const filterSelect = document.getElementById('filter-category');
        if (filterSelect) filterSelect.value = '';
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
                docList.innerHTML = `<li class="doc-item empty">업로드된 문서가 없습니다.</li>`;
            } else {
                docList.innerHTML = files.map(f => {
                    const iconClass = getFileIcon(f.display_name);
                    return `
                    <li class="doc-item">
                        <div class="doc-icon-wrapper">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="doc-info">
                            <span class="doc-title">${f.display_name}</span>
                            <div class="doc-meta">
                                ${f.category ? `<span class="cat-badge" data-cat="${f.category}">${getTranslateCat(f.category)}</span>` : ''}
                            </div>
                        </div>
                    </li>
                `;
                }).join('');
            }
        } catch (err) {
            console.error('Failed to load files', err);
            docList.innerHTML = `<li class="doc-item empty">문서 목록을 불러올 수 없습니다.</li>`;
        }
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const map = {
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'csv': 'fas fa-file-csv',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            'txt': 'fas fa-file-alt',
            'hwp': 'fa-regular fa-file-word fa-file-hwp',
            'hwpx': 'fa-regular fa-file-word fa-file-hwp',
            'md': 'fab fa-markdown',
            'py': 'fab fa-python',
            'js': 'fab fa-js',
            'ts': 'fas fa-code',
            'jsx': 'fas fa-code',
            'tsx': 'fas fa-code',
            'css': 'fab fa-css3-alt',
            'json': 'fas fa-file-code',
            'xml': 'fas fa-file-code',
            'yaml': 'fas fa-file-code',
            'yml': 'fas fa-file-code',
            'html': 'fas fa-file-code'
        };
        return map[ext] || 'fas fa-file-alt';
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

        const modelId = modelSelect.value;
        const filterCat = document.getElementById('filter-category').value;

        try {
            let url = `/api/chat?query=${encodeURIComponent(text)}&model=${modelId}`;
            if (filterCat) url += `&category=${filterCat}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error || '답변 생성 중 오류가 발생했습니다.');
            }
            loadingMsg.remove();

            // 스트리밍을 위한 빈 AI 메시지 버블 생성
            const aiMsgDiv = appendMessage('ai', '');
            const contentDiv = aiMsgDiv.querySelector('.ai-message-content');
            let fullText = '';
            let citations = [];
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
                        updateAIMessage(contentDiv, fullText, citations);
                    }

                    if (data.citations) {
                        citations = [...new Set([...citations, ...data.citations])];
                        updateAIMessage(contentDiv, fullText, citations);
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

    function updateAIMessage(container, text, citationsList) {
        // [/cite:0] 형태의 태그를 [1] 형태의 위첨자로 변환
        let formattedText = text.replace(/\[\/cite:(\d+)\]/g, (match, p1) => {
            const index = parseInt(p1) + 1;
            return `<sup class="citation-ref" title="출처 보기">[${index}]</sup>`;
        });

        let content = formattedText;
        if (typeof marked !== 'undefined') {
            try {
                content = marked.parse(formattedText);
            } catch (e) {
                console.error('Markdown parse error:', e);
            }
        }

        if (citationsList && citationsList.length > 0) {
            content += `<br><div class="citations"><strong>참조 문서:</strong> ${citationsList.join(', ')}</div>`;
        }

        container.innerHTML = content;
        chatMessages.scrollTo({ top: chatMessages.scrollHeight });
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
