/* ══════════════════════════════════════════
   input.js ─ キーボード ＋ タッチ

   改善点（UPDATE-PLAN §8）:
     ・スティックにデッドゾーン12% ＋ 入力カーブ（低速域を細かく）
     ・ダッシュ／しのび足のトグル切替に対応（localStorage に保存）
     ・石の照準：ボタン長押しでチャージ、方向はスティック or マウス
   ══════════════════════════════════════════ */

import { VW, VH } from './config.js';

export const keys = {};
export const touch = { active:false, dx:0, dy:0, digital:false, run:false, sneak:false, stone:false, act:false };

/* HUD が「今どこにヒント帯を描いたか」を置く場所（内部解像度の座標）。
   タップ判定に使う。帯が出ていないときは null。 */
export const ui = { hintRect:null };
export const mouse = { x:0, y:0, inside:false, used:false };

export const isTouch = matchMedia('(pointer:coarse)').matches;

/* ── 設定（トグル操作） ── */
export const opt = {
  toggleMove: (localStorage.getItem('kg_toggle') === '1')
};
export function setToggle(v){
  opt.toggleMove = v;
  localStorage.setItem('kg_toggle', v ? '1' : '0');
}

/* トグル方式のときの保持状態 */
export const held = { run:false, sneak:false };

const DEAD = 0.12;
/* 低速域を細かく操作できるようにするカーブ */
function curve(v){
  const s = Math.sign(v), a = Math.abs(v);
  if(a < DEAD) return 0;
  const n = (a - DEAD) / (1 - DEAD);
  return s * (n * n * 0.55 + n * 0.45);
}

/* ── キーボード ── */
let onKeyExtra = null;
export function setKeyHook(fn){ onKeyExtra = fn; }

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if(!keys[k]){                       // トグルは押した瞬間だけ反応
    if(opt.toggleMove){
      if(k === 'shift'){ held.run = !held.run; held.sneak = false; }
      if(k === 'z')    { held.sneak = !held.sneak; held.run = false; }
    }
  }
  keys[k] = true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if(onKeyExtra) onKeyExtra(k, e);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for(const k in keys) keys[k] = false; });

/* ── 移動ベクトル ── */
export function moveVec(){
  let ix = 0, iy = 0;
  if(keys['arrowleft'] || keys['a']) ix -= 1;
  if(keys['arrowright']|| keys['d']) ix += 1;
  if(keys['arrowup']   || keys['w']) iy -= 1;
  if(keys['arrowdown'] || keys['s']) iy += 1;
  if(touch.active){
    if(touch.digital){ ix += touch.dx; iy += touch.dy; }   // 十字キー＝オン/オフ。斜めでも減速させない
    else { ix += curve(touch.dx); iy += curve(touch.dy); }
  }
  const m = Math.hypot(ix, iy);
  if(m > 1){ ix /= m; iy /= m; }
  return { x:ix, y:iy, mag:Math.min(1, m) };
}

export function wantRun(){
  return opt.toggleMove ? (held.run   || touch.run)   : (keys['shift'] || touch.run);
}
export function wantSneak(){
  /* Aボタンは常にトグル（潜入の基本姿勢なので押しっぱなしにさせない）。
     キーボードは従来どおり設定に従う。 */
  if(held.sneak) return true;
  return opt.toggleMove ? false : (keys['z'] || keys['control']);
}
export function wantStone(){ return keys['x'] || touch.stone; }
export function wantAct(){   return keys['e'] || keys['f'] || touch.act; }

/* ══ 操作盤の配線（下25%）══
   左＝十字キー（指を置いたまま滑らせて方向を変えられる／8方向）
   右＝A しのび足（トグル）・B いし（長押し→はなす）・C ダッシュ（押している間）
   「とる／まってて」は画面下のヒント帯をタップ（4つ目のボタンは置かない） */
export function initTouchUI(){
  const pad = document.getElementById('pad');
  const arrows = {
    up: pad && pad.querySelector('.up'), dn: pad && pad.querySelector('.dn'),
    lf: pad && pad.querySelector('.lf'), rt: pad && pad.querySelector('.rt'),
  };
  let padId = null;

  const paint = (dx,dy) => {
    if(!arrows.up) return;
    arrows.up.classList.toggle('on', dy < -0.3);
    arrows.dn.classList.toggle('on', dy >  0.3);
    arrows.lf.classList.toggle('on', dx < -0.3);
    arrows.rt.classList.toggle('on', dx >  0.3);
  };

  const aim = e => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width/2);
    const dy = e.clientY - (r.top  + r.height/2);
    const d  = Math.hypot(dx, dy);
    if(d < r.width * 0.14){                     // 中央のあそび：止まる
      touch.dx = touch.dy = 0; paint(0,0); return;
    }
    const a = Math.round(Math.atan2(dy,dx) / (Math.PI/4)) * (Math.PI/4);   // 8方向にスナップ
    const nx = Math.round(Math.cos(a)*1000)/1000, ny = Math.round(Math.sin(a)*1000)/1000;
    touch.dx = Math.abs(nx) < 0.01 ? 0 : Math.sign(nx);
    touch.dy = Math.abs(ny) < 0.01 ? 0 : Math.sign(ny);
    paint(touch.dx, touch.dy);
  };

  if(pad){
    pad.addEventListener('pointerdown', e => {
      padId = e.pointerId; touch.active = true; touch.digital = true;
      pad.setPointerCapture(e.pointerId); aim(e); e.preventDefault();
    });
    pad.addEventListener('pointermove', e => { if(e.pointerId === padId) aim(e); });
    const padEnd = e => {
      if(e.pointerId !== padId) return;
      padId = null; touch.active = false; touch.dx = touch.dy = 0; paint(0,0);
    };
    pad.addEventListener('pointerup', padEnd);
    pad.addEventListener('pointercancel', padEnd);
  }

  /* 押している間だけ立つボタン（B いし／C ダッシュ） */
  const hold = (id, prop) => {
    const b = document.getElementById(id);
    if(!b) return;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.classList.add('down'); touch[prop] = true;
      if(prop === 'run') held.sneak = false;      // 走ったらしのび足は解除
    });
    ['pointerup','pointerleave','pointercancel'].forEach(ev =>
      b.addEventListener(ev, () => { b.classList.remove('down'); touch[prop] = false; }));
  };
  hold('btnB','stone');
  hold('btnC','run');

  /* A しのび足：トグル。ONの間はボタンが光ったままで、今の姿勢が一目で分かる */
  const btnA = document.getElementById('btnA');
  if(btnA){
    btnA.addEventListener('pointerdown', e => {
      e.preventDefault();
      held.sneak = !held.sneak; held.run = false; touch.run = false;
      btnA.classList.toggle('on', held.sneak);
    });
  }

  /* 「とる／まってて」＝ヒント帯のタップ。出ていないときは何も起きない */
  const cv = document.getElementById('cv');
  if(cv){
    cv.addEventListener('pointerdown', e => {
      const r = ui.hintRect;
      if(!r) return;
      const b = cv.getBoundingClientRect();
      const lx = (e.clientX - b.left) / b.width  * r.vw;
      const ly = (e.clientY - b.top ) / b.height * r.vh;
      if(lx < r.x - 12 || lx > r.x + r.w + 12 || ly < r.y - 10 || ly > r.y + r.h + 10) return;
      e.preventDefault();
      touch.act = true;
      setTimeout(() => { touch.act = false; }, 120);   // 1フレーム以上は確実に立てる
    });
  }
}

/* Aボタンの見た目を状態に合わせる（一時停止・面の切り替えで解除されたとき用） */
export function syncButtons(){
  const btnA = document.getElementById('btnA');
  if(btnA) btnA.classList.toggle('on', held.sneak);
}

/* ── マウス照準（PC） ── */
export function initMouse(cv){
  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width  * VW;
    mouse.y = (e.clientY - r.top ) / r.height * VH;
    mouse.inside = true; mouse.used = true;
  });
  cv.addEventListener('mouseleave', () => { mouse.inside = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
