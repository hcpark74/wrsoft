document.addEventListener('DOMContentLoaded', () => {
    const CATEGORY_LABELS = {
        marketing: '마케팅',
        legal: '법무',
        tech: '기술',
        hr: '인사',
        company: '회사소개',
    };
    const CATEGORY_STORAGE_KEY = 'doc-intel-admin-categories';
    const ADMIN_KEY_STORAGE_KEY = 'doc-intel-admin-key';

    const DEFAULT_STORE_LABEL = '기본 스토어';

    const state = {
        files: [],
        selectedDocName: '',
        categories: [],
    };

    const dropZone = document.getElementById('drop-zone');
    const triggerUploadBtn = document.getElementById('trigger-upload-btn');
    const fileInput = document.getElementById('file-input');
    const uploadCategory = document.getElementById('upload-category');
    const docList = document.getElementById('document-list');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const filterSelect = document.getElementById('filter-category');
    const scopeStore = document.getElementById('scope-store');
    const scopeResetBtn = document.getElementById('scope-reset-btn');
    const scopeBadges = document.getElementById('scope-badges');
    const statusBadge = document.getElementById('status-badge');
    const detailTitle = document.getElementById('detail-title');
    const detailCategory = document.getElementById('detail-category');
    const detailState = document.getElementById('detail-state');
    const detailUpdated = document.getElementById('detail-updated');
    const detailName = document.getElementById('detail-name');
    const detailSummary = document.getElementById('detail-summary');
    const detailRefreshBtn = document.getElementById('detail-refresh-btn');
    const detailDeleteBtn = document.getElementById('detail-delete-btn');
    const statTotalDocs = document.getElementById('stat-total-docs');
    const statProcessingDocs = document.getElementById('stat-processing-docs');
    const statFailedDocs = document.getElementById('stat-failed-docs');
    const statCategoryCount = document.getElementById('stat-category-count');
    const categoryList = document.getElementById('category-list');
    const categoriesSummary = document.getElementById('categories-summary');
    const categoryCreateBtn = document.getElementById('category-create-btn');

    const CATEGORY_DESCRIPTIONS = {
        marketing: '전단, 보도자료, 홍보 자료 분류',
        legal: '계약, 규정, 준법 문서 분류',
        tech: '제품 문서, API, 운영 가이드 분류',
        hr: '복지, 인사 정책, 채용 자료 분류',
        company: '회사 소개, 연혁, 조직 정보 분류',
    };

    function getApiErrorMessage(data, fallback) {
        return data?.error || data?.detail || fallback;
    }

    function getTranslateCat(cat) {
        return CATEGORY_LABELS[cat] || cat || '미분류';
    }

    function getDefaultCategories() {
        return Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
            value,
            label,
            description: CATEGORY_DESCRIPTIONS[value] || '운영용 카테고리',
            builtin: true,
            isActive: true,
        }));
    }

    function loadCategoryConfig() {
        const defaults = getDefaultCategories();
        try {
            const stored = JSON.parse(window.localStorage.getItem(CATEGORY_STORAGE_KEY) || '[]');
            const custom = Array.isArray(stored) ? stored.filter((item) => item?.value && item?.label) : [];
            const merged = [...defaults];
            custom.forEach((item) => {
                if (!merged.some((existing) => existing.value === item.value)) {
                    merged.push({
                        value: item.value,
                        label: item.label,
                        description: item.description || '사용자 정의 카테고리',
                        builtin: false,
                        isActive: item.isActive !== false,
                    });
                }
            });
            state.categories = merged;
            state.categories.forEach((item) => {
                CATEGORY_LABELS[item.value] = item.label;
            });
        } catch (_error) {
            state.categories = defaults;
        }
    }

    function saveCustomCategories() {
        const custom = state.categories
            .filter((item) => !item.builtin)
            .map(({ value, label, description, isActive }) => ({ value, label, description, isActive }));
        window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(custom));
    }

    function getStoredAdminKey() {
        return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '';
    }

    function setStoredAdminKey(value) {
        if (value) {
            window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, value);
        } else {
            window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
        }
    }

    async function adminFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        let adminKey = getStoredAdminKey();

        if (!adminKey) {
            adminKey = window.prompt('관리자 API 키를 입력하세요.') || '';
            if (!adminKey) {
                throw new Error('관리자 API 키가 필요합니다.');
            }
            setStoredAdminKey(adminKey.trim());
            adminKey = adminKey.trim();
        }

        headers.set('X-Admin-Key', adminKey);
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            setStoredAdminKey('');
        }

        return response;
    }

    async function fetchServerCategories() {
        const response = await fetch('/api/categories');
        if (!response.ok) {
            throw new Error('카테고리 API를 불러오지 못했습니다.');
        }

        const rows = await response.json();
        if (!Array.isArray(rows)) {
            throw new Error('카테고리 API 응답 형식이 올바르지 않습니다.');
        }

        state.categories = rows.map((item) => ({
            value: item.slug,
            label: item.label,
            description: item.description || '운영용 카테고리',
            builtin: Boolean(item.is_builtin),
            isActive: Boolean(item.is_active),
        }));
        state.categories.forEach((item) => {
            CATEGORY_LABELS[item.value] = item.label;
        });
        saveCustomCategories();
    }

    function populateCategoryControls() {
        const currentUploadValue = uploadCategory?.value || '';
        const currentFilterValue = filterSelect?.value || '';

        if (uploadCategory) {
            uploadCategory.innerHTML = [
                '<option value="">카테고리 없음</option>',
                ...state.categories.filter((item) => item.isActive !== false).map((item) => `<option value="${item.value}">${item.label}</option>`),
            ].join('');
            uploadCategory.value = state.categories.some((item) => item.value === currentUploadValue) ? currentUploadValue : '';
        }

        if (filterSelect) {
            filterSelect.innerHTML = [
                '<option value="">전체 문서</option>',
                ...state.categories.filter((item) => item.isActive !== false).map((item) => `<option value="${item.value}">${item.label}</option>`),
            ].join('');
            filterSelect.value = state.categories.some((item) => item.value === currentFilterValue) ? currentFilterValue : '';
        }
    }

    function slugifyCategoryLabel(label) {
        return label
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    async function initializeCategories() {
        loadCategoryConfig();
        populateCategoryControls();

        try {
            await fetchServerCategories();
            populateCategoryControls();
        } catch (error) {
            console.warn('Using local category fallback:', error.message);
        }
    }

    function getCategoryConfig(value) {
        return state.categories.find((item) => item.value === value) || null;
    }

    async function refreshCategoriesAfterMutation() {
        try {
            await fetchServerCategories();
        } catch (error) {
            console.warn('Refreshing categories from server failed:', error.message);
        }
        populateCategoryControls();
        renderCategorySection(state.files);
        updateStats(state.files);
        renderScopeBadges();
    }

    async function handleCategoryEdit(categoryValue) {
        const current = getCategoryConfig(categoryValue);
        if (!current) return;

        const label = window.prompt('카테고리 이름을 수정하세요.', current.label);
        if (!label) return;
        const normalizedLabel = label.trim();
        if (!normalizedLabel) return;

        const description = window.prompt('카테고리 설명을 수정하세요.', current.description || `${normalizedLabel} 관련 문서 분류`);
        const nextActive = window.confirm('이 카테고리를 활성 상태로 유지할까요?\n취소를 누르면 비활성 상태로 저장됩니다.');

        try {
            const response = await adminFetch(`/api/categories/${encodeURIComponent(categoryValue)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: normalizedLabel,
                    description: (description || '').trim(),
                    is_active: nextActive,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(getApiErrorMessage(data, '카테고리 수정 실패'));
            }

            await refreshCategoriesAfterMutation();
        } catch (error) {
            console.warn('Falling back to local category edit:', error.message);
            current.label = normalizedLabel;
            current.description = (description || '').trim();
            current.isActive = nextActive;
            CATEGORY_LABELS[current.value] = normalizedLabel;
            saveCustomCategories();
            populateCategoryControls();
            renderCategorySection(state.files);
            updateStats(state.files);
            renderScopeBadges();
        }
    }

    async function handleCategoryDelete(categoryValue) {
        const current = getCategoryConfig(categoryValue);
        if (!current) return;
        if (!window.confirm(`카테고리 '${current.label}'을(를) 비활성화할까요?`)) return;

        try {
            const response = await adminFetch(`/api/categories/${encodeURIComponent(categoryValue)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(getApiErrorMessage(data, '카테고리 삭제 실패'));
            }

            if (filterSelect?.value === categoryValue) {
                filterSelect.value = '';
            }
            if (uploadCategory?.value === categoryValue) {
                uploadCategory.value = '';
            }
            await refreshCategoriesAfterMutation();
        } catch (error) {
            console.warn('Falling back to local category delete:', error.message);
            current.isActive = false;
            saveCustomCategories();
            if (filterSelect?.value === categoryValue) {
                filterSelect.value = '';
            }
            if (uploadCategory?.value === categoryValue) {
                uploadCategory.value = '';
            }
            populateCategoryControls();
            renderCategorySection(state.files);
            updateStats(state.files);
            renderScopeBadges();
        }
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const map = {
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            docx: 'fas fa-file-word',
            xls: 'fas fa-file-excel',
            xlsx: 'fas fa-file-excel',
            csv: 'fas fa-file-csv',
            ppt: 'fas fa-file-powerpoint',
            pptx: 'fas fa-file-powerpoint',
            txt: 'fas fa-file-alt',
            hwp: 'fa-regular fa-file-word fa-file-hwp',
            hwpx: 'fa-regular fa-file-word fa-file-hwp',
            md: 'fab fa-markdown',
            py: 'fab fa-python',
            js: 'fab fa-js',
            ts: 'fas fa-code',
            jsx: 'fas fa-code',
            tsx: 'fas fa-code',
            css: 'fab fa-css3-alt',
            json: 'fas fa-file-code',
            xml: 'fas fa-file-code',
            yaml: 'fas fa-file-code',
            yml: 'fas fa-file-code',
            html: 'fas fa-file-code',
        };
        return map[ext] || 'fas fa-file-alt';
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function classifyState(rawState) {
        const normalized = (rawState || '').toUpperCase();
        const processing = normalized.includes('PROCESSING') || normalized.includes('IMPORTING') || normalized.includes('INITIALIZING') || normalized.includes('PENDING');
        const failed = normalized.includes('FAILED') || normalized.includes('ERROR');
        return {
            normalized,
            isProcessing: processing,
            isFailed: failed,
            isActive: !processing && !failed,
        };
    }

    function setStatus(type, text) {
        if (!statusBadge) return;
        statusBadge.textContent = text;
        statusBadge.className = `status-badge ${type}`;
    }

    function renderScopeBadges() {
        const badges = [];
        const storeValue = scopeStore ? scopeStore.value : '';
        const storeLabel = scopeStore?.selectedOptions?.[0]?.textContent || DEFAULT_STORE_LABEL;
        badges.push(`
            <span class="scope-badge">
                <i class="fas fa-database"></i>
                지식베이스: ${storeValue ? storeLabel : DEFAULT_STORE_LABEL}
            </span>
        `);

        const category = filterSelect ? filterSelect.value : '';
        if (category) {
            badges.push(`
                <span class="scope-badge">
                    <i class="fas fa-tags"></i>
                    카테고리: ${getTranslateCat(category)}
                    <button type="button" data-clear-scope="category" aria-label="카테고리 해제">
                        <i class="fas fa-xmark"></i>
                    </button>
                </span>
            `);
        }

        scopeBadges.innerHTML = badges.join('');
        scopeBadges.querySelectorAll('[data-clear-scope]').forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-clear-scope');
                if (target === 'category' && filterSelect) {
                    filterSelect.value = '';
                    renderScopeBadges();
                    loadFiles();
                }
            });
        });
    }

    function updateStats(files) {
        const processingCount = files.filter((file) => classifyState(file.state).isProcessing).length;
        const failedCount = files.filter((file) => classifyState(file.state).isFailed).length;
        const categories = new Set([
            ...state.categories.map((item) => item.value),
            ...files.map((file) => file.category).filter(Boolean),
        ]);
        statTotalDocs.textContent = String(files.length);
        statProcessingDocs.textContent = String(processingCount);
        statFailedDocs.textContent = String(failedCount);
        statCategoryCount.textContent = String(categories.size);
    }

    function buildCategoryStats(files) {
        const map = new Map(state.categories.map((item) => [item.value, {
            key: item.value,
            count: 0,
            latest: '',
        }]));
        files.forEach((file) => {
            const key = file.category || 'uncategorized';
            const current = map.get(key) || {
                key,
                count: 0,
                latest: '',
            };
            current.count += 1;
            if (file.create_time && (!current.latest || new Date(file.create_time) > new Date(current.latest))) {
                current.latest = file.create_time;
            }
            map.set(key, current);
        });

        return Array.from(map.values())
            .sort((a, b) => {
                if (a.key === 'uncategorized') return 1;
                if (b.key === 'uncategorized') return -1;
                return a.key.localeCompare(b.key);
            });
    }

    function renderCategorySection(files) {
        const stats = buildCategoryStats(files);
        const categorizedCount = files.filter((file) => file.category).length;
        const uncategorizedCount = files.length - categorizedCount;

        categoriesSummary.innerHTML = `
            <article class="summary-pill">
                <span>전체 카테고리</span>
                <strong>${stats.filter((item) => item.key !== 'uncategorized').length}</strong>
            </article>
            <article class="summary-pill">
                <span>분류된 문서</span>
                <strong>${categorizedCount}</strong>
            </article>
            <article class="summary-pill">
                <span>미분류 문서</span>
                <strong>${uncategorizedCount}</strong>
            </article>
            <article class="summary-pill">
                <span>기본 필터</span>
                <strong>${filterSelect?.value ? getTranslateCat(filterSelect.value) : '전체'}</strong>
            </article>
        `;

        if (stats.length === 0) {
            categoryList.innerHTML = '<div class="category-row empty-row">카테고리 데이터가 없습니다.</div>';
            return;
        }

        categoryList.innerHTML = stats.map((item) => {
            const label = item.key === 'uncategorized' ? '미분류' : getTranslateCat(item.key);
            const configured = state.categories.find((category) => category.value === item.key);
            const description = configured?.description || CATEGORY_DESCRIPTIONS[item.key] || '카테고리 분류 규칙을 아직 정의하지 않았습니다.';
            const isInactive = configured?.isActive === false;
            const canManage = item.key !== 'uncategorized';
            return `
                <div class="category-row">
                    <div class="category-meta">
                        <div class="category-name">
                            <span class="category-dot" data-cat="${item.key}"></span>
                            <strong>${label}</strong>
                        </div>
                        ${isInactive ? '<span class="category-status inactive">비활성</span>' : ''}
                    </div>
                    <div>${item.count}</div>
                    <div>${formatDate(item.latest)}</div>
                    <div class="category-desc">${description}</div>
                    <div class="category-actions">
                        ${canManage ? `<button class="category-action-btn" type="button" data-category-edit="${item.key}" title="수정"><i class="fas fa-pen"></i></button>` : ''}
                        ${canManage ? `<button class="category-action-btn" type="button" data-category-delete="${item.key}" title="비활성화"><i class="fas fa-ban"></i></button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        categoryList.querySelectorAll('[data-category-edit]').forEach((button) => {
            button.addEventListener('click', () => handleCategoryEdit(button.getAttribute('data-category-edit')));
        });
        categoryList.querySelectorAll('[data-category-delete]').forEach((button) => {
            button.addEventListener('click', () => handleCategoryDelete(button.getAttribute('data-category-delete')));
        });
    }

    function renderDetailPanel(file) {
        if (!file) {
            detailTitle.textContent = '문서를 선택하세요';
            detailCategory.textContent = '-';
            detailState.textContent = '-';
            detailUpdated.textContent = '-';
            detailName.textContent = '-';
            detailSummary.textContent = '문서를 선택하면 상태와 메타데이터를 여기서 확인할 수 있습니다.';
            detailDeleteBtn.disabled = true;
            return;
        }

        const { isProcessing, isFailed, isActive } = classifyState(file.state);
        detailTitle.textContent = file.display_name;
        detailCategory.textContent = getTranslateCat(file.category);
        detailState.textContent = isProcessing ? '인덱싱 중' : (isFailed ? '인덱싱 실패' : (isActive ? '활성' : file.state || '-'));
        detailUpdated.textContent = formatDate(file.create_time);
        detailName.textContent = file.name || '-';
        detailSummary.textContent = isProcessing
            ? '현재 이 문서는 인덱싱 중입니다. 완료되면 검색과 답변 범위에 포함됩니다.'
            : (isFailed
                ? '인덱싱 실패 문서입니다. 원본 파일과 메타데이터를 확인한 뒤 재업로드를 권장합니다.'
                : '현재 문서는 검색 가능한 상태입니다. 카테고리 필터를 통해 질의 범위를 제한할 수 있습니다.');
        detailDeleteBtn.disabled = isProcessing;
        detailDeleteBtn.dataset.name = file.name || '';
    }

    function renderDocuments(files) {
        if (!Array.isArray(files) || files.length === 0) {
            docList.innerHTML = '<div class="doc-row empty-row">업로드된 문서가 없습니다.</div>';
            renderDetailPanel(null);
            return;
        }

        docList.innerHTML = files.map((file) => {
            const iconClass = getFileIcon(file.display_name);
            const { isProcessing, isFailed, isActive } = classifyState(file.state);
            const stateLabel = isProcessing ? '인덱싱 중' : (isFailed ? '실패' : (isActive ? '활성' : (file.state || '-')));
            const stateClass = isProcessing ? 'processing' : (isFailed ? 'failed' : 'active');
            const isSelected = state.selectedDocName === file.name;

            return `
                <div class="doc-row ${isSelected ? 'selected' : ''}" data-doc-name="${file.name}">
                    <div class="doc-main">
                        <div class="doc-icon-wrapper">
                            ${isProcessing ? '<span class="loading-spinner"></span>' : `<i class="${iconClass}"></i>`}
                        </div>
                        <div class="doc-name-stack">
                            <strong title="${file.display_name}">${file.display_name}</strong>
                            <small>${file.name}</small>
                        </div>
                    </div>
                    <div>${file.category ? `<span class="cat-badge" data-cat="${file.category}">${getTranslateCat(file.category)}</span>` : '-'}</div>
                    <div><span class="state-pill ${stateClass}">${stateLabel}</span></div>
                    <div>${formatDate(file.create_time)}</div>
                    <button class="row-delete-btn" type="button" data-delete-name="${file.name}" title="삭제">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
        }).join('');

        docList.querySelectorAll('[data-doc-name]').forEach((row) => {
            row.addEventListener('click', (event) => {
                if (event.target.closest('[data-delete-name]')) return;
                const docName = row.getAttribute('data-doc-name');
                state.selectedDocName = docName;
                const selected = state.files.find((file) => file.name === docName) || null;
                renderDocuments(state.files);
                renderDetailPanel(selected);
            });
        });

        docList.querySelectorAll('[data-delete-name]').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const docName = button.getAttribute('data-delete-name');
                if (confirm('정말 이 문서를 삭제하시겠습니까?')) {
                    await deleteFile(docName);
                }
            });
        });

        const selected = state.files.find((file) => file.name === state.selectedDocName) || files[0];
        state.selectedDocName = selected?.name || '';
        renderDetailPanel(selected || null);
        if (selected && !docList.querySelector('.doc-row.selected')) {
            renderDocuments(state.files);
        }
    }

    async function loadFiles() {
        try {
            docList.innerHTML = '<div class="doc-row empty-row"><span class="loading-spinner"></span> 조회 중...</div>';
            const category = filterSelect ? filterSelect.value : '';
            const url = category ? `/api/files?category=${encodeURIComponent(category)}` : '/api/files';
            const resp = await fetch(url);
            const files = await resp.json();

            if (!Array.isArray(files)) {
                throw new Error('문서 목록 응답이 올바르지 않습니다.');
            }

            state.files = files;
            updateStats(files);
            renderDocuments(files);
            renderCategorySection(files);
            renderScopeBadges();

            if (files.some((file) => classifyState(file.state).isProcessing)) {
                setTimeout(() => loadFiles(), 3000);
            }
        } catch (error) {
            console.error('Failed to load files', error);
            docList.innerHTML = '<div class="doc-row empty-row">문서 목록을 불러올 수 없습니다.</div>';
            renderDetailPanel(null);
        }
    }

    async function deleteFile(docName) {
        try {
            const resp = await fetch(`/api/files/${encodeURIComponent(docName)}`, {
                method: 'DELETE',
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(getApiErrorMessage(data, '삭제에 실패했습니다.'));
            }
            if (state.selectedDocName === docName) {
                state.selectedDocName = '';
            }
            await loadFiles();
        } catch (error) {
            console.error('Delete error', error);
            alert(error.message || '삭제 중 오류가 발생했습니다.');
        }
    }

    async function handleUpload(file) {
        const category = uploadCategory ? uploadCategory.value : '';
        const formData = new FormData();
        formData.append('file', file);
        formData.append('display_name', file.name);
        if (category) {
            formData.append('category', category);
        }

        dropZone.classList.add('processing');
        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(getApiErrorMessage(data, '업로드 실패'));
            }
            setTimeout(() => loadFiles(), 1000);
        } catch (error) {
            console.error('Upload error', error);
            alert(error.message || '업로드 중 오류가 발생했습니다.');
        } finally {
            dropZone.classList.remove('processing');
            fileInput.value = '';
        }
    }

    function bindDragAndDrop() {
        ['dragenter', 'dragover'].forEach((eventName) => {
            dropZone.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            dropZone.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (event) => {
            const file = event.dataTransfer?.files?.[0];
            if (file) {
                handleUpload(file);
            }
        });
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        const modelId = modelSelect ? modelSelect.value : 'gemini-2.5-flash-lite';
        const category = filterSelect ? filterSelect.value : '';
        const store = scopeStore ? scopeStore.value : '';

        appendMessage('user', text);
        userInput.value = '';
        setStatus('processing', '처리 중...');

        const loadingMsg = appendMessage('ai', `${modelId}가 선택한 범위로 답변을 생성하고 있습니다...`);

        try {
            const params = new URLSearchParams({ query: text, model: modelId });
            if (category) params.set('category', category);
            if (store) params.set('store', store);

            const resp = await fetch(`/api/chat?${params.toString()}`);

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(getApiErrorMessage(data, '답변 생성 중 오류가 발생했습니다.'));
            }

            loadingMsg.remove();
            const aiMsgDiv = appendMessage('ai', '');
            const contentDiv = aiMsgDiv.querySelector('.ai-message-content');
            let fullText = '';
            let citations = [];
            let streamError = null;

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();

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
                    } catch (_error) {
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
            setStatus('ready', '준비됨');
        } catch (error) {
            console.error('Chat error:', error);
            loadingMsg.classList.add('error-message');
            loadingMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message}`;
            setStatus('error', '오류 발생');
        }
    }

    function updateAIMessage(container, text, citationsList) {
        let content = text;
        if (typeof marked !== 'undefined') {
            try {
                content = marked.parse(text);
            } catch (error) {
                console.error('Markdown parse error:', error);
            }
        }

        if (citationsList && citationsList.length > 0) {
            content += `<br><div class="citations"><strong>참조 문서:</strong> ${citationsList.join(', ')}</div>`;
        }

        container.innerHTML = content;
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    }

    function appendMessage(sender, text, citations = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        let content = text;
        if (sender === 'ai' && typeof marked !== 'undefined' && text) {
            try {
                content = marked.parse(text);
            } catch (error) {
                console.error('Markdown parse error:', error);
            }
        }

        if (citations.length > 0) {
            content += `<br><div class="citations"><strong>참조 문서:</strong> ${citations.join(', ')}</div>`;
        }

        msgDiv.innerHTML = sender === 'ai'
            ? `<div class="ai-message-content">${content}</div>`
            : content;

        chatMessages.appendChild(msgDiv);
        setTimeout(() => {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }, 80);
        return msgDiv;
    }

    if (triggerUploadBtn) {
        triggerUploadBtn.addEventListener('click', () => fileInput.click());
    }
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            handleUpload(event.target.files[0]);
        }
    });
    bindDragAndDrop();

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            renderScopeBadges();
            loadFiles();
        });
    }

    if (scopeStore) {
        scopeStore.addEventListener('change', renderScopeBadges);
    }

    if (scopeResetBtn) {
        scopeResetBtn.addEventListener('click', () => {
            if (scopeStore) scopeStore.value = '';
            if (filterSelect) filterSelect.value = '';
            renderScopeBadges();
            loadFiles();
        });
    }

    detailRefreshBtn.addEventListener('click', loadFiles);
    detailDeleteBtn.addEventListener('click', async () => {
        const docName = detailDeleteBtn.dataset.name;
        if (!docName) return;
        if (confirm('정말 이 문서를 삭제하시겠습니까?')) {
            await deleteFile(docName);
        }
    });

    if (categoryCreateBtn) {
        categoryCreateBtn.addEventListener('click', async () => {
            const label = window.prompt('새 카테고리 이름을 입력하세요. 예: 고객지원');
            if (!label) return;

            const normalizedLabel = label.trim();
            if (!normalizedLabel) return;

            const value = slugifyCategoryLabel(normalizedLabel);
            if (!value) {
                alert('카테고리 식별자를 생성할 수 없습니다. 영문, 숫자 또는 한글이 포함된 이름을 사용해 주세요.');
                return;
            }

            if (state.categories.some((item) => item.value === value)) {
                alert('이미 같은 카테고리가 있습니다. 다른 이름을 사용해 주세요.');
                return;
            }

            const description = window.prompt('카테고리 설명을 입력하세요.', `${normalizedLabel} 관련 문서 분류`) || `${normalizedLabel} 관련 문서 분류`;
            const categoryPayload = {
                slug: value,
                label: normalizedLabel,
                description: description.trim() || `${normalizedLabel} 관련 문서 분류`,
            };

            try {
                const response = await adminFetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(categoryPayload),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(getApiErrorMessage(data, '카테고리 저장 실패'));
                }

                await fetchServerCategories();
            } catch (error) {
                console.warn('Falling back to local category storage:', error.message);
                state.categories.push({
                    value,
                    label: normalizedLabel,
                    description: categoryPayload.description,
                    builtin: false,
                    isActive: true,
                });
                saveCustomCategories();
            }

            CATEGORY_LABELS[value] = normalizedLabel;
            populateCategoryControls();
            renderCategorySection(state.files);
            updateStats(state.files);
            renderScopeBadges();
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${Math.min(userInput.scrollHeight, 220)}px`;
    });
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    (async () => {
        await initializeCategories();
        renderScopeBadges();
        renderDetailPanel(null);
        setStatus('ready', '준비됨');
        loadFiles();
    })();
});
