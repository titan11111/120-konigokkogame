/* ══════════════════════════════════════════
   hud.js ─ 画面上の情報

   現行版の不満点10「目的が画面に出ていない」への対策として、
   ミッション目標と進捗を常時いちばん目立つ場所に出す。
   ══════════════════════════════════════════ */
import { TS, VW, VH, PHASE, STONE } from './config.js';
import { current } from './map.js';

const rr = (c,x,y,w,h,r) => {
  c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
};

export function drawHUD(ctx, G){
  /* ── 上部バー ── */
  ctx.fillStyle='rgba(6,10,22,.74)'; ctx.fillRect(0,0,VW,74);
  const ph = PHASE[G.alert.phase];
  ctx.strokeStyle = ph.col.replace(')', ',.35)').replace('#','') ? `${ph.col}59` : ph.col;
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,74.5); ctx.lineTo(VW,74.5); ctx.stroke();

  /* ライフ */
  ctx.textAlign='left';
  for(let i=0;i<3;i++){
    const x = 22+i*24, y = 26;
    ctx.fillStyle = i < G.lives ? '#ff6b7a' : 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.moveTo(x,y+5); ctx.bezierCurveTo(x-10,y-4,x-3,y-11,x,y-5);
    ctx.bezierCurveTo(x+3,y-11,x+10,y-4,x,y+5); ctx.fill();
  }

  /* 石の残り */
  for(let i=0;i<STONE.max;i++){
    const x = 24+i*20, y = 52;
    ctx.fillStyle = i < G.player.stones ? '#cfc7b4' : 'rgba(255,255,255,.14)';
    rr(ctx, x-6, y-6, 12, 11, 4); ctx.fill();
  }
  ctx.fillStyle='#8ea3c6'; ctx.font='700 10px "M PLUS Rounded 1c"';
  ctx.fillText('いし', 24+STONE.max*20, 56);

  /* タイマー */
  const m = Math.floor(G.timeLeft/60), s = Math.floor(G.timeLeft%60);
  const low = G.timeLeft < 30;
  ctx.textAlign='center';
  ctx.fillStyle = low && Math.sin(G.elapsed*8) > 0 ? '#ff5964' : '#ffd166';
  ctx.font='800 27px "Dela Gothic One","M PLUS Rounded 1c"';
  ctx.fillText(`${m}:${String(s).padStart(2,'0')}`, VW/2, 30);
  ctx.fillStyle='#8ea3c6'; ctx.font='700 10px "M PLUS Rounded 1c"';
  ctx.fillText('チャイムまで', VW/2, 43);

  /* ★ ミッション目標（常時表示） */
  const prog = G.progressText();
  ctx.font='700 13px "M PLUS Rounded 1c"';
  const label = `${G.level.id}面：${G.objective.label}` + (prog ? `　［${prog}］` : '');
  const w = ctx.measureText(label).width + 26;
  ctx.fillStyle='rgba(124,247,196,.10)';
  rr(ctx, VW/2-w/2, 50, w, 21, 10); ctx.fill();
  ctx.strokeStyle='rgba(124,247,196,.35)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#bff3dd'; ctx.fillText(label, VW/2, 65);

  /* 警戒フェーズ（右上の一時停止ボタンと重ならないよう内側に寄せる） */
  const RX = VW-64;
  ctx.textAlign='right';
  ctx.fillStyle = ph.col;
  ctx.font = G.alert.phase==='NORMAL'
    ? '700 14px "M PLUS Rounded 1c"'
    : '800 19px "Dela Gothic One","M PLUS Rounded 1c"';
  ctx.fillText(ph.label, RX, 31);
  if(G.alert.phase !== 'NORMAL'){
    const t = PHASE[G.alert.phase].t;
    const bw = 118, bx = RX-bw, by = 41;
    ctx.fillStyle='rgba(0,0,0,.45)'; rr(ctx,bx,by,bw,6,3); ctx.fill();
    ctx.fillStyle = ph.col; rr(ctx,bx,by,bw*Math.max(0,G.alert.timer/t),6,3); ctx.fill();
    ctx.fillStyle='#8ea3c6'; ctx.font='700 10px "M PLUS Rounded 1c"';
    ctx.fillText(nextLabel(G.alert.phase), RX, 61);
  }

  /* 移動モード ＋ 隠れ状態 */
  const p = G.player;
  const modeTxt = p.mode==='run' ? 'ダッシュ（音デカい）' : p.mode==='sneak' ? 'しのび足（無音）' : 'ふつう歩き';
  const modeCol = p.mode==='run' ? '#ff9a68' : p.mode==='sneak' ? '#7cf7c4' : '#b9c9e4';
  ctx.textAlign='left'; ctx.fillStyle=modeCol; ctx.font='700 13px "M PLUS Rounded 1c"';
  ctx.fillText(modeTxt, 22, VH-22);

  /* 文脈ボタンの案内（とる／まってて など） */
  if(p.actHint){
    ctx.textAlign='center'; ctx.font='700 14px "M PLUS Rounded 1c"';
    const t = p.actHint, ww = ctx.measureText(t).width + 34;
    ctx.fillStyle='rgba(255,209,102,.16)';
    rr(ctx, VW/2-ww/2, VH-118, ww, 30, 15); ctx.fill();
    ctx.strokeStyle='rgba(255,209,102,.6)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#ffd166'; ctx.fillText(t, VW/2, VH-98);
  }

  /* トースト（一時メッセージ） */
  if(G.toastT > 0){
    ctx.textAlign='center'; ctx.font='700 15px "M PLUS Rounded 1c"';
    const a = Math.min(1, G.toastT*2.2);
    const ww = ctx.measureText(G.toastMsg).width + 36;
    ctx.globalAlpha = a;
    ctx.fillStyle='rgba(8,14,28,.86)'; rr(ctx, VW/2-ww/2, VH-172, ww, 32, 8); ctx.fill();
    ctx.strokeStyle='rgba(124,247,196,.45)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#e8f4ff'; ctx.fillText(G.toastMsg, VW/2, VH-151);
    ctx.globalAlpha = 1;
  }

  drawRadar(ctx, G);
}
function nextLabel(ph){
  return ph==='ALERT' ? 'にげきれば「さがしてる」へ'
       : ph==='EVASION' ? 'もうすこしで「ようじん中」'
       : 'もうすこしで元どおり';
}

/* ── レーダー（ALERT中は砂嵐で見えづらくなる） ── */
function drawRadar(ctx, G){
  const M = current();
  const R = 66, cx = VW-R-26, cy = VH-R-26, scale = R/430;
  const noisy = G.alert.phase === 'ALERT' || G.alert.phase === 'EVASION';

  /* マップが小さいとカメラが端で止まり、プレイヤーがレーダーの裏に回りこむ。
     自機が近づいたら薄くして、自分が見えなくなるのを防ぐ。 */
  const psx = G.player.x - G.cam.x, psy = G.player.y - G.cam.y;
  const near = Math.hypot(psx-cx, psy-cy) < R + 34;

  ctx.save();
  if(near) ctx.globalAlpha = 0.26;
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
  ctx.fillStyle='rgba(4,20,16,.82)'; ctx.fill();
  ctx.clip();

  ctx.strokeStyle='rgba(124,247,196,.16)'; ctx.lineWidth=1;
  for(let i=-3;i<=3;i++){
    ctx.beginPath(); ctx.moveTo(cx-R,cy+i*18); ctx.lineTo(cx+R,cy+i*18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+i*18,cy-R); ctx.lineTo(cx+i*18,cy+R); ctx.stroke();
  }
  ctx.fillStyle='rgba(124,247,196,.16)';
  for(const b of (M.L.buildings||[])){
    ctx.fillRect((b.x*TS-G.player.x)*scale+cx, (b.y*TS-G.player.y)*scale+cy,
                 b.w*TS*scale, b.h*TS*scale);
  }
  const blip = (e) => {
    const ex = (e.x-G.player.x)*scale+cx, ey = (e.y-G.player.y)*scale+cy;
    const col = e.stun>0 ? '#8f96ab'
              : e.hasKey ? '#ffb703'
              : e.mode==='chase' ? '#ff5964'
              : e.mode==='suspect' ? '#ffd166' : '#7cf7c4';
    if(!e.S.crow){
      ctx.globalAlpha=.22; ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(ex,ey);
      ctx.arc(ex,ey,e.S.range*scale, e.ang-e.S.fov/2, e.ang+e.S.fov/2);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    }
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(ex,ey, e.S.boss?4.5:3.2, 0, Math.PI*2); ctx.fill();
  };
  for(const e of G.enemies) if(!e.dead) blip(e);
  if(G.boss && !G.boss.dead) blip(G.boss);

  /* かぎ持ちの方向（レーダーの外に出ていてもリムにクランプして出す）
     ─ 4面で「どこにいるか分からない」を無くすための唯一の常時表示 */
  if(!G.hasKey){
    const k = G.enemies.find(e => e.hasKey && !e.dead);
    if(k){
      const kx = (k.x-G.player.x)*scale, ky = (k.y-G.player.y)*scale;
      const kd = Math.hypot(kx,ky), ka = Math.atan2(ky,kx);
      const outside = kd > R-9;
      const kr = Math.min(kd, R-9);
      const bx = cx+Math.cos(ka)*kr, by = cy+Math.sin(ka)*kr;
      const pl = .5 + Math.sin(G.elapsed*4)*.5;
      ctx.strokeStyle = `rgba(255,183,3,${.45+pl*.45})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(bx, by, 5+pl*3.5, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#ffb703';
      if(outside){                      // 範囲外は「方向だけ」を示す菱形にする
        ctx.save(); ctx.translate(bx,by); ctx.rotate(ka);
        ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(0,-4.2); ctx.lineTo(-4,0); ctx.lineTo(0,4.2);
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(bx, by, 3.6, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // ゴールの方向
  const g = G.objective.goal;
  const hx = (g.x+g.w/2)*TS-G.player.x, hy = g.y*TS-G.player.y;
  const hd = Math.hypot(hx,hy), ha = Math.atan2(hy,hx), hr = Math.min(hd*scale, R-9);
  ctx.fillStyle = G.goalOpen ? '#ffd166' : 'rgba(180,190,215,.55)';
  ctx.save(); ctx.translate(cx+Math.cos(ha)*hr, cy+Math.sin(ha)*hr); ctx.rotate(ha);
  ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-4,-5); ctx.lineTo(-4,5); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 連れの位置
  if(G.companion){
    ctx.fillStyle='#ffb3c8';
    ctx.beginPath(); ctx.arc(cx+(G.companion.x-G.player.x)*scale, cy+(G.companion.y-G.player.y)*scale, 3, 0, Math.PI*2); ctx.fill();
  }

  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(124,247,196,.35)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(G.elapsed*2)*R, cy+Math.sin(G.elapsed*2)*R); ctx.stroke();

  if(noisy){                        // 見つかっているとレーダーが乱れる
    ctx.globalAlpha = .5;
    for(let i=0;i<26;i++){
      ctx.fillStyle = i%2 ? 'rgba(255,120,130,.5)' : 'rgba(200,220,255,.35)';
      ctx.fillRect(cx-R + Math.random()*R*2, cy-R + Math.random()*R*2, 2+Math.random()*7, 1.5);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.save();
  if(near) ctx.globalAlpha = 0.26;
  ctx.strokeStyle = noisy ? 'rgba(255,89,100,.6)' : 'rgba(124,247,196,.55)';
  ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = noisy ? 'rgba(255,140,150,.8)' : 'rgba(124,247,196,.75)';
  ctx.font='700 10px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText('RADAR', cx, cy+R+14);
  ctx.restore();
}
