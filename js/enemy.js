/* ══════════════════════════════════════════
   enemy.js ─ 鬼8種＋ボス

   共通ルール: 鬼は誰も「倒せない」。
   ひるませる・撒く・追い払うだけ。子どもの鬼ごっこだから。
   ══════════════════════════════════════════ */
import { TS, ENEMY, DET, BOSS, STONE } from './config.js';
import { los, angDiff, stepToward, moveCircle, tileAt } from './map.js';
import { visibleRange } from './player.js';
import { raise, visMul, spdMul, isHunting } from './alert.js';
import { sfx } from './audio.js';

export function makeEnemy(type, route, opts = {}){
  const S = ENEMY[type];
  const start = route ? route[0] : [opts.tx, opts.ty];
  return {
    type, S,
    x:start[0]*TS+TS/2, y:start[1]*TS+TS/2,
    route: route || [start], wp:1,
    ang: opts.ang !== undefined ? opts.ang : 0,
    det:0, mode:'patrol', timer:0, look:0,
    spd:S.speed, stun:0, noticeCd:0, cawCd:0,
    searchPt:null, dead:false,
    hasKey: !!opts.hasKey,
    backwards: !!opts.backwards,     // ふたり組の後ろ側（進行方向と逆を向く）
    hatOff: 0,
    home: {x:start[0]*TS+TS/2, y:start[1]*TS+TS/2}
  };
}

/* 面データ → 実体（ふたり組は2体に展開する） */
export function spawnEnemies(L){
  const out = [];
  for(const e of (L.enemies || [])){
    if(e.type === 'pair'){
      out.push(makeEnemy('patrol', e.route));
      out.push(makeEnemy('patrol', e.route, { backwards:true }));
      out[out.length-1].wp = Math.max(0, (e.route.length>>1));
    } else {
      out.push(makeEnemy(e.type, e.route, e));
    }
  }
  return out;
}

/* 音を聞く（石・足音の両方がここに来る） */
export function hearNoise(G, x, y, r, needLos){
  for(const e of G.enemies){
    if(e.dead || e.S.crow || e.stun > 0) continue;
    if(e.mode === 'chase') continue;
    const d = Math.hypot(e.x-x, e.y-y);
    if(d > r * e.S.hear) continue;
    if(needLos && !los(e.x, e.y, x, y)) continue;   // 足音は遮蔽で届きにくい／石の音は回り込む
    e.mode = 'suspect';
    e.searchPt = { x, y };
    e.timer = 5.0;
    if(e.noticeCd <= 0){ sfx.notice(); e.noticeCd = 1.2; }
  }
  if(G.boss && !G.boss.dead && Math.hypot(G.boss.x-x, G.boss.y-y) < r){
    G.boss.alerted = true;
  }
}

export function updateEnemies(G, dt){
  const p = G.player, A = G.alert;
  let anyChase = false, maxDet = 0;

  for(const e of G.enemies){
    if(e.dead) continue;
    e.noticeCd -= dt; e.cawCd -= dt;

    if(e.stun > 0){                       // 石が当たってひるんでいる
      e.stun -= dt;
      e.look += dt;
      e.ang += Math.sin(e.look*18)*dt*3;
      continue;
    }

    const vm = visMul(A), sm = spdMul(A);
    e.spd = (e.mode === 'chase' ? e.S.speed * e.S.chase
           : e.mode === 'suspect' ? e.S.speed * 1.25
           : e.S.speed) * sm;

    /* ── 見えているか ── */
    const d    = Math.hypot(p.x-e.x, p.y-e.y);
    const toP  = Math.atan2(p.y-e.y, p.x-e.x);
    const range = visibleRange(p, e.S.range * vm);
    const inFov = e.S.fov >= 6 ? true : angDiff(toP, e.ang) < e.S.fov/2;
    const canSee = p.inv <= 0 && d < range && inFov && los(e.x, e.y, p.x, p.y);

    /* ── カラス（見張り）は特別：鳴いて周りに知らせるだけ ── */
    if(e.S.crow){
      if(canSee && e.cawCd <= 0){
        e.cawCd = 6;
        sfx.crow();
        G.ping(e.x, e.y);
        raise(A, A.phase === 'NORMAL' ? 'CAUTION' : 'EVASION', p);
        hearNoise(G, p.x, p.y, 420, false);
      }
      continue;
    }

    /* ── ポチ（犬）は足あとを追う ── */
    if(e.S.dog && !canSee && e.mode === 'patrol'){
      let target = null, bi = -1, bd = 1e9;
      for(let i=0;i<p.trail.length;i++){
        const s = p.trail[i];
        const dd = Math.hypot(s.x-e.x, s.y-e.y);
        if(dd < 175 && dd < bd && los(e.x,e.y,s.x,s.y)){ bd = dd; bi = i; }
      }
      if(bi >= 0){
        target = p.trail[Math.min(p.trail.length-1, bi+3)];  // 新しい方へ辿る
        e.mode = 'suspect'; e.searchPt = { x:target.x, y:target.y }; e.timer = 3.2;
        if(e.noticeCd <= 0){ sfx.dogBark(); e.noticeCd = 2.4; }
      }
    }

    /* ── 発見メーター ── */
    if(canSee){
      const near = 1 - Math.min(1, d/e.S.range)*0.55;
      const loud = p.mode === 'run' ? DET.runLoud : p.mode === 'sneak' ? DET.sneakQuiet : 1;
      e.det = Math.min(1, e.det + dt*DET.up*near*loud);
      A.lastSeen = { x:p.x, y:p.y };
    } else {
      e.det = Math.max(0, e.det - dt*DET.down);
    }
    maxDet = Math.max(maxDet, e.det);

    if(e.det >= 1 && e.mode !== 'chase'){
      e.mode = 'chase'; e.timer = 7;
      if(raise(A, 'ALERT', p)){ G.flash = .5; G.shake = 10; }   // 段が上がった瞬間だけ画面を光らせる
    } else if(e.det > DET.suspect && e.mode === 'patrol'){
      e.mode = 'suspect'; e.timer = 4; e.searchPt = { x:p.x, y:p.y };
      if(e.noticeCd <= 0){ sfx.notice(); e.noticeCd = 1.2; }
    }

    /* ── 町が ALERT/EVASION なら、見ていなくても集まってくる ── */
    if(isHunting(A) && e.mode === 'patrol' && A.lastSeen){
      e.mode = 'suspect';
      e.searchPt = A.phase === 'ALERT'
        ? { x:A.lastSeen.x, y:A.lastSeen.y }
        : scatterNear(A.lastSeen, e);           // EVASION は散開して探す
      e.timer = A.phase === 'ALERT' ? 8 : 6;
    }

    /* ── 行動 ── */
    if(e.mode === 'chase'){
      anyChase = true;
      e.timer = canSee ? 7 : e.timer - dt;
      const t = canSee ? p : (A.lastSeen || p);
      stepToward(e, (t.x/TS)|0, (t.y/TS)|0, dt);
      if(e.timer <= 0){ e.mode = 'suspect'; e.timer = 4; e.det = .5; e.searchPt = A.lastSeen; }

    } else if(e.mode === 'suspect'){
      e.timer -= dt;
      const t = e.searchPt;
      if(t){
        const dd = Math.hypot(t.x-e.x, t.y-e.y);
        if(dd > 26) stepToward(e, (t.x/TS)|0, (t.y/TS)|0, dt);
        else {
          e.look += dt;
          e.ang += Math.sin(e.look*2.4)*dt*2.8;   // その場でキョロキョロ
          // EVASION 中は隠れ場所を覗きに来る
          if(isHunting(A) && e.timer > 0 && Math.random() < dt*0.5)
            e.searchPt = scatterNear(t, e);
        }
      }
      if(e.timer <= 0){ e.mode = 'patrol'; e.searchPt = null; e.det = 0; }

    } else {
      // 巡回
      const wp = e.route[e.wp % e.route.length];
      const dd = Math.hypot(wp[0]*TS+TS/2-e.x, wp[1]*TS+TS/2-e.y);
      if(dd < 20) e.wp = (e.wp+1) % e.route.length;
      else stepToward(e, wp[0], wp[1], dt);
      if(e.backwards) e.ang += Math.PI;    // ふたり組の後ろ側は逆を向く
    }

    /* ── タッチ判定 ── */
    const touchR = 20;
    if(p.inv <= 0 && d < touchR && (!p.hidden || e.det > 0.85)) G.onCaught();
  }

  /* 連れが見つかると、それも発見になる（3面） */
  if(G.companion){
    const c = G.companion;
    for(const e of G.enemies){
      if(e.dead || e.S.crow || e.stun > 0) continue;
      const d = Math.hypot(c.x-e.x, c.y-e.y);
      const inFov = e.S.fov >= 6 ? true : angDiff(Math.atan2(c.y-e.y, c.x-e.x), e.ang) < e.S.fov/2;
      if(d < e.S.range*0.8 && inFov && los(e.x,e.y,c.x,c.y)){
        e.det = Math.min(1, e.det + dt*DET.up*0.8);
        if(e.det >= 1 && e.mode !== 'chase'){
          e.mode = 'chase'; e.timer = 7;
          raise(G.alert, 'ALERT', c);
          G.flash = .5; G.shake = 10;
        }
      }
    }
  }

  G.alertLevel = anyChase ? 1 : maxDet;
}

function scatterNear(pt, e){
  const a = Math.random()*Math.PI*2, r = 60 + Math.random()*150;
  return { x: pt.x + Math.cos(a)*r, y: pt.y + Math.sin(a)*r };
}

/* 石が鬼に当たった：ひるむ。ただし「当てた＝気づかれる」のでタダではない */
export function stoneHitEnemy(G, e){
  if(e.S.crow){                       // カラスは石で追い払える（永久に排除）
    e.dead = true; sfx.flap();
    G.burst(e.x, e.y, '#5d6480', 14);
    return;
  }
  sfx.stoneHit();
  e.stun = STONE.stunT;
  e.det  = Math.max(e.det, 0.55);
  e.mode = 'suspect';
  e.searchPt = { x:G.player.x, y:G.player.y };
  e.timer = 4.5;
  G.burst(e.x, e.y - 18, '#ffd166', 10);
}

/* ══ ボス：ガキ大将 ══ */
export function makeBoss(tx, ty){
  return {
    x:tx*TS+TS/2, y:ty*TS+TS/2, ang:Math.PI/2,
    S: ENEMY.boss, type:'boss',
    hp: BOSS.hatHP, state:'idle', timer:1.2,
    cx:0, cy:0, det:0, dead:false, alerted:false,
    flinch:0, hatGone:false, spawned:[], mode:'patrol', spd:ENEMY.boss.speed
  };
}

export function updateBoss(G, dt){
  const b = G.boss; if(!b || b.dead) return;
  const p = G.player;
  b.flinch = Math.max(0, b.flinch - dt);
  b.timer -= dt;

  const d = Math.hypot(p.x-b.x, p.y-b.y);
  const toP = Math.atan2(p.y-b.y, p.x-b.x);
  const canSee = p.inv <= 0 && d < visibleRange(p, b.S.range) &&
                 angDiff(toP, b.ang) < b.S.fov/2 && los(b.x,b.y,p.x,p.y);
  if(canSee){ b.det = Math.min(1, b.det + dt*1.5); b.alerted = true; }
  else b.det = Math.max(0, b.det - dt*0.6);

  if(b.flinch > 0){ return; }

  switch(b.state){
    case 'idle': {
      // プレイヤーの方をゆっくり向く
      if(b.det > 0.2 || b.alerted){
        let diff = toP - b.ang;
        while(diff >  Math.PI) diff -= Math.PI*2;
        while(diff < -Math.PI) diff += Math.PI*2;
        b.ang += diff * Math.min(1, dt*2.2);
      } else {
        b.ang += dt*0.5;                      // 見失っていたら周りを見回す
      }
      if(b.timer <= 0 && (b.det > 0.5 || (b.alerted && d < 340))){
        b.state = 'windup'; b.timer = BOSS.windup;
        b.cx = Math.cos(b.ang); b.cy = Math.sin(b.ang);
        sfx.bossCharge();
      } else if(b.timer <= 0){
        b.timer = 0.8;
        if(d < 460){ G.stepEntity(b, (p.x/TS)|0, (p.y/TS)|0, dt, 13); }
      }
      break;
    }
    case 'windup': {
      b.cx = Math.cos(b.ang); b.cy = Math.sin(b.ang);   // 直前まで狙いを更新
      if(b.det > 0.3){
        let diff = toP - b.ang;
        while(diff >  Math.PI) diff -= Math.PI*2;
        while(diff < -Math.PI) diff += Math.PI*2;
        b.ang += diff * Math.min(1, dt*3.2);
      }
      if(b.timer <= 0){ b.state = 'charge'; b.timer = BOSS.charge; }
      break;
    }
    case 'charge': {
      moveCircle(b, b.cx*BOSS.chargeSpd*dt, b.cy*BOSS.chargeSpd*dt, 13);
      G.shake = Math.max(G.shake, 3);
      if(b.timer <= 0){ b.state = 'recover'; b.timer = BOSS.recover; }
      break;
    }
    case 'recover': {                 // ここが石を当てるチャンス
      if(b.timer <= 0){ b.state = 'idle'; b.timer = 0.9; }
      break;
    }
  }

  if(p.inv <= 0 && d < 24) G.onCaught();
}

/* ボスへの命中判定：正面はガードされる。背後 or 突進直後だけ帽子に当たる */
export function stoneHitBoss(G, b, s){
  // ボスから見て石が飛んできた方向と、ボスの向きの差。
  // π に近い＝真後ろから当たった、が正しい判定（ここに +Math.PI を足すと前後が反転する）
  const fromBack = angDiff(Math.atan2(s.y - b.y, s.x - b.x), b.ang) > BOSS.backAngle;
  const open = b.state === 'recover' || fromBack;
  if(!open){
    sfx.stoneHit();
    G.burst(b.x, b.y-10, '#8aa0c8', 8);
    G.toast('ぼうしにあたらない！ とつげきのあとか、うしろから');
    b.alerted = true;
    return;
  }
  b.hp--;
  b.flinch = 1.0;
  b.state = 'idle'; b.timer = 1.1;
  sfx.bossHit();
  G.shake = 12; G.flash = .3;
  G.burst(b.x, b.y-26, '#ff5964', 20);

  if(b.hp <= 0){
    b.dead = true; b.hatGone = true;
    sfx.bossDown();
    G.onBossDown();
  } else {
    G.toast(`ぼうしをおとした！ あと ${b.hp}かい`);
    if(BOSS.minionAt.includes(b.hp)) G.spawnMinions(b, 2);
  }
}
