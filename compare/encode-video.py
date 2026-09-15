#!/usr/bin/env python3
"""record-deck.js 가 남긴 프레임과 실제 시각으로 MP4를 만든다.
화면 스트리밍은 화면이 바뀔 때만 프레임을 보내므로, 프레임마다 실제 지속 시간을 줘야
정지 구간과 움직이는 구간의 속도가 원본과 같아진다.
사용법: python3 encode-video.py <프레임 폴더> <출력 mp4> [--gif <출력 gif>]"""
import json, pathlib, subprocess, sys

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
gif = None
if '--gif' in sys.argv:
    gif = pathlib.Path(sys.argv[sys.argv.index('--gif') + 1])

frames = json.loads((src / 'frames.json').read_text())
if len(frames) < 2:
    sys.exit('프레임이 부족합니다')

MIN, MAX = 1 / 60, 2.0
lines = []
for i, f in enumerate(frames):
    if i + 1 < len(frames):
        d = frames[i + 1]['t'] - f['t']
    else:
        d = 1.0
    d = max(MIN, min(MAX, d))
    lines.append(f"file '{f['file']}'")
    lines.append(f"duration {d:.4f}")
lines.append(f"file '{frames[-1]['file']}'")   # concat 은 마지막 파일을 한 번 더 적어야 표시된다
listfile = src / 'concat.txt'
listfile.write_text('\n'.join(lines) + '\n', encoding='utf-8')

out.parent.mkdir(parents=True, exist_ok=True)
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(listfile),
       '-vf', 'scale=1280:720:flags=lanczos', '-r', '30',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
       '-movflags', '+faststart', str(out)]
subprocess.run(cmd, check=True)
dur = sum(min(MAX, max(MIN, (frames[i + 1]['t'] - frames[i]['t']))) for i in range(len(frames) - 1)) + 1.0
print(f'{out.name}  {out.stat().st_size / 1024 / 1024:.1f}MB  약 {dur:.0f}초  프레임 {len(frames)}')

if gif:
    pal = src / 'palette.png'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out),
                    '-vf', 'fps=12,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff', str(pal)], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out), '-i', str(pal),
                    '-lavfi', 'fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
                    str(gif)], check=True)
    pal.unlink(missing_ok=True)
    print(f'{gif.name}  {gif.stat().st_size / 1024 / 1024:.1f}MB')
