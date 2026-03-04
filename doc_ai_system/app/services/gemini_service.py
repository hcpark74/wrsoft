import os
import time
import mimetypes
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# File Search 공식 지원 모델 (File_Search.md 참조)
FILE_SEARCH_MODEL = "gemini-3-flash-preview"

# CEO 페르소나 시스템 인스트럭션
CEO_PERSONA = "당신은 회사의 대표이사(CEO)입니다. 전문적이고 권위 있으면서도 격려하는 태도로, 전략적인 관점에서 답변하세요. 회사의 목표와 비전을 깊이 이해하고 있으며, 항상 이러한 관점에서 답변해야 합니다."


class GeminiService:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self._store_name = None  # FileSearchStore name 캐시

    def create_corpus(self, display_name: str) -> str:
        """File Search Store 생성. 이미 존재하면 첫 번째 스토어 재사용."""
        try:
            stores = list(self.client.file_search_stores.list())
            if stores:
                self._store_name = stores[0].name
                print(f"Reusing File Search Store: {self._store_name}")
                return self._store_name

            store = self.client.file_search_stores.create(
                config={"display_name": display_name}
            )
            self._store_name = store.name
            print(f"Created File Search Store: {self._store_name}")
            return self._store_name
        except Exception as e:
            print(f"Error creating File Search Store: {e}")
            return None

    # 확장자 → MIME 타입 매핑 테이블
    MIME_MAP = {
        'pdf':  'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc':  'application/msword',
        'txt':  'text/plain',
        'md':   'text/markdown',
        'html': 'text/html',
        'css':  'text/css',
        'js':   'text/javascript',
        'ts':   'application/typescript',
        'jsx':  'text/jsx',
        'tsx':  'text/tsx',
        'py':   'text/x-python',
        'json': 'application/json',
        'xml':  'application/xml',
        'csv':  'text/csv',
        'tsv':  'text/tab-separated-values',
        'yaml': 'text/plain',
        'yml':  'text/plain',
        'xls':  'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt':  'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'hwp':  'application/x-hwp',
        'hwpx': 'application/x-hwp',
        'sql':  'application/sql',
        'zip':  'application/zip',
    }
    
    # Python 표준 mimetypes 모듈에 등록하여 Gemini SDK가 파일 확장자에서 안정적으로 자동 감지하도록 조치
    for ext, mtype in MIME_MAP.items():
        mimetypes.add_type(mtype, f'.{ext}')

    def upload_file_to_corpus(self, corpus_name: str, file_path: str, display_name: str, custom_metadata: list = None):
        """
        파일을 File Search Store에 직접 업로드하고 인덱싱 완료까지 대기.
        custom_metadata 예: [{"key": "category", "string_value": "marketing"}]
        """
        try:
            store_name = corpus_name or self._store_name
            if not store_name:
                print("No File Search Store available")
                return None

            # 확장자로 MIME 타입 결정 (SDK가 자동 인식 못하는 경우 명시)
            ext = file_path.rsplit('.', 1)[-1].lower() if '.' in file_path else ''
            mime_type = self.MIME_MAP.get(ext, 'text/plain')

            print(f"Uploading '{display_name}' (mime: {mime_type}) to File Search Store...")

            operation = self.client.file_search_stores.upload_to_file_search_store(
                file=file_path,
                file_search_store_name=store_name,
                config={
                    "display_name": display_name,
                    "custom_metadata": custom_metadata
                },
            )

            print(f"'{display_name}' upload initiated. Indexing runs in background.")
            return operation
        except Exception as e:
            print(f"Error uploading file: {e}")
            return None

    def list_documents(self, corpus_name: str):
        """File Search Store 내 문서 목록 조회"""
        try:
            store_name = corpus_name or self._store_name
            if not store_name:
                return []
            docs = self.client.file_search_stores.documents.list(parent=store_name)
            return list(docs)
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []

    def delete_document(self, document_name: str):
        """File Search Store 내 특정 문서 삭제 (document_name: stores/.../documents/...)"""
        try:
            # 'Cannot delete non-empty Document' 에러 방지를 위해 관련 청크까지 강제 삭제 옵션 적용
            # SDK 버전에 따라 인자명이 다를 수 있으나, 보통 force 또는 delete_chunks=True 지원
            self.client.file_search_stores.documents.delete(name=document_name, config={'force': True})
            print(f"Document deleted: {document_name}")
            return True
        except Exception as e:
            print(f"Error deleting document {document_name}: {e}")
            return False

    def ask_chatbot(self, query: str, model_id: str = FILE_SEARCH_MODEL):
        """File Search Tool을 사용한 RAG 답변 생성 (non-streaming)"""
        try:
            store_name = self._store_name
            if not store_name:
                raise Exception("File Search Store가 초기화되지 않았습니다.")

            response = self.client.models.generate_content(
                model=model_id,
                contents=query,
                config=types.GenerateContentConfig(
                    system_instruction=CEO_PERSONA,
                    tools=[
                        types.Tool(
                            file_search=types.FileSearch(
                                file_search_store_names=[store_name]
                            )
                        )
                    ]
                ),
            )
            return response
        except Exception as e:
            self._handle_error(e, model_id)

    def ask_chatbot_stream(self, query: str, model_id: str = FILE_SEARCH_MODEL, metadata_filter: str = None):
        """File Search Tool 스트리밍 답변. metadata_filter 지원."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                store_name = self._store_name
                if not store_name:
                    raise Exception("File Search Store가 초기화되지 않았습니다.")

                return self.client.models.generate_content_stream(
                    model=model_id,
                    contents=query,
                    config=types.GenerateContentConfig(
                        system_instruction=CEO_PERSONA,
                        tools=[
                            types.Tool(
                                file_search=types.FileSearch(
                                    file_search_store_names=[store_name],
                                    metadata_filter=metadata_filter
                                )
                            )
                        ],
                        # grounding_metadata를 명시적으로 포함하도록 설정 (필요 시)
                    ),
                )
            except Exception as e:
                error_msg = str(e)
                if ("503" in error_msg or "UNAVAILABLE" in error_msg) and attempt < max_retries - 1:
                    wait = 2 ** attempt  # 1s → 2s → 4s
                    print(f"503 UNAVAILABLE, {wait}s 후 재시도 ({attempt + 1}/{max_retries - 1})...")
                    time.sleep(wait)
                    continue
                self._handle_error(e, model_id)

    def _handle_error(self, e, model_id):
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            raise Exception("현재 사용 중인 Gemini 모델의 무료 호출 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.")
        elif "503" in error_msg or "UNAVAILABLE" in error_msg:
            raise Exception("죄송합니다. 현재 Gemini 서버에 부하가 집중되고 있습니다. 잠시 후 다시 시도해 주세요.")
        elif "404" in error_msg or "NOT_FOUND" in error_msg:
            raise Exception(f"모델({model_id})을 찾을 수 없거나 File Search를 지원하지 않습니다.")
        raise e


gemini_service = GeminiService()
