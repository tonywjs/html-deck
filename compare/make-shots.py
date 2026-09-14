#!/usr/bin/env python3
"""shots/*.png → shots-jpg/*.jpg 변환과 모델별 세로 이어붙인 <모델>-full.jpg 생성.
README는 <모델>-0.jpg를 갤러리 썸네일로, <모델>-full.jpg를 모델별 절에 쓴다.
사용법: python3 make-shots.py [모델폴더…]   (생략하면 shots/에 있는 모든 모델)"""
import pathlib, sys, re
from PIL import Image

base = pathlib.Path.home() / 'html-deck-compare'
src, dst = base / 'shots', base / 'shots-jpg'
dst.mkdir(exist_ok=True)
W, Q, GAP = 1280, 82, 10

models = sys.argv[1:]
if not models:
    models = sorted({re.sub(r'-\d+\.png$', '', p.name) for p in src.glob('*.png')})

for m in models:
    shots = sorted(src.glob(f'{m}-*.png'), key=lambda p: int(re.search(r'-(\d+)\.png$', p.name).group(1)))
    if not shots:
        print(m, 'no shots'); continue
    imgs = []
    for p in shots:
        im = Image.open(p).convert('RGB')
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        imgs.append(im)
        out = dst / (p.stem + '.jpg')
        im.save(out, 'JPEG', quality=Q, optimize=True)
    H = sum(i.height for i in imgs) + GAP * (len(imgs) - 1)
    sheet = Image.new('RGB', (W, H), (243, 245, 249))
    y = 0
    for i in imgs:
        sheet.paste(i, (0, y)); y += i.height + GAP
    full = dst / f'{m}-full.jpg'
    sheet.save(full, 'JPEG', quality=Q, optimize=True)
    print(f'{m}: {len(imgs)} slides -> {full.name} ({full.stat().st_size // 1024}KB)')
