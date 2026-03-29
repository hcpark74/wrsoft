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
