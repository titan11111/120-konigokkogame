/* ══════════════════════════════════════════
   player.js ─ 移動・かくれる・足音・石の構え
   ══════════════════════════════════════════ */
import { TS, T, SPD, NOISE_R, PLAYER_R, HIDE_SPEC, STONE, isHide } from './config.js';
import { tileAt, moveCircle, surfaceAt, los } from './map.js';
import { sfx } from './audio.js';
import * as In from './input.js';

export function makePlayer(sx, sy){
  return {
    x:sx*TS+TS/2, y:sy*TS+TS/2, ang:-Math.PI/2,
    mode:'walk',
    hidden:false, hideTile:T.GROUND, hideT:0, moving:false,
    inv:0, stepT:0, noiseT:0,
    stones:STONE.max, aim:0, aiming:false, aimAng:-Math.PI/2,
    trail:[], trailT:0,          // ポチ（犬）が追う足あと
    actHint:null                 // 「とる」「まってて」などの文脈ボタン
  };
}

/* いま隠れている場所の性能 */
export function hideSpec(p){
  return p.hidden ? HIDE_SPEC[p.hideTile] : null;
}
/* 鬼から見て、この距離までなら見つかる */
export function visibleRange(p, baseRange){
  if(!p.hidden) return baseRange;
  const s = HIDE_SPEC[p.hideTile];
  return p.moving ? s.moving : s.still;
}

export function updatePlayer(G, dt){
  const p = G.player;
  const mv = In.moveVec();

  /* ── 石を構える ── */
  const holdStone = In.wantStone() && p.stones > 0 && G.state === 'play';
  if(holdStone){
    if(!p.aiming){ p.aiming = true; p.aim = 0; }
    p.aim = Math.min(1, p.aim + dt / STONE.chargeT);
    // 方向：マウス（PC）> スティック/キー > 向いている方向
    if(In.mouse.used && In.mouse.inside && !In.isTouch){
      p.aimAng = Math.atan2(In.mouse.y + G.cam.y - p.y, In.mouse.x + G.cam.x - p.x);
    } else if(mv.mag > 0.15){
      p.aimAng = Math.atan2(mv.y, mv.x);
    }
  } else if(p.aiming){
    p.aiming = false;
    G.throwStone(p.aimAng, Math.max(0.28, p.aim));
    p.aim = 0;
  }

  /* ── 移動モード ── */
  const wantSneak = In.wantSneak(), wantRun = In.wantRun();
  p.mode = wantSneak ? 'sneak' : wantRun ? 'run' : 'walk';
  let spd = SPD[p.mode];

  const t = tileAt(p.x, p.y);
  const inHide = isHide(t);
  if(inHide) spd *= HIDE_SPEC[t].mul;        // 隠れながらの移動は遅い
  if(p.aiming) spd *= STONE.aimSlow;         // 構え中も遅い

  p.moving = mv.mag > 0.06;
  if(p.moving){
    moveCircle(p, mv.x*spd*dt, mv.y*spd*dt, PLAYER_R);
    if(!p.aiming) p.ang = Math.atan2(mv.y, mv.x);
  }

  /* ── かくれ状態 ── */
  const wasHidden = p.hidden;
  const wasTile = p.hideTile;
  p.hideTile = inHide ? t : T.GROUND;
  if(inHide){
    p.hideT += dt;
    p.hidden = p.hideT >= HIDE_SPEC[t].enter;   // 土管・車の下は潜り込むのに時間がかかる
  } else {
    p.hideT = 0; p.hidden = false;
  }
  if(p.hidden && !wasHidden) sfx.hide();
  if(!p.hidden && wasHidden && isHide(wasTile)) sfx.unhide();

  p.inv = Math.max(0, p.inv - dt);

  /* ── 足音（ノイズ音。鬼を引き寄せる） ── */
  if(p.moving && p.mode !== 'sneak'){
    p.stepT -= dt * (p.mode === 'run' ? 2.3 : 1.35);
    if(p.stepT <= 0){
      p.stepT = 0.34;
      const surf = surfaceAt(p.x, p.y);
      if(p.mode === 'run') sfx.stepRun(surf); else sfx.step(surf);
    }
  }
  p.noiseT -= dt;
  if(p.moving && p.noiseT <= 0){
    p.noiseT = 0.3;
    let r = NOISE_R[p.mode];
    if(p.hidden && (p.hideTile === T.BUSH || p.hideTile === T.HEDGE)) r *= 1.15; // 草はガサガサいう
    if(r > 0) G.emitNoise(p.x, p.y, r, true);
  }

  /* ── 足あと（ポチが追う） ── */
  p.trailT -= dt;
  if(p.moving && p.trailT <= 0){
    p.trailT = 0.26;
    p.trail.push({ x:p.x, y:p.y, age:0 });
    if(p.trail.length > 26) p.trail.shift();
  }
  for(const s of p.trail) s.age += dt;
  while(p.trail.length && p.trail[0].age > 7) p.trail.shift();
}

/* ── 連れ（3面の1年生） ── */
import { COMPANION } from './config.js';
export function makeCompanion(x,y){
  return { x, y, ang:0, spd:COMPANION.speed, staying:false, moving:false, sob:0 };
}
export function updateCompanion(G, dt){
  const c = G.companion; if(!c) return;
  const p = G.player;
  const d = Math.hypot(p.x-c.x, p.y-c.y);
  c.moving = false;
  if(!c.staying && d > COMPANION.follow){
    c.spd = Math.min(COMPANION.speed * 1.35, COMPANION.speed * (0.7 + d/220));
    const tx = (p.x/TS)|0, ty = (p.y/TS)|0;
    // 近ければ直接、遠ければ経路探索
    if(d < 150 && los(c.x,c.y,p.x,p.y)){
      const a = Math.atan2(p.y-c.y, p.x-c.x);
      moveCircle(c, Math.cos(a)*c.spd*dt, Math.sin(a)*c.spd*dt, 9);
      c.ang = a;
    } else {
      G.stepEntity(c, tx, ty, dt, 9);
    }
    c.moving = true;
  }
  c.sob += dt;
  // 動くと音が出る＝連れがいると難しくなる
  if(c.moving && Math.random() < dt*3.2) G.emitNoise(c.x, c.y, COMPANION.noiseR, true);
}
