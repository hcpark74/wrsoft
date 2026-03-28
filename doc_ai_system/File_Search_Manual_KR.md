# Gemini File Search 사용 매뉴얼

## 관련 문서

- [문서 안내](./README.md)
- [기능 설명 문서](./File_Search_KR.md)
- [운영 가이드](./File_Search_Operations_Guide_KR.md)
- [원문 문서](./File_Search.md)

## 목적

이 문서는 Gemini API의 `File Search` 기능을 실제로 사용하기 위한 작업 절차를 단계별로 설명하는 실무용 매뉴얼입니다.

`File Search`를 사용하면 문서를 검색 가능한 저장소에 인덱싱한 뒤, 사용자 질문에 맞는 문서 조각을 찾아 Gemini 응답의 근거로 활용할 수 있습니다.

---

## 빠른 이해

작업 흐름은 아래 3단계로 이해하면 됩니다.

1. `File Search store` 생성
2. 문서 업로드 및 인덱싱
3. `generateContent`에서 `fileSearch` tool로 질의

---

## 사전 준비

### 준비 항목

- Gemini API 사용 가능한 프로젝트
- `GEMINI_API_KEY`
- 검색 대상 문서 파일
- Python 또는 Node.js 실행 환경

### 권장 준비

- 문서 분류 기준 정의
- store 이름 규칙 정의
- 메타데이터 기준 정의

예:

- 환경: `dev`, `stg`, `prod`
- 문서 유형: `policy`, `tech`, `faq`, `manual`
- 메타데이터: `department`, `owner`, `version`, `updated_at`

---

## 전체 절차

### 1단계. File Search store 만들기

먼저 문서 임베딩과 인덱스를 저장할 `File Search store`를 생성합니다.

### 권장 이름 규칙

- `prod-policy-docs`
- `prod-tech-docs`
- `dev-internal-manuals`

### 주의

- store 이름은 충돌 가능성을 고려해 환경명과 서비스명을 포함하는 것이 좋습니다.
- 하나의 store에 너무 많은 성격의 문서를 섞지 않는 것이 좋습니다.

---

### 2단계. 문서 업로드 방식 선택

문서 등록 방식은 두 가지입니다.

## 방식 A. `uploadToFileSearchStore`

파일 업로드와 인덱싱을 한 번에 처리합니다.

### 적합한 경우

- 빠르게 PoC를 만들 때
- 업로드된 원본 파일을 별도로 관리할 필요가 없을 때
- 구현 복잡도를 줄이고 싶을 때

## 방식 B. `files.upload` 후 `importFile`

원본 파일 업로드와 검색 인덱싱을 분리합니다.

### 적합한 경우

- 파일 업로드 단계와 인덱싱 단계를 분리하고 싶을 때
- 기존 파일 관리 프로세스가 이미 있을 때
- 파일 단위 처리 로그를 명확히 나누고 싶을 때

---

## 기본 사용 예시

## Python 예시

```python
from google import genai
from google.genai import types
import time

client = genai.Client()

# 1. store 생성
file_search_store = client.file_search_stores.create(
    config={"display_name": "prod-tech-docs"}
)

# 2. 파일 업로드 + 인덱싱
operation = client.file_search_stores.upload_to_file_search_store(
    file="sample.txt",
    file_search_store_name=file_search_store.name,
    config={
        "display_name": "sample-doc"
    }
)

# 3. 완료 대기
while not operation.done:
    time.sleep(5)
    operation = client.operations.get(operation)

# 4. 질의
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="이 문서의 핵심 내용을 요약해줘.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[file_search_store.name]
                )
            )
        ]
    )
)

print(response.text)
```

## Node.js 예시

```javascript
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

async function run() {
  const fileSearchStore = await ai.fileSearchStores.create({
    config: { displayName: 'prod-tech-docs' }
  });

  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: 'sample.txt',
    fileSearchStoreName: fileSearchStore.name,
    config: {
      displayName: 'sample-doc'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.get({ operation });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: '이 문서의 핵심 내용을 요약해줘.',
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [fileSearchStore.name]
          }
        }
      ]
    }
  });

  console.log(response.text);
}

run();
```

---

## 청킹 설정 방법

긴 문서나 문서 구조가 복잡한 경우 청킹 설정을 조정할 수 있습니다.

### 주요 옵션

- `max_tokens_per_chunk`
- `max_overlap_tokens`

### 예시

```python
operation = client.file_search_stores.upload_to_file_search_store(
    file='sample.txt',
    file_search_store_name=file_search_store.name,
    config={
        'display_name': 'sample-doc',
        'chunking_config': {
            'white_space_config': {
                'max_tokens_per_chunk': 200,
                'max_overlap_tokens': 20
            }
        }
    }
)
```

### 운영 팁

- FAQ나 짧은 안내문: 작은 청크가 유리할 수 있음
- 매뉴얼이나 정책 문서: 약간 큰 청크가 유리할 수 있음
- 검색 결과가 지나치게 잘게 쪼개지면 overlap을 늘려봄

---

## 메타데이터 추가와 필터 검색

여러 문서를 한 store에 넣는 경우 메타데이터를 붙이는 것이 좋습니다.

### 문서 등록 시 메타데이터 추가

```python
op = client.file_search_stores.import_file(
    file_search_store_name=file_search_store.name,
    file_name=sample_file.name,
    custom_metadata=[
        {"key": "department", "string_value": "hr"},
        {"key": "year", "numeric_value": 2025}
    ]
)
```

### 검색 시 메타데이터 필터 적용

```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="연차 정책을 알려줘.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[file_search_store.name],
                    metadata_filter='department="hr"'
                )
            )
        ]
    )
)
```

### 권장 메타데이터 예시

- `department`
- `category`
- `owner`
- `version`
- `year`
- `product`

---

## 응답 출처 확인

File Search 응답은 citation 정보를 포함할 수 있습니다.

### 확인 위치

- Python: `response.candidates[0].grounding_metadata`
- JavaScript: `response.candidates?.[0]?.groundingMetadata`

### 활용 방법

- 답변 하단에 출처 문서명 표시
- 관리자 화면에 참조 문서 로그 저장
- 잘못된 검색 결과 분석에 활용

---

## Structured Output과 함께 쓰기

문서 검색 결과를 JSON으로 받고 싶다면 structured output을 함께 사용합니다.

### 예시 목적

- 문서에서 금액 추출
- 문서에서 담당 부서 추출
- 규정 문서에서 정책 항목 구조화

### 예시

```python
from pydantic import BaseModel, Field

class PolicyInfo(BaseModel):
    title: str = Field(description="정책명")
    department: str = Field(description="담당 부서")

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="이 문서에서 정책명과 담당 부서를 찾아줘.",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[file_search_store.name]
                )
            )
        ],
        response_mime_type="application/json",
        response_schema=PolicyInfo.model_json_schema()
    )
)

result = PolicyInfo.model_validate_json(response.text)
print(result)
```

---

## 운영 체크리스트

문서 등록 전에 아래 항목을 확인합니다.

- store 이름 규칙이 정해졌는가
- 문서 분류 기준이 정해졌는가
- 메타데이터 스키마가 정해졌는가
- 문서 크기가 제한 이내인가
- 검색 테스트 질문이 준비되었는가

문서 등록 후에는 아래를 확인합니다.

- 인덱싱이 정상 완료되었는가
- 기대한 문서가 검색되는가
- citation이 정상 출력되는가
- 불필요한 문서가 검색되지 않는가
- 토큰 비용이 과도하지 않은가

---

## 자주 발생하는 운영 이슈

### 1. 검색 품질이 낮음

가능한 원인:

- 청크 크기가 너무 큼
- 문서 구조가 불균일함
- 메타데이터 필터 없이 너무 많은 문서를 함께 검색함
- 질문이 너무 짧거나 모호함

대응 방법:

- 청킹 설정 조정
- store 분리
- 메타데이터 필터 적용
- 질의문 개선

### 2. 관련 없는 문서가 자주 검색됨

가능한 원인:

- 서로 다른 주제 문서를 같은 store에 넣음
- 메타데이터 설계 부족

대응 방법:

- store를 주제별로 분리
- 필수 메타데이터 도입
- 검색 시 필터 사용

### 3. 비용이 예상보다 큼

가능한 원인:

- 문서 수가 많음
- retrieved context가 너무 큼
- 반복 질의가 많음

대응 방법:

- 긴 문서 분리
- 검색 범위 축소
- 메타데이터 필터 활용
- 자주 묻는 결과 캐싱 검토

---

## 제한 사항

- Live API에서는 지원되지 않음
- 다른 일부 도구와 동시에 사용할 수 없음
- 파일당 최대 크기: `100 MB`
- store 총 용량은 사용자 티어에 따라 제한됨
- store 크기는 20GB 이하 유지 권장

---

## 실무 권장 운영 방식

### 권장 1. store는 주제별로 분리

- 인사
- 기술
- 정책
- 고객지원

### 권장 2. 메타데이터는 초기에 설계

- `department`
- `category`
- `owner`
- `version`
- `updated_at`

### 권장 3. PoC는 단순하게 시작

- 먼저 `uploadToFileSearchStore`로 시작
- 이후 필요 시 `files.upload + importFile` 구조로 분리

### 권장 4. 답변에는 출처를 표시

- 사용자 신뢰도 향상
- 운영 분석에 유리

### 권장 5. 성능과 비용을 함께 본다

- 검색 정확도
- 응답 속도
- 입력 토큰 비용
- 인덱싱 비용

---

## 문서 삭제 및 정리

운영 중에는 오래된 문서나 잘못 등록된 문서를 제거해야 합니다.

가능한 작업:

- store 목록 조회
- store 삭제
- store 내부 문서 목록 조회
- 특정 문서 삭제

권장 방식:

- 테스트용 store와 운영용 store 분리
- 버전이 바뀐 문서는 교체 정책 운영
- 정기적으로 오래된 문서 정리

---

## 결론

Gemini `File Search`는 문서를 검색 가능한 지식 저장소로 구성해, 더 정확하고 근거 있는 응답을 만들기 위한 기능입니다.

실무에서는 단순히 파일을 올리는 것보다, 다음 3가지를 먼저 설계하는 것이 중요합니다.

- store 분리 기준
- 메타데이터 기준
- 검색 검증 방식

이 세 가지를 먼저 정하면 File Search를 훨씬 안정적으로 운영할 수 있습니다.
