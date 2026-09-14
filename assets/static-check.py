#!/usr/bin/env python3
"""html-deck 정적 검사. 브라우저 없이 확인할 수 있는 항목만 본다.
사용법: python3 static-check.py 산출.html
출력: JSON (pass:true면 통과, 종료 코드 0).
검사 항목: <title> 교체, 줄표, 플레이스홀더 잔존, 엔진·런타임 블록 무결(원본과 비교), 슬라이드 data-title·notes,
  fig-node id·인라인 좌표, fig-edge from/to 실존, fx 종류·대상·data-step, 장면 번호 연속성, data-transition 값,
  .fig-elabel 14px 오버라이드, 14px 미만 font-size 선언.
브라우저 검증(콘솔 오류, 품질 스니펫, 장면 실동작)은 이 검사로 대신할 수 없다."""
import os, sys, re, json, pathlib

if len(sys.argv) < 2:
    print(__doc__); sys.exit(2)
f = pathlib.Path(sys.argv[1]); t = f.read_text(encoding='utf-8')
here = pathlib.Path(__file__).resolve().parent
out = {'file': str(f), 'errors': [], 'warnings': [], 'slides': []}
E, W = out['errors'].append, out['warnings'].append
PH = ('/*__FIG_EDITOR_CSS__*/', '/*__DECK_CSS__*/', '/*__FIG_EDITOR_JS__*/', '/*__DECK_JS__*/')


def engine():
    cands = []
    env = os.environ.get('HTML_DIAGRAM_DIR')
    if env:
        cands += [pathlib.Path(env).expanduser() / 'assets', pathlib.Path(env).expanduser()]
    cands += [here.parent.parent / 'html-diagram' / 'assets',
              pathlib.Path.home() / '.claude' / 'skills' / 'html-diagram' / 'assets',
              pathlib.Path.home() / '.agents' / 'skills' / 'html-diagram' / 'assets']
    for p in cands:
        if (p / 'fig-editor.css').is_file() and (p / 'fig-editor.js').is_file():
            return (p / 'fig-editor.css').read_text(encoding='utf-8'), (p / 'fig-editor.js').read_text(encoding='utf-8')
    tpl = here / 'template.html'
    if tpl.is_file():
        h = tpl.read_text(encoding='utf-8')
        m1 = re.search(r'<style id="fig-editor-css">\n(.*?)\n</style>', h, re.S)
        m2 = re.search(r'<script>\n(/\* =+\n\s*fig-editor\.js:.*?)\n</script>', h, re.S)
        if m1 and m2: return m1.group(1), m2.group(1)
    return None, None


is_source = any(k in t for k in PH)
c = t
if is_source:
    W('소스 파일(플레이스홀더 있음): 엔진·런타임 블록 검사는 조립본에서 한다')
else:
    css, js = engine()
    dcss = (here / 'deck-runtime.css').read_text(encoding='utf-8')
    djs = (here / 'deck-runtime.js').read_text(encoding='utf-8')
    if css is None: W('엔진 원본(fig-editor.css/js)을 찾지 못해 엔진 블록 검사 생략')
    else:
        if css not in t: E('엔진 CSS 블록이 fig-editor.css와 다름 (엔진은 수정·요약 금지. 최신 엔진이면 재조립)')
        if js not in t: E('엔진 JS 블록이 fig-editor.js와 다름 (엔진은 수정·요약 금지. 최신 엔진이면 재조립)')
        c = c.replace(css, '').replace(js, '')
    if dcss not in t: E('덱 런타임 CSS 블록이 deck-runtime.css와 다름 (재조립 필요)')
    if djs not in t: E('덱 런타임 JS 블록이 deck-runtime.js와 다름 (재조립 필요)')
    c = c.replace(dcss, '').replace(djs, '')

m = re.search(r'<title>(.*?)</title>', c, re.S)
title = m.group(1).strip() if m else ''
if not title or title == '발표자료' or 'DECK:TITLE' in title: E('<title> 미교체: ' + repr(title))
n = len(re.findall('[—–]', c))
if n: E(f'줄표(em/en dash) {n}개')
emo = re.findall('[\U0001F300-\U0001FAFF]', c)
if emo: W(f'이모지 {len(emo)}개 (배포 문서에는 쓰지 않는다)')
if not re.search(r'\.fig-elabel\s*\{[^}]*font-size\s*:\s*14px', c): E('.fig-elabel{font-size:14px} 오버라이드 없음 (화살표 라벨 하한)')
sizes = [float(x) for x in re.findall(r'font-size\s*:\s*([\d.]+)px', c)]
small = sorted({s for s in sizes if s < 14})
if small: W('14px 미만 font-size 선언: ' + ', '.join(str(s) for s in small) + 'px (슬라이드 안 텍스트에 쓰였다면 위반)')
if not re.search(r'class="deck"', c): E('.deck 컨테이너 없음')

allids = re.findall(r'\bid="([^"]+)"', c)
dup = sorted({i for i in allids if allids.count(i) > 1})
if dup: E('id 중복: ' + ', '.join(dup))

slides = re.split(r'<section class="slide[^"]*"', c)[1:]
if not slides: E('section.slide 없음')
FX = ('focus', 'view', 'flow', 'pulse', 'reset'); TR = ('rise', 'flow', 'fade', 'zoom-in', 'zoom-out', 'none')
PT = r'^-?[\d.]+\s*,\s*-?[\d.]+$'
for si, s in enumerate(slides, 1):
    head = s.split('>', 1)[0]
    if 'data-title=' not in head: E(f'슬라이드{si}: data-title 없음')
    if '<aside class="notes">' not in s: W(f'슬라이드{si}: 발표자 노트(aside.notes) 없음')
    tr = re.search(r'data-transition="([^"]*)"', head)
    if tr and tr.group(1) not in TR: E(f'슬라이드{si}: 알 수 없는 data-transition {tr.group(1)!r}')
    ids = set(re.findall(r'\bid="([^"]+)"', s))
    nodes = re.findall(r'<div[^>]*class="[^"]*\bfig-node\b[^"]*"[^>]*>', s)
    for nd in nodes:
        mi = re.search(r'\bid="([^"]+)"', nd)
        if not mi: E(f'슬라이드{si}: id 없는 .fig-node ' + nd[:70]); continue
        for k in ('left', 'top', 'width'):
            if not re.search(r'style="[^"]*\b' + k + r'\s*:', nd): E(f'슬라이드{si} #{mi.group(1)}: 인라인 {k} 없음')
    edges = re.findall(r'<div[^>]*class="[^"]*\bfig-edge\b[^"]*"[^>]*>', s)
    for e in edges:
        for k in ('from', 'to'):
            mv = re.search(r'data-' + k + r'="([^"]*)"', e); v = mv.group(1) if mv else None
            if v is None: E(f'슬라이드{si}: data-{k} 없는 .fig-edge ' + e[:70])
            elif not re.match(PT, v) and v not in ids: E(f'슬라이드{si}: data-{k}="{v}" 실존하지 않는 노드 id')
    steps = set()
    tags_only = ' '.join(re.findall(r'<[^>]+>', s))   # 본문 텍스트의 data-step="n" 설명은 속성이 아니다
    for m2 in re.finditer(r'data-step="([^"]*)"', tags_only):
        r = re.match(r'^\s*(\d+)\s*(?:-\s*(\d+))?\s*$', m2.group(1))
        if not r: E(f'슬라이드{si}: data-step 형식 오류 {m2.group(1)!r} (n 또는 n-m)'); continue
        steps.add(int(r.group(1)))
        if r.group(2): steps.add(int(r.group(2)))
    mx = max(steps) if steps else 0
    missing = [k for k in range(1, mx + 1) if k not in steps]
    if missing: E(f'슬라이드{si}: 장면 번호 비연속 (없는 번호 {missing})')
    for fx in re.findall(r'<i class="fx"[^>]*>', s):
        kind = re.search(r'data-fx="([^"]*)"', fx); kind = kind.group(1) if kind else ''
        if kind not in FX: E(f'슬라이드{si}: 알 수 없는 fx {kind!r}')
        tg = re.search(r'data-target="#([^"]*)"', fx)
        if kind in ('focus', 'flow', 'pulse') and not tg: E(f'슬라이드{si}: {kind} fx에 data-target 없음')
        if tg and tg.group(1) not in ids: E(f'슬라이드{si}: fx 대상 #{tg.group(1)} 실존하지 않음')
        if kind == 'view' and not (tg or re.search(r'data-rect="', fx)): E(f'슬라이드{si}: view fx에 data-rect/data-target 없음')
        if 'data-step=' not in fx: E(f'슬라이드{si}: fx에 data-step 없음')
    canv = re.findall(r'<div[^>]*class="[^"]*\bfig-canvas\b[^"]*"[^>]*>', s)
    for cv in canv:
        if not re.search(r'data-size="\s*\d+\s*[x×]\s*\d+\s*"', cv): E(f'슬라이드{si}: data-size="WxH" 없는 .fig-canvas')
    out['slides'].append({'n': si, 'nodes': len(nodes), 'edges': len(edges), 'canvases': len(canv), 'maxStep': mx})

out['title'] = title
out['pass'] = not out['errors']
out['note'] = '브라우저 검증(콘솔 오류, 품질 스니펫, 장면 진행·역방향·편집 왕복)은 이 검사로 대신할 수 없다'
print(json.dumps(out, ensure_ascii=False, indent=1))
sys.exit(0 if out['pass'] else 1)
