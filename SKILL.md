---
name: html-deck
description: Use when 발표자료·슬라이드·프레젠테이션·덱을 HTML로 만들 때, PPT 품질에 불만이 있어 HTML 발표자료를 원할 때, 또는 장면 전환(줌인 설명, 단계 공개, 흐름 애니메이션)이 있는 발표 문서가 필요할 때. 발표 중 화면 일부를 확대해 설명하는 연출이 필요한 경우 포함.
---

# html-deck: 장면(step) 기반 HTML 발표자료

**REQUIRED BACKGROUND:** html-diagram 스킬을 먼저 읽는다. 슬라이드 내부는 그 스킬의
fig 규약(.fig-canvas / .fig-node / .fig-edge) 그대로이며, 같은 편집 엔진(⌘E 글자·도형 편집,
⌘S 같은 파일 저장)이 내장된다. 이 문서는 덱 고유 사항만 다룬다.
html-diagram이 없으면 https://github.com/tonywjs/html-diagram 을 `~/.claude/skills/html-diagram`에 받는다
(엔진 원본이 거기 있다. 없어도 이 스킬의 `assets/template.html`에 인라인된 엔진으로 조립은 된다).

**핵심 개념: → 키는 페이지가 아니라 "장면"을 넘긴다.** 한 슬라이드 안에서 요소가 단계적으로
나타나고, 특정 부분으로 카메라가 줌인되며(나머지는 흐려짐), 화살표에 흐름이 재생된다.
장면이 소진되면 다음 슬라이드로 넘어간다.

## 생성 워크플로

1. 발표 흐름을 슬라이드·장면 단위로 먼저 설계한다 (슬라이드마다 "이 장면에서 무엇을 이해시키는가").
2. 소스 파일을 작성한다: `assets/template-skeleton.html` 구조 + 4개 플레이스홀더
   (`/*__FIG_EDITOR_CSS__*/` `/*__DECK_CSS__*/` `/*__FIG_EDITOR_JS__*/` `/*__DECK_JS__*/`) 유지.
   `<title>`은 반드시 교체한다(스켈레톤 기본값 "발표자료"가 남으면 안 된다).
3. 조립: `python3 <이 스킬 폴더>/assets/build-template.py 소스.html 산출.html`
   (엔진·런타임이 인라인된 자체완결 파일이 나온다. 엔진 파일은 절대 수정하지 않는다.
   엔진은 html-diagram 스킬 폴더에서 찾고 없으면 `assets/template.html`에 인라인된 것을 쓴다.
   경로가 다르면 `HTML_DIAGRAM_DIR=<html-diagram 폴더>`로 알려 준다.)
4. 정적 검사: `python3 <이 스킬 폴더>/assets/static-check.py 산출.html` (title·줄표·id·fx 대상·장면 번호 연속성·엔진 무결).
5. 브라우저 검증: 콘솔 오류 0 → 장면 진행·역방향 실동작 → 아래 품질 스니펫 전 슬라이드 pass.
   검증 요령(로컬 HTTP 서빙, Aside repl `page.evaluate`, 콘솔은 내장 Browser 패널)은 html-diagram 스킬과 같다.
   브라우저 도구가 없는 환경(Codex CLI 등)에서는 정적 검사까지만 하고 브라우저 검증은 수행하지 못했다고 보고한다.
6. 통과 전에는 완성으로 선언하지 않는다.

완성 예시(`*-src.html`이 원본, 같은 이름의 `.html`이 조립본):
- `examples/demo-deck-src.html`: 5슬라이드. 빌드·flow·focus 줌·reset·pulse·전환 프리셋·여정형 캔버스(view)·노트 전부 사용.
- `examples/green-test-roadmap-src.html`: 5슬라이드 사업 추진 보고. 카드 내부 요소의 단계 공개(`ul[data-step]`), 허브 focus와 flow 조합.

## 덱 규약

```html
<div class="deck" data-slide-size="1280x720">
  <section class="slide" data-title="작동 원리">
    <div class="fig-canvas" data-size="1280x720">
      <div class="fig-node" id="s2-hub" style="left:560px;top:240px;width:190px" data-step="1">…</div>
      <div class="fig-edge" id="e2-p" data-from="s2-pharma" data-to="s2-hub" data-step="1" …></div>

      <i class="fx" data-step="1" data-fx="flow"  data-target="#e2-p"></i>
      <i class="fx" data-step="2" data-fx="focus" data-target="#s2-hub" data-zoom="2"></i>
      <i class="fx" data-step="3" data-fx="reset"></i>
    </div>
    <aside class="notes">발표자 노트 (N 키로 표시)</aside>
  </section>
</div>
```

| 항목 | 규칙 |
|---|---|
| `.slide` | `data-title` 필수(오버뷰에 표시). 슬라이드당 fig-canvas 1개 권장(보통 1280x720 전체) |
| `data-step="n"` | 장면 n부터 보임. `"n-m"` = n~m에만. 노드·엣지·노드 내부 요소 모두 가능 |
| `.fx` 디렉티브 | 보이지 않는 연출 선언. `<i class="fx" data-step data-fx data-target>` |
| `data-fx="focus"` | 대상으로 카메라 줌(`data-zoom`, 기본 1.8) + 나머지 딤(`data-dim="false"`로 끔). 다음 focus/view/reset까지 유지. **focus 시 대상 노드에 `.deck-focus` 클래스가 붙으므로**(딤을 꺼도 붙는다), `.fig-node.deck-focus .내클래스{...}` CSS로 "확대됐을 때만 나타나는 설명·애니메이션"을 카드 안(내용 아래 여백 등)에 넣을 수 있다 (예시: demo 슬라이드 3의 카드별 테마 애니메이션). 편집 모드 대비 `body.fig-editing .내클래스{opacity:1}`도 함께 |
| 흐름 화살표 | 화살표를 움직이는 점선으로: fx `data-fx="flow"`(장면 동안만) 또는 edge에 `data-flow="on"`(항상, 속성 패널 토글). 카드 확대와 조합 시 flow 화살표로 흐름을 함께 보여주면 효과적 |
| `data-fx="view"` | **영역이 슬라이드를 채우도록** 카메라 이동. 줌 자동 계산, 딤 없음(기본. `data-dim="true"`로 켬). 대상: `data-rect="x,y,w,h"`(캔버스 좌표) 또는 `data-target="#id"`. 여정형 캔버스의 기본 도구 |
| `data-fx="flow"` | 대상 화살표에 흐름 재생. `data-step` 범위 동안 유지, reset으로도 해제 |
| `data-fx="pulse"` | 해당 장면 진입 시 대상 1회 강조 |
| `data-fx="reset"` | 카메라·딤·흐름 초기화 |
| `data-transition` | `section.slide`에 지정하는 **진입 전환**. 모든 전환은 모션그래픽 안무다: 프레임(테두리)은 절대 움직이지 않고, 내용 요소들이 **읽기 순서 캐스케이드**(약 46ms 시차, expo-out)로 들어오며 화살표는 박스가 자리 잡은 뒤 한 박자 늦게 떠오른다. 프리셋: **미지정=`rise`(아래에서 떠오름, 기본)** \| `flow`(왼쪽으로 흘러 나가고 오른쪽에서 들어옴. 같은 이야기의 다음 장면) \| `fade` \| `zoom-in`(세부로) \| `zoom-out`(맥락으로) \| `none`(즉시 컷, 옵트아웃). 역방향 자동 반전, 첫 로드에도 인트로 캐스케이드, reduced-motion 시 전부 생략 |
| 움직일 요소 | 반드시 캔버스 안 노드로 (캔버스 밖 요소는 글자 수정만 가능) |

## 여정형 캔버스: 페이지 경계 없는 전개

한 슬라이드에 **슬라이드보다 넓은 캔버스**(예: `data-size="2200x720"`)를 두고 `view`로 카메라를
옮기면, "줌아웃하며 전체 그림이 드러나고 → 옆으로 팬하며 다음 설명이 등장"하는 연속 전개가 된다
(예시: `examples/demo-deck-src.html`의 5번 슬라이드).

```html
<div class="fig-canvas" data-size="2200x720">
  …왼쪽 영역(0~780) 노드들… …중앙 영역 노드들(data-step="1")… …오른쪽 영역(data-step="2")…
  <i class="fx" data-step="0" data-fx="view" data-rect="0,0,780,720"></i>     <!-- 시작: 왼쪽 확대 -->
  <i class="fx" data-step="1" data-fx="view" data-rect="0,0,2200,720"></i>    <!-- 줌아웃: 전체 -->
  <i class="fx" data-step="2" data-fx="view" data-rect="1460,0,740,720"></i>  <!-- 오른쪽으로 팬 -->
</div>
```

- **글자 크기 주의**: 넓은 캔버스는 축소돼 실리므로 css 글자를 그만큼 키워야 한다.
  하한(14px) ÷ 캔버스 축소율만큼. 예: 2200px 캔버스(축소 0.58)면 모든 글자 **최소 25px**.
  품질 스니펫이 축소율을 곱해 실측하므로 통과가 곧 기준 충족이다.
- 화살표 라벨(14px 고정)은 축소되면 하한 미달 → 여정 캔버스의 화살표에는 라벨을 쓰지 않는다.
- 시작 장면(`data-step="0"` view)을 반드시 두어 첫 화면부터 카메라가 잡히게 한다.

**키보드(발표)**: →/Space/PageDown 다음 장면 · ←/PageUp 이전 · Home/End 처음·마지막 슬라이드 · ESC 오버뷰 · N 노트 ·
숫자+Enter 슬라이드 점프 · URL 해시(`#2.1`)로 위치 공유(주소창에서 고쳐도 이동). 인쇄(⌘P)는 슬라이드당 한 장, 모든 장면 펼침. 편집은 우상단 `✎ 편집`(⌘E)으로 진입, 도크의 `완료` 버튼(`#figDone`) 또는 ⌘E로 종료.
편집 중엔 모든 장면이 펼쳐지고 카메라가 풀리며, 종료하면 보던 장면으로 복원된다.
도크의 `배포용 저장`은 편집기를 걷어낸 정적 HTML을 따로 만든다(장면·카메라·HUD·인쇄는 그대로, 편집만 불가). 원본은 함께 보관한다.

## 장면·애니메이션 원칙 (이 원칙을 벗어난 연출 금지)

1. 모든 움직임은 넷 중 하나를 표현해야 한다: **흐름(flow)** · **단계(build, data-step)** ·
   **강조(focus/pulse)** · **상태 변화**. 어디에도 해당 없으면 넣지 않는다.
2. 모든 슬라이드 전환은 기본으로 안무(`rise` 캐스케이드)가 적용된다. 별도 지정 없이도 전문 모션그래픽처럼 이어진다.
   서사적 관계가 있으면 프리셋을 바꾼다: 같은 이야기가 이어지면 `flow`, 세부로 들어가면 `zoom-in`, 맥락으로 물러나면 `zoom-out`.
   어떤 전환에서도 프레임은 고정된다(내용만 움직임). 정적인 컷이 필요한 특수한 경우에만 `none`.
   같은 맥락을 계속 오간다면 전환 대신 여정형 캔버스를 검토한다.
3. 장면 설계 기준: "이 장면에서 청중이 새로 이해하는 것"을 한 문장으로 말할 수 있어야 한다.
   말할 수 없는 장면은 이전 장면에 합친다. 슬라이드당 장면 2~4개가 적정.
4. focus는 슬라이드당 1~2회. 세부 설명이 필요한 대상에만 쓴다.
5. `prefers-reduced-motion`은 런타임이 자동 처리한다 (별도 작업 불필요).
6. 사용자는 편집 모드(⌘E) 하단의 **장면 타임라인**에서 애니메이션을 직접 편집할 수 있다
   (등장·줌인·강조·흐름·해제 추가/이동/삭제, 장면 삽입·정리, 장면 번호 클릭=미리보기).
   따라서 fx 지시자를 특수하게 배치하지 말고 규약대로만 쓰면 된다. 타임라인이 그것을 읽는다.

## 타이포그래피·공간 (1280×720 투사 기준, 하한 미만 금지)

| 용도 | 크기 |
|---|---|
| 슬라이드 제목 | 30~44px |
| 소제목·카드 제목 | 20~26px |
| 본문·설명 | 17~20px, **하한 16px** |
| 캡션·라벨·각주 | **하한 14px** |

- 화살표 라벨 기본값이 12px이므로 문서 스타일에 `.fig-elabel{font-size:14px;}` **오버라이드 필수**.
- 콘텐츠 슬라이드는 모든 장면을 펼친 상태에서 노드 bbox가 슬라이드의 **70% 이상**
  (고정 프레임+안전 여백을 감안한 기준. 도식의 85%와 다름).
  타이틀·섹션 간지 슬라이드는 예외. 단 55% 미만이면 구성을 재고한다.
- 빈 공간이 남으면 글자·카드를 키운다. 슬라이드 크기는 줄일 수 없기 때문이다.

**품질 스니펫** (전 슬라이드 순회, 모두 `pass:true` 나올 때까지 수정. 타이틀 간지의 fill 미달만 예외 허용):

```js
(function(){
  const R=window.DeckRuntime, F=window.FigEditor, FLOOR=14, FILL=70;
  const report=[];
  for(let i=0;i<R.count();i++){
    R.go(i,999); F.fitAll();
    const sl=document.querySelectorAll('.deck section.slide')[i];   // .slide.active는 전환 중 이전 슬라이드도 잡는다
    const out={slide:i+1,minFont:Infinity,fill:0,offenders:[]};
    sl.querySelectorAll('.fig-canvas').forEach(cv=>{
      const s=cv._scale||1, W=cv.offsetWidth,H=cv.offsetHeight;
      let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
      cv.querySelectorAll('.fig-node').forEach(n=>{
        x0=Math.min(x0,n.offsetLeft); y0=Math.min(y0,n.offsetTop);
        x1=Math.max(x1,n.offsetLeft+n.offsetWidth); y1=Math.max(y1,n.offsetTop+n.offsetHeight);
      });
      out.fill=Math.round(((x1-x0)*(y1-y0))/(W*H)*100);
      const w=document.createTreeWalker(cv,NodeFilter.SHOW_TEXT,null);
      while(w.nextNode()){
        const t=w.currentNode; if(!t.textContent.trim()) continue;
        const el=t.parentElement; if(!el||el.closest('[data-fig-ui]')) continue;
        const fs=parseFloat(getComputedStyle(el).fontSize)*s;
        if(fs<out.minFont) out.minFont=fs;
        if(fs<FLOOR) out.offenders.push(Math.round(fs*10)/10+'px: '+t.textContent.trim().slice(0,16));
      }
    });
    out.minFont=Math.round(out.minFont*10)/10;
    out.pass=out.minFont>=FLOOR&&out.fill>=FILL;
    out.offenders=out.offenders.slice(0,4);
    report.push(out);
  }
  R.go(0,0);
  return JSON.stringify(report);
})()
```

## 문장 부호

- **줄표(`—`) 금지.** 문서 어디에도 em dash(`—`)·en dash(`–`)를 쓰지 않는다. 쉼표·콜론·괄호로 바꾸거나 문장을 나눈다.
  예: `A — B` → `A: B` / `A(B)` / `A. B`

## 체크리스트 (산출 전 확인)

- [ ] `<title>` 교체됨(스켈레톤 기본값 "발표자료"가 남아 있지 않음)
- [ ] 본문에 줄표(`—`) 0개
- [ ] 슬라이드마다 `data-title`, 발표자 노트(`aside.notes`)
- [ ] 모든 fx의 `data-target`이 실존 id, 장면 번호가 연속적(1,2,3… 건너뜀 없음)
- [ ] `.fig-elabel` 14px 오버라이드 포함
- [ ] 정적 검사(`assets/static-check.py`) pass · 콘솔 오류 0 · 품질 스니펫 전 슬라이드 pass
- [ ] 실동작: → 로 끝까지 진행(장면→슬라이드 경계 포함), ← 역방향에서 focus·flow 상태 복원
- [ ] 편집 모드 왕복: ⌘E 진입 시 전 장면 펼침·카메라 해제, 종료 시 현재 장면 복원

## 흔한 실수

| 실수 | 결과 → 교정 |
|---|---|
| fx를 보이는 요소로 작성 | 화면에 잡동사니 → 반드시 `<i class="fx" …></i>` 빈 요소 |
| 라벨 12px 방치 | 투사 시 안 읽힘 → `.fig-elabel{font-size:14px}` |
| 모든 요소에 data-step | 클릭 연타 발표 → 장면당 "새 이해" 원칙으로 묶기 |
| focus 대상이 캔버스 밖 | 카메라 미동작 → 캔버스 안 노드/엣지만 대상 가능 |
| 도식용 fill 85% 적용 | 슬라이드에선 불가능한 기준 → 덱은 70% |
| 엣지 공개를 CSS로 시도 | 엣지는 SVG 렌더 → `data-step`을 fig-edge에 직접 (런타임이 처리) |
| 검증 스크립트에서 `.slide.active`로 현재 슬라이드 선택 | 전환 중엔 이전 슬라이드도 active → `section.slide`를 인덱스로 선택 |

## 엔진·런타임 유지보수 (스킬 관리자용)

`assets/deck-runtime.js`·`deck-runtime.css`를 고쳤거나 html-diagram의 엔진이 바뀌었으면 `python3 assets/build-template.py`(인자 없이)로
템플릿과 예시를 재생성한다. 회귀 테스트는 `bash assets/tests/run.sh`(예시 조립 → 로컬 HTTP → Aside repl로 장면 진행·역방향 복원·
편집 왕복·타임라인·저장 정화·undo 재마운트 검사, 전부 pass여야 한다). 런타임은 엔진의 정리 훅 `FigEditor.onClean`으로 저장·스냅샷에서
자기 상태를 걷어내므로, 새 상태 클래스를 추가하면 `cleanDeckState`에도 넣는다.
