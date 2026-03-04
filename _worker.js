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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
  const model = url.searchParams.get("model") || "gemini-3-flash-preview";
  const category = url.searchParams.get("category") || "";

  if (!query) return errorResponse("query 파라미터가 필요합니다.", 400, origin);

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  const storeName = await getStoreName(env);
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
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
              // Citations 추출
              const groundingMeta = data?.candidates?.[0]?.groundingMetadata;
              if (groundingMeta?.groundingChunks) {
                const sources = groundingMeta.groundingChunks
                  .map(gc => gc?.retrievedContext?.title)
                  .filter(Boolean);
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
    const displayName = formData.get("display_name") || file?.name || "uploaded_file";
    const category = formData.get("category") || "";

    if (!file) return errorResponse("file 필드가 필요합니다.", 400, origin);

    const fileBuffer = await file.arrayBuffer();

    // 브라우저가 보내는 MIME 타입이 불완전하거나 비표준일 수 있으므로
    // 파이썬 환경과 동일하게 확장자 기반 강제 매핑을 우선 적용합니다.
    const ext = displayName.split(".").pop().toLowerCase();
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
        body: JSON.stringify({ file: { display_name: displayName } }),
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
      const importBody = { file_name: fileName };
      if (category) {
        importBody.custom_metadata = [{ key: "category", string_value: category }];
      }

      // ctx.waitUntil: Worker 응답 반환 후에도 백그라운드에서 인덱싱 계속 실행
      ctx.waitUntil(
        fetch(`${GEMINI_BASE}/v1beta/${storeName}:importFile?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(importBody),
        }).then(r => r.json()).then(d => console.log("Import started:", JSON.stringify(d)))
          .catch(e => console.error("Import error:", e.message))
      );
    }

    return jsonResponse({ status: "success", file: uploadData.file }, 200, origin);
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
    const resp = await fetch(
      `${GEMINI_BASE}/v1beta/${storeName}/documents?key=${apiKey}`
    );
    if (!resp.ok) return errorResponse("파일 목록 조회 실패", 502, origin);

    const data = await resp.json();
    const docs = data.documents || data.fileSearchDocuments || [];

    const result = docs
      .map((d) => {
        // category 메타데이터 추출
        const metaList = d.customMetadata || [];
        const catMeta = metaList.find((m) => m.key === "category");
        const category = catMeta?.stringValue || "";
        return {
          name: d.name,
          display_name: d.display_name || d.displayName || (d.name ? d.name.split('/').pop() : "알 수 없는 파일"),
          create_time: d.updateTime || d.createTime || null,
          category,
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
