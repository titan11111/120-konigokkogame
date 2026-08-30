/* ══════════════════════════════════════════
   audio.js ─ 音の作り直し

   方針（タイタン指示 2026-08-30）:
     ・常時鳴る音をビープにしない（耳が疲れる）
       → 足音・かくれる音は「オシレータのピー音」を廃止し、
         ホワイトノイズ＋フィルタで布擦れ／砂利の質感にする
     ・一度きりの重要イベントだけ音を立てる
     ・「見つかった瞬間」はこの作品の顔。いちばん力を入れる
   ══════════════════════════════════════════ */

let AC = null, master = null, noiseBuf = null;

export function audio(){
  if(!AC){
    try{
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.9;
      master.connect(AC.destination);
    }catch(e){ /* 音なしでも遊べる */ }
  }
  return AC;
}
/* iOS はユーザー操作の中でしか鳴らせない */
export function unlock(){
  const ac = audio();
  if(ac && ac.state === 'suspended') ac.resume();
}

function getNoise(ac){
  if(!noiseBuf){
    const len = ac.sampleRate * 0.7;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  }
  return noiseBuf;
}

/* ノイズ1発（足音・葉ずれ・着弾などの「質感のある音」はすべてこれ） */
function nz({dur=.1, type='lowpass', f0=800, f1=0, q=1, vol=.08, at=0}){
  const ac = audio(); if(!ac) return;
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac); src.loop = true;
  src.playbackRate.value = 0.8 + Math.random()*0.4;
  const flt = ac.createBiquadFilter();
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  if(f1) flt.frequency.exponentialRampToValueAtTime(Math.max(60,f1), t+dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.012, dur*.25));
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + .03);
}

/* 音程のある音（チャイム・掛け声など、鳴らす価値のあるものだけ） */
function osc({freq=440, dur=.2, type='triangle', vol=.08, to=0, at=0, lp=0}){
  const ac = audio(); if(!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if(to) o.frequency.exponentialRampToValueAtTime(Math.max(40,to), t+dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .015);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let node = o;
  if(lp){
    const f = ac.createBiquadFilter();
    f.type='lowpass'; f.frequency.value = lp;
    o.connect(f); node = f;
  }
  node.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + .03);
}

export const sfx = {
  /* 操作盤の打感（短く・小さく。常時ビープにしない） */
  tap(){
    nz({dur:.028, f0:1800, f1:900, vol:.028, type:'bandpass', q:1.4});
  },

  /* ── 常時鳴る音：ぜんぶノイズ。ビープにしない ── */
  step(surface){
    // アスファルト＝硬い / 草＝やわらかい / 砂利＝ざらつく
    if(surface === 'grass')      nz({dur:.075, f0:1500, f1:520, vol:.030, q:.7});
    else if(surface === 'gravel')nz({dur:.070, f0:2600, f1:900, vol:.038, q:.9});
    else                         nz({dur:.055, f0:760,  f1:300, vol:.032, q:.8});
  },
  stepRun(surface){
    if(surface === 'grass')      nz({dur:.095, f0:1700, f1:480, vol:.050, q:.7});
    else                         nz({dur:.075, f0:980,  f1:280, vol:.055, q:.8});
  },
  hide(){   // 草に潜り込む音
    nz({dur:.20, f0:2400, f1:700, vol:.045, q:.6});
  },
  unhide(){ nz({dur:.13, f0:1900, f1:800, vol:.030, q:.6}); },

  /* ── あやしまれた：ビープではなく木質の「コッ」 ── */
  notice(){
    nz({dur:.05, f0:2200, vol:.045, type:'bandpass', q:2.2});
    osc({freq:430, dur:.10, type:'triangle', vol:.045, to:360, lp:1400});
  },

  /* ══ 見つかった ══
     この作品の顔。ここだけは強く、はっきり鳴らす。
     ①息を呑む一撃 ②「みぃつけた！」に相当する二段の掛け声 ③追跡の緊迫 */
  alert(){
    nz({dur:.14, f0:5200, f1:900, vol:.16, q:.8});                   // ①
    osc({freq:300, dur:.13, type:'sawtooth', vol:.10, to:760, lp:1900});
    osc({freq:660, dur:.16, type:'square',   vol:.075, at:.10, lp:2300}); // ②一声め
    osc({freq:880, dur:.30, type:'square',   vol:.085, at:.24, lp:2600}); // ②二声め
    nz({dur:.5,  f0:400, f1:150, vol:.055, q:.5, at:.22});            // ③
    osc({freq:120, dur:.55, type:'sawtooth', vol:.075, at:.22, to:96, lp:520});
  },

  caught(){
    nz({dur:.30, f0:900, f1:120, vol:.12, q:.7});
    osc({freq:330, dur:.45, type:'sawtooth', vol:.10, to:70, lp:900});
  },

  /* ── 石 ── */
  throw(){ nz({dur:.16, f0:600, f1:2400, vol:.045, type:'bandpass', q:1.6}); },
  stoneLand(){   // カツン
    nz({dur:.045, f0:4200, vol:.10, type:'highpass', q:.8});
    osc({freq:980, dur:.075, type:'triangle', vol:.075, to:620, lp:3200});
  },
  stoneHit(){    // 鬼に当たった
    nz({dur:.09, f0:2600, f1:700, vol:.11, q:1.0});
    osc({freq:520, dur:.20, type:'triangle', vol:.070, to:300, lp:1600});
  },

  pickup(){ osc({freq:740, dur:.11, type:'triangle', vol:.060, lp:3000});
            osc({freq:1108,dur:.14, type:'triangle', vol:.050, at:.08, lp:3400}); },
  itemGet(){ [660,880,1174].forEach((f,i)=>osc({freq:f,dur:.20,type:'triangle',vol:.075,at:i*.09,lp:3600})); },

  crow(){    // カラスが鳴く＝周囲に知らせる
    osc({freq:900, dur:.16, type:'sawtooth', vol:.075, to:520, lp:2400});
    osc({freq:820, dur:.20, type:'sawtooth', vol:.070, to:430, lp:2200, at:.20});
    nz({dur:.30, f0:2000, f1:800, vol:.040, q:.7, at:.06});
  },
  dogBark(){
    osc({freq:300, dur:.13, type:'square', vol:.085, to:180, lp:1200});
    nz({dur:.14, f0:1400, f1:400, vol:.055, q:.8});
  },
  flap(){ for(let i=0;i<4;i++) nz({dur:.09, f0:1100, f1:400, vol:.045, q:.6, at:i*.11}); },

  bossHit(){
    nz({dur:.14, f0:3200, f1:500, vol:.13, q:.8});
    osc({freq:220, dur:.30, type:'sawtooth', vol:.095, to:120, lp:1100});
  },
  bossCharge(){
    osc({freq:150, dur:.55, type:'sawtooth', vol:.085, to:280, lp:700});
    nz({dur:.55, f0:260, f1:700, vol:.055, q:.6});
  },
  bossDown(){
    [440,392,330,262].forEach((f,i)=>osc({freq:f,dur:.42,type:'triangle',vol:.090,at:i*.16,lp:2400}));
    nz({dur:.5, f0:700, f1:120, vol:.070, q:.6, at:.3});
  },

  /* ── 5時のチャイム（世界観の要。これは音程のある音でいい） ── */
  chime(){ [784,659,523,392].forEach((f,i)=>osc({freq:f,dur:.85,type:'sine',vol:.085,at:i*.42,lp:2600})); },
  preChime(){ [784,659].forEach((f,i)=>osc({freq:f,dur:.7,type:'sine',vol:.035,at:i*.40,lp:1500})); },

  clear(){ [523,659,784,1047].forEach((f,i)=>osc({freq:f,dur:.34,type:'triangle',vol:.095,at:i*.13,lp:3600})); },
  levelUp(){ [392,523,659,784,1047].forEach((f,i)=>osc({freq:f,dur:.30,type:'triangle',vol:.085,at:i*.10,lp:3600})); },
};
