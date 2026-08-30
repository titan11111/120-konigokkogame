/* ══════════════════════════════════════════
   map.js ─ 面データ → グリッド、当たり判定、視線、経路探索
   ══════════════════════════════════════════ */
import { TS, T, SOLID, SIGHT_BLOCK, HIDE_SPEC } from './config.js';

let M = null;   // 現在の面（1面ずつしか使わないのでモジュールに持つ）

export function current(){ return M; }

/* 線分（タイル単位）を埋める */
function line(set, from, to){
  const [x0,y0] = from, [x1,y1] = to;
  const dx = Math.sign(x1-x0), dy = Math.sign(y1-y0);
  const n  = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
  for(let i=0;i<=n;i++) set.push([x0 + dx*Math.min(i,Math.abs(x1-x0)),
                                  y0 + dy*Math.min(i,Math.abs(y1-y0))]);
}

export function buildMap(L){
  const MW = L.size.w, MH = L.size.h;
  const grid = [];
  for(let y=0;y<MH;y++) grid.push(new Uint8Array(MW));

  // 外周は壁
  for(let x=0;x<MW;x++){ grid[0][x]=T.WALL; grid[MH-1][x]=T.WALL; }
  for(let y=0;y<MH;y++){ grid[y][0]=T.WALL; grid[y][MW-1]=T.WALL; }

  const put = (x,y,t) => { if(y>0&&y<MH-1&&x>0&&x<MW-1 && grid[y][x]===T.GROUND) grid[y][x]=t; };

  for(const b of (L.buildings||[]))
    for(let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++)
      if(grid[y] && x<MW && y<MH) grid[y][x] = T.WALL;

  const hideSpots = [];
  const addHide = (x,y,t) => { put(x,y,t); if(grid[y][x]===t) hideSpots.push({x:x*TS+TS/2, y:y*TS+TS/2, t}); };

  for(const [x,y] of (L.bushes||[])) addHide(x,y,T.BUSH);
  for(const [x,y] of (L.boxes ||[])) addHide(x,y,T.BOX);
  for(const [x,y] of (L.pipes ||[])) addHide(x,y,T.PIPE);
  for(const [x,y] of (L.cars  ||[])) addHide(x,y,T.CAR);
  for(const [x,y] of (L.norens||[])) addHide(x,y,T.NOREN);

  // 線状の隠れ場所（隠れたまま移動できる＝この作品の主役）
  for(const seg of (L.hedges ||[])){ const pts=[]; line(pts,seg.from,seg.to); for(const [x,y] of pts) addHide(x,y,T.HEDGE); }
  for(const seg of (L.ditches||[])){ const pts=[]; line(pts,seg.from,seg.to); for(const [x,y] of pts) addHide(x,y,T.DITCH); }

  // 視線を遮る設置物（自販機・看板・電柱）＝背後が安全地帯になる
  const props = [];
  for(const p of (L.props||[])){ put(p.x,p.y,T.PROP); if(grid[p.y][p.x]===T.PROP) props.push(p); }

  const lamps = (L.lamps||[]).map(([x,y]) => ({x:x*TS+TS/2, y:y*TS+TS/2}));

  M = {
    L, MW, MH, WW:MW*TS, WH:MH*TS, grid, hideSpots, props, lamps,
    roads: L.roads || {cols:[], rows:[]},
    _bfs: new Map(), _bfsT: 0
  };
  return M;
}

/* ── 問い合わせ ── */
export const solid = (tx,ty) =>
  (tx<0||ty<0||tx>=M.MW||ty>=M.MH) ? true : SOLID.has(M.grid[ty][tx]);

export const blocksSight = (tx,ty) =>
  (tx<0||ty<0||tx>=M.MW||ty>=M.MH) ? true : SIGHT_BLOCK.has(M.grid[ty][tx]);

export const tileAt = (px,py) => {
  const tx = (px/TS)|0, ty = (py/TS)|0;
  return (tx<0||ty<0||tx>=M.MW||ty>=M.MH) ? T.WALL : M.grid[ty][tx];
};

export function isRoad(tx,ty){
  const r = M.roads;
  for(const c of (r.cols||[])) if(Math.abs(tx-c)<=1) return true;
  for(const w of (r.rows||[])) if(Math.abs(ty-w)<=1) return true;
  return false;
}

/* 足音の質感（音の作り分けに使う） */
export function surfaceAt(px,py){
  const t = tileAt(px,py);
  if(t===T.BUSH || t===T.HEDGE) return 'grass';
  if(t===T.DITCH) return 'gravel';
  const tx=(px/TS)|0, ty=(py/TS)|0;
  return isRoad(tx,ty) ? 'road' : 'gravel';
}

/* 視線が通るか */
export function los(ax,ay,bx,by){
  const dx = bx-ax, dy = by-ay, d = Math.hypot(dx,dy);
  const steps = Math.ceil(d/11);
  for(let i=1;i<steps;i++){
    const t = i/steps;
    if(blocksSight(((ax+dx*t)/TS)|0, ((ay+dy*t)/TS)|0)) return false;
  }
  return true;
}

/* ── 壁ずり移動 ＋ コーナーコレクション ──
   角にひっかかって止まる不快感（現行版の不満点3）への対策。
   進めなかった軸を、1タイル未満のズレなら滑らせて回り込ませる。 */
export function hitsWall(x,y,r){
  for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r],[0,-r],[0,r],[-r,0],[r,0]])
    if(solid(((x+ox)/TS)|0, ((y+oy)/TS)|0)) return true;
  return false;
}
export function moveCircle(o, dx, dy, r){
  const okX = !hitsWall(o.x+dx, o.y, r);
  const okY = !hitsWall(o.x, o.y+dy, r);
  if(okX) o.x += dx;
  if(okY) o.y += dy;

  // 角の回り込み：横に進めなかったが、少し縦にズラせば通れる場合に助ける
  if(!okX && dx !== 0 && Math.abs(dy) < 0.01){
    const slip = Math.min(Math.abs(dx)*1.6, 3.2);
    for(const s of [slip, -slip])
      if(!hitsWall(o.x+dx, o.y+s, r)){ o.y += s; o.x += dx; break; }
  }
  if(!okY && dy !== 0 && Math.abs(dx) < 0.01){
    const slip = Math.min(Math.abs(dy)*1.6, 3.2);
    for(const s of [slip, -slip])
      if(!hitsWall(o.x+s, o.y+dy, r)){ o.x += s; o.y += dy; break; }
  }

  // 街灯にぶつかる
  for(const l of M.lamps){
    const ddx = o.x-l.x, ddy = o.y-l.y, d = Math.hypot(ddx,ddy), min = r+7;
    if(d < min && d > .01){ o.x = l.x + ddx/d*min; o.y = l.y + ddy/d*min; }
  }
  o.x = Math.max(18, Math.min(M.WW-18, o.x));
  o.y = Math.max(18, Math.min(M.WH-18, o.y));
}

/* ── BFS（同じ目的地は使い回す：鬼が8体でも重くならない） ── */
export function bfs(gx,gy){
  const key = gx + gy*M.MW;
  const hit = M._bfs.get(key);
  if(hit) return hit;

  const dist = new Int16Array(M.MW*M.MH).fill(-1);
  if(!solid(gx,gy)){
    const q = [key]; dist[key] = 0;
    let head = 0;
    while(head < q.length){
      const c = q[head++], cx = c % M.MW, cy = (c/M.MW)|0, d = dist[c];
      for(const [nx,ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){
        if(nx<0||ny<0||nx>=M.MW||ny>=M.MH) continue;
        const i = nx + ny*M.MW;
        if(dist[i] !== -1 || solid(nx,ny)) continue;
        dist[i] = d+1; q.push(i);
      }
    }
  }
  if(M._bfs.size > 24) M._bfs.clear();
  M._bfs.set(key, dist);
  return dist;
}
export function tickMap(dt){
  M._bfsT -= dt;
  if(M._bfsT <= 0){ M._bfs.clear(); M._bfsT = 0.45; }   // 0.45秒ごとに作り直す
}

/* 目的地へ1歩進む */
export function stepToward(e, tx, ty, dt, r=11){
  tx = Math.max(1, Math.min(M.MW-2, tx|0));
  ty = Math.max(1, Math.min(M.MH-2, ty|0));
  const ex = (e.x/TS)|0, ey = (e.y/TS)|0;
  const path = bfs(tx,ty);
  const cur = path[ex + ey*M.MW];
  let best = null, bv = cur < 0 ? 1e9 : cur;
  for(const [nx,ny] of [[ex+1,ey],[ex-1,ey],[ex,ey+1],[ex,ey-1]]){
    if(nx<0||ny<0||nx>=M.MW||ny>=M.MH) continue;
    const v = path[nx + ny*M.MW];
    if(v >= 0 && v < bv){ bv = v; best = [nx,ny]; }
  }
  const tgx = best ? best[0]*TS+TS/2 : tx*TS+TS/2;
  const tgy = best ? best[1]*TS+TS/2 : ty*TS+TS/2;
  const dx = tgx-e.x, dy = tgy-e.y, d = Math.hypot(dx,dy);
  if(d > 1){
    moveCircle(e, dx/d*e.spd*dt, dy/d*e.spd*dt, r);
    const want = Math.atan2(dy,dx);
    let diff = want - e.ang;
    while(diff >  Math.PI) diff -= Math.PI*2;
    while(diff < -Math.PI) diff += Math.PI*2;
    e.ang += diff * Math.min(1, dt*9);   // 急に振り向かない
  }
}

/* 手打ちの座標が壁の中に入っていても事故らないための安全装置。
   5面ぶんを手で書くので、ここで必ず通せるタイルへ寄せる。 */
export function nearestFree(tx,ty){
  tx = Math.max(1, Math.min(M.MW-2, tx|0));
  ty = Math.max(1, Math.min(M.MH-2, ty|0));
  if(!solid(tx,ty)) return [tx,ty];
  for(let r=1;r<=8;r++){
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy)) !== r) continue;
      const nx = tx+dx, ny = ty+dy;
      if(nx<1||ny<1||nx>=M.MW-1||ny>=M.MH-1) continue;
      if(!solid(nx,ny)) return [nx,ny];
    }
  }
  return [tx,ty];
}
/* 面の開始地点からゴールへ本当に歩いて行けるかを検算する */
export function reachable(fromTx, fromTy, toTx, toTy){
  const d = bfs(toTx, toTy);
  return d[fromTx + fromTy*M.MW] >= 0;
}

export function nearestHide(x,y,pred){
  let best = null, bd = 1e9;
  for(const h of M.hideSpots){
    if(pred && !pred(h)) continue;
    const d = Math.hypot(h.x-x, h.y-y);
    if(d < bd){ bd = d; best = h; }
  }
  return best;
}

export const angDiff = (a,b) => {
  let d = a-b;
  while(d >  Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return Math.abs(d);
};
