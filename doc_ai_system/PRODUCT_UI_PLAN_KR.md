# 제품 UI 기획서

이 문서는 관리자 콘솔 구조와 대화 범위 설계를 하나의 제품 관점에서 통합한 기획 문서입니다.

목표는 다음 두 가지입니다.

- `Admin`은 `ChatDOC Studio`의 `Panorama Embedding`와 유사한 운영형 콘솔로 구성
- `Chatbot`은 `Floating Chat Widget`과 유사한 최종 사용자용 인터페이스로 구성

## 1. 제품 구조

제품은 역할이 다른 2개 표면으로 나뉩니다.

### Admin

- 문서 업로드
- 문서 분류
- 인덱싱 상태 확인
- 검색 품질 테스트
- 배포/위젯 설정

### Chatbot

- 고객/사용자 질문 응답
- 제한된 범위에서 문서 검색
- citation과 근거 확인

핵심 원칙은 `업로드 화면`과 `대화 화면`을 한 페이지에 억지로 묶지 않는 것입니다.

## 2. 핵심 개념

### Store

- 가장 큰 지식베이스 단위
- 어떤 문서 묶음을 검색 대상으로 쓸지 결정
- 예: `company-main`, `legal-kb`, `product-docs`

### Category

- 문서 분류용 운영 메타데이터
- 예: `company`, `legal`, `tech`, `hr`
- 독립 챗봇 단위가 아니라 검색 범위를 줄이는 필터 역할

### Selected Documents

- 사용자가 명시적으로 선택한 문서 집합
- 가장 좁은 범위 제어 방식
- 계약 검토, 특정 자료 비교, 근거 확인에 적합

## 3. 대화 범위 모델

대화 범위는 아래 순서로 점진적으로 좁힙니다.

```text
Store
└─ Category Filter
   └─ Selected Documents
```

정리하면:

- `Store` = 어느 지식베이스를 쓸지
- `Category` = 그 안에서 어떤 분류만 볼지
- `Selected Documents` = 정확히 어떤 파일만 볼지

이 범위 제어는 별도 챗봇 인스턴스를 만드는 방식이 아니라, 검색 대상을 제한하는 방식으로 구현합니다.

## 4. Admin 정보 구조

- `Overview`
- `Knowledge Base`
- `Documents`
- `Categories`
- `Indexing`
- `Playground`
- `Deployment`
- `Widget`
- `Analytics`
- `Settings`

## 5. Admin 메인 구조

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                      │
│ Logo | Workspace | Global Search | Alerts | Help | Admin Avatar             │
├──────────────┬──────────────────────────────────────────────┬────────────────┤
│ Left Nav     │ Main Workspace                               │ Right Panel    │
│              │                                              │                │
│ Overview     │ Page: Knowledge Base                         │ Selected Item  │
│ Knowledge Base│ [Upload] [New Collection] [New Category]    │                │
│ Documents    │ [Sync] [Export]                              │ Document Info  │
│ Categories   │                                              │ - name         │
│ Indexing     │ Stats                                         │ - category     │
│ Playground   │ [124 docs] [7 pending] [3 failed] [5 cats]   │ - state        │
│ Deployment   │                                              │ - metadata     │
│ Widget       │ Filters                                      │                │
│ Analytics    │ [Store] [Category] [State] [Search]          │ Chunk Preview  │
│ Settings     │                                              │ - chunk 1      │
│              │ Category Tabs                                │ - chunk 2      │
│              │ [All] [Company] [Legal] [Tech] [HR]          │                │
│              │                                              │ Actions        │
│              │ Document Table                               │ [Reindex]      │
│              │ Name | Category | State | Updated | Actions  │ [Delete]       │
│              │                                              │ [Open source]  │
│              │ Bottom Area                                  │                │
│              │ Upload Queue | Failed Jobs | Recent Activity │                │
├──────────────┴──────────────────────────────────────────────┴────────────────┤
│ Footer: API status | Last sync | Storage usage | Build version               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 6. Admin 화면별 역할

### Overview

- 전체 문서 수, 카테고리 수, 인덱싱 대기/실패 현황 요약
- 최근 업로드 문서와 오류 로그 제공

### Knowledge Base

- 문서 운영의 중심 화면
- 업로드, 컬렉션, 카테고리, 필터, 문서 리스트를 통합 제공

### Documents

- 문서 테이블 중심 운영 화면
- 이름, 카테고리, 상태, 업로드일, 파일형식, 액션 관리

### Categories

- 분류 체계 관리 전용 화면
- 카테고리 생성, 설명, 적용 문서 수, 운영 규칙 관리

### Playground

- 검색 품질과 대화 범위를 테스트하는 화면
- Store/Category/Selected Documents를 조합해 응답 품질 점검

### Widget

- 최종 사용자용 챗봇 설정 화면
- 브랜드, 기본 스토어, 검색 정책, 추천 질문, 스타일 설정

## 7. Categories 화면 설계

카테고리는 대화 채널이 아니라 운영 분류 체계입니다.

### 역할

- 업로드 시 문서 분류
- 문서 목록 필터
- Playground 테스트 필터
- 위젯 검색 정책의 보조 기준

### 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Categories                                                           │
│ [New Category] [Import Rules] [Save Defaults]                        │
├──────────────────────────────────────────────────────────────────────┤
│ Summary Cards                                                        │
│ [5 categories] [124 docs mapped] [2 uncategorized] [1 hidden]        │
├──────────────────────────────────────────────────────────────────────┤
│ Category Table                                                       │
│ Name     | Docs | Search Filterable | Default Label | Updated | ... │
│ company  | 42   | yes               | yes           | today   |     │
│ legal    | 31   | yes               | yes           | today   |     │
│ tech     | 28   | yes               | yes           | 1d ago  |     │
│ hr       | 14   | yes               | no            | 3d ago  |     │
├──────────────────────────────────────────────────────────────────────┤
│ Side Detail                                                          │
│ - Description                                                        │
│ - Sample documents                                                   │
│ - Search usage                                                       │
│ - Filter behavior                                                    │
│ - Actions: edit / archive / view docs                               │
└──────────────────────────────────────────────────────────────────────┘
```

## 8. 대화 범위 UI 설계

현재 제품에서 가장 중요한 범위 제어 UI는 아래 3가지입니다.

### 1단계. Store 선택

- 관리자용 Playground에서는 명시적으로 노출
- 사용자용 위젯에서는 기본적으로 숨김 또는 고정
- 의미: 어떤 지식베이스를 쓸지 선택

### 2단계. Category 필터

- 관리자 화면에서는 적극 노출
- 사용자 위젯에서는 필요 시만 단순 주제 선택 형태로 노출
- 의미: 카테고리와 대화하는 것이 아니라, 해당 카테고리 문서만 검색 대상으로 제한

### 3단계. Selected Documents

- 관리자 또는 whole-page chat에서만 지원 권장
- floating widget에는 기본적으로 넣지 않음
- 의미: 특정 파일만 근거로 답변 받도록 제한

## 9. 범위 제어 UI 배치

### Admin / Playground 필터 바

```text
[모델 선택] [스토어 선택] [카테고리 필터] [선택 문서만] [범위 초기화]
```

### 입력창 상단 범위 배지

예시:

- `지식베이스: 회사 문서`
- `카테고리: 법률/규정`
- `선택 문서 2개 기준`

배지는 개별 해제가 가능해야 합니다.

## 10. Chatbot 구조

최종 사용자용 챗봇은 `Floating Chat Widget` 계열을 기준으로 구성합니다.

### 기본 구조

- 플로팅 버튼
- 확장 시 채팅 패널 오픈
- 헤더
- 추천 질문
- 메시지 영역
- 출처 카드
- 입력창

### 범위 노출 원칙

- Store는 숨김 또는 고정
- Category는 필요 시만 노출
- Selected Documents는 기본적으로 비노출

즉, 일반 사용자에게는 복잡한 범위 제어보다 단순하고 신뢰감 있는 대화 경험을 우선합니다.

## 11. 구현 매핑

현재 코드 기준 핵심 연결 지점은 다음과 같습니다.

- Worker 채팅 처리: `_worker.js:54`
- 업로드/관리형 채팅 요청: `doc_ai_system/app/static/script.js:232`
- 위젯형 채팅 요청: `doc_ai_system/app/static/chat.js:171`

### 현재 가능한 범위 제어

- 기본 스토어 1개 자동 선택
- 카테고리 기반 `metadata_filter`

### 다음 단계 구현

- `store` 파라미터 지원
- 범위 배지 UI 추가
- 문서 선택 상태 관리 추가
- 필요 시 `/api/chat` POST 전환 검토

## 12. 단계별 로드맵

### 1단계

- Admin 화면을 운영형 구조로 개편
- 카테고리를 분류/필터 개념으로 명확화
- Playground에 Store/Category 범위 제어 추가
- 범위 배지 UI 추가

### 2단계

- Categories 전용 관리 화면 고도화
- Widget 설정에 검색 정책 반영
- 문서 선택 기반 범위 제한 UI 도입

### 3단계

- 선택 문서 기반 대화 범위 정밀화
- Analytics에서 범위별 사용량 분석
- 위젯/전체화면 채팅별 범위 정책 분화

## 13. UX 문구 원칙

좋은 표현:

- `선택한 범위의 문서만 검색합니다`
- `현재 질문 범위: 법률/규정`
- `선택한 2개 문서 기준으로 답변 중`

피해야 할 표현:

- `legal 챗봇`
- `카테고리와 대화 중`

## 결론

이 제품의 핵심은 `업로드 + 채팅`을 한 화면에 나열하는 것이 아니라, 아래처럼 역할과 범위를 분리하는 것입니다.

- `Admin` = 지식베이스를 운영하는 콘솔
- `Chatbot` = 그 지식베이스를 사용하는 사용자 인터페이스
- `대화 범위` = Store, Category, Selected Documents로 점진적으로 제한되는 검색 정책

이 구조로 정리하면 관리자 경험과 사용자 경험 모두 훨씬 자연스럽고 확장 가능하게 설계할 수 있습니다.
