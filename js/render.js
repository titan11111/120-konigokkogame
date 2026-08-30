/* ══════════════════════════════════════════
   render.js ─ 描画（HD-2D風・Yソート・ライティング）
   ══════════════════════════════════════════ */
import { TS, VW, VH, T, HIDE_SPEC, isHide } from './config.js';
import { current, blocksSight, isRoad, tileAt } from './map.js';
import { predict, rangeOf } from './stone.js';

let ctx, cv, lctx, lightCv, dpr = 1;

export function initRender(canvas){
  cv = canvas; ctx = cv.getContext('2d');
  lightCv = document.createElement('canvas');
  lightCv.width = VW; lightCv.height = VH;
  lctx = lightCv.getContext('2d');
  resize(); addEventListener('resize', resize);
}
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = VW*dpr; cv.height = VH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = true;
}

const rr = (c,x,y,w,h,r) => {
  c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
};

let cam = {x:0,y:0};
const sx = wx => wx - cam.x;
const sy = wy => wy - cam.y;

/* ─── 地面 ─── */
function groundColor(tx,ty){
  if(isRoad(tx,ty)) return '#2a2f3d';
  const h = ((tx*73856093) ^ (ty*19349663)) >>> 0;
  return ['#28402f','#2b4433','#264029','#2d4735','#28402f'][h % 5];
}
function drawGround(G){
  const M = current();
  const x0 = Math.max(0,(cam.x/TS|0)-1), y0 = Math.max(0,(cam.y/TS|0)-1);
  const x1 = Math.min(M.MW-1,((cam.x+VW)/TS|0)+1), y1 = Math.min(M.MH-1,((cam.y+VH)/TS|0)+1);
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    ctx.fillStyle = groundColor(x,y);
    ctx.fillRect(x*TS-cam.x, y*TS-cam.y, TS+1, TS+1);
    if(M.grid[y][x] === T.DITCH) drawDitch(x,y);
  }
  // 道のセンターライン
  ctx.strokeStyle='rgba(226,215,160,.20)'; ctx.lineWidth=3; ctx.setLineDash([14,16]);
  ctx.beginPath();
  for(const c of (M.roads.cols||[])){ ctx.moveTo(c*TS+16-cam.x, -cam.y); ctx.lineTo(c*TS+16-cam.x, M.WH-cam.y); }
  for(const r of (M.roads.rows||[])){ ctx.moveTo(-cam.x, r*TS+16-cam.y); ctx.lineTo(M.WW-cam.x, r*TS+16-cam.y); }
  ctx.stroke(); ctx.setLineDash([]);

  drawGoal(G);
}

function drawDitch(tx,ty){       // 用水路：地面より低い＝視線が通らない場所
  const x = tx*TS-cam.x, y = ty*TS-cam.y;
  ctx.fillStyle='#1b2430'; ctx.fillRect(x,y+4,TS,TS-8);
  ctx.fillStyle='#141b25'; ctx.fillRect(x,y+8,TS,TS-16);
  ctx.strokeStyle='rgba(150,170,200,.18)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x,y+4.5); ctx.lineTo(x+TS,y+4.5);
  ctx.moveTo(x,y+TS-4.5); ctx.lineTo(x+TS,y+TS-4.5); ctx.stroke();
  ctx.fillStyle='rgba(90,140,180,.10)'; ctx.fillRect(x,y+13,TS,6);
}

function drawGoal(G){
  const g = G.objective.goal;
  const open = G.goalOpen;
  const x = g.x*TS-cam.x, y = g.y*TS-cam.y, w = g.w*TS, h = g.h*TS;
  const pulse = .32 + Math.sin(G.elapsed*3)*.14;
  ctx.fillStyle = open ? `rgba(255,209,102,${pulse})` : 'rgba(120,132,160,.22)';
  rr(ctx, x+4, y+5, w-8, h-10, 8); ctx.fill();
  ctx.strokeStyle = open ? 'rgba(255,233,180,.85)' : 'rgba(160,175,205,.5)';
  ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = open ? '#2a1c08' : 'rgba(230,238,255,.75)';
  ctx.font = '700 13px "M PLUS Rounded 1c"'; ctx.textAlign = 'center';
  ctx.fillText(open ? G.goalLabel : 'かぎがかかってる', x+w/2, y+h/2+5);
}

/* ─── 建物 ─── */
function drawBuilding(b){
  const H = b.home ? 26 : 34;
  const x = b.x*TS-cam.x, y = b.y*TS-cam.y, w = b.w*TS, h = b.h*TS;
  if(x>VW || y>VH || x+w<0 || y+h+40<0) return;
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(x+8,y+10,w,h);
  const sg = ctx.createLinearGradient(0,y+h-H,0,y+h);
  sg.addColorStop(0,b.wall); sg.addColorStop(1,'#0d1020');
  ctx.fillStyle=sg; ctx.fillRect(x, y+h-H, w, H);
  ctx.fillStyle=b.roof; ctx.fillRect(x, y-6, w, h-H+6);
  ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(x, y-6, w, 5);
  ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=2; ctx.strokeRect(x, y-6, w, h);
  for(let i=0;i<b.w;i++){
    if((i+b.x+b.y)%2) continue;
    const lit = ((b.x*7+b.y*13+i*5)%3)!==0;
    ctx.fillStyle = lit ? 'rgba(255,214,140,.92)' : 'rgba(40,52,80,.9)';
    ctx.fillRect(x+i*TS+9, y+h-H+9, 14, H-16);
  }
  if(b.home){
    ctx.fillStyle='#e8b45a'; ctx.fillRect(x+w/2-10, y+h-H+6, 20, H-8);
    ctx.fillStyle='#7a4a1c'; ctx.fillRect(x+w/2-10, y+h-H+6, 20, 5);
    ctx.fillStyle='#fff0c8'; ctx.font='700 12px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText('うち', x+w/2, y+h-H-12);
  }
}

/* ─── 隠れ場所 ─── */
function shadowEl(wx,wy,w,a=.42){
  ctx.fillStyle=`rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(sx(wx), sy(wy)+8, w, w*0.42, 0,0,Math.PI*2); ctx.fill();
}
function drawBush(tx,ty){
  const x = tx*TS+16-cam.x, y = ty*TS+16-cam.y;
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x,y+9,15,6,0,0,Math.PI*2); ctx.fill();
  const blobs=[[-8,0,11],[8,1,11],[0,-6,12],[0,4,10]];
  for(const [ox,oy,r] of blobs){ ctx.fillStyle='#1f5a35'; ctx.beginPath(); ctx.arc(x+ox,y+oy,r,0,Math.PI*2); ctx.fill(); }
  for(const [ox,oy,r] of blobs){ ctx.fillStyle='rgba(126,214,140,.28)'; ctx.beginPath(); ctx.arc(x+ox-2,y+oy-3,r*.55,0,Math.PI*2); ctx.fill(); }
}
function drawHedge(tx,ty){       // いけがき：隠れたまま歩ける
  const x = tx*TS-cam.x, y = ty*TS-cam.y;
  ctx.fillStyle='rgba(0,0,0,.40)'; ctx.fillRect(x+3, y+TS-6, TS, 8);
  ctx.fillStyle='#194a2c'; ctx.fillRect(x, y-8, TS, TS+6);
  ctx.fillStyle='#22633a'; ctx.fillRect(x, y-10, TS, 12);
  for(let i=0;i<5;i++){
    const h=((tx*31+ty*17+i*13)>>>0)%7;
    ctx.fillStyle='rgba(130,210,145,.22)';
    ctx.beginPath(); ctx.arc(x+5+i*6, y-6+h*0.8, 4.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle='rgba(10,30,18,.6)'; ctx.lineWidth=1; ctx.strokeRect(x+.5, y-10.5, TS-1, TS+8);
}
function drawNoren(tx,ty){
  const x = tx*TS-cam.x, y = ty*TS-cam.y;
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(x+3, y+TS-5, TS, 6);
  ctx.fillStyle='#7a3038'; ctx.fillRect(x, y-16, TS, 5);
  for(let i=0;i<3;i++){
    ctx.fillStyle = i===1 ? '#9c3f48' : '#8b3740';
    ctx.fillRect(x+i*11, y-12, 9, 24);
  }
  ctx.fillStyle='rgba(255,235,210,.75)'; ctx.font='700 9px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText('湯', x+16, y+3);
}
function drawBox(tx,ty){
  const x = tx*TS+16-cam.x, y = ty*TS+16-cam.y;
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x,y+10,14,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#7b5326'; ctx.fillRect(x-14,y-2,28,20);
  ctx.fillStyle='#a9762f'; ctx.fillRect(x-14,y-12,28,12);
  ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(x-14,y-12,28,3);
  ctx.strokeStyle='rgba(40,22,6,.8)'; ctx.lineWidth=1.5; ctx.strokeRect(x-14,y-12,28,30);
  ctx.strokeStyle='rgba(232,214,180,.55)'; ctx.beginPath(); ctx.moveTo(x,y-12); ctx.lineTo(x,y-2); ctx.stroke();
}
function drawPipe(tx,ty){        // 公園の土管：中は完全に安全
  const x = tx*TS+16-cam.x, y = ty*TS+16-cam.y;
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x,y+11,17,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#8a8f99'; ctx.fillRect(x-16,y-16,32,26);
  ctx.fillStyle='#767c88'; ctx.fillRect(x-16,y-16,32,4);
  ctx.fillStyle='#5c626e'; ctx.beginPath(); ctx.ellipse(x-14,y-3,7,13,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#15181f'; ctx.beginPath(); ctx.ellipse(x-14,y-3,4.5,10,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(30,34,42,.7)'; ctx.lineWidth=1.5; ctx.strokeRect(x-16,y-16,32,26);
}
function drawCar(tx,ty){         // とめてある車：下にもぐれる
  const x = tx*TS+16-cam.x, y = ty*TS+16-cam.y;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(x,y+9,22,8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2c3550'; ctx.fillRect(x-22,y-4,44,12);
  ctx.fillStyle='#3d4a6d'; rr(ctx,x-22,y-18,44,16,5); ctx.fill();
  ctx.fillStyle='#141a28'; rr(ctx,x-15,y-16,30,10,3); ctx.fill();
  ctx.fillStyle='rgba(160,200,255,.25)'; rr(ctx,x-14,y-15,28,7,2); ctx.fill();
  ctx.fillStyle='#0e121c'; ctx.fillRect(x-19,y+6,9,4); ctx.fillRect(x+10,y+6,9,4);
  ctx.fillStyle='rgba(255,220,160,.5)'; ctx.fillRect(x+19,y-2,4,4);
}
function drawProp(p){            // 視線を遮る設置物＝背後が安全地帯になる
  const x = p.x*TS+16-cam.x, y = p.y*TS+16-cam.y;
  ctx.fillStyle='rgba(0,0,0,.48)'; ctx.beginPath(); ctx.ellipse(x,y+10,14,5,0,0,Math.PI*2); ctx.fill();
  if(p.kind === 'vending'){
    ctx.fillStyle='#1d3a52'; ctx.fillRect(x-14,y-40,28,50);
    ctx.fillStyle='#2a5f8a'; ctx.fillRect(x-14,y-40,28,6);
    ctx.fillStyle='rgba(255,238,180,.9)'; ctx.fillRect(x-11,y-34,22,20);
    for(let i=0;i<3;i++){ ctx.fillStyle=['#e05a5a','#4fc27a','#e0b44f'][i]; ctx.fillRect(x-9+i*7, y-31, 5, 13); }
    ctx.fillStyle='#0f1a26'; ctx.fillRect(x-11,y-11,22,7);
  } else if(p.kind === 'sign'){
    ctx.fillStyle='#3a4358'; ctx.fillRect(x-3,y-14,6,24);
    ctx.fillStyle='#c8503f'; rr(ctx,x-16,y-44,32,32,4); ctx.fill();
    ctx.strokeStyle='rgba(255,235,200,.7)'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#ffeecd'; ctx.font='800 15px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText('店', x, y-23);
  } else {  // 電柱
    ctx.fillStyle='#4a4f5e'; ctx.fillRect(x-4,y-56,8,66);
    ctx.fillStyle='#5c6274'; ctx.fillRect(x-13,y-50,26,4);
    ctx.fillStyle='#5c6274'; ctx.fillRect(x-11,y-42,22,3);
    ctx.strokeStyle='rgba(20,26,38,.75)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x-13,y-49); ctx.lineTo(x-70,y-54);
    ctx.moveTo(x+13,y-49); ctx.lineTo(x+70,y-54); ctx.stroke();
  }
}
function drawLamp(l){
  const x = l.x-cam.x, y = l.y-cam.y;
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x,y+6,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#39445c'; ctx.fillRect(x-3, y-46, 6, 50);
  ctx.fillStyle='#ffd88a'; rr(ctx,x-9,y-56,18,12,4); ctx.fill();
  ctx.fillStyle='rgba(255,216,138,.25)'; ctx.beginPath(); ctx.arc(x,y-50,18,0,Math.PI*2); ctx.fill();
}

/* ─── 視界コーン ─── */
function coneColor(e, boss){
  if(e.stun > 0)          return ['rgba(150,160,190,.20)','rgba(150,160,190,0)'];
  if(e.mode === 'chase' || (boss && e.det > .6)) return ['rgba(255,89,100,.38)','rgba(255,89,100,0)'];
  if(e.mode === 'suspect')return ['rgba(255,169,84,.30)','rgba(255,169,84,0)'];
  if(e.S.light)           return ['rgba(255,240,190,.42)','rgba(255,240,190,0)'];
  return ['rgba(255,236,170,.20)','rgba(255,236,170,0)'];
}
function drawCone(e, boss){
  if(e.S.crow) return;
  const range = e.S.range;
  const ex = e.x-cam.x, ey = e.y-cam.y;
  if(ex < -range-40 || ey < -range-40 || ex > VW+range+40 || ey > VH+range+40) return;
  const N = 26, pts = [];
  for(let i=0;i<=N;i++){
    const a = e.ang - e.S.fov/2 + e.S.fov*(i/N);
    let d = range;
    for(let s=12; s<=range; s+=12){
      const px = e.x+Math.cos(a)*s, py = e.y+Math.sin(a)*s;
      if(blocksSight((px/TS)|0,(py/TS)|0)){ d = s-8; break; }
    }
    pts.push([e.x+Math.cos(a)*d-cam.x, e.y+Math.sin(a)*d-cam.y]);
  }
  e._cone = pts;
  const [c0,c1] = coneColor(e, boss);
  const g = ctx.createRadialGradient(ex,ey,8, ex,ey,range);
  g.addColorStop(0,c0); g.addColorStop(1,c1);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(ex,ey);
  for(const p of pts) ctx.lineTo(p[0],p[1]);
  ctx.closePath(); ctx.fill();
}

/* ─── キャラクター ─── */
function head(x,y,skin='#f2d9c0',hair='#2c2320'){
  ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(x,y,8.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=hair; ctx.beginPath(); ctx.arc(x,y-2,8.5,Math.PI,Math.PI*2); ctx.fill();
}

function drawPlayer(G){
  const p = G.player;
  const x = p.x-cam.x, y = p.y-cam.y;
  if(p.inv > 0 && Math.sin(G.elapsed*28) < 0) return;
  shadowEl(p.x, p.y, 12);

  const t = tileAt(p.x,p.y);
  if(p.hidden && t === T.BOX){          // ダンボール変装
    ctx.fillStyle='#8a5c2a'; ctx.fillRect(x-15,y-16,30,26);
    ctx.fillStyle='#b3812f'; ctx.fillRect(x-15,y-24,30,10);
    ctx.strokeStyle='rgba(40,22,6,.85)'; ctx.lineWidth=2; ctx.strokeRect(x-15,y-24,30,34);
    ctx.fillStyle='#2b1a06'; ctx.font='700 9px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText('わ れ も の', x, y-3);
    if(p.moving){ hideTag(x, y-34, 'うごくとバレる', '#ff9a68'); }
    return;
  }
  if(p.hidden && (t === T.PIPE || t === T.CAR)){
    ctx.fillStyle='rgba(124,247,196,.5)';
    ctx.beginPath(); ctx.arc(x, y-4, 6, 0, Math.PI*2); ctx.fill();
    hideTag(x, y-24, HIDE_SPEC[t].name+'の中', '#7cf7c4');
    return;
  }

  const anyInput = p.moving;
  const bob = Math.sin(G.elapsed*10) * (p.mode==='run'?2.2:1) * (anyInput?1:0);
  let crouch = (p.hidden || p.mode==='sneak') ? 4 : 0;
  if(p.hidden && (t===T.DITCH)) crouch = 12;      // 溝の中は頭だけ

  ctx.fillStyle='#8b2230'; ctx.fillRect(x-9, y-16+crouch+bob, 18, 14);   // ランドセル
  head(x, y-20+crouch+bob);
  ctx.fillStyle='#3b6fd4'; ctx.fillRect(x-8, y-13+crouch+bob, 16, 13);
  ctx.fillStyle='#25304a'; ctx.fillRect(x-8, y-1+crouch, 6, 7); ctx.fillRect(x+2, y-1+crouch, 6, 7);
  ctx.fillStyle='rgba(255,255,255,.8)';
  const fa = p.aiming ? p.aimAng : p.ang;
  ctx.beginPath(); ctx.arc(x+Math.cos(fa)*7, y-20+crouch+bob+Math.sin(fa)*4, 2, 0, Math.PI*2); ctx.fill();

  if(p.aiming){    // 石を構えている腕
    ctx.fillStyle='#f2d9c0';
    ctx.beginPath(); ctx.arc(x+Math.cos(fa)*13, y-14+crouch+Math.sin(fa)*8, 3.5, 0, Math.PI*2); ctx.fill();
  }
  if(p.hidden){
    const s = HIDE_SPEC[p.hideTile];
    const risky = p.moving && s.moving > s.still*1.6;
    hideTag(x, y-34+crouch, risky ? 'うごくとバレる' : 'かくれ中', risky ? '#ff9a68' : '#7cf7c4');
  }
}
function hideTag(x,y,txt,col){
  ctx.fillStyle=col; ctx.font='700 11px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText(txt, x, y);
}

function drawCompanion(G){
  const c = G.companion; if(!c) return;
  const x = c.x-cam.x, y = c.y-cam.y;
  shadowEl(c.x, c.y, 10);
  const bob = Math.sin(G.elapsed*9)*(c.moving?1.6:0.5);
  ctx.fillStyle='#c8a23c'; ctx.fillRect(x-7, y-13+bob, 14, 11);        // 黄色いランドセル
  head(x, y-16+bob, '#f6e2ca', '#3a2b22');
  ctx.fillStyle='#d9668a'; ctx.fillRect(x-6.5, y-10+bob, 13, 11);
  ctx.fillStyle='#2a3350'; ctx.fillRect(x-6, y+1, 5, 6); ctx.fillRect(x+1, y+1, 5, 6);
  ctx.fillStyle= c.staying ? '#ffd166' : '#7cf7c4';
  ctx.font='700 10px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText(c.staying ? 'まってる' : 'ついてく', x, y-28);
  if(!c.staying && Math.sin(c.sob*2.2) > .85){    // ときどきしゃくりあげる
    ctx.fillStyle='rgba(160,210,255,.8)';
    ctx.beginPath(); ctx.arc(x+7, y-15, 2.2, 0, Math.PI*2); ctx.fill();
  }
}

function drawEnemy(G, e){
  const x = e.x-cam.x, y = e.y-cam.y;
  if(x<-70||y<-90||x>VW+70||y>VH+70) return;

  if(e.S.crow){                       // 電柱の上のカラス
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x,y+8,9,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a4f5e'; ctx.fillRect(x-3,y-42,6,50);
    const fl = e.cawCd > 4.4 ? Math.sin(G.elapsed*24)*3 : 0;
    ctx.fillStyle='#171b26';
    ctx.beginPath(); ctx.ellipse(x, y-50+fl, 11, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x-7, y-56+fl, 5.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#d8a13c';
    ctx.beginPath(); ctx.moveTo(x-12,y-56+fl); ctx.lineTo(x-19,y-54+fl); ctx.lineTo(x-12,y-52+fl); ctx.closePath(); ctx.fill();
    ctx.fillStyle= e.cawCd > 4.4 ? '#ff5964' : '#c9d3e6';
    ctx.beginPath(); ctx.arc(x-8, y-57+fl, 1.5, 0, Math.PI*2); ctx.fill();
    if(e.cawCd > 4.4) mark(x, y-74, '！', '#ff5964', G);
    return;
  }

  shadowEl(e.x, e.y, e.S.boss ? 15 : 12);
  const stunned = e.stun > 0;
  const bob = stunned ? Math.sin(G.elapsed*22)*2.5
            : Math.sin(G.elapsed*(e.mode==='chase'?16:8)+e.x)*1.6;

  if(e.S.dog){                        // ポチ
    ctx.fillStyle='#b8873f'; rr(ctx,x-14,y-14+bob,28,13,6); ctx.fill();
    ctx.fillStyle='#c8a05a'; ctx.beginPath(); ctx.arc(x+11, y-18+bob, 7.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#8a6229';
    ctx.beginPath(); ctx.moveTo(x+7,y-24+bob); ctx.lineTo(x+11,y-30+bob); ctx.lineTo(x+14,y-23+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#1b1b1b'; ctx.beginPath(); ctx.arc(x+17, y-18+bob, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#8a6229';
    for(const ox of [-10,-4,4,10]) ctx.fillRect(x+ox, y-2, 3.5, 8);
    ctx.strokeStyle='#8a6229'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-14,y-12+bob); ctx.lineTo(x-21,y-19+bob); ctx.stroke();
    detBar(e, x, y);
    if(e.mode!=='patrol') mark(x, y-40, e.mode==='chase'?'！':'？', e.mode==='chase'?'#ff5964':'#ffd166', G);
    return;
  }

  const big = e.S.boss ? 1.28 : e.type === 'minion' ? 0.88 : 1;
  const hy = y - 20*big + bob;
  head(x, hy, '#f2d9c0', '#1e1a18');

  // 赤帽子（鬼のしるし）
  const capCol = stunned ? '#8f96ab' : (e.mode === 'chase' ? '#ff4d5a' : e.S.cap);
  if(!(e.S.boss && e.hatGone)){
    ctx.fillStyle = capCol;
    ctx.beginPath(); ctx.arc(x, hy-4*big, 9*big, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillRect(x-11*big, hy-5*big, 22*big, 3);
  }
  if(e.S.ear || e.type === 'ear'){    // じごく耳：大きな耳
    ctx.fillStyle='#f6e0c8';
    ctx.beginPath(); ctx.ellipse(x-10, hy+1, 4, 7, -.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+10, hy+1, 4, 7,  .3, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = stunned ? '#9aa3bb' : (e.mode==='chase' ? '#ff8b93' : '#c9d3e6');
  ctx.fillRect(x-8*big, y-13*big+bob, 16*big, 13*big);
  ctx.fillStyle='#2a3350'; ctx.fillRect(x-8*big, y-1, 6*big, 7); ctx.fillRect(x+2*big, y-1, 6*big, 7);

  if(e.hasKey){                       // カギ持ちは 足元の輪＋黄色い帽子＋頭上の鍵 の3点で分かる
    const kp = .5 + Math.sin(G.elapsed*3.4)*.5;
    ctx.strokeStyle = `rgba(255,209,102,${.28+kp*.34})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y+5, 17+kp*4, 8+kp*2, 0, 0, Math.PI*2); ctx.stroke();
    /* ライト鬼の帽子(#e8c14a)と色が近いので、黒フチで別物だと分かるようにする */
    ctx.fillStyle='#ffd166';
    ctx.beginPath(); ctx.arc(x, hy-4, 9.5, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillRect(x-12, hy-5, 24, 3);
    ctx.strokeStyle='#1b1408'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.arc(x, hy-4, 9.5, Math.PI, Math.PI*2); ctx.stroke();
    ctx.strokeRect(x-12, hy-5, 24, 3);
    keyGlyph(x, hy-30 + Math.sin(G.elapsed*3)*3, 1.05);
  }
  if(e.S.light){                      // 懐中電灯
    const lx = x+Math.cos(e.ang)*14, ly = y-8+Math.sin(e.ang)*9;
    ctx.fillStyle='#4a5164'; ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffe9a8'; ctx.beginPath(); ctx.arc(lx+Math.cos(e.ang)*3, ly+Math.sin(e.ang)*2, 2.6, 0, Math.PI*2); ctx.fill();
  }

  if(stunned){
    ctx.fillStyle='#ffd166'; ctx.font='700 13px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    for(let i=0;i<3;i++){
      const a = G.elapsed*6 + i*2.09;
      ctx.fillText('★', x+Math.cos(a)*13, hy-14+Math.sin(a)*5);
    }
  } else {
    detBar(e, x, y);
    if(e.mode==='chase'||e.mode==='suspect')
      mark(x, y-46*big, e.mode==='chase'?'！':'？', e.mode==='chase'?'#ff5964':'#ffd166', G);
  }
}
function detBar(e,x,y){
  if(e.det <= .02 || e.mode === 'chase') return;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x-14, y-40, 28, 5);
  ctx.fillStyle = e.det > .7 ? '#ff5964' : '#ffd166'; ctx.fillRect(x-14, y-40, 28*e.det, 5);
}
function mark(x,y,ch,col,G){
  const s = ch==='！' ? 1+Math.sin(G.elapsed*14)*.12 : 1;
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle='rgba(8,12,26,.9)'; rr(ctx,-11,-16,22,24,6); ctx.fill();
  ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle=col; ctx.font='800 16px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText(ch,0,2); ctx.restore();
}

function drawBoss(G){
  const b = G.boss; if(!b) return;
  const x = b.x-cam.x, y = b.y-cam.y;
  shadowEl(b.x, b.y, 17);
  const wind = b.state==='windup';
  const bob = wind ? Math.sin(G.elapsed*30)*2.5 : Math.sin(G.elapsed*7)*1.6;
  const hy = y-26+bob;

  if(b.dead){                       // 降参してすわりこむ
    ctx.fillStyle='#f2d9c0'; ctx.beginPath(); ctx.arc(x, y-14, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#1e1a18'; ctx.beginPath(); ctx.arc(x, y-16, 10, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillStyle='#7b8296'; rr(ctx,x-13,y-6,26,14,5); ctx.fill();
    ctx.fillStyle='#ffd166'; ctx.font='700 12px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText('まいった…', x, y-30);
    return;
  }

  head(x, hy, '#f0d2b4', '#171410');
  if(!b.hatGone){
    ctx.fillStyle = b.state==='recover' ? '#ff8b93' : '#ff4d5a';
    ctx.beginPath(); ctx.arc(x, hy-5, 12, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillRect(x-15, hy-6, 30, 4);
    ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(x-15, hy-6, 30, 1.5);
  }
  ctx.fillStyle = b.state==='recover' ? '#ffb0b8' : '#e0555f';
  ctx.fillRect(x-13, y-18+bob, 26, 19);
  ctx.fillStyle='#2a3350'; ctx.fillRect(x-12, y+1, 9, 9); ctx.fillRect(x+3, y+1, 9, 9);

  // ぼうしの残り回数
  for(let i=0;i<3;i++){
    ctx.fillStyle = i < b.hp ? '#ff4d5a' : 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(x-14+i*14, y-52+bob, 5, 0, Math.PI*2); ctx.fill();
  }
  if(wind){
    ctx.strokeStyle='rgba(255,89,100,.75)'; ctx.lineWidth=3; ctx.setLineDash([9,7]);
    ctx.beginPath(); ctx.moveTo(x,y-8);
    ctx.lineTo(x+Math.cos(b.ang)*300, y-8+Math.sin(b.ang)*300); ctx.stroke(); ctx.setLineDash([]);
    mark(x, y-70, '！', '#ff5964', G);
  }
  if(b.state === 'recover'){
    ctx.fillStyle='#7cf7c4'; ctx.font='700 12px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText('いまだ！ ぼうしをねらえ', x, y-66+bob);
  }
}

/* ─── 石・アイテム ─── */
function drawStones(G){
  for(const s of G.stones){
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(s.x-cam.x, s.y-cam.y+6, 5, 2.5, 0,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(s.x-cam.x, s.y-cam.y-s.z); ctx.rotate(s.spin);
    ctx.fillStyle='#b9b3a4'; rr(ctx,-4.5,-4,9,8,3); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(-3,-3,4,2);
    ctx.restore();
  }
}
function drawPickups(G){
  for(const s of G.pickups){
    if(s.got) continue;
    const bob = Math.sin(G.elapsed*3.4 + s.x)*2.5;
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(s.x-cam.x, s.y-cam.y+7, 6, 2.6, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#b9b3a4'; rr(ctx, s.x-cam.x-5, s.y-cam.y-5+bob, 10, 9, 3); ctx.fill();
    const g = ctx.createRadialGradient(s.x-cam.x, s.y-cam.y+bob, 1, s.x-cam.x, s.y-cam.y+bob, 22);
    g.addColorStop(0,'rgba(220,240,255,.32)'); g.addColorStop(1,'rgba(220,240,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x-cam.x, s.y-cam.y+bob, 22, 0, Math.PI*2); ctx.fill();
  }
}
function drawItems(G){
  for(const it of G.items){
    if(it.got) continue;
    const x = it.x-cam.x, y = it.y-cam.y, bob = Math.sin(G.elapsed*2.6+it.x)*3;
    const g = ctx.createRadialGradient(x,y+bob,2,x,y+bob,34);
    g.addColorStop(0,'rgba(255,209,102,.36)'); g.addColorStop(1,'rgba(255,209,102,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y+bob,34,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x,y+9,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e8c46a'; rr(ctx,x-9,y-9+bob,18,16,4); ctx.fill();
    ctx.strokeStyle='#8a6a20'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#7a5c18'; ctx.fillRect(x-9,y-4+bob,18,3);
    ctx.fillStyle='#ffe9a8'; ctx.font='700 10px "M PLUS Rounded 1c"'; ctx.textAlign='center';
    ctx.fillText(it.name, x, y-18+bob);
  }
}

/* 石の照準ガイド：着弾点は計算で確定するので必ず当たる */
function drawAim(G){
  const p = G.player;
  if(!p.aiming) return;
  const pw = Math.max(0.28, p.aim);
  const t = predict(p.x, p.y, p.aimAng, pw);
  const R = Math.hypot(t.x-p.x, t.y-p.y);
  ctx.save();
  ctx.strokeStyle='rgba(124,247,196,.85)'; ctx.lineWidth=2.5; ctx.setLineDash([6,7]);
  ctx.beginPath();
  for(let i=0;i<=18;i++){
    const k = i/18, px = p.x + (t.x-p.x)*k, py = p.y + (t.y-p.y)*k - Math.sin(k*Math.PI)*Math.min(46, R*0.22);
    i ? ctx.lineTo(px-cam.x, py-cam.y) : ctx.moveTo(px-cam.x, py-cam.y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  const tx = t.x-cam.x, ty = t.y-cam.y;
  // 着弾点
  ctx.strokeStyle='#7cf7c4'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(tx,ty,10,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx,ty,3,0,Math.PI*2); ctx.fillStyle='#7cf7c4'; ctx.fill();
  ctx.strokeStyle='rgba(124,247,196,.35)'; ctx.lineWidth=1.5;
  for(const a of [0, Math.PI/2, Math.PI, -Math.PI/2]){
    ctx.beginPath();
    ctx.moveTo(tx+Math.cos(a)*14, ty+Math.sin(a)*14);
    ctx.lineTo(tx+Math.cos(a)*20, ty+Math.sin(a)*20); ctx.stroke();
  }
  // 音が届く範囲＝ここにいる鬼を呼び寄せられる
  ctx.strokeStyle='rgba(124,247,196,.34)'; ctx.lineWidth=2; ctx.setLineDash([5,9]);
  ctx.beginPath(); ctx.arc(tx,ty,170,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(124,247,196,.55)'; ctx.font='700 10px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText('この中の鬼がよってくる', tx, ty-176);
  ctx.restore();
}

/* 石の着弾リング（音がここまで届いた、の可視化） */
/* ─── かぎのアイコン（絵文字に頼らずベクタで描く） ─── */
function keyGlyph(x, y, s=1, col='#ffd166'){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0,-3.6,3.6,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,0);   ctx.lineTo(0,7.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,4.4); ctx.lineTo(3.8,4.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,7.6); ctx.lineTo(3.0,7.6); ctx.stroke();
  ctx.restore();
}

/* ─── かぎ持ちの居場所マーカー ───
   4面「鍵を持った鬼がどこにいるか分からない」対策。
   画面内なら本人の頭上の鍵で足りるので出さない。画面外のときだけ
   画面のふちに方向と距離を出す。出すのは"目的の鬼"1体だけで、
   ほかの鬼の位置は今までどおり自分で探す。 */
function drawKeyMarker(G){
  if(G.hasKey) return;
  const e = G.enemies.find(en => en.hasKey && !en.dead);
  if(!e) return;
  const px = e.x - cam.x, py = e.y - cam.y;
  if(px > 34 && px < VW-34 && py > 96 && py < VH-84) return;

  const dist = Math.max(1, Math.round(Math.hypot(e.x-G.player.x, e.y-G.player.y) / TS));
  const ang = Math.atan2(py - VH/2, px - VW/2);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const hw = VW/2 - 46, hh = dy < 0 ? VH/2 - 104 : VH/2 - 78;   // 上のHUDバー・下のボタンを避ける
  const t  = Math.min(Math.abs(dx) < 1e-4 ? 1e9 : hw/Math.abs(dx),
                      Math.abs(dy) < 1e-4 ? 1e9 : hh/Math.abs(dy));
  const mx = VW/2 + dx*t, my = VH/2 + dy*t;
  const pl = .5 + Math.sin(G.elapsed*4)*.5;

  ctx.save();
  ctx.fillStyle = 'rgba(10,16,30,.72)';
  ctx.beginPath(); ctx.arc(mx, my, 19, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(255,209,102,${.5+pl*.4})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 19, 0, Math.PI*2); ctx.stroke();
  keyGlyph(mx, my-1, 1.15);
  ctx.translate(mx, my); ctx.rotate(ang);
  ctx.fillStyle = `rgba(255,209,102,${.65+pl*.35})`;
  ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(21,-6.5); ctx.lineTo(21,6.5); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.fillStyle='#ffe9a8'; ctx.font='700 11px "M PLUS Rounded 1c"'; ctx.textAlign='center';
  ctx.fillText(`${dist}m`, mx, my+32);
}

function drawPings(G){
  for(const p of G.pings){
    const k = 1 - p.life/p.max;
    ctx.strokeStyle=`rgba(124,247,196,${(1-k)*0.55})`;
    ctx.lineWidth = 3*(1-k)+0.5;
    ctx.beginPath(); ctx.arc(p.x-cam.x, p.y-cam.y, 12 + k*p.r, 0, Math.PI*2); ctx.stroke();
  }
}

/* ─── ライティング ─── */
function drawLighting(G){
  const M = current();
  lctx.clearRect(0,0,VW,VH);
  const ph = G.alert.phase;
  lctx.fillStyle = ph==='ALERT' ? 'rgba(34,6,14,.60)'
                 : ph==='EVASION' ? 'rgba(26,10,16,.62)'
                 : 'rgba(8,14,40,.66)';
  lctx.fillRect(0,0,VW,VH);
  lctx.globalCompositeOperation='destination-out';
  const hole = (x,y,r,a=1) => {
    const g = lctx.createRadialGradient(x,y,r*.12,x,y,r);
    g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(.55,`rgba(0,0,0,${a*.55})`); g.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=g; lctx.beginPath(); lctx.arc(x,y,r,0,Math.PI*2); lctx.fill();
  };
  for(const l of M.lamps){
    const x = l.x-cam.x, y = l.y-cam.y-40;
    if(x<-200||y<-200||x>VW+200||y>VH+200) continue;
    hole(x,y,155,.95);
  }
  hole(G.player.x-cam.x, G.player.y-cam.y, 105, .8);
  // 懐中電灯鬼のあかりは、実際に地面を照らす
  for(const e of G.enemies){
    if(!e.S.light || e.dead || !e._cone) continue;
    lctx.fillStyle='rgba(0,0,0,.92)';
    lctx.beginPath(); lctx.moveTo(e.x-cam.x, e.y-cam.y);
    for(const p of e._cone) lctx.lineTo(p[0],p[1]);
    lctx.closePath(); lctx.fill();
  }
  const g = G.objective.goal;
  hole((g.x+g.w/2)*TS-cam.x, g.y*TS-cam.y, 140, G.goalOpen ? .9 : .45);
  lctx.globalCompositeOperation='source-over';
  ctx.drawImage(lightCv,0,0);

  ctx.globalCompositeOperation='lighter';
  for(const l of M.lamps){
    const x = l.x-cam.x, y = l.y-cam.y-46;
    if(x<-160||y<-160||x>VW+160||y>VH+160) continue;
    const gg = ctx.createRadialGradient(x,y,2,x,y,90);
    gg.addColorStop(0,'rgba(255,214,140,.30)'); gg.addColorStop(1,'rgba(255,214,140,0)');
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(x,y,90,0,Math.PI*2); ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';

  const v = ctx.createRadialGradient(VW/2,VH/2,VH*.35,VW/2,VH/2,VH*.95);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.72)');
  ctx.fillStyle=v; ctx.fillRect(0,0,VW,VH);
}

/* ═══ 本体 ═══ */
export function render(G){
  cam = G.cam;
  const M = current();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,VW,VH);
  ctx.save();
  if(G.shake > 0) ctx.translate((Math.random()-.5)*G.shake, (Math.random()-.5)*G.shake);

  drawGround(G);
  for(const e of G.enemies) if(!e.dead) drawCone(e);
  if(G.boss && !G.boss.dead) drawCone(G.boss, true);

  // Yソートで奥行きを出す
  const d = [];
  for(const b of (M.L.buildings||[])) d.push({y:(b.y+b.h)*TS, f:()=>drawBuilding(b)});
  const x0 = Math.max(0,(cam.x/TS|0)-2), y0 = Math.max(0,(cam.y/TS|0)-3);
  const x1 = Math.min(M.MW-1,((cam.x+VW)/TS|0)+2), y1 = Math.min(M.MH-1,((cam.y+VH)/TS|0)+2);
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = M.grid[y][x];
    if(t===T.BUSH)      d.push({y:y*TS+24, f:()=>drawBush(x,y)});
    else if(t===T.BOX)  d.push({y:y*TS+24, f:()=>drawBox(x,y)});
    else if(t===T.HEDGE)d.push({y:y*TS+26, f:()=>drawHedge(x,y)});
    else if(t===T.NOREN)d.push({y:y*TS+26, f:()=>drawNoren(x,y)});
    else if(t===T.PIPE) d.push({y:y*TS+26, f:()=>drawPipe(x,y)});
    else if(t===T.CAR)  d.push({y:y*TS+26, f:()=>drawCar(x,y)});
  }
  for(const p of M.props) d.push({y:p.y*TS+26, f:()=>drawProp(p)});
  for(const l of M.lamps) d.push({y:l.y+4,    f:()=>drawLamp(l)});
  for(const e of G.enemies) if(!e.dead) d.push({y:e.y, f:()=>drawEnemy(G,e)});
  if(G.boss) d.push({y:G.boss.y, f:()=>drawBoss(G)});
  if(G.companion) d.push({y:G.companion.y, f:()=>drawCompanion(G)});
  d.push({y:G.player.y, f:()=>drawPlayer(G)});
  d.sort((a,b)=>a.y-b.y);
  for(const it of d) it.f();

  drawPickups(G);
  drawItems(G);
  drawStones(G);

  for(const p of G.particles){
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x-cam.x-2, p.y-cam.y-2, 4, 4);
  }
  ctx.globalAlpha = 1;

  drawLighting(G);

  // 照準ガイドと着弾リングは「操作のための線」なので、
  // 暗幕の下に沈めず必ず上に乗せる
  drawPings(G);
  drawAim(G);
  ctx.restore();

  drawKeyMarker(G);   // 画面のふちに出すので、画面ゆれ（shake）の外側で描く

  if(G.flash > 0){ ctx.fillStyle = `rgba(255,60,80,${G.flash*.4})`; ctx.fillRect(0,0,VW,VH); }
  return ctx;
}
export const getCtx = () => ctx;
