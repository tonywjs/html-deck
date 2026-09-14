#!/usr/bin/env python3
"""각 모델 폴더의 deck.html 정적 검사 → static.json.
엔진(fig-editor)·런타임(deck-runtime) 블록 무결성, 규약(id·좌표·화살표 참조·fx 대상·장면 연속·제목·노트),
문장부호, 그리고 덱 기능 커버리지(단계공개/범위/focus/view/flow/pulse/reset/여정캔버스/전환프리셋/노트)를 본다."""
import pathlib, re, json
base = pathlib.Path.home() / 'html-deck-compare'
sk = pathlib.Path.home() / '.claude/skills'
figcss = (sk / 'html-diagram/assets/fig-editor.css').read_text(encoding='utf-8')
figjs = (sk / 'html-diagram/assets/fig-editor.js').read_text(encoding='utf-8')
dcss = (sk / 'html-deck/assets/deck-runtime.css').read_text(encoding='utf-8')
djs = (sk / 'html-deck/assets/deck-runtime.js').read_text(encoding='utf-8')
emoji = re.compile('[\U0001F300-\U0001FAFF☀-➿]')
UI_GLYPHS = set('✎⌘⇧⌥⌃✕')   # 편집기 UI와 규약 기호를 그대로 인용한 글자는 장식 이모지가 아니다
PT = r'^-?[\d.]+\s*,\s*-?[\d.]+$'


def attr(e, k):
    m = re.search(r'data-' + k + r'="([^"]*)"', e)
    return m.group(1) if m else None


out = {}
for d in sorted(base.iterdir()):
    f = d / 'deck.html'
    if not d.is_dir() or not f.exists():
        continue
    t = f.read_text(encoding='utf-8')
    r = {'bytes': len(t.encode('utf-8'))}
    r['engine_css_ok'] = figcss in t
    r['engine_js_ok'] = figjs in t
    r['deck_css_ok'] = dcss in t
    r['deck_js_ok'] = djs in t
    c = t.replace(figcss, '').replace(figjs, '').replace(dcss, '').replace(djs, '')
    tm = re.search(r'<title>(.*?)</title>', c, re.S)
    r['title'] = tm.group(1).strip() if tm else None
    r['dashes'] = len(re.findall('[—–]', c))
    _emo = emoji.findall(c)
    r['emoji'] = len([ch for ch in _emo if ch not in UI_GLYPHS])
    r['ui_glyphs'] = sorted({ch for ch in _emo if ch in UI_GLYPHS})
    r['elabel_override'] = bool(re.search(r'\.fig-elabel\s*\{[^}]*font-size\s*:\s*14px', c))
    slide_w = 1280
    ms = re.search(r'data-slide-size="\s*(\d+)', c)
    if ms:
        slide_w = int(ms.group(1))
    slides = re.split(r'<section class="slide', c)[1:]
    allids = re.findall(r'\bid="([^"]+)"', c)
    r['dup_ids'] = len(allids) - len(set(allids))
    nodes_no_id = nodes_no_pos = edges_bad = fx_bad = steps_bad = slides_no_title = slides_no_notes = 0
    total_nodes = total_edges = total_canvas = max_step = 0
    fx_kinds = set()
    transitions = set()
    has_range = journey = False
    for s in slides:
        head = s.split('>', 1)[0]
        if 'data-title=' not in head:
            slides_no_title += 1
        if '<aside class="notes">' not in s:
            slides_no_notes += 1
        tr = re.search(r'data-transition="([^"]*)"', head)
        if tr:
            transitions.add(tr.group(1))
        ids = set(re.findall(r'\bid="([^"]+)"', s))
        nodes = re.findall(r'<div[^>]*class="[^"]*\bfig-node\b[^"]*"[^>]*>', s)
        total_nodes += len(nodes)
        for nd in nodes:
            mi = re.search(r'\bid="([^"]+)"', nd)
            if not mi:
                nodes_no_id += 1
                continue
            if not all(re.search(r'style="[^"]*\b' + k + r'\s*:', nd) for k in ('left', 'top', 'width')):
                nodes_no_pos += 1
        edges = re.findall(r'<div[^>]*class="[^"]*\bfig-edge\b[^"]*"[^>]*>', s)
        total_edges += len(edges)
        for e in edges:
            for k in ('from', 'to'):
                v = attr(e, k)
                if v is None or (not re.match(PT, v) and v not in ids):
                    edges_bad += 1
        canv = re.findall(r'<div[^>]*class="[^"]*\bfig-canvas\b[^"]*"[^>]*>', s)
        total_canvas += len(canv)
        for cvt in canv:
            mm = re.search(r'data-size="\s*(\d+)\s*[x×]\s*\d+', cvt)
            if mm and int(mm.group(1)) > slide_w:
                journey = True
        steps = set()
        tags_only = ' '.join(re.findall(r'<[^>]+>', s))
        for m2 in re.finditer(r'data-step="([^"]*)"', tags_only):
            rr = re.match(r'^\s*(\d+)\s*(?:-\s*(\d+))?\s*$', m2.group(1))
            if not rr:
                steps_bad += 1
                continue
            steps.add(int(rr.group(1)))
            if rr.group(2):
                steps.add(int(rr.group(2)))
                has_range = True
        mx = max(steps) if steps else 0
        max_step = max(max_step, mx)
        if [k for k in range(1, mx + 1) if k not in steps]:
            steps_bad += 1
        for fx in re.findall(r'<i class="fx"[^>]*>', s):
            kind = attr(fx, 'fx')
            if kind:
                fx_kinds.add(kind)
            tg = re.search(r'data-target="#([^"]*)"', fx)
            if kind in ('focus', 'flow', 'pulse') and (not tg or tg.group(1) not in ids):
                fx_bad += 1
            elif tg and tg.group(1) not in ids:
                fx_bad += 1
            if 'data-step=' not in fx:
                fx_bad += 1
    r.update({'slides': len(slides), 'nodes': total_nodes, 'edges': total_edges, 'canvases': total_canvas,
              'max_step': max_step, 'nodes_without_id': nodes_no_id, 'nodes_missing_inline_pos': nodes_no_pos,
              'edges_bad_ref': edges_bad, 'fx_bad': fx_bad, 'steps_bad': steps_bad,
              'slides_no_title': slides_no_title, 'slides_no_notes': slides_no_notes})
    r['features'] = {'step': total_nodes > 0 and max_step > 0, 'range': has_range,
                     'focus': 'focus' in fx_kinds, 'view': 'view' in fx_kinds, 'flow': 'flow' in fx_kinds,
                     'pulse': 'pulse' in fx_kinds, 'reset': 'reset' in fx_kinds, 'journey': journey,
                     'notes_all': slides_no_notes == 0, 'transitions': sorted(transitions),
                     'transition_presets': len(transitions - {'none'})}
    sizes = [float(x) for x in re.findall(r'font-size\s*:\s*([\d.]+)px', c)]
    r['min_font_declared'] = min(sizes) if sizes else None
    r['engine_ok'] = r['engine_css_ok'] and r['engine_js_ok'] and r['deck_css_ok'] and r['deck_js_ok']
    r['conv_ok'] = (edges_bad == 0 and r['dup_ids'] == 0 and nodes_no_id == 0 and nodes_no_pos == 0
                    and fx_bad == 0 and steps_bad == 0 and slides_no_title == 0)
    r['punct_ok'] = (r['dashes'] == 0 and r['emoji'] == 0)
    out[d.name] = r

(base / 'static.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
for k, r in out.items():
    fe = r['features']
    print(k, 'slides', r['slides'], 'nodes', r['nodes'], 'edges', r['edges'], 'maxstep', r['max_step'],
          'engine', r['engine_ok'], 'conv', r['conv_ok'], 'punct', r['punct_ok'],
          'feat', {x: fe[x] for x in ('step', 'range', 'focus', 'view', 'flow', 'pulse', 'reset', 'journey', 'notes_all')},
          'transitions', fe['transitions'])
