#!/usr/bin/env python3
"""폴더 목록(생략하면 deck.html이 있는 모든 폴더)을 받아 Aside repl 검증을 돌리고
verify.json에 병합, 스크린샷을 shots/로 복사한다. 로컬 HTTP는 미리 8791 포트로 띄워 둔다:
  python3 -m http.server 8791 --bind 127.0.0.1 --directory ~/html-deck-compare
콘솔 오류는 Aside가 캡처하지 못하므로 내장 Browser 패널의 read_console_messages로 확인해 console.json에 기록한다."""
import pathlib, json, subprocess, sys, shutil, re
base = pathlib.Path.home() / 'html-deck-compare'
folders = sys.argv[1:] or [d.name for d in sorted(base.iterdir()) if (d / 'deck.html').exists()]
js = (base / 'compare-verify.js').read_text(encoding='utf-8').replace('__FOLDERS__', json.dumps(folders))
(base / '_run-verify.js').write_text(js, encoding='utf-8')
res = subprocess.run(['aside', 'repl', js], capture_output=True, text=True, timeout=900)
m = re.search(r'VERIFY (\{.*\})', res.stdout + res.stderr, re.S)
if not m:
    print('NO RESULT\n', (res.stdout + res.stderr)[-1500:]); sys.exit(1)
data = json.loads(m.group(1)); pwd = data.pop('pwd', None)
(base / 'shots').mkdir(exist_ok=True)
for f, r in data.items():
    loc = []
    for p in r.get('shots', []):
        src = (pathlib.Path(pwd) / p) if pwd else pathlib.Path(p)
        dst = base / 'shots' / pathlib.Path(p).name
        if src.exists():
            shutil.copy(src, dst); loc.append('shots/' + pathlib.Path(p).name)
    r['shots_local'] = loc
old = json.loads((base / 'verify.json').read_text(encoding='utf-8')) if (base / 'verify.json').exists() else {}
old.update(data)
(base / 'verify.json').write_text(json.dumps(old, ensure_ascii=False, indent=1), encoding='utf-8')
for f, r in data.items():
    import meta
    qp = meta.quality_pass(r)   # SKILL.md 기준(타이틀 슬라이드 채움 예외)으로 판정
    print(f, 'runtime=', r.get('info'), 'quality_pass=', qp,
          'reachEnd=', r.get('reachEnd'), 'backOk=', r.get('backOk'), 'shots=', len(r.get('shots_local', [])), 'err=', r.get('error'))
