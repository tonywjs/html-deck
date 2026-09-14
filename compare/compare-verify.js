/* Aside repl: 각 모델 deck.html 브라우저 검증(품질 스니펫·장면 진행/역방향 복원·슬라이드별 스크린샷).
   run-verify.py 가 __FOLDERS__ 를 채워 http://127.0.0.1:8791 에 띄운 뒤 실행한다.
   전환 애니메이션 중에는 이전 슬라이드에도 .active 가 남으므로 현재 슬라이드는 인덱스로 잡는다. */
const FOLDERS = __FOLDERS__; const BASE = 'http://127.0.0.1:8791/';
const out = {}; await fs.mkdir('./artifacts', { recursive: true });
const SNIP = `(function(){
  const R=window.DeckRuntime, F=window.FigEditor, FLOOR=14, FILL=70;
  const report=[];
  for(let i=0;i<R.count();i++){
    R.go(i,999); F.fitAll();
    const sl=document.querySelectorAll('.deck section.slide')[i];
    const out={slide:i+1,minFont:Infinity,fill:0,offenders:[]};
    sl.querySelectorAll('.fig-canvas').forEach(cv=>{
      const s=cv._scale||1, W=cv.offsetWidth,H=cv.offsetHeight;
      let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
      cv.querySelectorAll('.fig-node').forEach(n=>{
        x0=Math.min(x0,n.offsetLeft); y0=Math.min(y0,n.offsetTop);
        x1=Math.max(x1,n.offsetLeft+n.offsetWidth); y1=Math.max(y1,n.offsetTop+n.offsetHeight);
      });
      out.fill=Math.round(((x1-x0)*(y1-y0))/(W*H)*100);
      const w=document.createTreeWalker(cv,NodeFilter.SHOW_TEXT,null);
      while(w.nextNode()){
        const t=w.currentNode; if(!t.textContent.trim()) continue;
        const el=t.parentElement; if(!el||el.closest('[data-fig-ui]')) continue;
        const fs=parseFloat(getComputedStyle(el).fontSize)*s;
        if(fs<out.minFont) out.minFont=fs;
        if(fs<FLOOR) out.offenders.push(Math.round(fs*10)/10+'px: '+t.textContent.trim().slice(0,16));
      }
    });
    out.minFont=Math.round(out.minFont*10)/10;
    out.pass=out.minFont>=FLOOR&&out.fill>=FILL;
    out.offenders=out.offenders.slice(0,4);
    report.push(out);
  }
  R.go(0,0);
  return JSON.stringify(report);
})()`;
for (const f of FOLDERS) {
  const r = {};
  try {
    await openTab(BASE + f + '/deck.html'); await sleep(1400);
    r.info = await page.evaluate(() => { const D = window.DeckRuntime; if (!D) return { noRuntime: true, title: document.title }; return { slides: D.count(), title: document.title, fig: !!window.FigEditor }; });
    if (r.info && !r.info.noRuntime) {
      r.quality = JSON.parse(await page.evaluate(SNIP));
      /* 앞으로 끝까지: next() 를 반복해 더 나아가지 않을 때까지 */
      r.walk = await page.evaluate(async () => {
        const D = window.DeckRuntime; D.go(0, 0); let g = 0; const seen = [];
        while (g < 500) { const a = D.cur() + '.' + D.step(); D.next(); await new Promise(r => setTimeout(r, 0)); const b = D.cur() + '.' + D.step(); seen.push(b); if (a === b) break; g++; }
        return { steps: seen.length, cur: D.cur(), step: D.step(), count: D.count(), maxLast: D.maxStep() };
      });
      r.reachEnd = r.walk.cur === r.walk.count - 1 && r.walk.step === r.walk.maxLast;
      /* 뒤로 처음까지 */
      r.back = await page.evaluate(async () => {
        const D = window.DeckRuntime; let g = 0;
        while (g < 500) { const a = D.cur() + '.' + D.step(); D.prev(); await new Promise(r => setTimeout(r, 0)); const b = D.cur() + '.' + D.step(); if (a === b) break; g++; }
        return { cur: D.cur(), step: D.step() };
      });
      r.backOk = r.back.cur === 0 && r.back.step === 0;
      /* 슬라이드별 스크린샷. 장면 0은 단계 공개 덱에서 빈 판이 되므로,
         모든 장면을 펼치고 카메라·딤을 푼 "슬라이드 전체 내용" 상태로 찍는다 */
      const shots = [];
      for (let i = 0; i < r.info.slides && i < 8; i++) {
        await page.evaluate(i => {
          const D = window.DeckRuntime; D.go(i, 0);
          const sl = document.querySelectorAll('.deck section.slide')[i];
          sl.querySelectorAll('[data-step]').forEach(el => {
            el.classList.add('step-on');
            if (el.classList.contains('fig-edge')) { if (el._g) el._g.style.opacity = ''; if (el._label) el._label.style.opacity = ''; }
          });
          sl.querySelectorAll('.fig-canvas').forEach(cv => {
            cv.classList.remove('deck-dimmed');
            const w = cv.parentElement; if (w && w.classList.contains('fig-scale')) w.style.transform = '';
          });
          sl.querySelectorAll('.deck-focus').forEach(e => e.classList.remove('deck-focus'));
        }, i); await sleep(650);
        const p = './artifacts/' + f + '-' + i + '.png'; await page.screenshot({ path: p }); shots.push(p);
      }
      await page.evaluate(() => window.DeckRuntime.go(0, 0));
      r.shots = shots;
    }
  } catch (e) { r.error = String(e).slice(0, 300); }
  out[f] = r;
}
out.pwd = pwd; console.log('VERIFY ' + JSON.stringify(out));
