/* ══════════════════════════════════════════
   config.js ─ チューニング値の一元管理
   数字をいじるならこのファイルだけ見ればいい
   ══════════════════════════════════════════ */

export const TS = 32;              // 1タイルのピクセル数
export const VW = 960, VH = 600;   // 画面（内部解像度）

/* ── タイル種別 ── */
export const T = {
  GROUND:0, WALL:1, BUSH:2, BOX:3, HEDGE:4,
  DITCH:5, NOREN:6, PIPE:7, CAR:8, PROP:9
};

/* 通れない */
export const SOLID = new Set([T.WALL, T.PROP]);
/* 視線を遮る（＝背後にいれば見つからない） */
export const SIGHT_BLOCK = new Set([T.WALL, T.HEDGE, T.NOREN, T.PROP]);

/* ── 隠れ場所の性能 ──
   still   : じっとしている時に見つかる距離（小さいほど安全）
   moving  : 動いている時に見つかる距離
   mul     : 隠れながら移動するときの速度倍率
   enter   : 隠れ切るまでの秒数（この間は無防備）        */
export const HIDE_SPEC = {
  [T.BUSH] : {still:46, moving:112, mul:0.62, enter:0,   name:'くさむら'},
  [T.BOX]  : {still:40, moving:132, mul:0.42, enter:0,   name:'ダンボール'},
  [T.HEDGE]: {still:42, moving:54,  mul:0.72, enter:0,   name:'いけがき'},
  [T.DITCH]: {still:38, moving:48,  mul:0.68, enter:0,   name:'みぞ'},
  [T.NOREN]: {still:44, moving:60,  mul:0.80, enter:0,   name:'のれん'},
  [T.PIPE] : {still:0,  moving:0,   mul:0.50, enter:0.5, name:'どかん'},
  [T.CAR]  : {still:0,  moving:0,   mul:0.40, enter:0.6, name:'車の下'},
};
export const isHide = t => HIDE_SPEC[t] !== undefined;

/* ── プレイヤー ── */
export const SPD    = { sneak:78, walk:132, run:205 };
export const NOISE_R= { sneak:0,  walk:92,  run:190 };  // 足音が届く距離
export const PLAYER_R = 10;
export const INV_TIME = 2.2;      // つかまった後の無敵秒数

/* ── 石 ── */
export const STONE = {
  max:3,          // 同時所持数
  chargeT:0.55,   // 最大まで溜める秒数
  minRange:96,    // 最短の飛距離
  maxRange:268,   // 最長の飛距離
  noiseR:170,     // 着弾音が届く距離（LOS不要＝角を曲がって届く）
  stunT:1.2,      // 直撃した鬼がひるむ秒数
  gravity:900,
  hitR:17,        // 命中判定の半径
  aimSlow:0.5     // 構えている間の移動速度倍率
};

/* ── 町ぜんたいの警戒フェーズ ──
   見つかった代償が「その後ずっと続く」のが潜入の緊張の正体 */
export const PHASE = {
  ALERT  : {t:20, label:'みつかった！', col:'#ff5964', vis:1.25, spd:1.30, next:'EVASION'},
  EVASION: {t:30, label:'さがしてる…', col:'#ff9a68', vis:1.12, spd:1.18, next:'CAUTION'},
  CAUTION: {t:45, label:'ようじん中',  col:'#ffd166', vis:1.15, spd:1.10, next:'NORMAL'},
  NORMAL : {t:0,  label:'しのび中',    col:'#7cf7c4', vis:1.00, spd:1.00, next:null},
};
export const PHASE_ORDER = ['NORMAL','CAUTION','EVASION','ALERT'];

/* ── 鬼の種類 ──
   fov  : 視野角(rad)　range : 見える距離　hear : 耳のよさ倍率 */
export const ENEMY = {
  patrol: {name:'見回り鬼',   fov:1.15, range:230, speed:78,  hear:1.0, chase:1.9, cap:'#d64450'},
  fast:   {name:'早足鬼',     fov:0.88, range:180, speed:118, hear:0.7, chase:1.7, cap:'#e0663c'},
  ear:    {name:'じごく耳',   fov:0.72, range:145, speed:72,  hear:2.2, chase:1.8, cap:'#c05fb0'},
  dog:    {name:'ポチ',       fov:0.55, range:105, speed:104, hear:1.4, chase:2.0, cap:'#c8a05a', dog:true},
  crow:   {name:'みはりガラス',fov:6.30, range:112, speed:0,  hear:0.0, chase:1.0, cap:'#5d6480', crow:true},
  light:  {name:'ライト鬼',   fov:0.46, range:378, speed:74,  hear:1.0, chase:1.8, cap:'#e8c14a', light:true},
  minion: {name:'こぶん',     fov:1.15, range:200, speed:92,  hear:1.0, chase:1.9, cap:'#b04a70'},
  boss:   {name:'ガキ大将',   fov:1.55, range:260, speed:96,  hear:1.0, chase:1.0, cap:'#ff4d5a', boss:true},
};

/* ── 検知 ── */
export const DET = {
  up:1.55,      // 見られている間に発見メーターが増える速さ
  down:0.70,    // 見られなくなってから減る速さ
  suspect:0.42, // ここを超えると「？」
  runLoud:1.7,  // ダッシュ中は見つかりやすい
  sneakQuiet:0.72
};

/* ── ボス ── */
export const BOSS = {
  hatHP:3,
  windup:0.75,   // 突進の予備動作（この間に逃げる）
  charge:0.85,
  chargeSpd:330,
  recover:1.45,  // 突進後のスキ＝石を当てるチャンス
  backAngle:2.0, // これ以上の角度差なら「背後」
  minionAt:[2,1] // 残りHPがこの値になった時に子分を呼ぶ
};

export const COMPANION = { follow:52, speed:112, noiseR:58, goalR:96 };
export const STEAL_R = 30, STEAL_ANGLE = 2.0;
