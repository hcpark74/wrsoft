from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import shutil
import os
import json
from app.services.gemini_service import gemini_service

app = FastAPI(title="Gemini File Search AI System")

# 정적 파일 서빙 (UI)
if not os.path.exists("app/static"):
    os.makedirs("app/static")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 상위 디렉토리의 images 폴더 서빙 (logo.png, chatbot.png 등)
# __file__ = .../wrsoft/doc_ai_system/app/main.py
# dirname×3 → wrsoft/
IMAGES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "images"
)
if os.path.exists(IMAGES_DIR):
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")
else:
    print(f"[WARN] images 폴더를 찾을 수 없습니다: {IMAGES_DIR}")

# 테스트용 고정 Corpus 이름 (실제로는 DB에서 관리 권장)
DEFAULT_CORPUS_NAME = None

@app.on_event("startup")
async def startup_event():
    global DEFAULT_CORPUS_NAME
    # 시작 시 기본 Corpus 이름 설정 (File API 방식에서는 고정값 사용)
    DEFAULT_CORPUS_NAME = gemini_service.create_corpus(display_name="Internal Knowledge Base")
    print(f"Service initialized with: {DEFAULT_CORPUS_NAME}")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
async def root():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

@app.post("/api/upload")
async def upload_document(display_name: str = Form(...), file: UploadFile = File(...)):
    if not DEFAULT_CORPUS_NAME:
        raise HTTPException(status_code=500, detail="Corpus not initialized")
    
    # 임시 저장
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Gemini에 등록
        doc = gemini_service.upload_file_to_corpus(
            corpus_name=DEFAULT_CORPUS_NAME,
            file_path=temp_path,
            display_name=display_name
        )
        return {"status": "success", "document": str(doc)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/files")
async def list_files():
    docs = gemini_service.list_documents(None)
    # FileSearchDocument: name, display_name, create_time 필드
    return [
        {
            "name": getattr(d, 'name', ''),
            "display_name": getattr(d, 'display_name', d.name),
            "create_time": getattr(d, 'update_time', getattr(d, 'create_time', None))
        } 
        for d in docs
    ]

@app.delete("/api/files/{document_id:path}")
async def delete_file(document_id: str):
    # document_id는 list_files에서 받은 'name' (stores/S/documents/D 형식)을 기대
    # URL 경로에 포함되므로 인코딩 상황에 따라 주의 필요하나, 
    # 일단 직접 전달하거나 쿼리 스트링으로 처리 가능. 여기선 경로 변수 사용.
    success = gemini_service.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=500, detail="문서 삭제 실패")
    return {"status": "success", "message": f"문서 {document_id} 삭제 완료"}

@app.get("/api/chat")
async def chat(query: str, model_id: str = "gemini-2.5-flash-lite"):
    async def generate():
        loop = asyncio.get_event_loop()
        try:
            # sync SDK 초기화를 스레드풀에서 실행 (이벤트 루프 블로킹 방지)
            stream = await loop.run_in_executor(
                None,
                lambda: gemini_service.ask_chatbot_stream(query=query, model_id=model_id)
            )
            if stream is None:
                yield f"data: {json.dumps({'error': '스트림을 시작할 수 없습니다.'}, ensure_ascii=False)}\n\n"
                return

            # sentinel 패턴: next()의 StopIteration이 asyncio Future 안에서
            # RuntimeError로 변환되는 PEP 479 문제를 방지
            _DONE = object()
            it = iter(stream)
            while True:
                chunk = await loop.run_in_executor(None, next, it, _DONE)
                if chunk is _DONE:
                    break
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text}, ensure_ascii=False)}\n\n"

                # grounding_metadata 추출 (주로 마지막 청크에 포함됨)
                if hasattr(chunk, 'candidates') and chunk.candidates:
                    metadata = getattr(chunk.candidates[0], 'grounding_metadata', None)
                    if metadata:
                        sources = []
                        # grounding_chunks에서 파일 제목 추출
                        g_chunks = getattr(metadata, 'grounding_chunks', [])
                        for gc in g_chunks:
                            retv = getattr(gc, 'retrieved_context', None)
                            if retv:
                                title = getattr(retv, 'title', None)
                                if title and title not in sources:
                                    sources.append(title)
                        
                        if sources:
                            yield f"data: {json.dumps({'citations': sources}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )
