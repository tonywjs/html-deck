#!/usr/bin/env python3
"""videos/<모델>.mp4 → videos/<모델>.gif (덱 전체를 2.5배속으로 담은 움직이는 미리보기).
GitHub README는 저장소 안의 mp4를 인라인 재생하지 않지만 GIF는 재생한다.
그래서 문서에는 GIF를 싣고, 클릭하면 mp4(깃허브 자체 재생기)로 가게 한다.
사용법: python3 make-gifs.py [모델…]"""
import pathlib, subprocess, sys

base = pathlib.Path.home() / 'html-deck-compare' / 'videos'
SPEED, FPS, W = 2.5, 10, 640

models = sys.argv[1:] or sorted(p.stem for p in base.glob('*.mp4'))
for m in models:
    src = base / f'{m}.mp4'
    if not src.exists():
        print(m, 'mp4 없음'); continue
    gif, pal = base / f'{m}.gif', base / f'_pal_{m}.png'
    vf = f'setpts=PTS/{SPEED},fps={FPS},scale={W}:-1:flags=lanczos'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-vf', vf + ',palettegen=stats_mode=diff', '-y', str(pal)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-i', str(pal), '-lavfi',
                    f'{vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', '-y', str(gif)], check=True)
    pal.unlink(missing_ok=True)
    print(f'{m}.gif  {gif.stat().st_size / 1024 / 1024:.1f}MB')
