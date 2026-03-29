import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../_worker.js';

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function textResponse(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: init.headers || {},
  });
}

function createMockDb(initialRows = []) {
  const rows = initialRows.map((row) => ({ ...row }));

  function buildStatement(sql, params = []) {
    return {
      async all() {
        if (sql.includes('FROM categories') && sql.includes('ORDER BY is_active DESC')) {
          const sorted = [...rows].sort((a, b) => {
            if (Number(b.is_active) !== Number(a.is_active)) return Number(b.is_active) - Number(a.is_active);
            if ((a.sort_order || 100) !== (b.sort_order || 100)) return (a.sort_order || 100) - (b.sort_order || 100);
            return String(a.label).localeCompare(String(b.label));
          });
          return { results: sorted };
        }
        throw new Error(`Unsupported all() SQL: ${sql}`);
      },
      async first() {
        if (sql.includes('FROM categories WHERE slug = ?')) {
          return rows.find((row) => row.slug === params[0]) || null;
        }
        throw new Error(`Unsupported first() SQL: ${sql}`);
      },
      async run() {
        if (sql.startsWith('INSERT INTO categories')) {
          rows.push({
            slug: params[0],
            label: params[1],
            description: params[2] || '',
            color: params[3] || '',
            sort_order: params[4],
            is_active: 1,
            is_builtin: 0,
            created_at: 100,
            updated_at: 100,
          });
          return { success: true, meta: { rows_written: 1 } };
        }
        if (sql.startsWith('UPDATE categories') && sql.includes('WHERE slug = ?')) {
          const target = rows.find((row) => row.slug === params[params.length - 1]);
          if (!target) return { success: true, meta: { rows_written: 0 } };
          if (sql.includes('SET label = ?')) {
            target.label = params[0];
            target.description = params[1] || '';
            target.color = params[2] || '';
            target.sort_order = params[3];
            target.is_active = params[4];
            target.updated_at = 200;
          } else {
            target.is_active = 0;
            target.updated_at = 200;
          }
          return { success: true, meta: { rows_written: 1 } };
        }
        throw new Error(`Unsupported run() SQL: ${sql}`);
      },
    };
  }

  return {
    prepare(sql) {
      return {
        all() {
          return buildStatement(sql).all();
        },
        bind(...params) {
          return buildStatement(sql, params);
        },
      };
    },
  };
}

async function readSsePayload(response) {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('worker api', () => {
  it('paginates and filters file list results', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        documents: [
          {
            name: 'fileSearchStores/store/documents/doc-1',
            displayName: 'generated-doc-1',
            updateTime: '2026-03-28T10:00:00Z',
            state: 'STATE_ACTIVE',
            customMetadata: [
              { key: 'original_name', stringValue: 'Legal One.pdf' },
              { key: 'category', stringValue: 'legal' },
            ],
          },
        ],
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(jsonResponse({
        documents: [
          {
            name: 'fileSearchStores/store/documents/doc-2',
            displayName: 'Tech One.pdf',
            updateTime: '2026-03-28T11:00:00Z',
            state: 'STATE_ACTIVE',
            customMetadata: [
              { key: 'category', stringValue: 'tech' },
            ],
          },
        ],
      }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/files?category=legal'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');

    const payload = await response.json();
    expect(payload).toEqual([
      {
        name: 'fileSearchStores/store/documents/doc-1',
        display_name: 'Legal One.pdf',
        create_time: '2026-03-28T10:00:00Z',
        category: 'legal',
        state: 'STATE_ACTIVE',
      },
    ]);
  });

  it('returns 502 when file list upstream request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      error: { message: 'documents unavailable' },
    }, { status: 503 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/files'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'documents unavailable',
    });
  });

  it('lists categories from D1', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/categories'),
      {
        DB: createMockDb([
          {
            slug: 'legal',
            label: '법무',
            description: '계약 문서',
            color: '#c084fc',
            sort_order: 20,
            is_active: 1,
            is_builtin: 1,
            created_at: 10,
            updated_at: 10,
          },
        ]),
      },
      {}
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        slug: 'legal',
        label: '법무',
        description: '계약 문서',
        color: '#c084fc',
        sort_order: 20,
        is_active: true,
        is_builtin: true,
        created_at: 10,
        updated_at: 10,
      },
    ]);
  });

  it('creates a category in D1', async () => {
    const db = createMockDb();
    const response = await worker.fetch(
      new Request('https://example.com/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'customer-support',
          label: '고객지원',
          description: 'FAQ 문서',
          color: '#f59e0b',
        }),
      }),
      { DB: db },
      {}
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      slug: 'customer-support',
      label: '고객지원',
      description: 'FAQ 문서',
      color: '#f59e0b',
      sort_order: 100,
      is_active: true,
      is_builtin: false,
      created_at: 100,
      updated_at: 100,
    });
  });

  it('requires admin key for category writes when configured', async () => {
    const db = createMockDb();

    const unauthorized = await worker.fetch(
      new Request('https://example.com/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'customer-support', label: '고객지원' }),
      }),
      { DB: db, ADMIN_API_KEY: 'secret-key' },
      {}
    );

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: '관리자 인증이 필요합니다.',
    });

    const authorized = await worker.fetch(
      new Request('https://example.com/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'secret-key',
        },
        body: JSON.stringify({ slug: 'customer-support', label: '고객지원' }),
      }),
      { DB: db, ADMIN_API_KEY: 'secret-key' },
      {}
    );

    expect(authorized.status).toBe(201);
  });

  it('updates and soft-deletes categories in D1', async () => {
    const db = createMockDb([
      {
        slug: 'legal',
        label: '법무',
        description: '계약 문서',
        color: '#c084fc',
        sort_order: 20,
        is_active: 1,
        is_builtin: 1,
        created_at: 10,
        updated_at: 10,
      },
    ]);

    const patchResponse = await worker.fetch(
      new Request('https://example.com/api/categories/legal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '법률/규정', sort_order: 5, is_active: true }),
      }),
      { DB: db },
      {}
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toEqual({
      slug: 'legal',
      label: '법률/규정',
      description: '계약 문서',
      color: '#c084fc',
      sort_order: 5,
      is_active: true,
      is_builtin: true,
      created_at: 10,
      updated_at: 200,
    });

    const deleteResponse = await worker.fetch(
      new Request('https://example.com/api/categories/legal', { method: 'DELETE' }),
      { DB: db },
      {}
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      status: 'disabled',
      slug: 'legal',
    });
  });

  it('returns an error when importFile fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse('', {
        headers: {
          'X-Goog-Upload-URL': 'https://upload.example.com/session',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        file: { name: 'files/abc123' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: { message: 'import denied' },
      }, { status: 403 }));

    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('file', new File(['hello'], 'sample.txt', { type: 'text/plain' }));
    formData.append('display_name', 'sample.txt');
    formData.append('category', 'company');

    const response = await worker.fetch(
      new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
      }),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: '인덱싱 시작 실패: import denied',
    });
  });

  it('returns operation_name when upload import starts successfully', async () => {
    const waitUntil = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse('', {
        headers: {
          'X-Goog-Upload-URL': 'https://upload.example.com/session',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        file: { name: 'files/xyz789' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        name: 'fileSearchStores/store/upload/operations/op-123',
      }));

    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('file', new File(['hello'], 'sample.txt', { type: 'text/plain' }));
    formData.append('display_name', 'sample.txt');
    formData.append('category', 'company');

    const response = await worker.fetch(
      new Request('https://example.com/api/upload', {
        method: 'POST',
        body: formData,
      }),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      { waitUntil }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'success',
      file_name: 'files/xyz789',
      store_name: 'fileSearchStores/store',
      indexing: 'pending',
      operation_name: 'fileSearchStores/store/upload/operations/op-123',
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      file: { displayName: 'sample.txt' },
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      fileName: 'files/xyz789',
      customMetadata: [
        { key: 'category', string_value: 'company' },
        { key: 'original_name', string_value: 'sample.txt' },
      ],
    });
  });

  it('streams only delta text chunks for chat responses', async () => {
    const sseBody = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello world"}]},"groundingMetadata":{"groundingChunks":[{"retrievedContext":{"title":"Doc A"}}]}}]}\n\n',
    ].join('');

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(sseBody, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/chat?query=hello'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(response.status).toBe(200);

    const payload = await readSsePayload(response);
    expect(payload).toEqual([
      { text: 'Hello' },
      { text: ' world' },
      { citations: ['Doc A'] },
    ]);
  });

  it('uses requested store name for chat scope when provided', async () => {
    const sseBody = 'data: {"candidates":[{"content":{"parts":[{"text":"Scoped"}]}}]}\n\n';
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(sseBody, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/chat?query=hello&store=fileSearchStores/custom-scope'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(response.status).toBe(200);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.tools[0].file_search.file_search_store_names).toEqual([
      'fileSearchStores/custom-scope',
    ]);
  });

  it('returns 400 when chat query is missing', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const response = await worker.fetch(
      new Request('https://example.com/api/chat'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'query 파라미터가 필요합니다.',
    });
  });

  it('returns upstream chat API errors as 502 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      error: { message: 'model unavailable' },
    }, { status: 503 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/chat?query=hello'),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'model unavailable',
    });
  });

  it('deletes document ids with force flag enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 200,
    }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/files/fileSearchStores%2Fstore%2Fdocuments%2Fdoc-99', {
        method: 'DELETE',
      }),
      { GOOGLE_API_KEY: 'test-key', FILE_SEARCH_STORE: 'fileSearchStores/store' },
      {}
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/fileSearchStores/store/documents/doc-99?key=test-key&force=true'
    );
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'DELETE' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'deleted',
      document_id: 'fileSearchStores/store/documents/doc-99',
    });
  });
});
