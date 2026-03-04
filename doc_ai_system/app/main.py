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
async def upload_document(
    display_name: str = Form(...), 
    category: str = Form(None),
    file: UploadFile = File(...)
):
    if not DEFAULT_CORPUS_NAME:
        raise HTTPException(status_code=500, detail="Corpus not initialized")
    
    # 인코딩 문제를 피하기 위해 로컬 임시 파일은 영문/숫자 이름 사용
    temp_filename = f"temp_upload_{int(asyncio.get_event_loop().time())}.{file.filename.split('.')[-1]}"
    temp_path = os.path.join(os.getcwd(), temp_filename)
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # custom_metadata 준비 (카테고리가 있는 경우)
        custom_metadata = None
        if category:
            custom_metadata = [{"key": "category", "string_value": category}]

        # Gemini에 등록 (display_name은 한글 가능)
        doc = gemini_service.upload_file_to_corpus(
            corpus_name=DEFAULT_CORPUS_NAME,
            file_path=temp_path,
            display_name=display_name,
            custom_metadata=custom_metadata
        )
        return {"status": "success", "document": str(doc)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/files")
async def list_files(category: str = None):
    docs = gemini_service.list_documents(None)
    # FileSearchDocument: name, display_name, update_time, custom_metadata 필드
    result = []
    for d in docs:
        doc_category = ""
        custom_meta = getattr(d, 'custom_metadata', []) or []
        for meta in custom_meta:
            if getattr(meta, 'key', '') == 'category':
                doc_category = getattr(meta, 'string_value', '')
                break
        
        # 필터링 로직 적용 (대소문자 및 공백 무시)
        if category and doc_category.strip().lower() != category.strip().lower():
            continue
            
        result.append({
            "name": getattr(d, 'name', ''),
            "display_name": getattr(d, 'display_name', d.name),
            "create_time": getattr(d, 'update_time', getattr(d, 'create_time', None)),
            "category": doc_category,
            "state": str(getattr(d, 'state', 'ACTIVE'))
        })
    return result

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
async def chat(query: str, model_id: str = "gemini-2.5-flash-lite", category: str = None):
    # category 기반 필터 문자열 생성 (예: category="marketing")
    metadata_filter = f'category="{category}"' if category else None
    async def generate():
        loop = asyncio.get_event_loop()
        try:
            stream = await loop.run_in_executor(
                    None,
                    lambda: gemini_service.ask_chatbot_stream(
                        query=query, 
                        model_id=model_id, 
                        metadata_filter=metadata_filter
                    )
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
