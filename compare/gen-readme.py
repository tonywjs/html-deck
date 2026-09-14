#!/usr/bin/env python3
"""static.json + verify.json + console.json + meta.py → compare/README.md 전체와 루트 README.md의 결과 블록.
스크린샷은 shots-jpg/*.jpg 를 참조한다(GitHub이 README 안의 이미지는 렌더한다)."""
import json, pathlib, re, sys
here = pathlib.Path(__file__).parent
root = pathlib.Path.home() / '.claude/skills/html-deck'   # 루트 README는 스킬 저장소
sys.path.insert(0, str(here))
from meta import names, order, EFFORT, RUNPATH, SELFCHECK, NOTES, CAVEAT, FOOTNOTE, ASYMMETRY, quality_pass as _qp
S = json.loads((here / 'static.json').read_text(encoding='utf-8'))
V = json.loads((here / 'verify.json').read_text(encoding='utf-8')) if (here / 'verify.json').exists() else {}
C = json.loads((here / 'console.json').read_text(encoding='utf-8')) if (here / 'console.json').exists() else {}


def ok(b):
    return 'O' if b else 'X'


def qpass(v):
    return _qp(v) is True


def qcols(v):
    q = v.get('quality')
    if not isinstance(q, list) or not q:
        return '-', '-'
    fill = ' / '.join(str(c['fill']) for c in q)
    mf = ' / '.join(str(c['minFont']) for c in q)
    return fill, mf


rows, cov, gal, sections = [], [], [], []
for k in order:
    if k not in S:
        continue
    s = S[k]; v = V.get(k, {}); fe = s['features']
    fill, mf = qcols(v)
    con = C.get(k)
    rows.append(f"| {names[k]} | {EFFORT.get(k, '-')} | {s['slides']} | {s['max_step']} | {s['nodes']} | {s['edges']} | {fill} | {mf} | "
                f"{ok(s['engine_ok'])} | {ok(s['conv_ok'])} | {ok(s['punct_ok'])} | {ok(qpass(v))} | "
                f"{ok(con == 0) if con is not None else '-'} | {ok(v.get('reachEnd') and v.get('backOk')) if v.get('info') and not v.get('info', {}).get('noRuntime') else '-'} |")
    cov.append(f"| {names[k]} | {ok(fe['step'])} | {ok(fe['range'])} | {ok(fe['focus'])} | {ok(fe['flow'])} | {ok(fe['view'])} | "
               f"{ok(fe['pulse'])} | {ok(fe['reset'])} | {ok(fe['journey'])} | {fe['transition_presets']} | {ok(fe['notes_all'])} |")
    if (here / 'shots-jpg' / f'{k}-full.jpg').exists():
        jpgs = [f'shots-jpg/{k}-full.jpg']
    else:
        jpgs = ['shots-jpg/' + pathlib.Path(p).stem + '.jpg' for p in v.get('shots_local', []) if (here / 'shots-jpg' / (pathlib.Path(p).stem + '.jpg')).exists()]
    if (here / 'shots-jpg' / f'{k}-0.jpg').exists():
        gal.append((k, f'shots-jpg/{k}-0.jpg'))
    elif v.get('shots_local'):
        first = pathlib.Path(v['shots_local'][0]).stem + '.jpg'
        if (here / 'shots-jpg' / first).exists():
            gal.append((k, 'shots-jpg/' + first))
    links = f"[deck.html]({k}/deck.html)" + (f" · [report.md]({k}/report.md)" if (here / k / 'report.md').exists() else '')
    sections.append(f"### {names[k]}\n\n{links}\n\n{NOTES.get(k, '')}\n\n" + '\n'.join(f'<img src="{j}" width="900">' for j in jpgs) + '\n')

H1 = ("| 모델 | 생각 강도 | 슬라이드 | 장면(최대) | 노드 | 엣지 | 채움 비율(%) | 최소 글자(px) | 엔진 무결 | 규약 | 문장부호 | 품질 스니펫 | 콘솔 0건 | 장면 진행 |\n"
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
H2 = ("| 모델 | 단계공개 | 범위 n-m | 줌인 focus | 흐름 flow | 여정 view | 강조 pulse | 초기화 reset | 여정 캔버스 | 전환 프리셋 수 | 노트(전 슬라이드) |\n"
      "|---|---|---|---|---|---|---|---|---|---|---|\n")
notes_md = '\n'.join(f"- **{names[k]}**: {NOTES[k]}" for k in order if NOTES.get(k) and k in S)


def gallery(prefix):
    cells = [f'<td align="center"><a href="{prefix}{k}/deck.html"><img src="{prefix}{j}" width="440"></a><br><sub>{names[k]}</sub></td>' for k, j in gal]
    trs = ''.join('<tr>' + ''.join(cells[i:i + 2]) + '</tr>' for i in range(0, len(cells), 2))
    return f'<table>{trs}</table>'


cmp_md = f"""# 모델 비교: 편집기 사용법 덱

같은 브리프로 일곱 모델에게 html-deck 스킬을 쓰게 하고, 산출물을 같은 하네스로 검사했습니다. 표의 브라우저 판정(품질 스니펫, 콘솔, 장면 진행)은 모델이 아니라 하네스가 전부 수행했습니다. `index.html`은 같은 내용에 스크린샷을 내장한 한 파일 판인데 GitHub 미리보기 한도를 넘으므로 내려받아 열어야 합니다. 이 문서가 같은 결과를 담고 있습니다.

## 브리프

- 주제: html-deck 편집기와 장면 기능을 가르치는 덱. 각 슬라이드가 설명하는 기능을 실제로 쓰면서 스스로를 시연. 단계공개(data-step, 범위 포함), 줌인 focus, 흐름 flow, 여정형 캔버스(view), 전환 프리셋, pulse, reset, 발표자 노트, 편집 모드·타임라인 안내를 모두 포함. 최소 5슬라이드, 1280x720, 한국어, 이모지·줄표 금지.
- 오염 방지: 주제가 다른 기존 예시(`examples/*-src.html`)는 형식 참고만 하고 베끼지 않도록 지시.
- 브리프 원문은 [PROMPT.txt](PROMPT.txt). 일곱 모델 모두 같은 원문을 받았고, Claude 서브에이전트에만 "브라우저 도구 사용 금지(공유 브라우저 충돌 방지), 정적 검사만" 한 줄이 추가됐습니다. 결과 판정은 모델이 아니라 중앙 하네스가 일곱 모두에게 똑같이 수행했습니다.

## 조건

| 모델 | 실행 경로 | 생각 강도 | 모델 자신의 검증 |
|---|---|---|---|
""" + '\n'.join(f"| {names[k]} | {RUNPATH.get(k, '-')} | {EFFORT.get(k, '-')} | {SELFCHECK.get(k, '-')} |" for k in order) + f"""

Claude 세 모델은 Claude Code 서브에이전트로 모델을 지정해 실행했고, GPT 네 모델은 Codex CLI(`codex exec`)로 실행했습니다. 생각 강도를 따로 지정하지 않아 기본값이 적용됐으므로 조건이 완전히 같지는 않습니다.

{ASYMMETRY}

## 결과

{H1}{chr(10).join(rows)}

O 통과 · X 실패 · 채움 비율과 최소 글자는 슬라이드별 값. 장면 진행은 → 로 끝까지 도달하고 ← 로 처음까지 복원되는지.

{FOOTNOTE}

## 커버리지 (정적 분석)

{H2}{chr(10).join(cov)}

브리프가 요구한 장면 기능을 실제로 썼는지. 전환 프리셋 수는 `none`을 제외한 서로 다른 `data-transition` 값의 수.

## 정성 메모

{notes_md}

{CAVEAT}

## 하네스

1. `compare-static.py`: 엔진·런타임 블록 무결성, 규약(id·좌표·화살표 참조·fx 대상·장면 연속·제목·노트), 줄표·이모지, 기능 커버리지 → `static.json`
2. `run-verify.py [폴더…]`: Aside 브라우저 repl로 품질 스니펫, 장면 진행/역방향 복원, 슬라이드별 스크린샷 → `verify.json`, `shots/`
3. 콘솔 오류: 내장 Browser 패널의 `read_console_messages`로 확인해 `console.json`에 기록
4. `compare-report.py`: 위 결과와 스크린샷을 합쳐 `index.html` 생성. `gen-readme.py`: 같은 데이터로 이 문서와 루트 README의 결과 블록 생성

## 모델별 스크린샷

{chr(10).join(sections)}"""
(here / 'README.md').write_text(cmp_md, encoding='utf-8')

root_block = f"""<!-- RESULTS:START -->
같은 브리프로 일곱 모델이 만든 편집기 사용법 덱을 같은 하네스로 검사한 결과입니다. 브라우저 판정(품질 스니펫, 콘솔, 장면 진행)은 전부 하네스가 수행했습니다. 조건, 커버리지, 전체 스크린샷은 [compare/README.md](compare/README.md)에 있습니다.

{H1}{chr(10).join(rows)}

O 통과 · X 실패 · 채움 비율과 최소 글자는 슬라이드별 값.

{notes_md}

{CAVEAT}

{gallery('compare/')}
<!-- RESULTS:END -->"""
rp = root / 'README.md'; rt = rp.read_text(encoding='utf-8')
if '<!-- RESULTS:START -->' in rt:
    rt = re.sub(r'<!-- RESULTS:START -->.*?<!-- RESULTS:END -->', lambda m: root_block, rt, flags=re.S)
else:
    m = re.search(r'## 모델 비교\n(.*?)(?=\n## )', rt, re.S)
    assert m, '루트 README에 "## 모델 비교" 절이 없음'
    rt = rt[:m.start()] + '## 모델 비교\n\n' + root_block + '\n' + rt[m.end():]
rp.write_text(rt, encoding='utf-8')
print('compare/README.md and root README results block written')
