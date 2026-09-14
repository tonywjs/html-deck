#!/bin/bash
# html-deck 런타임 회귀 테스트: 템플릿·예시를 임시 폴더에 조립 → 로컬 HTTP → Aside repl로 실행 (Aside는 file:// 을 열지 못함)
# 콘솔 오류는 Aside가 캡처하지 못하므로 내장 Browser 패널의 read_console_messages로 따로 확인한다.
set -e
D="$(cd "$(dirname "$0")" && pwd)"; A="$D/.."; T="$(mktemp -d)"; PORT=${PORT:-8767}
python3 "$A/build-template.py" "$A/template-skeleton.html" "$T/template.html" >/dev/null
for src in "$A"/../examples/*-src.html; do
  b="$(basename "$src" -src.html)"; python3 "$A/build-template.py" "$src" "$T/$b.html" >/dev/null
done
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$T" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$T"' EXIT
sleep 1
aside repl "$(sed "s/8767/$PORT/g" "$D/deck-tests.js")"
