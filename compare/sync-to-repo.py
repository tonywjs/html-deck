#!/usr/bin/env python3
"""작업 폴더(~/html-deck-compare)의 결과를 스킬 저장소의 compare/ 로 정제 복사한다.
로그(codex.log), 원본 PNG, 임시 파일, 개인 경로가 담긴 산출물은 옮기지 않는다."""
import pathlib, shutil, sys

src = pathlib.Path.home() / 'html-deck-compare'
dst = pathlib.Path.home() / '.claude/skills/html-deck/compare'
sys.path.insert(0, str(src))
from meta import order

dst.mkdir(parents=True, exist_ok=True)
HARNESS = ['PROMPT.txt', 'meta.py', 'compare-static.py', 'compare-verify.js', 'run-verify.py',
           'compare-report.py', 'gen-readme.py', 'make-shots.py', 'sync-to-repo.py',
           'record-deck.js', 'encode-video.py', 'make-gifs.py',
           'static.json', 'verify.json', 'console.json', 'README.md', 'index.html']
copied = []
for name in HARNESS:
    p = src / name
    if p.exists():
        shutil.copy(p, dst / name); copied.append(name)

# 모델별: deck.html 과 (있으면) report.md 만
for k in order:
    s = src / k
    if not (s / 'deck.html').exists():
        continue
    (dst / k).mkdir(exist_ok=True)
    shutil.copy(s / 'deck.html', dst / k / 'deck.html'); copied.append(f'{k}/deck.html')
    if (s / 'report.md').exists():
        shutil.copy(s / 'report.md', dst / k / 'report.md'); copied.append(f'{k}/report.md')

# 영상: 모델별 mp4(원래 속도)와 문서용 gif(2.5배속). 정지 스크린샷은 더 싣지 않는다
vd = src / 'videos'
if vd.exists():
    (dst / 'videos').mkdir(exist_ok=True)
    for p in sorted(list(vd.glob('*.mp4')) + list(vd.glob('*.gif'))):
        if p.name == 'preview.gif':
            continue   # 루트 README 대표 이미지는 docs/ 에 따로 둔다
        shutil.copy(p, dst / 'videos' / p.name); copied.append('videos/' + p.name)
# 예전 스크린샷 폴더가 남아 있으면 정리
old_shots = dst / 'shots-jpg'
if old_shots.exists():
    shutil.rmtree(old_shots); print('  (이전 shots-jpg 제거)')

# 저장소에 남으면 안 되는 것 정리
# 주의: macOS 파일시스템은 대소문자를 구분하지 않아 rglob('prompt.txt')가 최상위 PROMPT.txt까지 잡는다.
# 모델 폴더 안의 사본만 지운다.
junk = list(dst.rglob('codex*.log')) + list(dst.rglob('_run-verify.js')) + list(dst.rglob('__pycache__'))
junk += [q for q in dst.rglob('*.txt') if q.name.lower() == 'prompt.txt' and q.parent != dst]
for junk in junk:
    if junk.is_dir():
        shutil.rmtree(junk)
    else:
        junk.unlink()

total = sum(p.stat().st_size for p in dst.rglob('*') if p.is_file())
print(f'{len(copied)}개 항목 복사 → {dst}  (총 {total / 1024 / 1024:.1f}MB)')
for c in copied:
    print('  ', c)
