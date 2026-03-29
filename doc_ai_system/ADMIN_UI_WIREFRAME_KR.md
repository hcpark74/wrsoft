# 관리자 UI 와이어프레임 제안서

이 문서는 `ChatDOC Studio`의 `Panorama Embedding` 계열 구조를 참고해, 현재의 `좌측 업로드 / 우측 채팅` 화면을 운영형 관리자 콘솔로 재구성하기 위한 제안서입니다.

## 목표

- 업로드 도구가 아닌 `지식베이스 운영 콘솔`처럼 보이게 구성
- 문서, 카테고리, 인덱싱 상태, 검색 품질을 한 흐름에서 관리
- 챗봇 사용자 화면과 관리자 화면의 역할을 명확히 분리

## 제품 구조

- `Admin`: 문서 업로드, 분류, 인덱싱, 검색 테스트, 배포 설정 담당
- `Chatbot`: 최종 사용자용 `Floating Chat Widget` 담당

즉, 관리자는 운영 콘솔에서 지식베이스를 만들고, 사용자는 별도의 임베디드 위젯에서 질문합니다.

## 관리자 정보 구조

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

## 핵심 개념

### 1. Collections

- 회사/서비스/프로젝트 단위의 지식 저장소
- 예: `회사정책`, `법률/규정`, `기술문서`, `고객지원`

### 2. Categories

- 문서를 실무 기준으로 분류하는 운영 태그
- 예: `company`, `legal`, `tech`, `hr`, `sales`
- 업로드 시 선택 가능하고, 목록/운영/검색 필터에 활용
- 카테고리 자체가 독립적인 대화방이나 별도 챗봇 단위는 아님
- 컬렉션과 달리 더 가볍고 빠른 운영용 분류 축으로 사용

### 3. Documents

- 실제 업로드된 파일 단위 자산
- 이름, 카테고리, 메타데이터, 인덱싱 상태, 업로드 시간 관리

## 메인 와이어프레임

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
│ Analytics    │ [Collection] [Category] [State] [Search]     │ Chunk Preview  │
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

## 화면별 역할

### Overview

- 전체 문서 수, 카테고리 수, 인덱싱 대기/실패 현황 요약
- 최근 업로드 문서와 최근 오류 로그 노출
- 운영자가 매일 들어와 상태를 확인하는 홈 화면

### Knowledge Base

- 컬렉션과 카테고리를 함께 보며 문서를 운영하는 핵심 화면
- 상단 액션: `Upload`, `New Collection`, `New Category`, `Sync`
- 중앙: 문서 테이블
- 우측: 선택 문서 상세, 메타데이터, 청크 미리보기

### Documents

- 전체 문서를 테이블 중심으로 관리
- 주요 컬럼: `이름`, `카테고리`, `상태`, `업로드일`, `파일형식`, `액션`
- 다중 선택 후 일괄 삭제, 재색인, 카테고리 필터 지원

### Categories

- 카테고리 생성, 수정, 사용량 확인을 위한 전용 화면
- 주요 컬럼: `카테고리명`, `문서 수`, `최근 업데이트`, `설명`, `상태`
- 추천 액션:
  - `새 카테고리 추가`
  - `문서 보기`
  - `기본 분류 규칙 연결`
  - `운영 필터로 사용`

## 카테고리 운영 설계

카테고리는 단순 라벨이 아니라, 문서 운영과 검색 제어를 위한 1차 분류 체계로 다룹니다. 다만 카테고리 자체가 독립적인 대화 채널을 의미하지는 않습니다.

### 카테고리 예시

- `company`: 회사소개, 조직, 일반 사내 정보
- `legal`: 법률, 규정, 계약, 준법 문서
- `tech`: 개발문서, 제품문서, API, 운영가이드
- `hr`: 인사, 복지, 평가, 채용
- `sales`: 제안서, 상품 소개, 영업 자료

### 카테고리 UI 규칙

- 문서 업로드 시 카테고리 선택은 필수 또는 강한 권장
- 문서 목록 상단에 카테고리 탭/필터 제공
- 검색 Playground에서 카테고리 필터별 응답 테스트 가능
- 카테고리는 문서 분류와 검색 범위 제한용으로 사용

### 카테고리와 대화 범위의 관계

- 카테고리 = 문서 분류 기준
- 컬렉션 = 더 큰 지식 저장소 단위
- 실제 대화 범위는 요청 시 적용하는 검색 필터로 제한 가능
- 즉 `legal 카테고리와 대화한다`기보다 `legal 카테고리 문서만 검색 대상으로 제한한다`가 더 정확한 표현
- 위젯에서 특정 카테고리만 허용하는 UX는 가능하지만, 내부적으로는 카테고리 메타데이터 필터를 거는 방식

### 카테고리 화면 와이어프레임

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

## Playground 화면

- 운영자가 실제 검색 품질을 시험하는 공간
- 상단 제어:
  - 컬렉션 선택
  - 카테고리 필터
  - 모델 선택
  - 검색 옵션 선택
- 중앙: 질문/응답
- 우측: citation, retrieved chunks, 점수, 선택 문서

이 화면에서 `category=legal` 같은 필터를 걸었을 때 응답 품질이 어떻게 달라지는지 바로 테스트할 수 있어야 합니다.

## Widget 설정 화면

- 고객용 `Floating Chat Widget`을 설정하는 화면
- 주요 설정:
  - 브랜드명
  - 대표 인사말
  - 추천 질문
  - 기본 컬렉션
  - 색상/로고/톤앤매너
  - 선택적 검색 필터 정책

즉, 관리자는 여기서 위젯이 어떤 컬렉션을 기본으로 사용할지, 그리고 필요할 때 어떤 검색 필터를 적용할지 결정합니다.

## 권장 UX 원칙

- 업로드는 독립 패널이 아니라 상단 액션으로 축소
- 문서 운영의 기본 뷰는 카드보다 테이블 우선
- 카테고리는 업로드 보조값이 아니라 운영/검색 필터로 노출
- 채팅 테스트는 관리자 홈이 아니라 `Playground`로 분리
- 오류와 인덱싱 실패는 하단 운영 패널에서 빠르게 재처리 가능해야 함

## 구현 우선순위

### 1단계

- `Knowledge Base` 화면 개편
- 문서 테이블 도입
- 카테고리 필터/탭 추가
- 우측 문서 상세 패널 추가

### 2단계

- `Categories` 전용 화면 추가
- 카테고리 생성/분류 규칙 관리
- Playground에서 카테고리 필터 테스트 추가

### 3단계

- Widget 설정 화면 고도화
- 컬렉션 및 검색 필터 정책 제어
- Analytics에서 카테고리별 질의량 확인

## 결론

가장 중요한 변화는 현재의 `좌측 업로드 / 우측 채팅` 구조를 버리고, `문서 + 카테고리 + 인덱싱 + 검색 테스트` 중심의 관리자 콘솔로 바꾸는 것입니다.

특히 카테고리를 별도 화면과 운영 축으로 분리하면, 단순 업로드 UI가 아니라 실제 서비스형 문서 운영 제품에 가까운 구조가 됩니다.
