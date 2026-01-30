# CSS 리팩토링 및 파일 분리 가이드 (원복 및 재수행 과정)

기존의 통합된 `style.css`에서 발생하던 디자인 불일치 문제를 해결하기 위해, 현재까지의 작업을 원복하고 보다 정교한 방식으로 CSS를 재분리하는 과정을 기술합니다.

## 1. 개요 및 실패 원인 분석
기존의 `style.css`는 모든 스타일과 반응형 코드가 섞여 있어 유지보수가 어려웠습니다. 이를 분리하는 과정에서 다음과 같은 원인으로 디자인 불일치가 발생했습니다.
- **스타일 우선순위(Specificity) 충돌**: 분리된 새 CSS 파일과 기존 `style.css`가 동시에 로드되면서, 의도치 않은 스타일 덮어쓰기가 발생했습니다.
- **상속 및 공통 스타일 누락**: 문서 전체에 영향을 주던 태그 기반 스타일이나 `line-height` 등의 세밀한 속성이 분리된 파일에 완벽히 전이되지 않았습니다.

---

## 2. 1단계: 작업 원복 (Rollback)
먼저 현재 분리된 CSS 파일로 인해 변경된 디자인을 원래 상태로 되돌립니다. 이 작업은 **메인 페이지와 모든 서브 페이지**에 공통으로 적용됩니다.

1.  **HTML 파일 원복 (Main & Sub Pages)**
    *   `index.html` 및 `/sub/*.html` 파일에서 분리된 CSS 링크(`global.css`, `header-footer.css` 등)를 삭제하고 다시 `style.css` 하나만 참조하도록 수정합니다.
    ```html
    <!-- 수정 후 (원복 상태) -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 나머지 분리 파일 링크는 삭제 -->
    ```

2.  **Git을 이용한 원본 소스 복구**
    *   `git checkout css/style.css`를 실행하여 리팩토링 과정에서 수정된 원본 파일을 깨끗한 초기 상태로 되돌립니다.

---

## 3. 서브 페이지 작업 방식 (Sub-page Strategy)
서브 페이지(`business.html`, `solution.html` 등)는 메인 페이지와 별도로 관리되는 전용 CSS를 가지고 있습니다.
*   **공통 관리**: 헤더, 푸터, 커서, TOP 버튼은 메인과 동일한 `header-footer.css`, `components.css`를 공유하도록 재설계합니다.
*   **개별 관리**: `/css/sub/` 폴더 내의 전용 CSS(예: `business.css`)는 해당 페이지의 고유 레이아웃을 담당하므로, 메인 페이지 리팩토링 시 영향을 받지 않도록 격리하여 작업합니다.
*   **반응형**: `global.css`에서 제공하는 `.t-br`, `.m-br` 클래스를 활용하여 태그 중복 없이 해상도별 줄바꿈을 제어합니다.

---

## 4. 2단계: 체계적인 재분리 과정 (Re-factoring)
디자인 불일치를 방지하기 위해 다음 순서로 CSS를 추출합니다.

### 순서 1: Global & Layout (`global.css`)
*   **대상**: `:root` 변수, `.container`, `.wrapper`, 공통 폰트 설정, `.pc-br` 등 공통 유틸리티 클래스.

### 순서 2: Header & Footer (`header-footer.css`)
*   **대상**: `header`, `.header-inner`, `nav`, `.gnb`, `footer` 및 관련 미디어 쿼리 전량.
*   **검증**: 모든 서브 페이지에서 상단바와 하단 정보 영역이 일관되게 표시되는지 확인합니다.

### 순서 3: UI Components (`components.css`)
*   **대상**: `.top-btn`, `.curser-wrap` (사용자 정의 커서), 공통 애니메이션(`@keyframes`).

### 순서 4: Main Page Content (`main-page.css`)
*   **대상**: `.main-visual`, `.main-business`, `.main-information`, `.main-success` (Section 01 ~ 04).
*   **핵심**: 파일 하단에 흩어져 있는 **태블릿(@media 1024px) 및 모바일(@media 768px)용 오버라이드 코드**를 반드시 해당 섹션과 함께 추출하여 포함시킵니다.

---

## 5. 3단계: 최종 검증 및 배포
1.  **CSS 로드 순서 준수**: `global.css` -> `header-footer.css` -> `components.css` -> `main-page.css` 순서로 로드합니다.
2.  **디자인 교차 검증**: 원격 서버(`wrsoft.pages.dev`)의 계산된 스타일과 로컬 스타일을 비교하여 1px의 오차도 없도록 조정합니다.
3.  **반응형 테스트**: 브라우저 개발자 도구로 모든 해상도 임계점에서 레이아웃 유동성을 검사합니다.

---

## 6. 반응형 구현 원칙 (Responsive Implementation Principles)
본 프로젝트의 반응형 디자인은 단순한 요소 숨김이 아닌, 미디어 쿼리를 통한 **유연한 레이아웃 제어**를 지향합니다.

1.  **표준 브레이크포인트 규격**
    *   **Tablet**: `(min-width: 769px) and (max-width: 1024px)`
    *   **Mobile**: `(max-width: 768px)`
    *   **PC (Large)**: `(min-width: 1280px)` (필요시 추가 오버라이드)

2.  **조건부 클래스 제거 및 CSS 대체**
    *   기존 HTML에서 사용하던 `.only-pc`, `.no-pc-section` 등의 클래스 사용을 지양합니다.
    *   동일한 HTML 구조를 유지하되, CSS 미디어 쿼리 내에서 `display: none`과 `display: block`을 통해 노출 여부를 제어하여 마크업의 가독성을 높입니다.

3.  **반응형 줄바꿈(Word-break) 처리**
    *   디바이스별로 최적화된 텍스트 가독성을 위해 `<br />` 태그에 클래스를 부여하여 제어합니다.
    *   `.pc-br`: PC 화면에서만 줄바꿈 수행
    *   `.t-br`: 태블릿 화면에서만 줄바꿈 수행
    *   `.m-br`: 모바일 화면에서만 줄바꿈 수행

4.  **섹션별 캡슐화 (Encapsulation)**
    *   메인 페이지의 각 섹션(Section 01~04)은 자신만의 반응형 코드를 내부에 포함합니다.
    *   예를 들어, `.main-visual`에 대한 PC 스타일이 정의되었다면, 해당 파일 하단의 태블릿/모바일 미디어 쿼리 블록 안에 `.main-visual`에 대한 오버라이드 코드를 함께 배치하여 스타일의 응집력을 높입니다.

5.  **유연한 수치 단위 활용**
    *   고정 픽셀(`px`) 대신 상대 단위(`rem`, `em`, `%`, `vh`, `vw`)를 적극적으로 활용하여 다양한 해상도에 자연스럽게 대응합니다.
    *   폰트 크기와 여백(Margin/Padding)을 변수화하여 브레이크포인트별로 일괄 조정합니다.