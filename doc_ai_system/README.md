# doc_ai_system 문서 안내

## 개요

이 디렉터리는 Gemini `File Search` 기능을 이해하고, 실제로 적용하고, 운영하기 위한 한국어 문서를 모아둔 공간입니다.

---

## 문서 목록

### 1. 기능 설명 문서

- [`File_Search_KR.md`](./File_Search_KR.md)
- 목적: Gemini File Search의 개념, 구조, 제한 사항, 과금 체계를 이해하기 위한 설명 문서
- 추천 대상: 기획자, 개발자, 아키텍트, 기술 검토자

### 2. 실무 사용 매뉴얼

- [`File_Search_Manual_KR.md`](./File_Search_Manual_KR.md)
- 목적: File Search를 실제로 사용하는 절차를 단계별로 따라할 수 있는 작업 매뉴얼
- 포함 내용: store 생성, 파일 업로드, 질의, 청킹, 메타데이터, structured output, 운영 체크리스트
- 추천 대상: 개발자, PoC 담당자, 구현 담당자

### 3. 운영 가이드

- [`File_Search_Operations_Guide_KR.md`](./File_Search_Operations_Guide_KR.md)
- 목적: 운영 환경에서 File Search를 안정적으로 관리하기 위한 짧은 가이드
- 포함 내용: store 분리 기준, 메타데이터 표준, 문서 등록/개정/삭제 절차, 비용 및 품질 관리
- 추천 대상: 운영 담당자, 플랫폼 담당자, 문서 관리자

### 4. 원문 참고 문서

- [`File_Search.md`](./File_Search.md)
- 목적: Gemini File Search 공식 원문 기반 참고 자료
- 추천 대상: API 세부 스펙 확인이 필요한 개발자

---

## 권장 읽기 순서

### 개념부터 이해하고 싶은 경우

1. `File_Search_KR.md`
2. `File_Search_Manual_KR.md`
3. `File_Search_Operations_Guide_KR.md`

### 바로 구현하고 싶은 경우

1. `File_Search_Manual_KR.md`
2. `File_Search_KR.md`
3. `File_Search.md`

### 운영 기준만 빠르게 보고 싶은 경우

1. `File_Search_Operations_Guide_KR.md`

---

## 문서 용도 구분

- `File_Search_KR.md`: 무엇인지 이해하는 문서
- `File_Search_Manual_KR.md`: 어떻게 쓰는지 따라하는 문서
- `File_Search_Operations_Guide_KR.md`: 어떻게 관리할지 정하는 문서
- `File_Search.md`: 원문 스펙 확인 문서

---

## 추천 활용 방식

- PoC 시작 전: `File_Search_KR.md` 확인
- 개발 착수 시: `File_Search_Manual_KR.md` 기준으로 구현
- 운영 전환 시: `File_Search_Operations_Guide_KR.md` 기준으로 표준화
- 세부 API 확인 시: `File_Search.md` 참고

---

## 문서 구성 요약

현재 문서 세트는 아래 3단계 흐름으로 구성되어 있습니다.

1. 개념 이해
2. 구현 절차 수행
3. 운영 기준 정리

이 순서대로 보면 File Search를 도입할 때 필요한 주요 정보를 빠르게 파악할 수 있습니다.
