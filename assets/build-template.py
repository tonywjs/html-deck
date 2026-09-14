#!/usr/bin/env python3
"""덱 문서 조립: 소스의 플레이스홀더 4개에 fig-editor(도식 엔진)와 deck-runtime(장면 런타임)을 인라인한다.

사용법:
  python3 build-template.py                      # template-skeleton.html → template.html, examples/*-src.html → examples/*.html
  python3 build-template.py 소스.html 산출.html    # 임의 소스 조립

엔진(fig-editor.css/js) 탐색 순서:
  1. $HTML_DIAGRAM_DIR (html-diagram 스킬 폴더 또는 그 assets 폴더)
  2. ../../html-diagram/assets (형제 스킬 폴더)
  3. ~/.claude/skills/html-diagram/assets, ~/.agents/skills/html-diagram/assets
  4. 이 폴더의 template.html에 인라인된 엔진 (html-diagram이 없어도 조립은 된다. 다만 엔진 갱신은 안 된다)
"""
import os, pathlib, re, sys

d = pathlib.Path(__file__).resolve().parent
PH = ('/*__FIG_EDITOR_CSS__*/', '/*__DECK_CSS__*/', '/*__FIG_EDITOR_JS__*/', '/*__DECK_JS__*/')
HOME = pathlib.Path.home()


def engine_dirs():
    env = os.environ.get('HTML_DIAGRAM_DIR')
    if env:
        p = pathlib.Path(env).expanduser()
        yield p / 'assets'
        yield p
    yield d.parent.parent / 'html-diagram' / 'assets'
    yield HOME / '.claude' / 'skills' / 'html-diagram' / 'assets'
    yield HOME / '.agents' / 'skills' / 'html-diagram' / 'assets'


def load_engine():
    """(css, js, 출처) 를 돌려준다."""
    for p in engine_dirs():
        css, js = p / 'fig-editor.css', p / 'fig-editor.js'
        if css.is_file() and js.is_file():
            return css.read_text(encoding='utf-8'), js.read_text(encoding='utf-8'), str(p)
    t = d / 'template.html'
    if t.is_file():
        html = t.read_text(encoding='utf-8')
        m1 = re.search(r'<style id="fig-editor-css">\n(.*?)\n</style>', html, re.S)
        m2 = re.search(r'<script>\n(/\* =+\n\s*fig-editor\.js:.*?)\n</script>', html, re.S)
        if m1 and m2:
            return m1.group(1), m2.group(1), f'{t} (인라인된 엔진 추출)'
    sys.exit('엔진(fig-editor.css/js)을 찾지 못했습니다. html-diagram 스킬을 설치하거나 HTML_DIAGRAM_DIR을 지정하세요: '
             'https://github.com/tonywjs/html-diagram')


def build(src, out, css, js, dcss, djs):
    html = src.read_text(encoding='utf-8')
    missing = [k for k in PH if k not in html]
    if missing:
        sys.exit(f'{src}: 플레이스홀더가 없습니다 {missing}. assets/template-skeleton.html 구조를 유지하세요')
    html = html.replace(PH[0], css).replace(PH[1], dcss).replace(PH[2], js).replace(PH[3], djs)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print(f'{out} ({out.stat().st_size:,} bytes)')


def main(argv):
    if len(argv) not in (1, 3):
        sys.exit(__doc__)
    css, js, origin = load_engine()
    dcss = (d / 'deck-runtime.css').read_text(encoding='utf-8')
    djs = (d / 'deck-runtime.js').read_text(encoding='utf-8')
    print(f'엔진: {origin}')
    if len(argv) == 3:
        build(pathlib.Path(argv[1]), pathlib.Path(argv[2]), css, js, dcss, djs)
    else:
        build(d / 'template-skeleton.html', d / 'template.html', css, js, dcss, djs)
        for src in sorted((d.parent / 'examples').glob('*-src.html')):
            build(src, src.with_name(src.name[:-len('-src.html')] + '.html'), css, js, dcss, djs)


if __name__ == '__main__':
    main(sys.argv)
