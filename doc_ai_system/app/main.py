from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
from app.services.gemini_service import gemini_service

app = FastAPI(title="Gemini File Search AI System")

# 정적 파일 서빙 (UI)
if not os.path.exists("app/static"):
    os.makedirs("app/static")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

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

@app.post("/upload")
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

@app.get("/files")
async def list_files():
    docs = gemini_service.list_documents(None)
    return [{"name": d.uri, "display_name": d.display_name} for d in docs]

@app.get("/chat")
async def chat(query: str, model_id: str = "gemini-2.0-flash-lite"):
    def generate():
        try:
            # ask_chatbot_stream은 generator를 반환함
            for chunk in gemini_service.ask_chatbot_stream(query=query, model_id=model_id):
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
