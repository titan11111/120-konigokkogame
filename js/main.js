/* ══════════════════════════════════════════
   main.js ─ ゲーム全体の進行
   ══════════════════════════════════════════ */
import { TS, VW, VH, T, STONE, COMPANION, STEAL_R, STEAL_ANGLE, INV_TIME, isHide } from './config.js';
import { LEVELS, LAST } from './levels.js';
import { buildMap, current, tileAt, nearestFree, nearestHide, reachable,
         tickMap, stepToward, angDiff, los } from './map.js';
import { makePlayer, updatePlayer, makeCompanion, updateCompanion } from './player.js';
import { spawnEnemies, updateEnemies, hearNoise, stoneHitEnemy,
         makeEnemy, makeBoss, updateBoss, stoneHitBoss } from './enemy.js';
import { makeStone, updateStones } from './stone.js';
import { makeAlert, tickAlert, stealthScore } from './alert.js';
import { initRender, render } from './render.js';
import { drawHUD } from './hud.js';
import { sfx, unlock } from './audio.js';
import * as In from './input.js';

const cv = document.getElementById('cv');
initRender(cv);
In.initTouchUI();
In.initMouse(cv);

/* ══ ゲーム状態 ══ */
const G = {
  state:'title', levelIndex:0, level:null, objective:null,
  player:null, enemies:[], boss:null, companion:null,
  stones:[], pickups:[], items:[], particles:[], pings:[],
  cam:{x:0,y:0}, alert:null, alertLevel:0,
  timeLeft:0, lives:3, caught:0, elapsed:0, shake:0, flash:0,
  goalOpen:true, goalLabel:'ゴール', hasKey:false,
  toastMsg:'', toastT:0,
  run:{ time:0, caught:0, raised:0, perfect:0 },
};
window.__KG = G;    // デバッグ用
G.jumpTo = i => { G.levelIndex = i; startLevel(); };   // デバッグ用：__KG.jumpTo(3) で4面へ

/* ── 共有ヘルパ（他モジュールから呼ばれる） ── */
G.emitNoise = (x,y,r,needLos) => hearNoise(G, x, y, r, needLos);
G.ping      = (x,y) => G.pings.push({x, y, r:STONE.noiseR, life:0.85, max:0.85});
G.burst = (x,y,c,n=12) => {
  for(let i=0;i<n;i++) G.particles.push({
    x, y, vx:(Math.random()-.5)*220, vy:(Math.random()-.5)*220, life:.6, c
  });
};
G.toast = msg => { G.toastMsg = msg; G.toastT = 2.6; };
G.stepEntity = (o,tx,ty,dt,r) => stepToward(o, tx, ty, dt, r);
G.throwStone = (ang, power) => {
  if(G.player.stones <= 0) return;
  G.player.stones--;
  G.stones.push(makeStone(G.player.x, G.player.y, ang, power));
};
G.onStoneHitEnemy = e => stoneHitEnemy(G, e);
G.onStoneHitBoss  = (b,s) => stoneHitBoss(G, b, s);
G.spawnMinions = (b, n) => {
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const [tx,ty] = nearestFree(((b.x+Math.cos(a)*110)/TS)|0, ((b.y+Math.sin(a)*110)/TS)|0);
    const m = makeEnemy('minion', [[tx,ty]]);
    m.mode = 'chase'; m.timer = 8;
    G.enemies.push(m);
  }
  G.toast('こぶんを よんだ！');
};
G.progressText = () => {
  const o = G.objective;
  if(o.type === 'collect'){
    const got = G.items.filter(i=>i.got).length;
    return `${got}/${G.items.length}`;
  }
  if(o.type === 'boss' && G.boss) return G.boss.dead ? 'ふくしょう！' : `ぼうし あと${G.boss.hp}`;
  if(o.type === 'steal'){
    if(G.hasKey) return 'かぎ ゲット';
    const k = G.enemies.find(e => e.hasKey && !e.dead);
    return k ? `かぎ なし・あと${Math.max(1, Math.round(Math.hypot(k.x-G.player.x, k.y-G.player.y)/TS))}m`
             : 'かぎ なし';
  }
  if(o.type === 'escort') return G.companion && G.companion.staying ? 'またせてる' : 'いっしょ';
  return '';
};

/* ══ 面の読み込み ══ */
function loadLevel(i){
  const L = LEVELS[i];
  G.levelIndex = i; G.level = L; G.objective = L.objective;
  buildMap(L);
  const M = current();

  const [px,py] = nearestFree(L.start[0], L.start[1]);
  G.player = makePlayer(px, py);

  G.enemies = spawnEnemies(L);
  for(const e of G.enemies){                      // 手打ち座標の事故よけ
    e.route = e.route.map(([x,y]) => nearestFree(x,y));
    const s = e.route[0];
    e.x = s[0]*TS+TS/2; e.y = s[1]*TS+TS/2;
  }
  G.boss = L.boss ? makeBoss(...nearestFree(L.boss[0], L.boss[1])) : null;
  G.companion = L.companion
    ? (()=>{ const [cx,cy] = nearestFree(...L.companion);
             return makeCompanion(cx*TS+TS/2, cy*TS+TS/2); })()
    : null;

  G.pickups = (L.stones||[]).map(([x,y]) => {
    const [fx,fy] = nearestFree(x,y);
    return { x:fx*TS+TS/2, y:fy*TS+TS/2, got:false };
  });
  G.items = (L.items||[]).map(it => {
    const [fx,fy] = nearestFree(it.x, it.y);
    return { x:fx*TS+TS/2, y:fy*TS+TS/2, name:it.name, got:false };
  });

  G.stones = []; G.particles = []; G.pings = [];
  G.alert = makeAlert();
  G.timeLeft = L.time; G.lives = 3; G.caught = 0;
  G.shake = 0; G.flash = 0; G.hasKey = false;
  G.toastT = 0;
  updateGoalState();
  G.cam.x = Math.max(0, Math.min(M.WW-VW, G.player.x-VW/2));
  G.cam.y = Math.max(0, Math.min(M.WH-VH, G.player.y-VH/2));

  // ゴールへ本当に行けるかの検算（データの打ち間違い検出）
  const g = G.objective.goal;
  const [gx,gy] = nearestFree(g.x + (g.w>>1), g.y + (g.h>>1));
  if(!reachable((G.player.x/TS)|0, (G.player.y/TS)|0, gx, gy))
    console.warn(`[levels] ${L.name}: ゴールに到達できない配置です`);
}

function updateGoalState(){
  const o = G.objective;
  if(o.type === 'collect'){ G.goalOpen = G.items.every(i=>i.got); G.goalLabel='にしぐち'; }
  else if(o.type === 'steal'){ G.goalOpen = G.hasKey; G.goalLabel='もん'; }
  else if(o.type === 'boss'){ G.goalOpen = !!(G.boss && G.boss.dead); G.goalLabel='げんかん'; }
  else if(o.type === 'escort'){ G.goalOpen = true; G.goalLabel='でぐち'; }
  else { G.goalOpen = true; G.goalLabel='でぐち'; }
}

/* ══ 更新 ══ */
function update(dt){
  G.elapsed += dt;
  tickMap(dt);
  tickAlert(G.alert, dt);

  G.timeLeft -= dt;
  if(!G.alert.chimeWarned && G.timeLeft < 30){ G.alert.chimeWarned = true; sfx.preChime(); }
  if(G.timeLeft <= 0){ G.timeLeft = 0; sfx.chime(); return gameOver('5時のチャイムが鳴っちゃった…'); }

  updatePlayer(G, dt);
  updateCompanion(G, dt);
  updateStones(G, dt);
  updateEnemies(G, dt);
  updateBoss(G, dt);

  pickupsAndItems();
  contextAction();
  updateGoalState();
  checkGoal();

  /* カメラ：進行方向を先読みする（現行版の不満点1） */
  const M = current(), p = G.player;
  const look = p.moving ? (p.mode==='run' ? 90 : p.mode==='walk' ? 46 : 20) : 0;
  const tx = Math.max(0, Math.min(M.WW-VW, p.x + Math.cos(p.ang)*look - VW/2));
  const ty = Math.max(0, Math.min(M.WH-VH, p.y + Math.sin(p.ang)*look - VH/2));
  G.cam.x += (tx-G.cam.x)*Math.min(1, dt*4.2);
  G.cam.y += (ty-G.cam.y)*Math.min(1, dt*4.2);

  G.shake = Math.max(0, G.shake - dt*22);
  G.flash = Math.max(0, G.flash - dt*1.6);
  G.toastT = Math.max(0, G.toastT - dt);
  for(let i=G.particles.length-1;i>=0;i--){
    const q = G.particles[i];
    q.x += q.vx*dt; q.y += q.vy*dt; q.life -= dt;
    if(q.life <= 0) G.particles.splice(i,1);
  }
  for(let i=G.pings.length-1;i>=0;i--){
    G.pings[i].life -= dt;
    if(G.pings[i].life <= 0) G.pings.splice(i,1);
  }
}

function pickupsAndItems(){
  const p = G.player;
  for(const s of G.pickups){
    if(s.got || p.stones >= STONE.max) continue;
    if(Math.hypot(s.x-p.x, s.y-p.y) < 22){ s.got = true; p.stones++; sfx.pickup(); }
  }
  for(const it of G.items){
    if(it.got) continue;
    if(Math.hypot(it.x-p.x, it.y-p.y) < 24){
      it.got = true; sfx.itemGet();
      G.burst(it.x, it.y, '#ffd166', 16);
      const left = G.items.filter(i=>!i.got).length;
      G.toast(left ? `${it.name} をひろった！ あと${left}こ` : `ぜんぶそろった！ 西口へ！`);
    }
  }
}

/* 文脈ボタン（とる／まってて） */
function contextAction(){
  const p = G.player; p.actHint = null;
  const pressed = In.wantAct();

  if(G.objective.type === 'steal' && !G.hasKey){
    for(const e of G.enemies){
      if(!e.hasKey || e.dead) continue;
      const d = Math.hypot(e.x-p.x, e.y-p.y);
      if(d > STEAL_R) continue;
      const fromBack = angDiff(Math.atan2(p.y-e.y, p.x-e.x), e.ang) > STEAL_ANGLE;
      if(!fromBack){ p.actHint = 'うしろに回りこめ'; continue; }
      p.actHint = 'かぎをとる（E）';
      if(pressed && !actLatch){
        G.hasKey = true; e.hasKey = false;
        sfx.itemGet(); G.burst(e.x, e.y-14, '#ffd166', 18);
        G.toast('かぎを とった！ 門へ走れ！');
        e.mode = 'suspect'; e.searchPt = {x:p.x, y:p.y}; e.timer = 3.5;
      }
    }
  }
  if(G.companion){
    if(!p.actHint) p.actHint = G.companion.staying ? 'ついてこい（E）' : 'まってて（E）';
    if(pressed && !actLatch){
      G.companion.staying = !G.companion.staying;
      G.toast(G.companion.staying ? '「ここでまってて」' : '「いこう！」');
    }
  }
  actLatch = pressed;
}
let actLatch = false;

function checkGoal(){
  if(!G.goalOpen) return;
  const g = G.objective.goal, p = G.player;
  const gx = g.x*TS, gy = g.y*TS, gw = g.w*TS, gh = g.h*TS;
  if(!(p.x > gx && p.x < gx+gw && p.y > gy && p.y < gy+gh)) return;

  if(G.objective.type === 'escort'){
    const d = Math.hypot(G.companion.x-p.x, G.companion.y-p.y);
    if(d > COMPANION.goalR){
      G.player.actHint = '1年生をつれてこよう';
      return;
    }
  }
  levelClear();
}

/* つかまった：ワープではなくその場で無敵＋鬼が散る（不満点9） */
function onCaught(){
  const p = G.player;
  if(p.inv > 0) return;
  G.lives--; G.caught++;
  sfx.caught(); G.shake = 16; G.flash = .6;
  G.burst(p.x, p.y, '#ff5964', 20);
  if(G.lives <= 0) return gameOver('鬼にタッチされちゃった…');

  p.inv = INV_TIME;
  G.toast('つかまった！ いまのうちに かくれよう');
  for(const e of G.enemies){
    e.mode = 'patrol'; e.det = 0; e.searchPt = null;
    // その場から散る（プレイヤーはワープしない）
    const a = Math.atan2(e.y-p.y, e.x-p.x);
    e.ang = a;
  }
  if(G.boss){ G.boss.state = 'idle'; G.boss.timer = 1.6; G.boss.det = 0; }
  G.alert.phase = 'CAUTION'; G.alert.timer = 20; G.alert.lastSeen = null;
}
G.onCaught = onCaught;
G.onBossDown = () => {
  G.toast('ガキ大将が こうさんした！ おうちへ帰ろう！');
  for(let i=G.enemies.length-1;i>=0;i--)
    if(G.enemies[i].type === 'minion') G.enemies.splice(i,1);
};

/* ══ 画面遷移 ══ */
const S = id => document.getElementById(id);
const screens = ['scTitle','scCodec','scClear','scOver','scEnd','scPause'];
function show(id){
  screens.forEach(s => S(s).classList.toggle('on', s === id));
  deckActive(false);
}
function hideAll(){ screens.forEach(s => S(s).classList.remove('on')); deckActive(true); }
/* オーバーレイ表示中は操作盤を暗くして反応させない（見えてはいるので位置は覚えられる）。
   プレイに戻ったら必ず生き返らせる ─ ここを片方だけにすると操作盤が死んだままになる。 */
function deckActive(on){
  const d = document.getElementById('control-deck');
  if(d) d.classList.toggle('dim', !on);
}

function showCodec(){
  const L = LEVELS[G.levelIndex];
  G.state = 'codec';
  S('cdStage').textContent = `STAGE ${L.id} / 5`;
  S('cdName').textContent  = L.name;
  S('cdText').innerHTML    = L.codec.replace(/\n/g,'<br>');
  S('cdObj').textContent   = L.objective.label;
  S('cdTip').textContent   = L.tips || '';
  show('scCodec');
}

function startLevel(){
  unlock();
  In.held.sneak = false; In.held.run = false; In.syncButtons();
  loadLevel(G.levelIndex);
  G.state = 'play';
  hideAll();
}

function levelClear(){
  G.state = 'clear';
  const used = Math.ceil(G.level.time - G.timeLeft);
  G.run.time += used; G.run.caught += G.caught; G.run.raised += G.alert.raised;
  if(!G.alert.everSeen && G.caught === 0) G.run.perfect++;
  sfx.clear();
  const rank = rankOf(G.caught, G.alert);
  S('clStage').textContent = `STAGE ${G.level.id} CLEAR`;
  S('clStat').innerHTML =
    `かかった時間 <b>${used}秒</b>　／　つかまった回数 <b>${G.caught}回</b><br>` +
    `見つかった回数 <b>${G.alert.raised}回</b>（${stealthScore(G.alert)}）<br><br>ランク <b>${rank}</b>`;
  S('btnNext').textContent = G.levelIndex >= LAST ? 'おうちに入る' : 'つぎの面へ';
  show('scClear');
}
function rankOf(caught, A){
  if(!A.everSeen && caught === 0) return 'FOXHOUND級';
  if(caught === 0 && A.raised <= 1) return 'たつじん';
  if(caught === 0) return 'なかなか';
  if(caught === 1) return 'ぶじ通過';
  return 'ぎりぎり';
}
function nextLevel(){
  if(G.levelIndex >= LAST) return ending();
  G.levelIndex++;
  sfx.levelUp();
  showCodec();
}
function ending(){
  G.state = 'end';
  S('edStat').innerHTML =
    `ぜんぶで <b>${G.run.time}秒</b>　／　つかまった <b>${G.run.caught}回</b><br>` +
    `見つかった <b>${G.run.raised}回</b>　／　かんぺきクリア <b>${G.run.perfect}/5面</b>`;
  S('edRank').textContent = G.run.perfect === 5 ? 'FOXHOUND級'
                          : G.run.raised === 0  ? 'かんぺきな帰り道'
                          : G.run.caught === 0  ? 'たつじん'
                          : 'ただいま！';
  sfx.chime();
  show('scEnd');
}
function gameOver(reason){
  G.state = 'over';
  sfx.caught();
  S('ovTitle').textContent = reason.includes('チャイム') ? 'チャイム鳴っちゃった…' : 'つかまった…';
  S('ovStat').innerHTML = `${reason}<br>${G.level.id}面：${G.level.name}<br>` +
    `つかまった回数 <b>${G.caught}回</b>　残り時間 <b>${Math.ceil(G.timeLeft)}秒</b>`;
  show('scOver');
}

/* ── ボタン（pointerdown＝最速。clickだけだと iOS で遅れる） ── */
function bindTap(id, handler){
  const el = S(id);
  if(!el) return;
  const fire = (e) => {
    e.preventDefault();
    el.classList.add('is-pressed');
    unlock();
    if(navigator.vibrate) navigator.vibrate(14);
    try{ sfx.tap(); }catch(_){}
    handler(e);
  };
  const release = () => el.classList.remove('is-pressed');
  el.addEventListener('pointerdown', fire);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

bindTap('btnStart', () => { unlock(); G.levelIndex = 0;
  G.run = {time:0,caught:0,raised:0,perfect:0}; showCodec(); });
bindTap('btnGo', startLevel);
bindTap('btnNext', nextLevel);
bindTap('btnRetry', startLevel);
bindTap('btnTitle', () => { G.state='title'; show('scTitle'); });
bindTap('btnEndTitle', () => { G.state='title'; show('scTitle'); });
bindTap('btnResume', () => { G.state='play'; hideAll(); });
bindTap('btnQuit', () => { G.state='title'; show('scTitle'); });
bindTap('btnPause', () => togglePause());

const chk = S('optToggle');
chk.checked = In.opt.toggleMove;
chk.addEventListener('change', () => In.setToggle(chk.checked));

function togglePause(){
  if(G.state === 'play'){
    G.state = 'paused';
    S('pzObj').textContent = `${G.level.id}面：${G.objective.label}`;
    S('pzProg').textContent = G.progressText();
    S('pzTip').textContent = G.level.tips || '';
    show('scPause');
  } else if(G.state === 'paused'){ G.state = 'play'; hideAll(); }
}

In.setKeyHook(k => {
  if(k === 'escape' || k === 'p') togglePause();
  if(k === ' '){
    if(G.state === 'title')      S('btnStart').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    else if(G.state === 'codec') startLevel();
    else if(G.state === 'clear') nextLevel();
    else if(G.state === 'over')  startLevel();
    else if(G.state === 'end')   S('btnEndTitle').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
  }
});

/* ══ メインループ ══ */
loadLevel(0);
show('scTitle');
let last = performance.now();
function loop(now){
  const dt = Math.min(.033, (now-last)/1000); last = now;
  if(G.state === 'play') update(dt);
  else {
    G.elapsed += dt;
    const M = current();
    G.cam.x = Math.max(0, Math.min(M.WW-VW, G.player.x-VW/2));
    G.cam.y = Math.max(0, Math.min(M.WH-VH, G.player.y-VH/2));
  }
  const ctx = render(G);
  if(G.state === 'play' || G.state === 'paused') drawHUD(ctx, G);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
