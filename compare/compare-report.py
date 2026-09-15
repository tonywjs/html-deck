#!/usr/bin/env python3
"""static.json + verify.json + 스크린샷 → index.html 비교 페이지"""
import json, pathlib, html, sys
base = pathlib.Path.home() / 'html-deck-compare'
S = json.loads((base / 'static.json').read_text(encoding='utf-8'))
V = json.loads((base / 'verify.json').read_text(encoding='utf-8')) if (base / 'verify.json').exists() else {}
C = json.loads((base / 'console.json').read_text(encoding='utf-8')) if (base / 'console.json').exists() else {}
sys.path.insert(0, str(base))
from meta import names, order, EFFORT, NOTES, CAVEAT, quality_pass as _qp


def yn(b):
    return '<span class="ok">통과</span>' if b else '<span class="ng">실패</span>'


def qpass(v):
    return _qp(v) is True


rows, cards = [], []
for k in order:
    if k not in S:
        rows.append(f'<tr><td>{names[k]}</td><td>{EFFORT.get(k, "-")}</td><td colspan="12" class="mute">산출물 없음</td></tr>')
        continue
    s = S[k]; v = V.get(k, {}); fe = s['features']
    q = v.get('quality') if isinstance(v.get('quality'), list) else []
    fill = ' / '.join(str(c['fill']) for c in q) if q else '-'
    mf = ' / '.join(str(c['minFont']) for c in q) if q else '-'
    con = C.get(k)
    cov = []
    for lab, val in [('단계공개', fe['step']), ('범위 n-m', fe['range']), ('focus', fe['focus']), ('flow', fe['flow']),
                     ('view', fe['view']), ('pulse', fe['pulse']), ('reset', fe['reset']), ('여정캔버스', fe['journey']),
                     ('노트전체', fe['notes_all'])]:
        cov.append(f'<span class="{"c1" if val else "c0"}">{lab}</span>')
    cov.append(f'<span class="c1">전환 {fe["transition_presets"]}종</span>' if fe['transition_presets'] else '<span class="c0">전환 0종</span>')
    walked = v.get('info') and not v.get('info', {}).get('noRuntime')
    rows.append(f'''<tr><td><b>{names[k]}</b><br><a href="{k}/deck.html">deck.html</a> · {s["bytes"] // 1024}KB</td>
<td>{EFFORT.get(k, "-")}</td><td>{s["slides"]}</td><td>{s["max_step"]}</td><td>{s["nodes"]}</td><td>{s["edges"]}</td>
<td>{yn(s["engine_ok"])}</td>
<td>{yn(s["conv_ok"])}<br><small>{s["edges_bad_ref"]}참조/{s["dup_ids"]}중복/{s["nodes_missing_inline_pos"]}좌표/{s["fx_bad"]}fx/{s["steps_bad"]}장면</small></td>
<td>{yn(s["punct_ok"])}<br><small>줄표 {s["dashes"]} · 이모지 {s["emoji"]}</small></td>
<td>{yn(qpass(v))}<br><small>채움 {fill} · 최소 {mf}</small></td>
<td>{yn(con == 0) if con is not None else "-"}{"" if con is None else f"<br><small>{con}건</small>"}</td>
<td>{yn(v.get("reachEnd") and v.get("backOk")) if walked else "-"}</td>
<td class="cov">{"".join(cov)}</td></tr>''')
    mp4 = base / 'videos' / f'{k}.mp4'
    media = (f'<video src="videos/{k}.mp4" controls preload="metadata" playsinline></video>'
             if mp4.exists() else '<p class="mute">녹화 없음</p>')
    cards.append(f'<section><h2>{names[k]} <a href="{k}/deck.html">덱 파일</a>'
                 + (f' <a href="videos/{k}.mp4">영상 파일</a>' if mp4.exists() else '')
                 + f'</h2>{media}</section>')
notes_html = ('<section><h2>정성 메모</h2><ul>'
              + ''.join(f'<li><b>{names[k]}</b>: {html.escape(NOTES[k])}</li>' for k in order if NOTES.get(k))
              + '</ul><p class="mute">' + CAVEAT + '</p></section>')
page = f'''<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>html-deck 모델 비교</title>
<style>body{{font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;margin:24px;color:#0f172a;background:#f3f5f9}}
h1{{font-size:24px}} table{{border-collapse:collapse;background:#fff;font-size:13px}} th,td{{border:1px solid #dfe3ea;padding:6px 8px;vertical-align:top}} th{{background:#eef2f7}}
.ok{{color:#059669;font-weight:700}} .ng{{color:#dc2626;font-weight:700}} .mute{{color:#94a3b8}} small{{color:#64748b}}
.cov span{{display:inline-block;font-size:11px;padding:1px 5px;border-radius:4px;margin:1px}} .c1{{background:#dcfce7;color:#166534}} .c0{{background:#fee2e2;color:#991b1b;text-decoration:line-through}}
section{{margin-top:28px}} h2{{font-size:17px}} h2 a{{font-size:13px;margin-left:8px}} video{{width:900px;max-width:100%;border:1px solid #dfe3ea;border-radius:10px;background:#0b0e14}}
</style></head><body><h1>html-deck 편집기 사용법 덱: 모델 비교</h1>
<p>같은 브리프(스킬 SKILL.md + 동일 지시문)로 각 모델이 만든 deck.html과 그 덱을 실제로 넘기며 녹화한 영상. 검사는 전부 같은 하네스로 수행했다. Claude 세 모델은 공유 브라우저 충돌을 막으려 브라우저 없이 설계했고 GPT 네 모델은 스스로 브라우저 검증을 했지만, 표의 판정(품질 스니펫, 콘솔, 장면 진행)은 일곱 모두 이 하네스가 똑같이 수행한 값이다. 품질 스니펫은 SKILL.md 기준대로 글자 하한 14px은 전 슬라이드에, 채움 70%는 타이틀을 뺀 콘텐츠 슬라이드에 적용한다.</p>
<table><tr><th>모델</th><th>생각 강도</th><th>슬라이드</th><th>장면(최대)</th><th>노드</th><th>엣지</th><th>엔진 무결</th><th>규약</th><th>문장부호</th><th>품질 스니펫</th><th>콘솔</th><th>장면 진행</th><th>기능 커버리지</th></tr>{"".join(rows)}</table>
{notes_html}{"".join(cards)}</body></html>'''
(base / 'index.html').write_text(page, encoding='utf-8')
print('index.html written')
