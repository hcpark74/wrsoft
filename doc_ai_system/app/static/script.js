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
            docList.innerHTML = files.map(f => {
                const iconClass = getFileIcon(f.display_name);
                const isHwp = f.display_name.toLowerCase().endsWith('.hwp');
                const dateStr = f.create_time ? new Date(f.create_time).toLocaleString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : '방금 전';

                return `
                <li class="doc-item ${isHwp ? 'hwp-type' : ''}">
                    <div class="doc-icon-wrapper">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="doc-info">
                        <span class="doc-title">${f.display_name}</span>
                        <span class="doc-meta">${dateStr}</span>
                    </div>
                    <button class="delete-btn" data-name="${f.name}" title="삭제">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </li>
            `;
            }).join('') || '<li class="doc-item empty">업로드된 문서가 없습니다.</li>';

            // 삭제 버튼 이벤트 연결
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const docName = e.currentTarget.getAttribute('data-name');
                    if (confirm('정말 이 문서를 삭제하시겠습니까?')) {
                        deleteFile(docName);
                    }
                };
            });
        } catch (err) {
            console.error('Failed to load files', err);
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
            'pptx': 'fas fa-file-powerpoint',
            'txt': 'fas fa-file-alt',
            'hwp': 'fa-regular fa-file-word fa-file-hwp',
            'md': 'fab fa-markdown',
            'py': 'fab fa-python',
            'js': 'fab fa-js',
            'html': 'fas fa-file-code'
        };
        return map[ext] || 'fas fa-file-alt';
    }

    async function deleteFile(docName) {
        // 해당 항목 찾아서 로딩 상태 적용
        const items = document.querySelectorAll('.doc-item');
        let targetItem = null;
        items.forEach(item => {
            if (item.querySelector('.delete-btn').getAttribute('data-name') === docName) {
                targetItem = item;
            }
        });

        if (targetItem) {
            targetItem.classList.add('processing');
            const meta = targetItem.querySelector('.doc-meta');
            meta.innerHTML = `<span class="loading-spinner"></span> 삭제 중...`;
        }

        try {
            const resp = await fetch(`/api/files/${encodeURIComponent(docName)}`, {
                method: 'DELETE'
            });
            if (resp.ok) {
                loadFiles();
            } else {
                const data = await resp.json();
                alert('삭제 실패: ' + (data.detail || '알 수 없는 오류'));
                if (targetItem) targetItem.classList.remove('processing');
            }
        } catch (err) {
            console.error('Delete error', err);
            alert('삭제 중 오류가 발생했습니다.');
            if (targetItem) targetItem.classList.remove('processing');
        }
    }

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('display_name', file.name);

        // UI 즉시 반영 (로딩 상태)
        dropZone.classList.add('processing');
        const loadingItem = document.createElement('li');
        loadingItem.className = 'doc-item processing';
        loadingItem.innerHTML = `
            <div class="doc-icon-wrapper"><span class="loading-spinner"></span></div>
            <div class="doc-info">
                <span class="doc-title">${file.name}</span>
                <span class="doc-meta">인덱싱 중...(최대 1분 소요)</span>
            </div>
        `;
        docList.prepend(loadingItem);

        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                loadFiles();
            } else {
                alert('업로드 실패 (Gemini 서버 부하일 수 있습니다)');
                loadingItem.remove();
            }
        } catch (err) {
            console.error('Upload error', err);
            loadingItem.remove();
        } finally {
            dropZone.classList.remove('processing');
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

            // 스트리밍 루프
            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;

                    let data;
                    try {
                        data = JSON.parse(trimmed.slice(6));
                    } catch (parseErr) {
                        continue;
                    }

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

            if (streamError) throw streamError;

        } catch (err) {
            console.error('Chat error:', err);
            loadingMsg.classList.add('error-message');
            loadingMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`;
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
                content = marked.parse(text);
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
