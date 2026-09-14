/* ================================================================
   deck-runtime.js: HTML 발표자료 장면(step) 런타임
   규약: .deck[data-slide-size] > section.slide > (fig-canvas …)
   - → 키는 "장면"을 진행한다: 요소 공개(data-step), 연출(.fx 디렉티브)
   - .fx: data-fx="focus|view|flow|pulse|reset" data-target="#id" (view는 data-rect="x,y,w,h"도 가능) data-step="n[-m]"
   - fig-editor와 공존: 편집 모드(⌘E)에서는 장면을 전부 펼치고 카메라 해제
   ================================================================ */
(function(){
'use strict';
var body=document.body;
function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

var deck=$('.deck');
if(!deck) return;
body.classList.add('deck-doc');

var slides=$$('.deck section.slide');
if(!slides.length) return;
var cur=0, step=0, numBuf='', numT=null, wasEditing=false;

/* ---------------- 크기 맞춤 ---------------- */
function slideSize(){
  var m=(deck.dataset.slideSize||'1280x720').match(/(\d+)\s*[x×]\s*(\d+)/i);
  return m?{w:+m[1],h:+m[2]}:{w:1280,h:720};
}
function fit(){
  var s=slideSize(), aw=deck.clientWidth||innerWidth, ah=deck.clientHeight||innerHeight;
  var f=Math.min(aw/s.w, ah/s.h)*0.95;
  slides.forEach(function(sl){
    sl._fit=f;
    sl.style.width=s.w+'px'; sl.style.height=s.h+'px';
    sl.style.transform='translate(-50%,-50%) scale('+f+')';
  });
}
function reduceMotion(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
/* ================================================================
   슬라이드 전환. 모션그래픽 안무.
   프레임(슬라이드 테두리)은 절대 움직이지 않는다. 내용 요소들이
   읽기 순서대로 시차를 두고 이어진다(캐스케이드): 박스가 먼저
   자리 잡고, 화살표는 한 박자 늦게 떠오른다.
   프리셋: rise(기본) | flow | zoom-in | zoom-out | none.
   개별 translate/scale 속성 + 암시적 종료값(WAAPI)이라
   카메라 transform·딤 상태와 충돌하지 않는다.
   ================================================================ */
var EASE_OUT='cubic-bezier(.16,1,.3,1)';      /* expo-out: 빠르게 도착해 부드럽게 정착 */
var EASE_IN='cubic-bezier(.5,0,.9,.4)';       /* 퇴장: 가속하며 사라짐 */
function visibleNodes(sl){
  return $$('.fig-node',sl).filter(function(n){
    return !n.hasAttribute('data-step')||n.classList.contains('step-on');
  }).sort(function(a,b){ return (a.offsetTop-b.offsetTop)||(a.offsetLeft-b.offsetLeft); });
}
function edgeLayers(sl){
  var arr=$$('.fig-edges',sl);
  $$('.fig-elabel',sl).forEach(function(l){ if(l.style.opacity!=='0') arr.push(l); });
  return arr;
}
function transVec(type,back){
  var d=back?-1:1;
  switch(type){
    case 'flow':     return {out:{x:-84*d,y:0,s:1},   inn:{x:96*d,y:0,s:1}};
    case 'zoom-in':  return back
      ? {out:{x:0,y:0,s:0.92}, inn:{x:0,y:0,s:1.1}}
      : {out:{x:0,y:0,s:1.1},  inn:{x:0,y:0,s:0.92}};
    case 'zoom-out': return back
      ? {out:{x:0,y:0,s:1.1},  inn:{x:0,y:0,s:0.92}}
      : {out:{x:0,y:0,s:0.92}, inn:{x:0,y:0,s:1.1}};
    case 'fade':     return {out:{x:0,y:0,s:1},       inn:{x:0,y:0,s:1}};
    default:         /* rise */
      return {out:{x:0,y:-16*d,s:1}, inn:{x:0,y:30*d,s:0.985}};
  }
}
/* 진입 안무. 요소 캐스케이드 + 화살표 지연 페이드 */
function animateIn(sl,v,extraDelay){
  var base=extraDelay||0;
  visibleNodes(sl).forEach(function(el,i){
    el.animate(
      [{opacity:0, translate:v.x+'px '+v.y+'px', scale:String(v.s)}, {}],
      {duration:560, delay:base+Math.min(i*46,320), easing:EASE_OUT, fill:'backwards'});
  });
  edgeLayers(sl).forEach(function(el){
    el.animate([{opacity:0},{}],
      {duration:420, delay:base+300, easing:'ease-out', fill:'backwards'});
  });
}
function animateOut(sl,v){
  var anims=[];
  visibleNodes(sl).forEach(function(el,i){
    anims.push(el.animate(
      [{}, {opacity:0, translate:v.x+'px '+v.y+'px', scale:String(v.s)}],
      {duration:230, delay:Math.min(i*16,80), easing:EASE_IN, fill:'both'}));
  });
  edgeLayers(sl).forEach(function(el){
    anims.push(el.animate([{},{opacity:0}],{duration:170, easing:'ease-in', fill:'both'}));
  });
  return anims;
}
function playTransition(oldSl,newSl,type,back){
  if(!oldSl||oldSl===newSl||type==='none'||reduceMotion()) return;
  var v=transVec(type||'rise',back);
  oldSl.classList.add('active');   /* 두 프레임을 겹쳐 두면 프레임은 고정된 것처럼 보인다 */
  oldSl.style.zIndex='1'; newSl.style.zIndex='2';
  var outAnims=[], finished=false;
  function done(){
    if(finished) return; finished=true;
    /* 그 사이 이전 슬라이드로 되돌아왔을 수 있다. 현재 슬라이드는 숨기지 않는다 */
    if(slides[cur]!==oldSl) oldSl.classList.remove('active');
    oldSl.style.zIndex=''; newSl.style.zIndex='';
    /* fill:both 잔존 해제. 재방문 시 요소가 안 보이는 문제 방지 */
    outAnims.forEach(function(a){ try{ a.cancel(); }catch(e){} });
  }
  try{
    outAnims=animateOut(oldSl,v.out);
    animateIn(newSl,v.inn,130);
    try{ Promise.all(outAnims.map(function(a){ return a.finished.catch(function(){}); })).then(done); }catch(e){}
    setTimeout(done,1200);         /* 백그라운드 탭 등 타이머 스로틀 대비 이중 백업 */
  }catch(e){ done(); }
}
/* 진입 슬라이드의 잔존 애니메이션 전면 청소. 어떤 경로로도 fill 잔존 상태로 진입하지 않게 */
function cancelResidualAnims(sl){
  try{
    $$('.fig-node,.fig-edges,.fig-elabel',sl).forEach(function(el){
      el.getAnimations().forEach(function(a){ try{ a.cancel(); }catch(e){} });
    });
  }catch(e){}
}
/* 첫 로드 인트로. 시작 슬라이드도 안무와 함께 등장 */
function playIntro(){
  if(reduceMotion()) return;
  try{ animateIn(slides[cur],{x:0,y:26,s:0.99},80); }catch(e){}
}

/* ---------------- 배포본(편집기 제거) 호환 ----------------
   배포용 저장 파일에는 엔진 대신 뷰어 스텁만 남아 화살표를 다시 그리지 않는다. 구워진 SVG g·라벨을 .fig-edge에
   순서대로 묶고 경로에서 기하를 복원해, 장면별 화살표 숨김·흐름·edge focus가 배포본에서도 동작하게 한다 */
function isStatic(){ return !!(window.FigEditor&&window.FigEditor.static); }
function bindStaticEdges(){
  if(!isStatic()) return;
  $$('.fig-canvas').forEach(function(cv){
    var svg=cv.querySelector(':scope > .fig-edges'); if(!svg) return;
    var gs=$$(':scope > g',svg), edges=$$('.fig-edge',cv);
    if(gs.length!==edges.length) return;
    var labels=$$(':scope > .fig-elabel',cv), used=[];
    edges.forEach(function(e,i){
      var g=gs[i]; e._g=g; g._edge=e;
      var pth=g.querySelector('.fe-main'), d=(pth&&pth.getAttribute('d'))||'';
      var m=/M([-\d.]+),([-\d.]+)\s*Q([-\d.]+),([-\d.]+)\s+([-\d.]+),([-\d.]+)/.exec(d);
      if(m) e._geom={p0:{x:+m[1],y:+m[2]},ctrl:{x:+m[3],y:+m[4]},p1:{x:+m[5],y:+m[6]}};
      if(!e.dataset.label) return;
      /* 라벨은 곡선 중앙에 놓이므로 좌표로 짝을 찾는다(경로 끝이 화살촉만큼 짧아 몇 px 오차 허용). 못 찾으면 순서로 */
      var best=null, bd=1/0;
      if(e._geom){ var gm=e._geom, mx=0.25*gm.p0.x+0.5*gm.ctrl.x+0.25*gm.p1.x, my=0.25*gm.p0.y+0.5*gm.ctrl.y+0.25*gm.p1.y;
        labels.forEach(function(l){ if(used.indexOf(l)>=0) return; var dx=parseFloat(l.style.left)-mx, dy=parseFloat(l.style.top)-my; var dd=dx*dx+dy*dy; if(dd<bd){ bd=dd; best=l; } });
        if(bd>20*20) best=null; }
      if(!best) best=labels.filter(function(l){ return used.indexOf(l)<0; })[0]||null;
      if(best){ used.push(best); e._label=best; best._edge=e; }
    });
  });
}
/* 뷰어 스텁의 fit()은 캔버스 축소 배율(_scale)을 남기지 않는다. transform에서 읽어 채운다 */
function syncStaticScale(){
  if(!isStatic()) return;
  $$('.fig-canvas').forEach(function(cv){ var m=/scale\(([\d.]+)\)/.exec(cv.style.transform||''); cv._scale=m?parseFloat(m[1]):1; });
}
function engineFit(){ if(window.FigEditor){ window.FigEditor.fitAll(); syncStaticScale(); } }

/* ---------------- 장면 파싱 ---------------- */
function parseRange(v){
  var m=/^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(v||'');
  if(!m) return {from:0,to:Infinity};
  return {from:+m[1], to:m[2]?+m[2]:Infinity};
}
function maxStep(sl){
  var mx=0;
  $$('[data-step]',sl).forEach(function(el){
    var r=parseRange(el.dataset.step);
    mx=Math.max(mx, r.from, (r.to!==Infinity)?r.to:r.from);
  });
  return mx;
}

/* ---------------- fx 누적 상태 ---------------- */
function fxState(sl,n){
  var cam=null, flows=[];
  $$('.fx',sl).map(function(el){
    var r=parseRange(el.dataset.step);
    return {el:el,from:r.from,to:r.to,kind:el.dataset.fx||''};
  }).sort(function(a,b){ return a.from-b.from; })
  .forEach(function(f){
    if(f.from>n) return;
    if(f.kind==='focus'){ cam={target:f.el.dataset.target, zoom:parseFloat(f.el.dataset.zoom||'1.8'), dim:f.el.dataset.dim!=='false', fit:false}; }
    else if(f.kind==='view'){ /* 영역을 화면에 채우는 카메라. 여정형 캔버스용 */
      cam={target:f.el.dataset.target, rect:f.el.dataset.rect, zoom:parseFloat(f.el.dataset.zoom||'0'), dim:f.el.dataset.dim==='true', fit:true}; }
    else if(f.kind==='reset'){ cam=null; flows=[]; }
    else if(f.kind==='flow'&&n>=f.from&&n<=f.to){ flows.push(f.el.dataset.target); }
  });
  return {cam:cam, flows:flows};
}
function regionOf(sl,cam){
  /* 카메라 대상 영역 계산: data-rect="x,y,w,h" 또는 노드/엣지 target */
  if(cam.rect){
    var m=cam.rect.split(',').map(parseFloat);
    if(m.length===4&&m.every(isFinite)){
      var cv0=sl.querySelector('.fig-canvas');
      if(cv0) return {cv:cv0, x:m[0],y:m[1],w:m[2],h:m[3], el:null};
    }
    return null;
  }
  var el=null; try{ el=sl.querySelector(cam.target); }catch(e){}
  if(!el) return null;
  var cv=el.closest('.fig-canvas'); if(!cv) return null;
  if(el.classList.contains('fig-edge')){
    var g=el._geom; if(!g) return null;
    var mx=0.25*g.p0.x+0.5*g.ctrl.x+0.25*g.p1.x;
    var my=0.25*g.p0.y+0.5*g.ctrl.y+0.25*g.p1.y;
    return {cv:cv, x:mx-60,y:my-60,w:120,h:120, el:el};
  }
  var x=0,y=0,n=el;
  while(n&&n!==cv&&n!==document.body){ x+=n.offsetLeft; y+=n.offsetTop; n=n.offsetParent; }
  return {cv:cv, x:x,y:y,w:el.offsetWidth,h:el.offsetHeight, el:el};
}
function clearFx(sl){
  $$('.fig-canvas',sl).forEach(function(cv){
    cv.classList.remove('deck-dimmed');
    var w=cv.parentElement;
    if(w&&w.classList.contains('fig-scale')){ w.style.transform=''; }
  });
  $$('.deck-focus',sl).forEach(function(el){ el.classList.remove('deck-focus'); });
  $$('.deck-flow-anim',sl).forEach(function(el){ el.classList.remove('deck-flow-anim'); });
}
function markFocus(el){
  if(el.classList.contains('fig-edge')){
    if(el._g) el._g.classList.add('deck-focus');
    if(el._label) el._label.classList.add('deck-focus');
  } else {
    var node=el.classList.contains('fig-node')?el:el.closest('.fig-node');
    (node||el).classList.add('deck-focus');
  }
}
function applyFx(sl,n){
  clearFx(sl);
  var st=fxState(sl,n);
  if(st.cam&&(st.cam.target||st.cam.rect)){
    var ri=regionOf(sl,st.cam);
    if(ri){
      var wrap=ri.cv.parentElement;
      if(wrap&&wrap.classList.contains('fig-scale')){
        var cs=ri.cv._scale||1;
        /* 뷰포트는 래퍼가 아니라 슬라이드 전체 기준 */
        var slW=sl.offsetWidth||wrap.clientWidth, slH=sl.offsetHeight||wrap.clientHeight;
        var z;
        if(st.cam.fit){ /* view: 영역이 슬라이드를 채우도록 줌 자동 계산 (data-zoom으로 강제 가능) */
          z=Math.min(slW/Math.max(1,ri.w*cs), slH/Math.max(1,ri.h*cs))*0.94;
          if(st.cam.zoom>0) z=st.cam.zoom;
          z=Math.max(0.05,Math.min(6,z));
        } else {
          z=st.cam.zoom||1.8;
        }
        var px=(ri.x+ri.w/2)*cs, py=(ri.y+ri.h/2)*cs;
        var Ow={x:wrap.clientWidth/2, y:wrap.clientHeight/2};
        /* 슬라이드 중심을 래퍼 로컬 좌표로 환산해 세로 오프셋 보정 */
        var Sc={x:slW/2-wrap.offsetLeft, y:slH/2-wrap.offsetTop};
        var tx=Ow.x-px+(Sc.x-Ow.x)/z, ty=Ow.y-py+(Sc.y-Ow.y)/z;
        wrap.style.transformOrigin='50% 50%';
        wrap.style.transform='scale('+z+') translate('+Math.round(tx)+'px,'+Math.round(ty)+'px)';
      }
      /* 대상 표시(.deck-focus)는 딤 여부와 무관하다. data-dim="false" 로 딤을 꺼도
         "확대됐을 때만 보이는 설명"을 거는 CSS 훅은 살아 있어야 한다 (SKILL.md의 focus 설명) */
      if(ri.el&&(!st.cam.fit||st.cam.dim)) markFocus(ri.el);
      if(st.cam.dim&&ri.el) ri.cv.classList.add('deck-dimmed');
    }
  }
  st.flows.forEach(function(sel){
    var e=null; try{ e=sl.querySelector(sel); }catch(err){}
    if(e&&e._g) e._g.classList.add('deck-flow-anim');
  });
}
/* 펄스는 실제 보이는 박스에. 투명 래퍼면 둥근 자식으로 내려가 모서리 빈틈 방지 */
function visualBox(el){
  var cur=el,hop=0;
  while(hop<3){
    var cs=getComputedStyle(cur);
    var noBg=(cs.backgroundColor==='rgba(0, 0, 0, 0)'||cs.backgroundColor==='transparent');
    var noBorder=(parseFloat(cs.borderTopWidth)||0)===0;
    if(!(noBg&&noBorder)) return cur;
    var kids=Array.prototype.filter.call(cur.children,function(k){ return k.nodeType===1; });
    if(kids.length!==1) return cur;
    cur=kids[0]; hop++;
  }
  return cur;
}
function firePulses(sl,n){
  $$('.fx',sl).forEach(function(el){
    if((el.dataset.fx||'')!=='pulse') return;
    if(parseRange(el.dataset.step).from!==n) return;
    var t=null; try{ t=sl.querySelector(el.dataset.target); }catch(e){}
    if(!t) return;
    var node=t.classList.contains('fig-node')?t:(t.closest?t.closest('.fig-node'):null);
    var tgt=visualBox(node||t);
    tgt.classList.add('deck-pulse');
    setTimeout(function(){ tgt.classList.remove('deck-pulse'); },1900);
  });
}

/* ---------------- 상태 적용 · 이동 ---------------- */
function applyStepVisibility(sl,n,editing){
  $$('[data-step]',sl).forEach(function(el){
    var r=parseRange(el.dataset.step);
    var on=editing||(n>=r.from&&n<=r.to);
    el.classList.toggle('step-on',on);
    if(el.classList.contains('fig-edge')){
      /* 엣지는 SVG 레이어로 렌더되므로 g/라벨에 직접 표시 상태 적용 */
      if(el._g) el._g.style.opacity=on?'':'0';
      if(el._label) el._label.style.opacity=on?'':'0';
    }
  });
}
/* 모든 슬라이드의 장면 상태를 선초기화. 첫 진입 때 "보였다 사라지는" 잔상 방지 */
function initAllSteps(){
  slides.forEach(function(sl,k){
    if(k!==cur) applyStepVisibility(sl,0,false);
  });
}
var previewStep=null;   /* 편집 모드에서 특정 장면을 미리보는 상태 (타임라인) */
function applyState(){
  var sl=slides[cur], editing=body.classList.contains('fig-editing');
  var revealAll = editing && previewStep==null;
  var n = editing ? (previewStep!=null?previewStep:step) : step;
  applyStepVisibility(sl,n,revealAll);
  if(!editing){ applyFx(sl,step); }
  else if(previewStep!=null){ applyFx(sl,previewStep); }
  else { clearFx(sl); }
  hud();
  if(!editing){ try{ history.replaceState(null,'','#'+(cur+1)+(step?'.'+step:'')); }catch(e){} }
}
function activate(i,s){
  var prev=cur, prevSl=slides[prev];
  cur=Math.max(0,Math.min(slides.length-1,i|0));
  step=Math.max(0,Math.min(maxStep(slides[cur]), s|0));
  var entering=slides[cur], changed=cur!==prev;
  /* 진입 프레임에는 트랜지션 전면 차단. 이전 상태에서 새 상태로 페이드되며
     "보였다 사라지는" 잔상이 어떤 경로로도 생기지 않게 한다 */
  if(changed){
    entering.classList.add('deck-no-anim'); cancelResidualAnims(entering);
    if(previewStep!=null){ previewStep=null; body.classList.remove('deck-step-preview'); }
  }
  slides.forEach(function(sl,k){ sl.classList.toggle('active',k===cur); });
  fit();
  engineFit(); if(window.FigEditor) window.FigEditor.renderAll();
  applyState();
  updateNotes();
  if(changed&&body.classList.contains('fig-editing')) renderTimeline();
  if(changed){
    var unblock=function(){ entering.classList.remove('deck-no-anim'); };
    requestAnimationFrame(function(){ requestAnimationFrame(unblock); });
    setTimeout(unblock,250);   /* 백그라운드 탭 등 rAF 정지 환경 대비 */
    if(!body.classList.contains('fig-editing')){
      var back=cur<prev;
      var type=back?(prevSl&&prevSl.dataset.transition):(entering.dataset.transition);
      playTransition(prevSl,entering,type,back);
    }
  }
}
function next(){
  if(step<maxStep(slides[cur])){ step++; applyState(); firePulses(slides[cur],step); }
  else if(cur<slides.length-1){ activate(cur+1,0); }
}
function prev(){
  if(step>0){ step--; applyState(); }
  else if(cur>0){ activate(cur-1, maxStep(slides[cur-1])); }
}

/* ---------------- HUD · 오버뷰 · 노트 ---------------- */
function mountUI(){
  if($('#deckHud')) return;
  /* 인쇄: 슬라이드 크기 = 종이 크기 (슬라이드당 한 장). body 안의 style은 data-fig-ui라 저장 시 제거된다 */
  var ps=document.createElement('style'); ps.id='deckPrintStyle'; ps.setAttribute('data-fig-ui','');
  var psz=slideSize(); ps.textContent='@page{size:'+psz.w+'px '+psz.h+'px;margin:0}';
  body.appendChild(ps);
  var hudEl=document.createElement('div');
  hudEl.className='deck-hud'; hudEl.id='deckHud'; hudEl.setAttribute('data-fig-ui','');
  hudEl.innerHTML='<button class="nav" id="dhPrev" title="이전 (←)">‹</button>'+
    '<span class="pg" id="dhPg"></span><span class="dots" id="dhDots"></span>'+
    '<button class="nav" id="dhNext" title="다음 (→)">›</button>'+
    '<span class="key">ESC</span><span class="key">N</span>';
  body.appendChild(hudEl);
  $('#dhPrev').addEventListener('click',prev);
  $('#dhNext').addEventListener('click',next);
  var ov=document.createElement('div');
  ov.className='deck-ov'; ov.id='deckOv'; ov.setAttribute('data-fig-ui','');
  ov.innerHTML='<h3>슬라이드 오버뷰. 클릭해 이동 · ESC 닫기</h3><div class="grid" id="dovGrid"></div>';
  body.appendChild(ov);
  ov.addEventListener('mousedown',function(e){ if(e.target===ov) closeOverview(); });
  var nt=document.createElement('div');
  nt.className='deck-notes'; nt.id='deckNotes'; nt.setAttribute('data-fig-ui','');
  nt.innerHTML='<div class="nt">발표자 노트</div><div id="dnBody"></div>';
  body.appendChild(nt);
}
function hud(){
  var pg=$('#dhPg'); if(!pg) return;
  pg.textContent=(cur+1)+' / '+slides.length;
  var mx=maxStep(slides[cur]), d=$('#dhDots'); d.innerHTML='';
  for(var i=0;i<=mx&&mx>0;i++){ var b=document.createElement('i'); if(i===step) b.className='on'; d.appendChild(b); }
}
function openOverview(){
  var g=$('#dovGrid'); if(!g) return; g.innerHTML='';
  slides.forEach(function(sl,i){
    var h=sl.querySelector('h1,h2,.slide-title');
    var t=sl.dataset.title||(h?h.textContent.trim():'슬라이드 '+(i+1));
    var mx=maxStep(sl);
    var c=document.createElement('button');
    c.className='card'+(i===cur?' cur':'');
    c.innerHTML='<div class="no">'+String(i+1).padStart(2,'0')+'</div><div class="tt">'+esc(t)+'</div>'+
      (mx?'<div class="st">장면 '+mx+'개</div>':'');
    c.onclick=function(){ closeOverview(); activate(i,0); };
    g.appendChild(c);
  });
  $('#deckOv').classList.add('open');
}
function closeOverview(){ var o=$('#deckOv'); if(o) o.classList.remove('open'); }
function updateNotes(){
  var b=$('#dnBody'); if(!b) return;
  var src=slides[cur].querySelector('aside.notes');
  b.innerHTML=src?src.innerHTML:'<span style="color:#7c8698">이 슬라이드에는 노트가 없습니다.</span>';
}
function toggleNotes(){ var n=$('#deckNotes'); if(n){ n.classList.toggle('open'); updateNotes(); } }

/* ================================================================
   장면 타임라인. 편집 모드에서 애니메이션(장면) 추가·수정·삭제
   장면 데이터는 [data-step] 속성과 .fx 지시자 요소가 원본이며,
   타임라인은 그 위의 편집 뷰다 (변경은 곧바로 저장/undo에 반영).
   ================================================================ */
function fxKindLabel(k){ return ({focus:'줌인',view:'카메라',flow:'흐름',pulse:'강조',reset:'해제'})[k]||k; }
function elLabel(el){
  if(!el) return '?';
  if(el.classList&&el.classList.contains('fig-edge')){
    return '화살표'+(el.dataset.label?'·'+el.dataset.label.slice(0,8):'');
  }
  var t=(el.textContent||'').trim().replace(/\s+/g,' ');
  return t?(t.length>9?t.slice(0,9)+'…':t):(el.id||'도형');
}
function collectScenes(sl){
  var cols=[]; var mx=maxStep(sl);
  for(var i=0;i<=mx;i++) cols.push({n:i,items:[]});
  function push(n,item){ if(n<0)return; while(cols.length<=n) cols.push({n:cols.length,items:[]}); cols[n].items.push(item); }
  $$('[data-step]',sl).forEach(function(el){
    if(el.classList.contains('fx')) return;
    push(parseRange(el.dataset.step).from,{type:'appear',el:el});
  });
  $$('.fx',sl).forEach(function(fx){
    var tgt=null; try{ tgt=fx.dataset.target?sl.querySelector(fx.dataset.target):null; }catch(e){}
    push(parseRange(fx.dataset.step).from,{type:'fx',fx:fx,kind:fx.dataset.fx||'',el:tgt});
  });
  return cols;
}
function shiftStep(el,delta){
  var r=parseRange(el.dataset.step);
  var from=Math.max(0,r.from+delta);
  var to=(r.to===Infinity)?null:Math.max(from,r.to+delta);
  el.dataset.step=(to!=null)?(from+'-'+to):String(from);
}
function insertSceneBefore(sl,k){
  if(!(k>0)) return;   /* 시작(장면 0) 앞에는 삽입하지 않는다. 장면 0의 view 카메라가 밀리면 여정 시작이 사라진다 */
  $$('[data-step]',sl).forEach(function(el){
    var r=parseRange(el.dataset.step);
    var from=r.from>=k?r.from+1:r.from;
    var to=(r.to===Infinity)?null:(r.to>=k?r.to+1:r.to);
    el.dataset.step=(to!=null)?(from+'-'+to):String(from);
  });
}
function compactScenes(sl){
  var used={};
  $$('[data-step]',sl).forEach(function(el){
    var r=parseRange(el.dataset.step);
    used[r.from]=1; if(r.to!==Infinity) used[r.to]=1;
  });
  var nums=Object.keys(used).map(Number).sort(function(a,b){return a-b;});
  var map={}, next=0;
  nums.forEach(function(v){ map[v]=(v===0)?0:(++next); });
  $$('[data-step]',sl).forEach(function(el){
    var r=parseRange(el.dataset.step);
    var f=map[r.from], t=(r.to===Infinity)?null:map[r.to];
    el.dataset.step=(t!=null)?(f+'-'+t):String(f);
  });
}
function setPreview(n){
  previewStep=(n==null)?null:Math.max(0,Math.min(maxStep(slides[cur]),n|0));
  body.classList.toggle('deck-step-preview',previewStep!=null);
  applyState();
  renderTimeline();
}
/* ---- 타임라인 다중 선택 + 드래그 이동 ---- */
var tlSelected=new Set();   /* 데이터 캐리어(fx 요소 또는 등장 대상 요소) 기준 */
/* 카드에 호버하면 캔버스의 대상이 보라 점선으로 표시 */
function tlHint(el,on){
  if(!el||!el.classList) return;
  if(el.classList.contains('fig-edge')){
    if(el._g) el._g.classList.toggle('tl-target-hint-e',on);
    if(el._label) el._label.classList.toggle('tl-target-hint',on);
  } else {
    el.classList.toggle('tl-target-hint',on);
  }
}
function tlClearHints(){
  $$('.tl-target-hint').forEach(function(el){ el.classList.remove('tl-target-hint'); });
  $$('.tl-target-hint-e').forEach(function(el){ el.classList.remove('tl-target-hint-e'); });
}
/* 선택된 카드 일괄 삭제 (fx는 제거, 등장 카드는 data-step 해제) */
function tlDeleteSelected(){
  if(!tlSelected.size) return false;
  var n=0;
  tlSelected.forEach(function(t){
    if(!t||!document.contains(t)) return;
    if(t.classList.contains('fx')){ t.remove(); n++; }
    else {
      delete t.dataset.step;
      t.classList.remove('step-on');
      if(t._g) t._g.style.opacity='';
      if(t._label) t._label.style.opacity='';
      n++;
    }
  });
  tlSelected.clear();
  tlAfterChange();
  tlToast(n+'개 카드 삭제');
  return true;
}
/* 타임라인 선택이 있을 때 Backspace/Delete는 카드 삭제로 .
   캡처 단계에서 가로채 엔진의 도형 삭제보다 먼저 처리한다 */
document.addEventListener('keydown',function(ev){
  if(!body.classList.contains('fig-editing')) return;
  var t=ev.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
  if((ev.key==='Backspace'||ev.key==='Delete')&&tlSelected.size){
    ev.preventDefault(); ev.stopPropagation();
    tlDeleteSelected();
  } else if(ev.key==='Escape'&&tlSelected.size){
    tlSelected.clear(); renderTimeline();   /* 캔버스 선택 해제(엔진)는 그대로 진행 */
  }
},true);
/* 캔버스를 직접 클릭하면 타임라인 선택 해제. Backspace 대상의 모호함 제거 */
document.addEventListener('pointerdown',function(ev){
  if(!body.classList.contains('fig-editing')||!tlSelected.size) return;
  if(ev.target.closest&&ev.target.closest('#deckTl')) return;
  if(ev.target.closest&&ev.target.closest('.fig-canvas')){
    tlSelected.clear(); renderTimeline();
  }
},true);
function tlSetStepAbs(el,n){
  var r=parseRange(el.dataset.step);
  var span=(r.to===Infinity)?null:(r.to-r.from);
  el.dataset.step=(span!=null)?(n+'-'+(n+span)):String(n);
}
function tlStartDrag(row,ev){
  var startX=ev.clientX, startY=ev.clientY, dragging=false, ghost=null, overCol=null;
  function selRows(){ return [].slice.call(document.querySelectorAll('.tl-item.sel')); }
  function onMove(e2){
    if(!dragging){
      if(Math.abs(e2.clientX-startX)<5&&Math.abs(e2.clientY-startY)<5) return;
      dragging=true;
      ghost=document.createElement('div');
      ghost.className='tl-ghost'; ghost.setAttribute('data-fig-ui','');
      ghost.textContent=(tlSelected.size>1)?(tlSelected.size+'개 이동'):(row.querySelector('.tl-name')?row.querySelector('.tl-name').textContent:'이동');
      body.appendChild(ghost);
      selRows().forEach(function(r){ r.classList.add('dragging'); });
    }
    ghost.style.left=(e2.clientX+12)+'px'; ghost.style.top=(e2.clientY+10)+'px';
    var hit=document.elementFromPoint(e2.clientX,e2.clientY);
    var col=hit?hit.closest('.tl-col'):null;
    if(overCol&&overCol!==col) overCol.classList.remove('drop');
    overCol=col; if(col) col.classList.add('drop');
  }
  function onUp(e2){
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    if(ghost) ghost.remove();
    selRows().forEach(function(r){ r.classList.remove('dragging'); });
    if(overCol) overCol.classList.remove('drop');
    if(dragging&&overCol){
      var n=parseInt(overCol.dataset.n,10);
      if(!isNaN(n)){
        tlSelected.forEach(function(el){ if(el&&el.dataset) tlSetStepAbs(el,n); });
        tlAfterChange();
        tlToast('장면 '+(n===0?'시작':n)+'(으)로 이동');
      }
    } else if(!dragging&&!(e2.shiftKey||e2.metaKey||e2.ctrlKey)){
      /* 드래그 없는 일반 클릭 = 이 카드만 선택 */
      tlSelected.clear(); tlSelected.add(row._tlTarget); renderTimeline();
    }
  }
  document.addEventListener('pointermove',onMove);
  document.addEventListener('pointerup',onUp);
}
function tlSel(){ return (window.FigEditor&&window.FigEditor.selection)?window.FigEditor.selection():[]; }
function tlToast(m){ if(window.FigEditor&&window.FigEditor.toast) window.FigEditor.toast(m); }
function tlAfterChange(){
  if(window.FigEditor){ window.FigEditor.commit(); window.FigEditor.renderAll(); }
  if(previewStep!=null) previewStep=Math.min(previewStep,maxStep(slides[cur]));
  applyState();
  renderTimeline();
}
function tlAddAppear(){
  var sel=tlSel().filter(function(el){ return !el.classList.contains('fx'); });
  if(!sel.length){ tlToast('먼저 등장시킬 도형·화살표를 선택하세요'); return; }
  var n=maxStep(slides[cur])+1;
  sel.forEach(function(el){ el.dataset.step=String(n); });
  tlAfterChange();
  tlToast('장면 '+n+'에 등장 추가');
}
function tlAddFx(kind){
  var sl=slides[cur], target=null;
  if(kind!=='reset'){
    var sel=tlSel();
    if(kind==='flow') target=sel.filter(function(e){ return e.classList.contains('fig-edge'); })[0];
    else target=sel.filter(function(e){ return e.classList.contains('fig-node'); })[0]||sel[0];
    if(!target){ tlToast(kind==='flow'?'먼저 화살표를 선택하세요':'먼저 대상 도형을 선택하세요'); return; }
    if(!target.id) target.id='n-'+Math.random().toString(36).slice(2,8);
  }
  var n=maxStep(sl)+1;
  var fx=document.createElement('i');
  fx.className='fx'; fx.dataset.step=String(n); fx.dataset.fx=kind;
  if(target) fx.dataset.target='#'+target.id;
  if(kind==='focus') fx.dataset.zoom='1.5';
  (sl.querySelector('.fig-canvas')||sl).appendChild(fx);
  tlAfterChange();
  tlToast('장면 '+n+'에 '+fxKindLabel(kind)+' 추가');
}
function mountTimeline(){
  if($('#deckTl')) return;
  var tl=document.createElement('div');
  tl.id='deckTl'; tl.className='deck-tl'; tl.setAttribute('data-fig-ui','');
  tl.innerHTML=
    '<div class="tl-resize" title="드래그해서 타임라인 높이 조절"></div>'+
    '<div class="tl-head"><b>장면 타임라인</b>'+
    '<button class="tl-b" id="tlAll" title="미리보기 해제. 모든 요소 표시">전체 보기</button>'+
    '<span class="tl-sep"></span>'+
    '<button class="tl-b" id="tlAppear">+ 등장</button>'+
    '<button class="tl-b" id="tlFocus">+ 줌인</button>'+
    '<button class="tl-b" id="tlPulse">+ 강조</button>'+
    '<button class="tl-b" id="tlFlow">+ 흐름</button>'+
    '<button class="tl-b" id="tlReset">+ 해제</button>'+
    '<span class="tl-sep"></span>'+
    '<button class="tl-b" id="tlCompact" title="비어 있는 장면 번호를 당겨 정리">빈 장면 정리</button>'+
    '<span class="tl-hint">카드 드래그 = 장면 이동 (⇧클릭 다중 선택) · 장면 번호 클릭 = 미리보기 · 도형 선택 후 + 버튼 = 추가</span></div>'+
    '<div class="tl-cols" id="tlCols"></div>';
  body.appendChild(tl);
  $('#tlCols').addEventListener('pointerdown',function(ev){
    if(ev.target===this){ tlSelected.clear(); renderTimeline(); }
  });
  /* 높이 조절: 상단 핸들 드래그 (세션 간 기억) */
  try{
    var saved=localStorage.getItem('deck:tlh');
    if(saved) body.style.setProperty('--tl-h',clampTlH(parseInt(saved,10))+'px');
  }catch(e){}
  function clampTlH(h){ return Math.max(120,Math.min(Math.round(innerHeight*0.6),h||206)); }
  tl.querySelector('.tl-resize').addEventListener('pointerdown',function(ev){
    ev.preventDefault(); ev.stopPropagation();
    var raf=false;
    function onMove(e2){
      var h=clampTlH(innerHeight-e2.clientY-14);
      body.style.setProperty('--tl-h',h+'px');
      if(!raf){ raf=true; requestAnimationFrame(function(){ raf=false; fit(); }); }
    }
    function onUp(){
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      try{ localStorage.setItem('deck:tlh',parseInt(getComputedStyle(tl).height,10)); }catch(e){}
      fit();
    }
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
  });
  $('#tlAll').addEventListener('click',function(){ setPreview(null); });
  $('#tlAppear').addEventListener('click',tlAddAppear);
  $('#tlFocus').addEventListener('click',function(){ tlAddFx('focus'); });
  $('#tlPulse').addEventListener('click',function(){ tlAddFx('pulse'); });
  $('#tlFlow').addEventListener('click',function(){ tlAddFx('flow'); });
  $('#tlReset').addEventListener('click',function(){ tlAddFx('reset'); });
  $('#tlCompact').addEventListener('click',function(){ compactScenes(slides[cur]); tlAfterChange(); });
  /* 타임라인 조작이 캔버스 선택 해제로 이어지지 않게 */
  tl.addEventListener('pointerdown',function(ev){ ev.stopPropagation(); });
}
function renderTimeline(){
  var tl=$('#deckTl'); if(!tl) return;
  var show=body.classList.contains('fig-editing');
  tl.classList.toggle('open',show);
  body.classList.toggle('deck-tl-open',show);
  if(!show) return;
  var sl=slides[cur], wrap=$('#tlCols');
  tlSelected.forEach(function(el){ if(!el||!document.contains(el)) tlSelected.delete(el); });
  tlClearHints();   /* 재렌더로 mouseleave가 끊겨 남는 하이라이트 방지 */
  wrap.innerHTML='';
  collectScenes(sl).forEach(function(col){
    var c=document.createElement('div');
    c.className='tl-col'+(previewStep===col.n?' cur':'');
    c.dataset.n=col.n;
    var head=document.createElement('div'); head.className='tl-colhead';
    var num=document.createElement('button'); num.className='tl-num';
    num.textContent=(col.n===0)?'시작':col.n; num.title='이 장면 미리보기 (다시 누르면 해제)';
    num.onclick=function(){ setPreview(previewStep===col.n?null:col.n); };
    head.appendChild(num);
    if(col.n>0){   /* 시작 열에는 삽입 버튼을 두지 않는다 (insertSceneBefore 참조) */
      var ins=document.createElement('button'); ins.className='tl-ins'; ins.textContent='+';
      ins.title='이 앞에 빈 장면 삽입';
      ins.onclick=function(){ insertSceneBefore(sl,col.n); tlAfterChange(); };
      head.appendChild(ins);
    }
    c.appendChild(head);
    col.items.forEach(function(it){
      var target=(it.type==='appear')?it.el:it.fx;
      var row=document.createElement('div');
      row.className='tl-item k-'+(it.type==='appear'?'appear':it.kind)+(tlSelected.has(target)?' sel':'');
      row._tlTarget=target;
      var name=document.createElement('span'); name.className='tl-name';
      var lbl=(it.type==='fx'&&it.kind==='reset')?'':((it.el)?' '+elLabel(it.el):(it.kind==='view'?' 영역':''));
      name.textContent=(it.type==='appear'?'등장':fxKindLabel(it.kind))+lbl;
      name.title='클릭: 카드 선택 + 캔버스에서 대상 표시 · 드래그: 장면 이동 · ⇧클릭: 다중 선택';
      row.appendChild(name);
      /* 호버만 해도 대상이 어디인지 보이게 */
      row.addEventListener('mouseenter',function(){ tlHint(it.el,true); });
      row.addEventListener('mouseleave',function(){ tlHint(it.el,false); });
      if(it.type==='fx'&&it.kind==='focus'){
        var z=document.createElement('input');
        z.className='tl-zoom'; z.type='number'; z.step='0.1'; z.min='1.1'; z.max='4';
        z.value=parseFloat(it.fx.dataset.zoom||'1.5');
        z.title='줌 배율';
        z.onchange=function(){ it.fx.dataset.zoom=this.value; tlAfterChange(); };
        z.addEventListener('pointerdown',function(e){ e.stopPropagation(); });
        row.appendChild(z);
      }
      var acts=document.createElement('span'); acts.className='tl-acts';
      var del=document.createElement('button'); del.className='tl-del'; del.textContent='✕'; del.title='삭제';
      del.addEventListener('pointerdown',function(e){ e.stopPropagation(); });
      del.onclick=function(){
        tlSelected.delete(target);
        if(it.type==='appear'){
          delete it.el.dataset.step;
          it.el.classList.remove('step-on');
          if(it.el._g) it.el._g.style.opacity='';
          if(it.el._label) it.el._label.style.opacity='';
        } else { it.fx.remove(); }
        tlAfterChange();
      };
      acts.appendChild(del);
      row.appendChild(acts);
      /* 선택 + 드래그 이동 */
      row.addEventListener('pointerdown',function(ev){
        if(ev.target.closest('.tl-del,.tl-zoom')) return;
        if(ev.shiftKey||ev.metaKey||ev.ctrlKey){
          if(tlSelected.has(target)) tlSelected.delete(target); else tlSelected.add(target);
          renderTimeline();
          return;
        }
        if(!tlSelected.has(target)){ tlSelected.clear(); tlSelected.add(target); renderTimeline(); }
        /* 카드 선택 = 캔버스에서 대상도 선택 (어떤 도형의 효과인지 표시) */
        if(it.el&&window.FigEditor) window.FigEditor.select(it.el);
        tlStartDrag(row,ev);
      });
      c.appendChild(row);
    });
    wrap.appendChild(c);
  });
}

/* ---------------- 키보드 ---------------- */
document.addEventListener('keydown',function(e){
  if(body.classList.contains('fig-editing')) return;   /* 편집 중 키는 fig-editor 소관 */
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  var tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||(e.target&&e.target.isContentEditable)) return;
  var ov=$('#deckOv');
  if(ov&&ov.classList.contains('open')){
    if(e.key==='Escape'||e.key==='Enter'){ e.preventDefault(); closeOverview(); }
    return;
  }
  switch(e.key){
    case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); return;
    case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); return;
    case 'Home': e.preventDefault(); activate(0,0); return;
    case 'End': e.preventDefault(); activate(slides.length-1,0); return;
    case 'Escape': e.preventDefault(); openOverview(); return;
    case 'n': case 'N': e.preventDefault(); toggleNotes(); return;
  }
  if(/^[0-9]$/.test(e.key)){
    numBuf+=e.key; clearTimeout(numT);
    numT=setTimeout(function(){ numBuf=''; },1500);
  } else if(e.key==='Enter'&&numBuf){
    activate(parseInt(numBuf,10)-1,0); numBuf='';
  }
});
window.addEventListener('resize',fit);
/* 주소창 해시(#슬라이드.장면)를 고치면 그 위치로 이동한다. applyState의 replaceState는 이 이벤트를 내지 않는다 */
window.addEventListener('hashchange',function(){
  var m=/^#(\d+)(?:\.(\d+))?/.exec(location.hash||''); if(!m) return;
  var i=+m[1]-1, s=+m[2]||0;
  if(i!==cur||s!==step) activate(i,s);
});

/* ---------------- fig-editor 공존 ---------------- */
new MutationObserver(function(){
  var editing=body.classList.contains('fig-editing');
  if(editing===wasEditing) return;
  wasEditing=editing;
  var run=function(){
    if(editing){
      mountTimeline();
      body.classList.add('deck-tl-open');       /* fit() 전에 레이아웃 확보 */
      cancelResidualAnims(slides[cur]); clearFx(slides[cur]); fit(); applyState();
    } else {
      previewStep=null;
      body.classList.remove('deck-step-preview','deck-tl-open');
      fit(); if(window.FigEditor) window.FigEditor.renderAll(); applyState();
    }
    renderTimeline();
  };
  run();
  requestAnimationFrame(run);   /* 다른 콜백이 상태를 덮어도 다음 프레임에 수렴 */
}).observe(body,{attributes:true,attributeFilter:['class']});

/* undo/복원(restoreBody)으로 DOM이 통째로 교체되면 재마운트 */
new MutationObserver(function(){
  if(!document.contains(deck)){
    deck=$('.deck'); if(!deck) return;
    slides=$$('.deck section.slide'); if(!slides.length) return;
    bindStaticEdges();
    mountUI(); mountTimeline(); activate(Math.min(cur,slides.length-1),0); initAllSteps(); renderTimeline();
  } else if(!$('#deckHud')){ mountUI(); mountTimeline(); hud(); updateNotes(); renderTimeline(); }
}).observe(body,{childList:true});

/* ---------------- 시작 ---------------- */
function init(){
  bindStaticEdges();
  mountUI();
  mountTimeline();
  var m=/^#(\d+)(?:\.(\d+))?/.exec(location.hash||'');
  activate(m?+m[1]-1:0, m?(+m[2]||0):0);
  initAllSteps();   /* 비활성 슬라이드도 장면 0 상태로 선초기화 */
  renderTimeline();
  playIntro();      /* 첫 화면도 안무와 함께 등장 */
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

/* 저장·undo 스냅샷·배포본·클립보드에서 런타임 상태를 걷어낸다 (엔진의 정리 훅 FigEditor.onClean).
   장면 클래스, 카메라·딤·흐름 표시, 슬라이드 맞춤 인라인 스타일, body 상태 클래스가 파일에 남지 않는다 */
function cleanDeckState(root){
  if(!root||!root.querySelectorAll) return;
  var CLS=['step-on','deck-focus','deck-dimmed','deck-flow-anim','deck-pulse','deck-no-anim','tl-target-hint'];
  $$('.'+CLS.join(',.'),root).forEach(function(el){
    CLS.forEach(function(c){ el.classList.remove(c); });
    if(typeof el.className==='string'&&!el.className) el.removeAttribute('class');
  });
  $$('.deck section.slide',root).forEach(function(sl){
    sl.classList.remove('active');
    ['width','height','transform','z-index','display'].forEach(function(prop){ sl.style.removeProperty(prop); });
    if(!sl.getAttribute('style')) sl.removeAttribute('style');
  });
  if(root.classList){
    root.classList.remove('deck-doc','deck-tl-open','deck-step-preview');
    if(root.tagName==='BODY'&&!root.className) root.removeAttribute('class');
  }
}
if(window.FigEditor&&window.FigEditor.onClean) window.FigEditor.onClean(cleanDeckState);

window.DeckRuntime={
  next:next, prev:prev, go:activate,
  cur:function(){ return cur; }, step:function(){ return step; },
  count:function(){ return slides.length; },
  maxStep:function(){ return maxStep(slides[cur]); },
  overview:openOverview, notes:toggleNotes
};
})();
