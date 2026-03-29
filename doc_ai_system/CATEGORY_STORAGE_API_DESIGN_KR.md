# 카테고리 서버 저장 API 설계안

이 문서는 현재 프론트엔드 `localStorage` 기반 카테고리 정의를 서버 공용 저장 방식으로 확장하기 위한 설계안입니다.

중요: 이 설계는 `문서의 category 메타데이터`를 없애거나 대체하려는 것이 아닙니다. 문서의 실제 카테고리 값은 계속 Gemini File Search `customMetadata.category`에 저장하고, 여기서 추가하는 서버 저장소는 `카테고리 정의 목록(라벨, 설명, 색상, 정렬 등)`을 관리하기 위한 것입니다.

기준 환경은 현재 프로젝트의 Cloudflare Worker 구조이며, 공용 저장소는 `Cloudflare D1`을 권장합니다.

## 목표

- 브라우저별이 아닌 서버 공용 카테고리 목록 제공
- 관리자 화면의 카테고리 생성/수정/삭제를 모든 사용자에게 일관되게 반영
- 문서의 기존 `category` metadata와 자연스럽게 연결
- 추후 `스토어별 카테고리`, `위젯별 허용 카테고리`, `정렬/노출 정책`까지 확장 가능하게 설계

## 현재 상태

- 문서 자체의 카테고리는 업로드 시 Gemini File Search metadata에 저장됨
- 카테고리 정의 목록은 아직 서버 저장소가 없음
- 현재 관리자 화면의 새 카테고리 생성은 `localStorage`에만 저장됨

즉 지금은:

- `문서 분류값`은 서버 측 문서 metadata에 있음
- `카테고리 정의 사전`은 브라우저 로컬에만 있음

이 둘은 역할이 다르므로 분리해서 관리해야 합니다.

## 먼저 구분할 개념

### 1. 문서 category 메타데이터

- 각 문서가 실제로 어떤 카테고리에 속하는지 나타내는 값
- 예: `legal`, `tech`, `company`
- 현재도 업로드 시 Gemini File Search `customMetadata.category`에 저장됨
- 검색 필터와 문서 목록은 이 값을 기준으로 동작

### 2. 카테고리 정의 목록

- 위 category 값이 화면에서 어떻게 보일지 정하는 사전
- 예: `legal` -> 라벨 `법무`, 설명 `계약/규정 문서`, 색상 `#c084fc`, 정렬순서 `20`
- 현재는 브라우저 `localStorage`에만 있음
- 이 문서에서 제안하는 D1 저장은 바로 이 영역을 위한 것

## 권장 아키텍처

### 1. 문서 metadata

- 계속 Gemini File Search `customMetadata.category` 사용
- 문서 업로드/조회/검색 필터에 그대로 활용

### 2. 카테고리 정의 저장소

- `D1`에 별도 테이블로 저장
- 관리자 화면은 이 목록을 읽어 셀렉트/카드/정책 UI 구성

### 3. 연결 방식

- 업로드 시 선택한 카테고리 값은 D1에 존재하는 category slug 중 하나를 사용
- 문서 목록은 metadata의 category를 보여줌
- 관리자 카테고리 화면은 D1 목록 + 실제 문서 사용량을 조합해 보여줌

## D1 스키마 제안

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_active_sort
ON categories(is_active, sort_order, label);

PRAGMA optimize;
```

## 필드 정의

- `slug`: 시스템 식별자, 예: `legal`, `tech`, `company`
- `label`: UI 표시 이름, 예: `법무`, `기술`, `회사소개`
- `description`: 운영 설명
- `color`: 카테고리 배지/점 색상
- `sort_order`: UI 표시 순서
- `is_active`: 비활성화 여부
- `is_builtin`: 시스템 기본 카테고리 여부

## API 제안

### `GET /api/categories`

목적:

- 카테고리 목록 조회
- 관리자 화면과 업로드 셀렉트에서 사용

응답 예시:

```json
[
  {
    "slug": "company",
    "label": "회사소개",
    "description": "회사 소개, 연혁, 조직 정보 분류",
    "color": "#7dd3fc",
    "sort_order": 10,
    "is_active": true,
    "is_builtin": true
  }
]
```

### `POST /api/categories`

목적:

- 새 카테고리 생성

요청 예시:

```json
{
  "slug": "customer-support",
  "label": "고객지원",
  "description": "FAQ, 응대 가이드, 문의 대응 문서",
  "color": "#f59e0b"
}
```

검증 규칙:

- `slug`는 영문/숫자/하이픈 기준 권장
- `label`은 필수
- 중복 slug 금지

### `PATCH /api/categories/{slug}`

목적:

- 라벨, 설명, 색상, 정렬 순서, 활성 여부 수정

요청 예시:

```json
{
  "label": "법률/규정",
  "description": "계약 및 규정 문서 분류",
  "sort_order": 20,
  "is_active": true
}
```

### `DELETE /api/categories/{slug}`

목적:

- 카테고리 정의 삭제 또는 비활성화

권장 정책:

- 실제 삭제보다 `is_active = 0` 비활성화를 우선 권장
- 이미 문서에서 사용 중인 카테고리는 hard delete 금지 권장

응답 예시:

```json
{
  "status": "disabled",
  "slug": "customer-support"
}
```

## 문서 metadata와의 관계

중요한 점:

- D1의 `categories` 테이블은 `카테고리 정의 목록`
- Gemini 문서 metadata의 `category`는 `실제 문서 분류값`

즉:

- 카테고리 이름/설명/정렬/색은 D1에서 관리
- 각 문서가 어느 카테고리인지 여부는 File Search metadata에서 유지

예를 들면:

- 문서 A metadata: `category = "legal"`
- D1 categories row: `slug = "legal", label = "법무", color = "#c084fc"`

이 둘이 합쳐져서 UI에서는 `법무` 배지로 보이게 됩니다.

## 문서 카테고리 변경 문제

현재 공개 Gemini File Search API에는 기존 문서 metadata patch API가 없으므로,
문서의 category 값을 사후 변경하는 것은 별도 운영 전략이 필요합니다.

권장 정책:

- `카테고리 정의 수정`은 D1에서 자유롭게 가능
- `문서 category 변경`은 현재는 재업로드 또는 재등록 플로우로 처리

즉 이 API 설계는 `카테고리 사전 관리`를 위한 것이고,
문서 metadata 자체를 직접 수정하는 API와는 별개입니다.

## Worker 구현 개요

### Env

```ts
type Env = {
  GOOGLE_API_KEY: string;
  DB: D1Database;
};
```

### wrangler 설정 예시

```toml
[[d1_databases]]
binding = "DB"
database_name = "wrsoft-admin"
database_id = "<production-db-id>"
preview_database_id = "wrsoft-admin-preview"
```

## 라우트 제안

- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:slug`
- `DELETE /api/categories/:slug`

기존 라우트와의 관계:

- `/api/files`는 계속 문서 metadata 기준
- `/api/chat`는 계속 `category` 필터 기준
- `/api/categories`는 관리자용 정의 목록 제공

## 프론트엔드 연결 방식

### 관리자 화면

- 페이지 진입 시 `GET /api/categories`
- 업로드 셀렉트와 필터 셀렉트를 서버 목록으로 채움
- `New Category`는 `POST /api/categories` 호출
- 카테고리 편집 UI는 `PATCH /api/categories/:slug`

### 사용자 챗봇 화면

- 필요 시 `GET /api/categories`로 노출 가능한 카테고리만 가져옴
- 단순 주제 선택용으로 사용 가능

## 권한 정책

권장:

- `GET /api/categories`는 공개 가능 또는 읽기 허용
- `POST/PATCH/DELETE /api/categories`는 관리자 권한 필요

현재 프로젝트에 인증 체계가 없으므로, 구현 시 최소한 아래 중 하나가 필요합니다.

- 관리자 비밀키 헤더
- Cloudflare Access
- 별도 관리자 세션 인증

## 마이그레이션/시드 권장안

초기 기본 카테고리는 migration 또는 seed SQL로 넣는 것을 권장합니다.

```sql
INSERT INTO categories (slug, label, description, color, sort_order, is_active, is_builtin, created_at, updated_at)
VALUES
  ('company', '회사소개', '회사 소개, 연혁, 조직 정보 분류', '#7dd3fc', 10, 1, 1, unixepoch(), unixepoch()),
  ('legal', '법무', '계약, 규정, 준법 문서 분류', '#c084fc', 20, 1, 1, unixepoch(), unixepoch()),
  ('tech', '기술', '제품 문서, API, 운영 가이드 분류', '#4ade80', 30, 1, 1, unixepoch(), unixepoch()),
  ('hr', '인사', '복지, 인사 정책, 채용 자료 분류', '#facc15', 40, 1, 1, unixepoch(), unixepoch());
```

## 단계별 도입안

### 1단계

- D1 추가
- `categories` 테이블 생성
- `GET /api/categories` + `POST /api/categories` 구현
- 프론트의 `localStorage` fallback 제거 또는 보조 fallback으로 축소

### 2단계

- `PATCH /api/categories/:slug`
- `DELETE` 대신 soft delete 지원
- 정렬/색상/활성 여부 UI 반영

### 3단계

- 스토어별 카테고리 지원 필요 시 `store_name` 컬럼 추가
- 위젯별 허용 카테고리 정책 테이블 추가 가능

## 결론

가장 좋은 확장 방향은 `문서의 category metadata`와 `카테고리 정의 목록`을 분리하는 것입니다.

- 문서 분류값: Gemini File Search metadata 유지
- 카테고리 사전: Cloudflare D1 저장

이렇게 하면 현재 구조를 크게 깨지 않고도,
관리자 공용 카테고리 관리 기능을 안정적으로 확장할 수 있습니다.
