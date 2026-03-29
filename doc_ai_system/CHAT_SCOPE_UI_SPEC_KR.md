# 대화 범위 UI 구현 스펙

이 문서는 현재 코드베이스를 기준으로 `대화 범위` UI를 어떻게 구현할지 정리한 스펙입니다.

기준 코드:

- Worker 채팅 API: `_worker.js:51`
- 업로드/관리형 화면 스크립트: `doc_ai_system/app/static/script.js:232`
- 챗봇형 화면 스크립트: `doc_ai_system/app/static/chat.js:170`

## 현재 상태

현재는 `카테고리` 1단계만 UI로 노출되어 있습니다.

- 업로드 시 카테고리 저장: `doc_ai_system/app/static/script.js:187`
- 채팅 시 카테고리 쿼리 전달: `doc_ai_system/app/static/script.js:245`
- 챗봇 화면도 카테고리 전달: `doc_ai_system/app/static/chat.js:194`
- Worker는 `metadata_filter`로 카테고리 범위 제한: `_worker.js:69`

즉, 현재 대화 범위는 사실상 아래 한 단계입니다.

- 기본 스토어 1개 고정
- 선택 카테고리로만 범위 제한
- 선택 문서 범위는 없음

## 목표 구조

대화 범위를 다음 3단계로 확장합니다.

- `스토어`: 어떤 지식베이스를 쓸지
- `카테고리`: 어떤 분류의 문서를 볼지
- `선택 문서`: 어떤 파일만 볼지

## 1. 스토어 범위 UI

### 목적

- 관리자용 Playground 또는 Admin 콘솔에서 여러 지식베이스를 전환
- 일반 사용자 위젯에서는 기본적으로 숨김 또는 고정

### 현재 코드 기준 제약

- Worker는 현재 첫 번째 스토어를 자동 선택합니다: `_worker.js:41`
- 프론트엔드에서 스토어를 전달하는 파라미터가 아직 없음

### 제안 UI

#### Admin / Playground

- 위치: 모델 선택 옆 또는 상단 필터 바
- 컴포넌트: `select`
- id 예시: `scope-store`

옵션 예시:

- `전체 운영 스토어`
- `회사 문서`
- `법률 문서`
- `기술 문서`

#### Chat Widget

- 기본적으로 노출하지 않음
- 위젯 설정 화면에서 고정값으로 설정

### 전송 규칙

- 채팅 요청에 `store` 쿼리 추가
- 예: `/api/chat?...&store=fileSearchStores/company-main`

### 백엔드 변경점

- `_worker.js:55` 부근에서 `store` 파라미터 읽기
- `getStoreName(env)` 자동 선택 대신
  - `store`가 있으면 우선 사용
  - 없으면 기존 기본 스토어 사용

## 2. 카테고리 범위 UI

### 목적

- 현재 기능을 유지하되 더 명확한 범위 제어 UI로 개선
- 카테고리를 `대화방`처럼 보이게 하지 않고 `검색 필터`로 표현

### 현재 구현

- `filter-category` 셀렉트 사용
- 문서 목록과 채팅 요청에 같은 카테고리 값을 공유

### 제안 UI

#### Admin / Main Chat

- 기존 `filter-category` 유지
- 라벨 변경: `카테고리`보다 `질문 범위` 또는 `문서 분류 필터`
- select 아래 보조 문구 추가:
  - `선택한 카테고리 문서만 검색합니다`

#### Chat Widget

- 기본형: 숨김
- 확장형: 추천 칩 또는 드롭다운으로 제공
- 예:
  - `전체`
  - `회사소개`
  - `법률/규정`
  - `기술지원`

### 전송 규칙

- 기존과 동일하게 `category` 쿼리 사용
- 예: `/api/chat?...&category=legal`

### 백엔드 변경점

- 현재 구현 유지 가능: `_worker.js:69`
- 별도 API 변경 없이 적용 가능

## 3. 선택 문서 범위 UI

### 목적

- 사용자가 특정 문서만 근거로 답변 받도록 제한
- 계약 검토, 규정 비교, 특정 자료 기반 요약에 유용

### 현재 코드 기준 제약

- 문서 목록은 단순 리스트이며 선택 상태가 없음
- `/api/chat`은 문서 id 목록을 받지 않음
- Worker는 문서 단위 필터를 처리하지 않음

### 제안 UI

#### Admin / Main Chat

- 문서 목록 각 항목에 체크박스 추가
- 상단에 `선택 문서만 대상으로 답변` 토글 추가
- 선택된 문서는 입력창 위에 chip으로 표시

예시:

- `발표본_V1_원본.pdf x`
- `용역계약현황.xlsx x`

#### Chat Widget

- 일반 floating widget에서는 미지원 권장
- whole-page chat 또는 fixed chatbox에서만 지원 권장

### 상태 관리

프론트엔드 상태 예시:

```js
{
  store: '',
  category: 'legal',
  selectedDocuments: [
    'fileSearchStores/store/documents/doc-1',
    'fileSearchStores/store/documents/doc-2'
  ],
  documentScopeEnabled: true
}
```

### 전송 규칙

쿼리스트링보다 POST JSON이 적합합니다.

예시:

```json
{
  "query": "이 계약서의 해지 조항을 요약해줘",
  "model": "gemini-2.5-flash-lite",
  "store": "fileSearchStores/company-main",
  "category": "legal",
  "document_names": [
    "fileSearchStores/company-main/documents/doc-1",
    "fileSearchStores/company-main/documents/doc-2"
  ]
}
```

### 백엔드 변경 방향

선택 문서 범위는 현재 API만으로는 바로 안 되는 부분이 있어서 제품 설계가 필요합니다.

권장 순서:

- 1안: 문서별 고유 메타데이터를 추가하고 필터로 제한
- 2안: 선택 문서 이름 배열을 Worker가 받아, 별도 질의 전략으로 처리
- 3안: 선택 문서 전용 임시 스코프를 세션으로 유지

현재 코드 기준 현실적인 방향은 `1안`입니다.

## UI 레이아웃 스펙

### 관리자/메인 화면 필터 바

권장 구성:

```text
[모델 선택] [스토어 선택] [카테고리 필터] [선택 문서만] [범위 초기화]
```

동작 규칙:

- 스토어를 바꾸면 문서 목록 재조회
- 카테고리를 바꾸면 문서 목록 재조회
- 선택 문서가 있으면 범위 배지 노출
- `범위 초기화` 클릭 시 스토어 기본값 제외 모두 초기화

### 입력창 상단 범위 배지

예시:

- `지식베이스: 회사 문서`
- `카테고리: 법률/규정`
- `선택 문서 2개 기준`

배지는 읽기 전용이 아니라 개별 해제 가능해야 합니다.

## 현재 파일별 변경 포인트

### `doc_ai_system/app/static/script.js`

추가할 항목:

- 스토어 셀렉트 상태 읽기
- 선택 문서 상태 배열 관리
- `/api/chat` 호출을 GET에서 POST로 확장 검토
- 범위 배지 렌더링 함수 추가

수정 대상 함수:

- `loadFiles()`
- `sendMessage()`
- 문서 렌더링 블록

### `doc_ai_system/app/static/chat.js`

추가할 항목:

- 위젯용 단순 범위 표시
- 카테고리 선택 시 현재 범위 안내 문구 반영
- 필요 시 추천칩 클릭 시 범위 배지 자동 생성

수정 대상 함수:

- `loadFiles()`
- `sendMessage()`
- welcome/suggestion chip 처리부

### `_worker.js`

추가할 항목:

- `store` 파라미터 지원
- 필요 시 POST body 기반 `/api/chat` 지원
- 향후 `document_names` 처리 구조 확장

수정 대상 함수:

- `handleChat()`
- `getStoreName()` 또는 보조 store resolver 함수

## 단계별 구현 권장안

### 1단계

- 스토어 선택 UI 추가
- 카테고리 라벨/설명 개선
- 입력창 위 범위 배지 추가

이 단계는 API 변경이 작고 효과가 큽니다.

### 2단계

- 문서 목록 선택 UI 추가
- 선택 문서 상태 관리 추가
- 메인 화면에서만 `선택 문서만 답변` 토글 제공

### 3단계

- `/api/chat` POST 지원
- `document_names` 또는 문서 기반 필터 설계 반영
- Playground와 Admin에 정밀 범위 테스트 기능 추가

## 사용자 문구 가이드

좋은 문구:

- `선택한 범위의 문서만 검색합니다`
- `현재 질문 범위: 법률/규정`
- `선택한 2개 문서 기준으로 답변 중`

피해야 할 문구:

- `legal 챗봇`
- `카테고리와 대화 중`

## 결론

현재 코드 기준으로 가장 먼저 도입할 만한 것은 아래 3가지입니다.

- 스토어 선택 UI
- 카테고리 필터를 범위 제어 UI로 명확화
- 입력창 상단 범위 배지 추가

선택 문서 범위는 가장 강력하지만, 현재 API와 UI 구조상 2차 단계로 도입하는 것이 현실적입니다.
