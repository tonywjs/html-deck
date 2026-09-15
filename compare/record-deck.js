#!/usr/bin/env node
/* 헤드리스 Chrome의 DevTools 화면 스트리밍(Page.startScreencast)으로 덱 발표 장면을 프레임으로 받아 저장한다.
   장면 전환·카메라 줌·흐름 애니메이션이 실제로 움직이는 그대로 담긴다.
   사용법: node record-deck.js <덱 URL> <프레임 폴더> [장면당 ms]
   출력: <프레임 폴더>/f000001.jpg … 와 frames.json(프레임별 실제 시각) */
const fs = require('fs'), path = require('path');

const URL_ = process.argv[2], OUT = process.argv[3], HOLD = +(process.argv[4] || 1600);
const CDP = 'http://127.0.0.1:9222';
const W = 1280, H = 720, SCALE = 2;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // 빈 탭 하나를 열어 그 대상에 붙는다
  const targetInfo = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0; const pending = new Map(); const frames = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method === 'Page.screencastFrame') {
      const n = frames.length + 1;
      const file = path.join(OUT, 'f' + String(n).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(m.params.data, 'base64'));
      frames.push({ file: path.basename(file), t: m.params.metadata.timestamp });
      send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    }
  };
  function send(method, params = {}) {
    const mid = ++id;
    return new Promise((res, rej) => { pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
  }
  const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  // 런타임이 애니메이션을 건너뛰지 않도록 동작 축소 선호를 명시적으로 끈다
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 100 && !(await evalJs('!!window.DeckRuntime')); i++) await sleep(200);
  await sleep(600);

  await send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1, maxWidth: W * SCALE, maxHeight: H * SCALE });
  await evalJs('window.DeckRuntime.go(0,0)');
  await sleep(1800);   // 첫 화면 인트로 캐스케이드

  let last = '', steps = 0;
  for (let i = 0; i < 60; i++) {
    const before = await evalJs('DeckRuntime.cur()+"."+DeckRuntime.step()');
    await evalJs('DeckRuntime.next()');
    await sleep(HOLD);
    const after = await evalJs('DeckRuntime.cur()+"."+DeckRuntime.step()');
    steps++;
    if (after === before) break;
    last = after;
  }
  await sleep(1200);
  await send('Page.stopScreencast');
  fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames));
  console.log(JSON.stringify({ url: URL_, frames: frames.length, steps, last }));
  ws.close();
  await fetch(`${CDP}/json/close/${targetInfo.id}`);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
