/**
 * Cloudflare Pages Worker
 * - /api/* 요청을 Gemini REST API로 라우팅
 * - 그 외 요청은 Pages 정적 파일(env.ASSETS)로 전달
 *
 * 환경 변수 (Cloudflare Dashboard > Settings > Variables):
 *   GOOGLE_API_KEY  - Gemini API Key (Secret으로 등록)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const CEO_PERSONA = "당신은 회사의 대표이사(CEO)입니다. 전문적이고 권위 있으면서도 격려하는 태도로, 전략적인 관점에서 답변하세요. 회사의 목표와 비전을 깊이 이해하고 있으며, 항상 이러한 관점에서 답변해야 합니다.";

// CORS 헤더: wrsoft 도메인에서만 허용 (필요 시 '*'로 변경)
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function errorResponse(message, status = 500, origin) {
  return jsonResponse({ error: message }, status, origin);
}

// ─────────────────────────────────────────────
// API 핸들러
// ─────────────────────────────────────────────

/**
 * GET /api/chat?query=...&model=gemini-2.0-flash-lite
 * 업로드된 ACTIVE 파일 컨텍스트를 포함하여 Gemini에 질문
 */
async function handleChat(request, env, url, origin) {
  const query = url.searchParams.get("query");
  const model = url.searchParams.get("model") || "gemini-2.5-flash-lite";

  if (!query) {
    return errorResponse("query 파라미터가 필요합니다.", 400, origin);
  }

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) {
    return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);
  }

  try {
    // 1. ACTIVE 파일 목록 조회
    const filesResp = await fetch(
      `${GEMINI_BASE}/v1beta/files?key=${apiKey}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const filesData = await filesResp.json();
    const activeFiles = (filesData.files || []).filter(
      (f) => f.state === "ACTIVE"
    );

    // 2. 컨텐츠 구성 (파일 파트 + 사용자 질문)
    const parts = activeFiles.map((f) => ({
      file_data: { mime_type: f.mimeType, file_uri: f.uri },
    }));
    parts.push({ text: query });

    // 3. Gemini generateContent 호출 (Streaming)
    // 참고: Worker에서는 File Search Store를 직접 관리하기 복잡하므로 
    // 기존의 File API(activeFiles) 방식을 유지하되, 페르소나와 모델만 Python과 맞춥니다.
    const genResp = await fetch(
      `${GEMINI_BASE}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CEO_PERSONA }] },
          contents: [{ role: "user", parts }]
        }),
      }
    );

    if (!genResp.ok) {
      let detail = "Gemini API 오류";
      try {
        const errData = await genResp.json();
        detail = errData?.error?.message || detail;
      } catch (e) {
        detail = await genResp.text();
      }
      return errorResponse(detail, 502, origin);
    }

    // Transform stream to extract text from Gemini SSE format to our app format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = genResp.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    (async () => {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              try {
                const data = JSON.parse(line.trim().slice(6));
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const sseData = `data: ${JSON.stringify({ text })}\n\n`;
                  await writer.write(encoder.encode(sseData));
                }
              } catch (e) { }
            }
          }
        }
      } catch (err) {
        const errData = `data: ${JSON.stringify({ error: err.message })}\n\n`;
        await writer.write(encoder.encode(errData));
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

/**
 * POST /api/upload  (multipart/form-data)
 * Body: file (binary), display_name (string)
 * Gemini Files API로 파일 업로드 (Resumable Upload)
 */
async function handleUpload(request, env, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const displayName = formData.get("display_name") || file?.name || "uploaded_file";

    if (!file) return errorResponse("file 필드가 필요합니다.", 400, origin);

    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";
    const numBytes = fileBuffer.byteLength;

    // Step 1: Resumable upload 초기화
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

    // Step 2: 실제 파일 데이터 전송
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
    return jsonResponse({ status: "success", file: uploadData.file }, 200, origin);
  } catch (err) {
    return errorResponse(`업로드 오류: ${err.message}`, 500, origin);
  }
}

/**
 * GET /api/files
 * Gemini Files API 목록 반환
 */
async function handleFiles(env, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  try {
    const resp = await fetch(`${GEMINI_BASE}/v1beta/files?key=${apiKey}`);
    if (!resp.ok) {
      return errorResponse("파일 목록 조회 실패", 502, origin);
    }
    const data = await resp.json();
    const files = (data.files || []).map((f) => ({
      name: f.name,
      display_name: f.displayName,
      mime_type: f.mimeType,
      state: f.state,
      uri: f.uri,
    }));
    return jsonResponse(files, 200, origin);
  } catch (err) {
    return errorResponse(`조회 오류: ${err.message}`, 500, origin);
  }
}

/**
 * DELETE /api/files/:fileId
 * Gemini Files API 파일 삭제
 */
async function handleDeleteFile(fileId, env, origin) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return errorResponse("서버 설정 오류: API 키가 없습니다.", 500, origin);

  try {
    const resp = await fetch(
      `${GEMINI_BASE}/v1beta/files/${fileId}?key=${apiKey}`,
      { method: "DELETE" }
    );
    if (!resp.ok) {
      return errorResponse("파일 삭제 실패", 502, origin);
    }
    return jsonResponse({ status: "deleted", file_id: fileId }, 200, origin);
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

    // Preflight (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // /api/* 라우팅
    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname;

      if (path === "/api/chat" && request.method === "GET") {
        return handleChat(request, env, url, origin);
      }

      if (path === "/api/upload" && request.method === "POST") {
        return handleUpload(request, env, origin);
      }

      if (path === "/api/files" && request.method === "GET") {
        return handleFiles(env, origin);
      }

      // DELETE /api/files/{fileId}
      const deleteMatch = path.match(/^\/api\/files\/(.+)$/);
      if (deleteMatch && request.method === "DELETE") {
        return handleDeleteFile(deleteMatch[1], env, origin);
      }

      return errorResponse("알 수 없는 API 경로입니다.", 404, origin);
    }

    // ── 페이지 라우팅 ──
    const pageRoutes = {
      "/chat": "/doc_ai_system/app/static/chat.html",   // 사용자 전용
      "/admin": "/doc_ai_system/app/static/index.html",  // 관리자 전용
      "/chatbot": "/doc_ai_system/app/static/popup.html", // 챗봇 전용
    };

    const staticPath = pageRoutes[url.pathname];
    if (staticPath) {
      const assetUrl = new URL(staticPath, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // /static/* 경로를 doc_ai_system/app/static/* 로 매핑하여 MIME 에러 해결
    if (url.pathname.startsWith("/static/")) {
      const newPath = "/doc_ai_system/app" + url.pathname;
      const assetUrl = new URL(newPath, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // 그 외 정적 파일: Cloudflare Pages Assets로 위임
    return env.ASSETS.fetch(request);
  },
};
