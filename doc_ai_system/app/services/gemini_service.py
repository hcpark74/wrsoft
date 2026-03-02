import os
import time
import mimetypes
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

class GeminiService:
    def __init__(self):
        # google-genai 1.x SDK 클라이언트: 안정성을 위해 기본 v1 사용
        api_key = os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=api_key)
        
        # 가용 모델 목록을 서버 시작 시점에 출력하여 404 원인을 파악합니다.
        try:
            models = self.client.models.list()
            print("--- Available Models (Detailed) ---")
            for m in models:
                print(f"- {getattr(m, 'name', 'N/A')} // {getattr(m, 'supported_methods', 'N/A')}")
        except Exception as e:
            print(f"Error listing models: {e}")
        
    def create_corpus(self, display_name: str):
        """
        참고: Semantic Retrieval API는 현재 v1beta에서 지원되나 SDK 접근 방식이 다를 수 있음.
        여기서는 최신 1.x SDK의 File API 기반 RAG로 전환하여 안정성 확보.
        """
        return "default_corpus" # placeholder

    def upload_file_to_corpus(self, corpus_name: str, file_path: str, display_name: str):
        """File API를 사용하여 파일 업로드 후 ACTIVE 상태가 될 때까지 대기"""
        try:
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"

            print(f"Uploading {display_name}...")
            # 최신 google-genai SDK는 'file' 인자 혹은 'path' 인자를 사용합니다.
            # 에러 발생 시를 대비하여 대체 방식(file 객체 전달)을 적용합니다.
            with open(file_path, 'rb') as f:
                uploaded_file = self.client.files.upload(
                    file=f,
                    config=types.UploadFileConfig(
                        display_name=display_name,
                        mime_type=mime_type
                    )
                )

            # 파일이 처리될 때까지 대기 (Gemini API 필수 과정)
            while uploaded_file.state.name == "PROCESSING":
                print(f"File {display_name} is processing...")
                time.sleep(2)
                uploaded_file = self.client.files.get(name=uploaded_file.name)

            if uploaded_file.state.name == "FAILED":
                print(f"File {display_name} failed to process.")
                return None
            
            print(f"File {display_name} is now ACTIVE.")
            return uploaded_file
        except Exception as e:
            print(f"Error uploading file: {e}")
            return None

    def list_documents(self, corpus_name: str):
        """파일 목록 조회"""
        try:
            docs = self.client.files.list()
            return list(docs)
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []

    def ask_chatbot(self, query: str, model_id: str = "gemini-2.0-flash-lite"):
        """ ACTIVE 상태인 파일들을 참조하여 답변 생성 """
        try:
            files = [f for f in self.client.files.list() if f.state.name == "ACTIVE"]
            contents = [types.Part.from_uri(file_uri=f.uri, mime_type=f.mime_type) for f in files]
            contents.append(types.Part.from_text(text=query))

            response = self.client.models.generate_content(model=model_id, contents=contents)
            return response
        except Exception as e:
            self._handle_error(e, model_id)

    def ask_chatbot_stream(self, query: str, model_id: str = "gemini-2.0-flash-lite"):
        """ 스트리밍 방식으로 답변 생성 """
        try:
            files = [f for f in self.client.files.list() if f.state.name == "ACTIVE"]
            contents = [types.Part.from_uri(file_uri=f.uri, mime_type=f.mime_type) for f in files]
            contents.append(types.Part.from_text(text=query))

            return self.client.models.generate_content_stream(model=model_id, contents=contents)
        except Exception as e:
            self._handle_error(e, model_id)

    def _handle_error(self, e, model_id):
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            friendly_msg = "현재 사용 중인 Gemini 모델의 무료 호출 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요."
            raise Exception(friendly_msg)
        elif "404" in error_msg or "NOT_FOUND" in error_msg:
            friendly_msg = f"모델({model_id})을 찾을 수 없습니다."
            raise Exception(friendly_msg)
        raise e

gemini_service = GeminiService()
