/* ══════════════════════════════════════════
   alert.js ─ 町ぜんたいの警戒フェーズ

   潜入ゲームの緊張の正体は「見つかった代償がその後も続く」こと。
   NORMAL → CAUTION → EVASION → ALERT と上がり、時間で1段ずつ下がる。
   ══════════════════════════════════════════ */
import { PHASE } from './config.js';
import { sfx } from './audio.js';

export function makeAlert(){
  return { phase:'NORMAL', timer:0, lastSeen:null, raised:0, everSeen:false, chimeWarned:false };
}

/* 上げる（下げる方向には使わない） */
export function raise(A, to, pos){
  const order = ['NORMAL','CAUTION','EVASION','ALERT'];
  const cur = order.indexOf(A.phase), nxt = order.indexOf(to);
  if(pos) A.lastSeen = { x:pos.x, y:pos.y };

  if(nxt > cur){
    if(to === 'ALERT'){ sfx.alert(); A.raised++; A.everSeen = true; }
    A.phase = to; A.timer = PHASE[to].t;
    return true;                 // 段が上がった（画面を光らせる等の合図）
  }
  // 同じ段なら時間を延長するだけ
  if(nxt === cur && PHASE[to].t > 0) A.timer = PHASE[to].t;
  return false;
}

export function tickAlert(A, dt){
  if(A.phase === 'NORMAL') return;
  A.timer -= dt;
  if(A.timer <= 0){
    const nx = PHASE[A.phase].next;
    A.phase = nx; A.timer = PHASE[nx] ? PHASE[nx].t : 0;
    if(A.phase === 'NORMAL') A.lastSeen = null;
  }
}

export const visMul = A => PHASE[A.phase].vis;
export const spdMul = A => PHASE[A.phase].spd;
export const isHunting = A => A.phase === 'ALERT' || A.phase === 'EVASION';

/* クリアランクの材料 */
export function stealthScore(A){
  if(!A.everSeen)   return 'かんぺき';
  if(A.raised <= 1) return 'ぎりぎりセーフ';
  if(A.raised <= 3) return 'バレバレ';
  return 'おおさわぎ';
}
