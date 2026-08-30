/* ══════════════════════════════════════════
   stone.js ─ 石を投げる

   設計思想（UPDATE-PLAN §6）:
     石は「攻撃手段」ではなく「鬼をどかす手段」。
     プレイヤーが強くなるのではなく、
     通れなかった道が通れるようになるのが正しい快感。
   ══════════════════════════════════════════ */
import { TS, STONE } from './config.js';
import { solid } from './map.js';
import { sfx } from './audio.js';

/* 溜め具合 → 飛距離。着弾点は計算で確定するので、予測線は必ず当たる */
export const rangeOf = power =>
  STONE.minRange + (STONE.maxRange - STONE.minRange) * power;

/* 予測着弾点（壁があればその手前で止まる） */
export function predict(x, y, ang, power){
  const R = rangeOf(power);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for(let s = 14; s <= R; s += 8){
    const px = x + cs*s, py = y + sn*s;
    if(solid((px/TS)|0, (py/TS)|0))
      return { x:x + cs*Math.max(10,s-10), y:y + sn*Math.max(10,s-10), hitWall:true };
  }
  return { x:x + cs*R, y:y + sn*R, hitWall:false };
}

export function makeStone(x, y, ang, power){
  const tgt = predict(x, y, ang, power);
  const dist = Math.hypot(tgt.x-x, tgt.y-y);
  const tf = 0.34 + power*0.34;             // 飛んでいる時間
  const z0 = 16;
  sfx.throw();
  return {
    x, y, z:z0,
    vx:(tgt.x-x)/tf, vy:(tgt.y-y)/tf,
    vz:(0.5*STONE.gravity*tf*tf - z0)/tf,
    ang, spin:0, dead:false, dist
  };
}

export function updateStones(G, dt){
  for(let i=G.stones.length-1; i>=0; i--){
    const s = G.stones[i];
    s.x += s.vx*dt; s.y += s.vy*dt;
    s.vz -= STONE.gravity*dt; s.z += s.vz*dt;
    s.spin += dt*14;

    // 飛んでいる途中で鬼に直撃したか（頭〜胴の高さ）
    if(s.z > 2 && s.z < 40){
      for(const e of G.enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x-s.x, e.y-s.y) < STONE.hitR){
          G.onStoneHitEnemy(e, s);
          s.dead = true; break;
        }
      }
      if(G.boss && !G.boss.dead && !s.dead &&
         Math.hypot(G.boss.x-s.x, G.boss.y-s.y) < STONE.hitR + 6){
        G.onStoneHitBoss(G.boss, s);
        s.dead = true;
      }
    }
    if(s.dead){ G.stones.splice(i,1); continue; }

    // 壁に当たった / 地面に落ちた → 音が出る＝これが本命
    const hitWall = solid((s.x/TS)|0, (s.y/TS)|0);
    if(s.z <= 0 || hitWall){
      sfx.stoneLand();
      G.emitNoise(s.x, s.y, STONE.noiseR, false);   // 音は角を曲がって届く
      G.ping(s.x, s.y);
      G.stones.splice(i,1);
    }
  }
}
