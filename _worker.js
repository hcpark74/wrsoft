/**
 * Cloudflare Pages Worker
 * - /api/* 요청을 Gemini File Search Store REST API로 라우팅
 * - 카테고리 메타데이터 필터링 완전 지원
 *
 * 환경 변수 (Cloudflare Dashboard > Settings > Variables):
 *   GOOGLE_API_KEY      - Gemini API Key (Secret으로 등록)
 *   FILE_SEARCH_STORE   - File Search Store name (예: fileSearchStores/abc123)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const CEO_PERSONA = "당신은 회사의 대표이사(CEO)입니다. 전문적이고 권위 있으면서도 격려하는 태도로, 전략적인 관점에서 답변하세요. 회사의 목표와 비전을 깊이 이해하고 있으며, 항상 이러한 관점에서 답변해야 합니다.";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  };
}

function jsonResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function errorResponse(message, status = 500, origin) {
  return jsonResponse({ error: message }, status, origin);
}

function getErrorMessage(data, fallback) {
  return data?.error?.message || data?.error || data?.message || fallback;
}

function normalizeCategoryRow(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    label: row.label,
    description: row.description || "",
    color: row.color || "",
    sort_order: Number(row.sort_order || 100),
    is_active: Boolean(row.is_active),
    is_builtin: Boolean(row.is_builtin),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function validateCategorySlug(slug) {
  return /^[a-z0-9-]+$/.test(slug);
}

function getDb(env) {
  return env.DB || null;
}

function requireAdminAuth(request, env, origin) {
  const configuredKey = env.ADMIN_API_KEY;
  if (!configuredKey) return null;

  const providedKey = request.headers.get("X-Admin-Key") || "";
  if (providedKey !== configuredKey) {
    return errorResponse("관리자 인증이 필요합니다.", 401, origin);
  }

  return null;
}

async function fetchCategoryBySlug(db, slug) {
  const row = await db.prepare(
    `SELECT slug, label, description, color, sort_order, is_active, is_builtin, created_at, updated_at
     FROM categories WHERE slug = ?`
  ).bind(slug).first();
  return normalizeCategoryRow(row);
}

async function handleGetCategories(env, origin) {
  const db = getDb(env);
  if (!db) return errorResponse("서버 설정 오류: D1 카테고리 저장소가 없습니다.", 500, origin);

  try {
    const result = await db.prepare(
      `SELECT slug, label, description, color, sort_order, is_active, is_builtin, created_at, updated_at
       FROM categories
       ORDER BY is_active DESC, sort_order ASC, label ASC`
    ).all();
    return jsonResponse((result.results || []).map(normalizeCategoryRow), 200, origin);
  } catch (err) {
    return errorResponse(`카테고리 조회 오류: ${err.message}`, 500, origin);
  }
}

async function handleCreateCategory(request, env, origin) {
  const authError = requireAdminAuth(request, env, origin);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return errorResponse("서버 설정 오류: D1 카테고리 저장소가 없습니다.", 500, origin);

  try {
    const body = await request.json().catch(() => null);
    const slug = String(body?.slug || "").trim().toLowerCase();
    const label = String(body?.label || "").trim();
    const description = String(body?.description || "").trim();
    const color = String(body?.color || "").trim();
    const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 100;

    if (!slug || !label) {
      return errorResponse("slug와 label은 필수입니다.", 400, origin);
    }
    if (!validateCategorySlug(slug)) {
      return errorResponse("slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.", 400, origin);
    }

    const exists = await fetchCategoryBySlug(db, slug);
    if (exists) {
      return errorResponse("이미 존재하는 카테고리입니다.", 409, origin);
    }

    await db.prepare(
      `INSERT INTO categories (slug, label, description, color, sort_order, is_active, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, unixepoch(), unixepoch())`
    ).bind(slug, label, description || null, color || null, sortOrder).run();

    const created = await fetchCategoryBySlug(db, slug);
    return jsonResponse(created, 201, origin);
  } catch (err) {
    return errorResponse(`카테고리 생성 오류: ${err.message}`, 500, origin);
  }
}

async function handleUpdateCategory(slug, request, env, origin) {
  const authError = requireAdminAuth(request, env, origin);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return errorResponse("서버 설정 오류: D1 카테고리 저장소가 없습니다.", 500, origin);

  try {
    const existing = await fetchCategoryBySlug(db, slug);
    if (!existing) return errorResponse("카테고리를 찾을 수 없습니다.", 404, origin);

    const body = await request.json().catch(() => null);
    const next = {
      label: body?.label !== undefined ? String(body.label).trim() : existing.label,
      description: body?.description !== undefined ? String(body.description).trim() : existing.description,
      color: body?.color !== undefined ? String(body.color).trim() : existing.color,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : existing.is_active,
    };

    if (!next.label) {
      return errorResponse("label은 비워둘 수 없습니다.", 400, origin);
    }
    if (!Number.isFinite(next.sort_order)) {
      return errorResponse("sort_order는 숫자여야 합니다.", 400, origin);
    }

    await db.prepare(
      `UPDATE categories
       SET label = ?, description = ?, color = ?, sort_order = ?, is_active = ?, updated_at = unixepoch()
       WHERE slug = ?`
    ).bind(
      next.label,
      next.description || null,
      next.color || null,
      next.sort_order,
      next.is_active ? 1 : 0,
      slug
    ).run();

    const updated = await fetchCategoryBySlug(db, slug);
    return jsonResponse(updated, 200, origin);
  } catch (err) {
    return errorResponse(`카테고리 수정 오류: ${err.message}`, 500, origin);
  }
}

async function handleDeleteCategory(slug, request, env, origin) {
  const authError = requireAdminAuth(request, env, origin);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return errorResponse("서버 설정 오류: D1 카테고리 저장소가 없습니다.", 500, origin);

  try {
    const existing = await fetchCategoryBySlug(db, slug);
    if (!existing) return errorResponse("카테고리를 찾을 수 없습니다.", 404, origin);

    await db.prepare(
      `UPDATE categories SET is_active = 0, updated_at = unixepoch() WHERE slug = ?`
    ).bind(slug).run();

    return jsonResponse({ status: "disabled", slug }, 200, origin);
  } catch (err) {
    return errorResponse(`카테고리 삭제 오류: ${err.message}`, 500, origin);
  }
}

// File Search Store name 조회 (env 변수 또는 API 자동 조회)
async function getStoreName(env) {
  if (env.FILE_SEARCH_STORE) return env.FILE_SEARCH_STORE;

  // 자동 조회: 첫 번째 스토어 사용
  const resp = await fetch(
    `${GEMINI_BASE}/v1beta/fileSearchStores?key=${env.GOOGLE_API_KEY}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.fileSearchStores?.[0]?.name || null;
}

// ─────────────────────────────────────────────
// GET /api/chat?query=...&model=...&category=...
// File Search Store Tool + metadata_filter 지원
// ─────────────────────────────────────────────
async function handleChat(request, env, url, origin) {
  const query = url.searchParams.get("query");
  const model = url.searchParams.get("model") || "gemini-2.5-flash-lite";
  const category = url.searchParams.get("category") || "";
  const requestedStore = url.searchParams.get("store") || "";

  if (!query) return errorResponse("query 파라미터가 필요합니다.", 400, origin);

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  const storeName = requestedStore || await getStoreName(env);
  if (!storeName) return errorResponse("File Search Store를 찾을 수 없습니다.", 500, origin);

  try {
    // File Search Tool 구성 (metadata_filter 선택적 적용)
    const fileSearchTool = { file_search_store_names: [storeName] };
    if (category) {
      fileSearchTool.metadata_filter = `category="${category}"`;
    }

    const genResp = await fetch(
      `${GEMINI_BASE}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CEO_PERSONA }] },
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ file_search: fileSearchTool }],
        }),
      }
    );

    if (!genResp.ok) {
      const errData = await genResp.json().catch(() => ({}));
      return errorResponse(errData?.error?.message || "Gemini API 오류", 502, origin);
    }

    // SSE 스트림 변환: Gemini 응답 → 우리 앱 포맷
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = genResp.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    (async () => {
      let buffer = "";
      let streamedText = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim().startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.trim().slice(6));
              const parts = data?.candidates?.[0]?.content?.parts || [];
              const fullText = parts
                .map((part) => part?.text || "")
                .join("");
              const text = fullText.startsWith(streamedText)
                ? fullText.slice(streamedText.length)
                : fullText;
              if (text) {
                streamedText = fullText;
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
              // Citations 추출
              const groundingMeta = data?.candidates?.[0]?.groundingMetadata;
              if (groundingMeta?.groundingChunks) {
                const sources = [...new Set(groundingMeta.groundingChunks
                  .map(gc => gc?.retrievedContext?.title)
                  .filter(Boolean))];
                if (sources.length > 0) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ citations: sources })}\n\n`));
                }
              }
            } catch (e) { }
          }
        }
      } catch (err) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return errorResponse(`내부 오류: ${err.message}`, 500, origin);
  }
}

// ─────────────────────────────────────────────
// POST /api/upload (multipart/form-data)
// Step 1: Files API 업로드 → Step 2: File Search Store importFile + category metadata
// ─────────────────────────────────────────────
async function handleUpload(request, env, ctx, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const originalFilename = file?.name || "uploaded_file";
    const displayName = formData.get("display_name") || originalFilename;
    const category = formData.get("category") || "";

    if (!file) return errorResponse("file 필드가 필요합니다.", 400, origin);

    const fileBuffer = await file.arrayBuffer();

    // 브라우저가 보내는 MIME 타입이 불완전하거나 비표준일 수 있으므로
    // 파이썬 환경과 동일하게 확장자 기반 강제 매핑을 우선 적용합니다.
    const ext = originalFilename.includes(".")
      ? originalFilename.split(".").pop().toLowerCase()
      : "";
    const mimeMap = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
      md: "text/markdown",
      html: "text/html",
      css: "text/css",
      js: "text/javascript",
      ts: "application/typescript",
      jsx: "text/jsx",
      tsx: "text/tsx",
      py: "text/x-python",
      json: "application/json",
      xml: "application/xml",
      csv: "text/csv",
      tsv: "text/tab-separated-values",
      yaml: "text/plain",
      yml: "text/plain",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      hwp: "application/x-hwp",
      hwpx: "application/x-hwp",
      sql: "application/sql",
      zip: "application/zip",
    };

    // 맵에 있는 확장자면 맵의 값을 가장 우선시하고, 없으면 브라우저가 보낸 file.type, 마지막엔 text/plain
    const mimeType = mimeMap[ext] || file.type || "text/plain";

    // ── Step 1: Gemini Files API로 파일 업로드 ──
    const numBytes = fileBuffer.byteLength;
    const initResp = await fetch(
      `${GEMINI_BASE}/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": numBytes,
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { displayName } }),
      }
    );

    if (!initResp.ok) {
      const errText = await initResp.text();
      return errorResponse(`업로드 초기화 실패: ${errText}`, 502, origin);
    }

    const uploadUrl = initResp.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) return errorResponse("Upload URL을 받지 못했습니다.", 502, origin);

    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": numBytes,
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: fileBuffer,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      return errorResponse(`파일 업로드 실패: ${errText}`, 502, origin);
    }

    const uploadData = await uploadResp.json();
    const fileName = uploadData?.file?.name; // "files/xxx"
    if (!fileName) return errorResponse("업로드된 파일 이름을 받지 못했습니다.", 502, origin);

    // ── Step 2: File Search Store에 importFile (카테고리 메타데이터 포함) ──
    const storeName = await getStoreName(env);
    if (storeName) {
      const metadata = [];
      if (category) {
        metadata.push({ key: "category", string_value: category });
      }
      // 파일명 보존을 위해 메타데이터 추가
      metadata.push({ key: "original_name", string_value: displayName });

      const importBody = {
        fileName: fileName,
        customMetadata: metadata,
      };

      const importResp = await fetch(`${GEMINI_BASE}/v1beta/${storeName}:importFile?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importBody),
      });

      const importData = await importResp.json().catch(() => ({}));
      if (!importResp.ok) {
        return errorResponse(
          `인덱싱 시작 실패: ${getErrorMessage(importData, "File Search Store import 실패")}`,
          502,
          origin
        );
      }

      ctx.waitUntil(Promise.resolve(console.log("Import started:", JSON.stringify(importData))));

      return jsonResponse({
        status: "success",
        file_name: fileName,
        store_name: storeName,
        indexing: "pending",
        operation_name: importData?.name || null,
      }, 200, origin);
    }

    return jsonResponse({
      status: "success",
      file_name: fileName,
      store_name: storeName || null,
      indexing: storeName ? "pending" : "not_started"
    }, 200, origin);
  } catch (err) {
    return errorResponse(`업로드 오류: ${err.message}`, 500, origin);
  }
}

// ─────────────────────────────────────────────
// GET /api/files?category=...
// File Search Store 문서 목록 + 카테고리 필터링
// ─────────────────────────────────────────────
async function handleFiles(env, url, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  const filterCategory = url.searchParams.get("category") || "";
  const storeName = await getStoreName(env);
  if (!storeName) return errorResponse("File Search Store를 찾을 수 없습니다.", 500, origin);

  try {
    const docs = [];
    let pageToken = "";

    do {
      const listUrl = new URL(`${GEMINI_BASE}/v1beta/${storeName}/documents`);
      listUrl.searchParams.set("key", apiKey);
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const resp = await fetch(listUrl.toString());
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return errorResponse(getErrorMessage(errData, "파일 목록 조회 실패"), 502, origin);
      }

      const data = await resp.json();
      docs.push(...(data.documents || data.fileSearchDocuments || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    const result = docs
      .map((d) => {
        const metaList = d.customMetadata || [];
        // 메타데이터에서 원본 파일명 추출 시도
        const nameMeta = metaList.find((m) => m.key === "original_name");
        const categoryMeta = metaList.find((m) => m.key === "category");

        const category = categoryMeta?.stringValue || "";
        const displayName = nameMeta?.stringValue || d.displayName || d.display_name || (d.name ? d.name.split("/").pop() : "알 수 없는 파일");

        return {
          name: d.name,
          display_name: displayName,
          create_time: d.updateTime || d.createTime || null,
          category,
          state: (d.state || "ACTIVE").toUpperCase().split(".").pop(),
        };
      })
      // 카테고리 필터 (서버단)
      .filter((d) =>
        !filterCategory || d.category.toLowerCase() === filterCategory.toLowerCase()
      );

    return jsonResponse(result, 200, origin);
  } catch (err) {
    return errorResponse(`조회 오류: ${err.message}`, 500, origin);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/files/{documentId}
// File Search Store 문서 삭제
// ─────────────────────────────────────────────
async function handleDeleteFile(fileId, env, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  try {
    const decodedId = decodeURIComponent(fileId);
    // force=true: 문서 내 청크까지 함께 강제 삭제 (Python SDK와 동일)
    const resp = await fetch(
      `${GEMINI_BASE}/v1beta/${decodedId}?key=${apiKey}&force=true`,
      { method: "DELETE" }
    );
    if (!resp.ok) {
      const errText = await resp.text();
      return errorResponse(`삭제 실패: ${errText}`, 502, origin);
    }
    return jsonResponse({ status: "deleted", document_id: decodedId }, 200, origin);
  } catch (err) {
    return errorResponse(`삭제 오류: ${err.message}`, 500, origin);
  }
}

// ─────────────────────────────────────────────
// 메인 라우터
// ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname;

      if (path === "/api/chat" && request.method === "GET") {
        return handleChat(request, env, url, origin);
      }
      if (path === "/api/upload" && request.method === "POST") {
        return handleUpload(request, env, ctx, origin);
      }
      if (path === "/api/files" && request.method === "GET") {
        return handleFiles(env, url, origin);
      }
      if (path === "/api/categories" && request.method === "GET") {
        return handleGetCategories(env, origin);
      }
      if (path === "/api/categories" && request.method === "POST") {
        return handleCreateCategory(request, env, origin);
      }
      const categoryMatch = path.match(/^\/api\/categories\/([^/]+)$/);
      if (categoryMatch && request.method === "PATCH") {
        return handleUpdateCategory(decodeURIComponent(categoryMatch[1]), request, env, origin);
      }
      if (categoryMatch && request.method === "DELETE") {
        return handleDeleteCategory(decodeURIComponent(categoryMatch[1]), request, env, origin);
      }
      const deleteMatch = path.match(/^\/api\/files\/(.+)$/);
      if (deleteMatch && request.method === "DELETE") {
        return handleDeleteFile(deleteMatch[1], env, origin);
      }

      return errorResponse("알 수 없는 API 경로입니다.", 404, origin);
    }

    // 페이지 라우팅
    const pageRoutes = {
      "/chat": "/doc_ai_system/app/static/chat.html",
      "/admin": "/doc_ai_system/app/static/index.html",
      "/chatbot": "/doc_ai_system/app/static/popup.html",
    };

    const staticPath = pageRoutes[url.pathname];
    if (staticPath) {
      const assetUrl = new URL(staticPath, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    if (url.pathname.startsWith("/static/")) {
      const newPath = "/doc_ai_system/app" + url.pathname;
      const assetUrl = new URL(newPath, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    return env.ASSETS.fetch(request);
  },
};
