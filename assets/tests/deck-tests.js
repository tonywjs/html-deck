/* html-deck 런타임 회귀 테스트 (Aside repl 스크립트). run.sh가 예시를 조립해 http://127.0.0.1:8767 에 띄운 뒤 실행한다.
   각 테스트는 실제 키 입력·클릭으로 장면 진행, 역방향 복원, 편집 왕복, 타임라인, 저장 정화, undo 재마운트를 검증한다.
   전환 애니메이션 중에는 이전 슬라이드에도 .active가 남으므로 현재 슬라이드는 항상 인덱스로 잡는다. */
const BASE='http://127.0.0.1:8767/';
const R={}; function ok(name,cond,info){ R[name]={pass:!!cond,info:String(info).slice(0,400)}; }
const STATE=()=>page.evaluate(()=>{ const D=window.DeckRuntime; const sl=document.querySelectorAll('.deck section.slide')[D.cur()]; const cv=sl.querySelector('.fig-canvas'); const wrap=cv.parentElement;
  return {cur:D.cur(),step:D.step(),hash:location.hash,cam:wrap.style.transform||'',dim:cv.classList.contains('deck-dimmed'),
    focus:[].map.call(sl.querySelectorAll('.deck-focus'),function(e){return e.id||e.tagName;}).join(','),flows:sl.querySelectorAll('.deck-flow-anim').length,
    edgeHidden:[].filter.call(sl.querySelectorAll('.fig-edge'),function(e){return e._g&&e._g.style.opacity==='0';}).length,
    hubOn:!!sl.querySelector('#s2-hub.step-on'),pulse:sl.querySelectorAll('.deck-pulse').length,anims:document.getAnimations().length}; });
const at=(arr,c,s)=>arr.find(x=>x.cur===c-1&&x.step===s);
const SNIPPET=`(function(){ const R=window.DeckRuntime,F=window.FigEditor,FLOOR=14,FILL=70; const report=[];
  for(let i=0;i<R.count();i++){ R.go(i,999); F.fitAll(); const sl=document.querySelectorAll('.deck section.slide')[i];
    const out={slide:i+1,minFont:Infinity,fill:0};
    sl.querySelectorAll('.fig-canvas').forEach(cv=>{ const s=cv._scale||1,W=cv.offsetWidth,H=cv.offsetHeight; let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
      cv.querySelectorAll('.fig-node').forEach(n=>{x0=Math.min(x0,n.offsetLeft);y0=Math.min(y0,n.offsetTop);x1=Math.max(x1,n.offsetLeft+n.offsetWidth);y1=Math.max(y1,n.offsetTop+n.offsetHeight);});
      out.fill=Math.round(((x1-x0)*(y1-y0))/(W*H)*100);
      const w=document.createTreeWalker(cv,NodeFilter.SHOW_TEXT,null);
      while(w.nextNode()){ const t=w.currentNode; if(!t.textContent.trim()) continue; const el=t.parentElement; if(!el||el.closest('[data-fig-ui]')) continue;
        const fs=parseFloat(getComputedStyle(el).fontSize)*s; if(fs<out.minFont) out.minFont=fs; } });
    out.minFont=Math.round(out.minFont*10)/10; out.pass=out.minFont>=FLOOR&&out.fill>=FILL; report.push(out); }
  R.go(0,0); return JSON.stringify(report); })()`;
// ---- T1~T3: 장면 진행 · 역방향 복원 (demo) ----
await openTab(BASE+'demo-deck.html'); await sleep(900);
const s0=await STATE(); const cnt=await page.evaluate(()=>window.DeckRuntime.count()); const title=await page.evaluate(()=>document.title);
ok('T1_init', s0.cur===0&&s0.step===0&&cnt===5&&!!title&&!title.includes('<!--'), JSON.stringify(s0)+' count='+cnt+' title='+title);
const fwd=[]; for(let i=0;i<22;i++){ await page.keyboard.press('ArrowRight'); await sleep(140); fwd.push(await STATE()); }
const end=fwd[fwd.length-1], a20=at(fwd,2,0), a21=at(fwd,2,1), a22=at(fwd,2,2), a23=at(fwd,2,3), a30=at(fwd,3,0), a34=at(fwd,3,4), a36=at(fwd,3,6), a43=at(fwd,4,3), a50=at(fwd,5,0), a51=at(fwd,5,1), a52=at(fwd,5,2);
ok('T2a_forward_to_end', end.cur===4&&end.step===2&&end.hash==='#5.2', JSON.stringify(end));
ok('T2b_2.0_hidden_edges', a20&&a20.edgeHidden===6&&!a20.hubOn&&a20.flows===0&&!a20.cam, JSON.stringify(a20));
ok('T2c_2.1_flow', a21&&a21.flows===3&&a21.edgeHidden===3&&a21.hubOn&&!a21.cam, JSON.stringify(a21));
ok('T2d_2.2_focus', a22&&/scale\(2\)/.test(a22.cam)&&a22.dim&&a22.focus.indexOf('s2-hub')>=0&&a22.flows===3, JSON.stringify(a22));
/* T2d2: focus 의 대상 표시는 딤을 꺼도 유지된다 (확대 전용 설명을 거는 CSS 훅) */
await page.evaluate(()=>{ const sl=document.querySelectorAll('.deck section.slide')[1]; const fx=[].find.call(sl.querySelectorAll('.fx'),f=>f.dataset.fx==='focus'); fx.dataset.dim='false'; });
await page.evaluate(()=>window.DeckRuntime.go(1,2)); await sleep(300);
const dimoff=await page.evaluate(()=>{ const sl=document.querySelectorAll('.deck section.slide')[1]; const cv=sl.querySelector('.fig-canvas'); return {focus:!!sl.querySelector('#s2-hub.deck-focus'), dimmed:cv.classList.contains('deck-dimmed'), cam:cv.parentElement.style.transform}; });
await page.evaluate(()=>{ const sl=document.querySelectorAll('.deck section.slide')[1]; const fx=[].find.call(sl.querySelectorAll('.fx'),f=>f.dataset.fx==='focus'); delete fx.dataset.dim; });
ok('T2d2_focus_marks_target_without_dim', dimoff.focus&&!dimoff.dimmed&&/scale\(2\)/.test(dimoff.cam), JSON.stringify(dimoff));
await page.evaluate(()=>window.DeckRuntime.go(999,999)); await sleep(400);   /* 역방향 검사를 위해 끝으로 되돌려 둔다 */
ok('T2e_2.3_reset_backflow', a23&&!a23.cam&&!a23.dim&&a23.focus===''&&a23.flows===3&&a23.edgeHidden===0, JSON.stringify(a23));
ok('T2f_3.0_transition_anims', a30&&a30.anims>0, JSON.stringify(a30));
ok('T2g_3.4_3.6_focus_cards', a34&&/scale\(1\.5\)/.test(a34.cam)&&a34.focus==='s3-c1'&&a36&&a36.focus==='s3-c3', JSON.stringify(a34)+' '+JSON.stringify(a36));
ok('T2h_4.3_pulse', a43&&a43.pulse===1, JSON.stringify(a43));
ok('T2i_5_view_journey', a50&&/scale\(1\.6/.test(a50.cam)&&a51&&/scale\(0\.9[34]/.test(a51.cam)&&a52&&/scale\(1\.6/.test(a52.cam)&&a52.pulse===1, JSON.stringify(a50)+' '+JSON.stringify(a51)+' '+JSON.stringify(a52));
const bwd=[]; for(let i=0;i<22;i++){ await page.keyboard.press('ArrowLeft'); await sleep(140); bwd.push(await STATE()); }
const bEnd=bwd[bwd.length-1], b35=at(bwd,3,5), b22=at(bwd,2,2), b21=at(bwd,2,1);
ok('T3a_back_to_start', bEnd.cur===0&&bEnd.step===0&&bEnd.hash==='#1', JSON.stringify(bEnd));
ok('T3b_back_restores_focus_flow', b35&&b35.focus==='s3-c2'&&b22&&b22.dim&&b22.focus.indexOf('s2-hub')>=0&&/scale\(2\)/.test(b22.cam)&&b21&&b21.flows===3&&!b21.cam&&b21.edgeHidden===3, JSON.stringify(b35)+' '+JSON.stringify(b22)+' '+JSON.stringify(b21));
// ---- T4: 오버뷰 · 노트 · 숫자 점프 · 해시 ----
await page.keyboard.press('Escape'); await sleep(250);
const ov=await page.evaluate(()=>({open:document.getElementById('deckOv').classList.contains('open'),cards:document.querySelectorAll('#dovGrid .card').length}));
await page.evaluate(()=>document.querySelectorAll('#dovGrid .card')[2].click()); await sleep(400);
const s3=await STATE(); const ovClosed=await page.evaluate(()=>!document.getElementById('deckOv').classList.contains('open'));
await page.keyboard.press('n'); await sleep(150);
const nt=await page.evaluate(()=>({open:document.getElementById('deckNotes').classList.contains('open'),len:document.getElementById('dnBody').textContent.trim().length}));
await page.keyboard.press('n'); await sleep(100);
await page.keyboard.press('4'); await page.keyboard.press('Enter'); await sleep(400); const s4=await STATE();
ok('T4a_overview_notes_numjump', ov.open&&ov.cards===5&&s3.cur===2&&s3.step===0&&ovClosed&&nt.open&&nt.len>5&&s4.cur===3&&s4.step===0, JSON.stringify(ov)+' '+JSON.stringify(nt)+' '+JSON.stringify(s4));
await page.evaluate(()=>{ location.hash='#2.1'; }); await sleep(500); const hc=await STATE();
ok('T4b_hashchange_navigates', hc.cur===1&&hc.step===1&&hc.flows===3, JSON.stringify(hc));
await page.evaluate(()=>{ window.DeckRuntime.go(4,0); const b=document.getElementById('dhNext'); b.focus(); window.__clicks=0; b.addEventListener('click',function(){window.__clicks++;}); b.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,cancelable:true})); b.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true,cancelable:true})); }); await sleep(200);
const sp=await page.evaluate(()=>({step:window.DeckRuntime.step(),clicks:window.__clicks}));
ok('T4c_space_on_focused_button_single_advance', sp.step===1&&sp.clicks===0, JSON.stringify(sp));
// ---- T5: 품질 스니펫(인덱스 기준) ----
const q=JSON.parse(await page.evaluate(SNIPPET));
ok('T5_quality_snippet_demo', q.every(x=>x.pass)&&q[4].fill>=80, JSON.stringify(q));
// ---- T6~T8: 편집 왕복 · 저장 정화 · 저장본 재로드 ----
await page.evaluate(()=>window.DeckRuntime.go(1,2)); await sleep(400);
await page.keyboard.press('Meta+e'); await sleep(500);
const e1=await page.evaluate(()=>{ const sl=document.querySelectorAll('.deck section.slide')[1]; const cv=sl.querySelector('.fig-canvas'); const wrap=cv.parentElement; return {editing:document.body.classList.contains('fig-editing'), tl:document.getElementById('deckTl').classList.contains('open'), allOn:[].every.call(sl.querySelectorAll('[data-step]'),function(e){return e.classList.contains('step-on');}), camComputed:getComputedStyle(wrap).transform, dim:cv.classList.contains('deck-dimmed'), cols:document.querySelectorAll('#tlCols .tl-col').length, items:document.querySelectorAll('#tlCols .tl-item').length, edgesVisible:[].every.call(sl.querySelectorAll('.fig-edge'),function(e){return e._g&&e._g.style.opacity!=='0';}), startIns:!!document.querySelector('#tlCols .tl-col[data-n="0"] .tl-ins'), col1Ins:!!document.querySelector('#tlCols .tl-col[data-n="1"] .tl-ins')}; });
ok('T6a_edit_reveals_all_timeline', e1.editing&&e1.tl&&e1.allOn&&e1.camComputed==='none'&&!e1.dim&&e1.cols===4&&e1.items===16&&e1.edgesVisible&&!e1.startIns&&e1.col1Ins, JSON.stringify(e1));
const ser=await page.evaluate(()=>{ const h=window.FigEditor.serialize(); const doc=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,''); return {body:(doc.match(/<body[^>]*>/)||[''])[0], stepOn:(doc.match(/step-on/g)||[]).length, noise:(doc.match(/deck-focus|deck-dimmed|deck-flow-anim|deck-pulse|deck-no-anim|tl-target-hint/g)||[]).length, slideStyle:(doc.match(/<section class="slide[^>]*style=/g)||[]).length, slideActive:(doc.match(/class="slide[^"]*active/g)||[]).length, ui:/id="deckTl"|id="deckHud"|id="deckPrintStyle"|class="fig-scale"/.test(doc), figEditing:/<body[^>]*fig-editing/.test(doc), doctype:h.startsWith('<!DOCTYPE html>'), len:h.length}; });
ok('T6b_serialize_clean', ser.stepOn===0&&ser.noise===0&&ser.slideStyle===0&&ser.slideActive===0&&!ser.ui&&!ser.figEditing&&ser.doctype&&!/deck-tl-open|deck-step-preview|deck-doc/.test(ser.body), JSON.stringify(ser));
const html=await page.evaluate(()=>window.FigEditor.serialize());
await page.keyboard.press('Meta+e'); await sleep(400);
const x1=await STATE();
ok('T6c_exit_edit_restores_scene', x1.cur===1&&x1.step===2&&/scale\(2\)/.test(x1.cam)&&x1.dim&&x1.focus.indexOf('s2-hub')>=0, JSON.stringify(x1));
await openTab('about:blank'); await page.evaluate(h=>{ document.open(); document.write(h); document.close(); }, html); await sleep(1200);
const rl=await page.evaluate(()=>{ const D=window.DeckRuntime; const sl=document.querySelectorAll('.deck section.slide')[D.cur()]; return {bodyCls:document.body.className, fit:sl._fit, expected:Math.min(innerWidth/1280,innerHeight/720)*0.95, deckH:Math.round(document.querySelector('.deck').getBoundingClientRect().height), inner:innerHeight, cur:D.cur(), step:D.step(), hubOn:!!document.querySelector('#s2-hub.step-on'), editing:document.body.classList.contains('fig-editing')}; });
ok('T7_saved_doc_reloads_clean', Math.abs(rl.fit-rl.expected)<0.001&&rl.deckH===rl.inner&&rl.cur===0&&rl.step===0&&!rl.hubOn&&!rl.editing&&rl.bodyCls==='deck-doc', JSON.stringify(rl));
// ---- T8: 타임라인 조작 · undo 재마운트 ----
await openTab(BASE+'demo-deck.html'); await sleep(900);
await page.evaluate(()=>window.DeckRuntime.go(1,2)); await sleep(300);
await page.keyboard.press('Meta+e'); await sleep(400);
await page.evaluate(()=>{ window.FigEditor.select(document.getElementById('s2-cap')); document.getElementById('tlAppear').click(); }); await sleep(300);
const t1=await page.evaluate(()=>({step:document.getElementById('s2-cap').dataset.step, cols:document.querySelectorAll('#tlCols .tl-col').length, max:window.DeckRuntime.maxStep()}));
await page.evaluate(()=>{ document.querySelectorAll('#tlCols .tl-num')[1].click(); }); await sleep(300);
const t2=await page.evaluate(()=>{ const sl=document.querySelectorAll('.deck section.slide')[1]; return {prev:document.body.classList.contains('deck-step-preview'), quoteOff:!document.getElementById('s2-quote').classList.contains('step-on'), hubOn:document.getElementById('s2-hub').classList.contains('step-on'), flows:sl.querySelectorAll('.deck-flow-anim').length}; });
await page.evaluate(()=>{ document.getElementById('tlAll').click(); }); await sleep(200);
await page.evaluate(()=>{ const cols=document.querySelectorAll('#tlCols .tl-col'); cols[cols.length-1].querySelector('.tl-del').click(); }); await sleep(300);
const t3=await page.evaluate(()=>({step:document.getElementById('s2-cap').dataset.step||null, max:window.DeckRuntime.maxStep()}));
ok('T8a_timeline_add_preview_delete', t1.step==='4'&&t1.cols===5&&t1.max===4&&t2.prev&&t2.quoteOff&&t2.hubOn&&t2.flows===3&&t3.step===null&&t3.max===3, JSON.stringify(t1)+' '+JSON.stringify(t2)+' '+JSON.stringify(t3));
await page.keyboard.press('Meta+z'); await sleep(700);
const t4=await page.evaluate(()=>({hud:!!document.getElementById('deckHud'), tlOpen:!!document.getElementById('deckTl')&&document.getElementById('deckTl').classList.contains('open'), editing:document.body.classList.contains('fig-editing'), step:document.getElementById('s2-cap').dataset.step||null, count:window.DeckRuntime.count(), cur:window.DeckRuntime.cur(), cols:document.querySelectorAll('#tlCols .tl-col').length, slideSized:!!document.querySelectorAll('.deck section.slide')[1].style.width}));
ok('T8b_undo_restores_and_remounts', t4.hud&&t4.tlOpen&&t4.editing&&t4.step==='4'&&t4.count===5&&t4.cur===1&&t4.cols===5&&t4.slideSized, JSON.stringify(t4));
await page.keyboard.press('Meta+z'); await sleep(500);
await page.evaluate(()=>window.DeckRuntime.go(4,0)); await sleep(300);
const v0=await page.evaluate(()=>[].map.call(document.querySelectorAll('.deck section.slide')[4].querySelectorAll('.fx[data-fx="view"]'),function(f){return f.dataset.step;}).join(','));
await page.evaluate(()=>{ document.querySelector('#tlCols .tl-col[data-n="1"] .tl-ins').click(); }); await sleep(300);
const v1=await page.evaluate(()=>[].map.call(document.querySelectorAll('.deck section.slide')[4].querySelectorAll('.fx[data-fx="view"]'),function(f){return f.dataset.step;}).join(','));
ok('T8c_insert_scene_keeps_step0_view', v0==='0,1,2'&&v1==='0,2,3', 'before='+v0+' after='+v1);
await page.keyboard.press('Meta+z'); await sleep(400); await page.keyboard.press('Meta+e'); await sleep(300);
// ---- T9: 배포용 내보내기(편집기 제거)에서도 장면·화살표·라벨·여정 카메라가 동작한다 (슬라이드 1이 활성인 상태에서 내보냄) ----
await openTab(BASE+'demo-deck.html'); await sleep(900);
const exh=await page.evaluate(()=>window.FigEditor.exportStatic());
const exNodes=exh.match(/<div[^>]*class="[^"]*fig-node[^"]*"[^>]*>/g)||[];
const exDoc=exh.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'');
const exStat={engine:exh.includes('fig-editor.js: 편집 가능한'), deckJs:exh.includes('deck-runtime.js: HTML 발표자료'), zeroH:exNodes.filter(n=>/height:\s*0px/.test(n)).length, degenerate:(exh.match(/d="M0,0 Q0,0 0,0"/g)||[]).length, shownLeak:(exDoc.match(/data-fig-shown|<section class="slide[^>]*style=/g)||[]).length, stepOn:(exDoc.match(/step-on/g)||[]).length, body:(exDoc.match(/<body[^>]*>/)||[''])[0]};
await openTab('about:blank'); await page.evaluate(h=>{ document.open(); document.write(h); document.close(); }, exh); await sleep(1200);
const exr=await page.evaluate(()=>{ const D=window.DeckRuntime; const sl=document.querySelectorAll('.deck section.slide'); D.go(1,0); const e2=[].slice.call(sl[1].querySelectorAll('.fig-edge')); const o={static:!!window.FigEditor.static, bound:e2.filter(e=>e._g).length, geom:e2.filter(e=>e._geom).length, hidden20:e2.filter(e=>e._g&&e._g.style.opacity==='0').length}; D.go(1,1); o.flows21=sl[1].querySelectorAll('.deck-flow-anim').length; o.hidden21=e2.filter(e=>e._g&&e._g.style.opacity==='0').length; const lp=document.getElementById('e2-p')._label; o.labelOn21=!!lp&&lp.style.opacity!=='0'&&lp.textContent.indexOf('전송')>=0; D.go(1,2); o.dim22=sl[1].querySelector('.fig-canvas').classList.contains('deck-dimmed'); D.go(4,0); const cv=sl[4].querySelector('.fig-canvas'); o.jScale=Math.round((cv._scale||0)*100)/100; o.jCam=cv.parentElement.style.transform; return o; });
ok('T9_export_static_scenes_work', !exStat.engine&&exStat.deckJs&&exStat.zeroH===0&&exStat.degenerate===0&&exStat.shownLeak===0&&exStat.stepOn===0&&exStat.body==='<body>'&&exr.static&&exr.bound===6&&exr.geom===6&&exr.hidden20===6&&exr.flows21===3&&exr.hidden21===3&&exr.labelOn21&&exr.dim22&&exr.jScale===0.58&&/scale\(1\.6/.test(exr.jCam), JSON.stringify(exStat)+' '+JSON.stringify(exr));
// ---- T10: green 예시 · 템플릿 ----
await openTab(BASE+'green-test-roadmap.html'); await sleep(900);
let last='',n=0; for(let i=0;i<40;i++){ await page.keyboard.press('ArrowRight'); await sleep(90); const h=await page.evaluate(()=>location.hash); if(h===last) break; last=h; n++; }
const g42=await page.evaluate(()=>{ window.DeckRuntime.go(3,2); const sl=document.querySelectorAll('.deck section.slide')[3]; const cv=sl.querySelector('.fig-canvas'); return {cam:cv.parentElement.style.transform, dim:cv.classList.contains('deck-dimmed'), focus:!!document.querySelector('#s4-hub.deck-focus'), flows:sl.querySelectorAll('.deck-flow-anim').length, detailOn:document.querySelector('#s4-hub .hdetail').classList.contains('step-on')}; });
for(let i=0;i<40;i++){ await page.keyboard.press('ArrowLeft'); await sleep(50); }
const h0=await page.evaluate(()=>location.hash+' '+window.DeckRuntime.cur()+'.'+window.DeckRuntime.step());
const gq=JSON.parse(await page.evaluate(SNIPPET));
ok('T10a_green_traverse_focus_quality', last==='#5.4'&&/scale\(1\.85\)/.test(g42.cam)&&g42.dim&&g42.focus&&g42.flows===4&&g42.detailOn&&h0.startsWith('#1 0.0')&&gq.every(x=>x.pass), last+' '+JSON.stringify(g42)+' '+h0+' '+JSON.stringify(gq));
await openTab(BASE+'template.html'); await sleep(700);
const tp=await page.evaluate(()=>({title:document.title, count:window.DeckRuntime.count(), hud:!!document.getElementById('deckHud'), print:!!document.getElementById('deckPrintStyle')}));
ok('T10b_template_loads', !tp.title.includes('<!--')&&tp.count===1&&tp.hud&&tp.print, JSON.stringify(tp));
const passed=Object.values(R).filter(r=>r.pass).length; console.log('RESULT', passed+'/'+Object.keys(R).length, JSON.stringify(R,null,1));
