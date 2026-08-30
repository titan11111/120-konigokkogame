/* ══════════════════════════════════════════
   input.js ─ キーボード ＋ タッチ

   改善点（UPDATE-PLAN §8）:
     ・スティックにデッドゾーン12% ＋ 入力カーブ（低速域を細かく）
     ・ダッシュ／しのび足のトグル切替に対応（localStorage に保存）
     ・石の照準：ボタン長押しでチャージ、方向はスティック or マウス
   ══════════════════════════════════════════ */

export const keys = {};
export const touch = { active:false, dx:0, dy:0, run:false, sneak:false, stone:false, act:false };
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
  if(touch.active){ ix += curve(touch.dx); iy += curve(touch.dy); }
  const m = Math.hypot(ix, iy);
  if(m > 1){ ix /= m; iy /= m; }
  return { x:ix, y:iy, mag:Math.min(1, m) };
}

export function wantRun(){
  return opt.toggleMove ? (held.run   || touch.run)   : (keys['shift'] || touch.run);
}
export function wantSneak(){
  return opt.toggleMove ? (held.sneak || touch.sneak) : (keys['z'] || keys['control'] || touch.sneak);
}
export function wantStone(){ return keys['x'] || touch.stone; }
export function wantAct(){   return keys['e'] || keys['f'] || touch.act; }

/* ══ タッチUIの配線 ══ */
export function initTouchUI(wrapEl){
  if(isTouch) document.getElementById('touch').classList.add('on');

  const stick    = document.getElementById('stick');
  const knobBase = document.getElementById('knobBase');
  const knob     = document.getElementById('knob');
  let stickId = null, sx = 0, sy = 0;

  const place = (el, x, y) => {
    const r = wrapEl.getBoundingClientRect();
    el.style.left = (x - r.left - el.offsetWidth  / 2) + 'px';
    el.style.top  = (y - r.top  - el.offsetHeight / 2) + 'px';
  };

  stick.addEventListener('pointerdown', e => {
    stickId = e.pointerId; sx = e.clientX; sy = e.clientY; touch.active = true;
    knobBase.style.opacity = .8; knob.style.opacity = .9;
    place(knobBase, sx, sy); place(knob, sx, sy);
    stick.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', e => {
    if(e.pointerId !== stickId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const d = Math.hypot(dx, dy), max = 54;
    if(d > max){ dx = dx/d*max; dy = dy/d*max; }
    place(knob, sx + dx, sy + dy);
    touch.dx = dx/max; touch.dy = dy/max;
  });
  const end = e => {
    if(e.pointerId !== stickId) return;
    stickId = null; touch.active = false; touch.dx = touch.dy = 0;
    knobBase.style.opacity = 0; knob.style.opacity = 0;
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  const bind = (id, prop, toggleable) => {
    const b = document.getElementById(id);
    if(!b) return;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.classList.add('down');
      if(toggleable && opt.toggleMove){
        if(prop === 'run'){ held.run = !held.run; held.sneak = false; }
        if(prop === 'sneak'){ held.sneak = !held.sneak; held.run = false; }
      } else touch[prop] = true;
    });
    ['pointerup','pointerleave','pointercancel'].forEach(ev =>
      b.addEventListener(ev, () => { b.classList.remove('down'); if(!(toggleable && opt.toggleMove)) touch[prop] = false; })
    );
  };
  bind('btnRun','run',true);
  bind('btnSneak','sneak',true);
  bind('btnStone','stone',false);
  bind('btnAct','act',false);
}

/* ── マウス照準（PC） ── */
export function initMouse(cv){
  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width  * 960;
    mouse.y = (e.clientY - r.top ) / r.height * 600;
    mouse.inside = true; mouse.used = true;
  });
  cv.addEventListener('mouseleave', () => { mouse.inside = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
