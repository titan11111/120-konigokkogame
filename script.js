(() => {
  const TILE = CONFIG.TILE;
  let stageIndex = 0;
  let STAGE = STAGES[0];
  let ROWS = STAGE.map;
  let COLS = ROWS[0].length;
  let WORLD_W = COLS * TILE;
  let WORLD_H = ROWS.length * TILE;
  let resultKind = 'fail';

  function rule(key) {
    const aliases = {
      TIME: 'time',
      VIEW_RANGE: 'viewRange',
      VIEW_CONE: 'viewCone',
      SEEKER_SPEED: 'seekerSpeed',
      SEEKER_CHASE: 'seekerChase',
    };
    const sk = aliases[key];
    if (sk && STAGE && STAGE[sk] != null) return STAGE[sk];
    return CONFIG[key];
  }

  function loadStage(i) {
    stageIndex = i;
    STAGE = STAGES[i];
    ROWS = STAGE.map;
    COLS = ROWS[0].length;
    WORLD_W = COLS * TILE;
    WORLD_H = ROWS.length * TILE;
  }

  const bootStage = (() => {
    const n = parseInt(new URLSearchParams(location.search).get('stage') || '', 10);
    if (!n) return 0;
    return Math.max(0, Math.min(STAGES.length - 1, n - 1));
  })();
  let titleFromEnd = false;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const radar = document.getElementById('radar');
  const rtx = radar.getContext('2d');

  const hud = document.getElementById('hud');
  const controls = document.getElementById('virtual-controls');
  const titleOv = document.getElementById('title-overlay');
  const briefOv = document.getElementById('brief-overlay');
  const resultOv = document.getElementById('result-overlay');
  const alertBox = document.getElementById('alert-box');
  const alertPhase = document.getElementById('alert-phase');
  const alertFill = document.getElementById('alert-fill');
  const timeLeft = document.getElementById('time-left');
  const muteBtn = document.getElementById('mute-btn');
  const resultTitle = document.getElementById('result-title');
  const resultMsg = document.getElementById('result-msg');
  const briefLabel = document.getElementById('brief-label');
  const briefLines = document.getElementById('brief-lines');
  const btnRetry = document.getElementById('btn-retry');
  const stageNum = document.getElementById('stage-num');
  const titleTag = document.querySelector('.tagline');
  const pauseOv = document.getElementById('pause-overlay');
  const pauseBtn = document.getElementById('pause-btn');
  const timerBox = document.getElementById('timer-box');
  const goalName = document.getElementById('goal-name');
  const goalDistance = document.getElementById('goal-distance');
  const goalArrow = document.getElementById('goal-arrow');
  const statusChip = document.getElementById('status-chip');
  const statusText = document.getElementById('status-text');
  const throwReady = document.getElementById('throw-ready');
  const moveStick = document.getElementById('move-stick');
  const stickKnob = document.getElementById('stick-knob');

  const K = {};
  let mode = 'title';
  let dpr = 1;
  let viewW = 0;
  let viewH = 0;
  let lastTs = 0;
  let camX = 0;
  let camY = 0;
  let radarSweep = 0;
  let lastTouchEnd = 0;
  let pausedFrom = 'play';
  let joyX = 0;
  let joyY = 0;
  let joyPointer = null;
  const camera = { x: null, y: null };

  const MUTE_KEY = 'hide-and-seek-mute';
  const audio = {
    ctx: null,
    muted: localStorage.getItem(MUTE_KEY) === '1',
    drone: null,
    gain: null,
    filter: null,
  };

  const player = {
    x: 0, y: 0, vx: 0, vy: 0, facing: -Math.PI / 2, crouch: false, hiding: false,
  };
  let seekers = [];
  let particles = [];
  let time = CONFIG.TIME;
  let meter = 0;
  let phase = 'SAFE';
  let alertTimer = 0;
  let evasionTimer = 0;
  let lastKnown = { x: 0, y: 0 };
  let spottedOnce = false;
  let freeze = 0;
  let pebble = null;
  let pebbleCd = 0;
  let rustleCd = 0;
  let heartT = 0;
  const throwBtn = document.getElementById('cv-throw');

  function tileAt(c, r) {
    if (r < 0 || c < 0 || r >= ROWS.length || c >= COLS) return '#';
    return ROWS[r][c];
  }

  function tileAtPx(x, y) {
    return tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  function isSolid(ch) {
    return ch === '#';
  }

  function isHide(ch) {
    return ch === 'B' || ch === 'C';
  }

  function findTiles(ch) {
    const out = [];
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (ROWS[r][c] === ch) out.push({ c, r });
      }
    }
    return out;
  }

  function tileCenter(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }

  function los(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isSolid(tileAtPx(x0 + dx * t, y0 + dy * t))) return false;
    }
    return true;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
  }

  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio.ctx) {
      audio.ctx = new AC();
      audio.gain = audio.ctx.createGain();
      audio.filter = audio.ctx.createBiquadFilter();
      audio.filter.type = 'lowpass';
      audio.filter.frequency.value = 280;
      audio.drone = audio.ctx.createOscillator();
      audio.drone.type = 'sine';
      audio.drone.frequency.value = 72;
      audio.drone.connect(audio.filter);
      audio.filter.connect(audio.gain);
      audio.gain.connect(audio.ctx.destination);
      audio.gain.gain.value = 0;
      audio.drone.start();
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    applyMute();
  }

  function applyMute() {
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    if (!audio.gain) return;
    audio.gain.gain.setTargetAtTime(audio.muted ? 0 : droneLevel(), audio.ctx.currentTime, 0.05);
  }

  function droneLevel() {
    if (phase === 'ALERT') return 0.045;
    if (phase === 'CAUTION' || phase === 'EVASION') return 0.028;
    return 0.016;
  }

  function beep(freq, dur, type) {
    if (!audio.ctx || audio.muted) return;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
    o.stop(audio.ctx.currentTime + dur);
  }

  function setMuted(next) {
    audio.muted = next;
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    applyMute();
  }

  function bindPointer(el, codes) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-pressed');
      codes.forEach((c) => { K[c] = true; });
      unlockAudio();
      if (navigator.vibrate) navigator.vibrate(12);
    });
    const off = () => {
      el.classList.remove('is-pressed');
      codes.forEach((c) => { K[c] = false; });
    };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
  }

  function bindTap(el, handler) {
    if (!el) return;
    const fire = (e) => {
      e.preventDefault();
      el.classList.add('is-pressed');
      if (navigator.vibrate) navigator.vibrate(15);
      unlockAudio();
      beep(880, 0.06, 'triangle');
      handler();
    };
    const release = () => el.classList.remove('is-pressed');
    el.addEventListener('pointerdown', fire);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  function resetWorld() {
    const spawn = findTiles('S');
    const sx = spawn.reduce((a, t) => a + tileCenter(t.c, t.r).x, 0) / spawn.length;
    const sy = spawn.reduce((a, t) => a + tileCenter(t.c, t.r).y, 0) / spawn.length;
    player.x = sx;
    player.y = sy;
    player.vx = 0;
    player.vy = 0;
    player.facing = -Math.PI / 2;
    player.crouch = false;
    player.hiding = false;
    seekers = STAGE.patrols.map((route, i) => {
      const p0 = tileCenter(route[0].c, route[0].r);
      return {
        x: p0.x,
        y: p0.y,
        facing: 0,
        route,
        wi: 0,
        sees: false,
        notice: 0,
        hue: i,
        wait: route[0].wait || 0,
        baseFacing: 0,
        scanT: 0,
        distract: 0,
        bait: { x: p0.x, y: p0.y },
        chaseFor: 0,
        lureSearch: 0,
      };
    });
    particles = [];
    time = rule('TIME');
    meter = 0;
    phase = 'SAFE';
    alertTimer = 0;
    evasionTimer = 0;
    spottedOnce = false;
    freeze = 0;
    pebble = null;
    pebbleCd = 0;
    rustleCd = 0;
    heartT = 0;
    joyX = 0;
    joyY = 0;
    camera.x = null;
    camera.y = null;
    lastKnown = { x: player.x, y: player.y };
    if (throwBtn) throwBtn.classList.remove('is-cooling');
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  function fillBrief() {
    if (briefLabel) briefLabel.textContent = 'STAGE ' + (stageIndex + 1) + '/5  ' + STAGE.name;
    if (briefLines) {
      briefLines.textContent = '';
      STAGE.brief.forEach((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        briefLines.appendChild(li);
      });
    }
  }

  function goTitle() {
    if (titleFromEnd || bootStage === 0) loadStage(0);
    else loadStage(bootStage);
    titleFromEnd = false;
    resetWorld();
    mode = 'title';
    show(titleOv, true);
    show(briefOv, false);
    show(resultOv, false);
    show(pauseOv, false);
    show(hud, false);
    show(controls, false);
    if (titleTag) titleTag.textContent = COPY.tag;
  }

  function goBrief() {
    fillBrief();
    mode = 'brief';
    show(titleOv, false);
    show(briefOv, true);
    show(resultOv, false);
    show(pauseOv, false);
    show(hud, false);
    show(controls, false);
  }

  function goPlay() {
    resetWorld();
    mode = 'play';
    show(titleOv, false);
    show(briefOv, false);
    show(resultOv, false);
    show(pauseOv, false);
    show(hud, true);
    show(controls, true);
    lastTs = 0;
    beep(220, 0.12, 'sawtooth');
  }

  function setPaused(on) {
    if (on) {
      if (mode !== 'play') return;
      pausedFrom = mode;
      mode = 'pause';
      show(pauseOv, true);
      show(controls, false);
      K.ArrowLeft = K.ArrowRight = K.ArrowUp = K.ArrowDown = false;
      K.ShiftLeft = K.ShiftRight = false;
      joyX = joyY = 0;
      if (stickKnob) stickKnob.style.transform = 'translate(0px, 0px)';
      applyMute();
    } else if (mode === 'pause') {
      mode = pausedFrom;
      show(pauseOv, false);
      show(controls, true);
      lastTs = 0;
      unlockAudio();
    }
  }

  function goResult(kind) {
    mode = 'result';
    show(controls, false);
    show(resultOv, true);
    if (kind === 'home') {
      const last = stageIndex >= STAGES.length - 1;
      resultKind = last ? 'ending' : 'clear';
      resultTitle.textContent = last ? COPY.homeTitle : STAGE.clearTitle;
      resultMsg.textContent = last ? COPY.homeMsg : STAGE.clearMsg;
      btnRetry.textContent = last ? COPY.titleCta : COPY.next;
      beep(523, 0.18, 'triangle');
      setTimeout(() => beep(784, 0.28, 'triangle'), 120);
    } else if (kind === 'late') {
      resultKind = 'fail';
      resultTitle.textContent = COPY.lateTitle;
      resultMsg.textContent = COPY.lateMsg;
      btnRetry.textContent = COPY.retry;
      beep(110, 0.4, 'sine');
    } else {
      resultKind = 'fail';
      resultTitle.textContent = COPY.caughtTitle;
      resultMsg.textContent = COPY.caughtMsg;
      btnRetry.textContent = COPY.retry;
      beep(90, 0.45, 'sawtooth');
    }
  }

  function onResultTap() {
    if (resultKind === 'ending') {
      titleFromEnd = true;
      goTitle();
      return;
    }
    if (resultKind === 'clear') {
      loadStage(stageIndex + 1);
      goBrief();
      return;
    }
    goPlay();
  }

  function moveBody(body, dx, dy, radius) {
    const nx = body.x + dx;
    if (!isSolid(tileAtPx(nx, body.y)) && !isSolid(tileAtPx(nx, body.y - radius * 0.4)) && !isSolid(tileAtPx(nx, body.y + radius * 0.4))) {
      body.x = nx;
    }
    const ny = body.y + dy;
    if (!isSolid(tileAtPx(body.x, ny)) && !isSolid(tileAtPx(body.x - radius * 0.4, ny)) && !isSolid(tileAtPx(body.x + radius * 0.4, ny))) {
      body.y = ny;
    }
    body.x = Math.max(radius, Math.min(WORLD_W - radius, body.x));
    body.y = Math.max(radius, Math.min(WORLD_H - radius, body.y));
  }

  function isRoadRow(r) {
    if (r <= 0 || r >= ROWS.length - 1) return false;
    let open = 0;
    let n = 0;
    for (let c = 1; c < COLS - 1; c++) {
      n += 1;
      if (ROWS[r][c] !== '#') open += 1;
    }
    return n > 0 && open / n >= 0.72;
  }

  function playerLight() {
    const c = Math.floor(player.x / TILE);
    const r = Math.floor(player.y / TILE);
    const ch = tileAt(c, r);
    if (ch === 'B' || ch === 'C') return 'cover';
    if (isRoadRow(r) && (c === 2 || c === 13) && ch === '.') return 'lamp';
    if (ch === 'H' || ch === 'V') return 'spill';
    if (tileAt(c, r - 1) === '#') return 'spill';
    return 'dark';
  }

  function visionMul() {
    if (player.hiding) return 1;
    const light = playerLight();
    if (light === 'cover') return CONFIG.BUSH_COVER;
    if (light === 'lamp') return CONFIG.LAMP_EXPOSE;
    if (light === 'spill') return CONFIG.SHOP_EXPOSE;
    return CONFIG.DARK_COVER;
  }

  function seekerSees(s) {
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const dist = Math.hypot(dx, dy);
    let range = rule('VIEW_RANGE') * visionMul();
    if (player.crouch && !player.hiding) range *= CONFIG.CROUCH_RANGE;
    if (dist > range) return false;
    const ang = Math.atan2(dy, dx);
    let diff = Math.abs(ang - s.facing);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    if (diff > CONFIG.VIEW_CONE) return false;
    if (!los(s.x, s.y, player.x, player.y)) return false;
    if (player.hiding && dist > CONFIG.HIDE_REVEAL) return false;
    return true;
  }

  function rustle() {
    if (rustleCd > 0) return;
    rustleCd = 1.15;
    meter = Math.min(100, meter + 16);
    beep(190, 0.07, 'triangle');
    let nearest = null;
    let best = CONFIG.RUSTLE_RANGE;
    seekers.forEach((s) => {
      const d = Math.hypot(s.x - player.x, s.y - player.y);
      if (d < best) {
        best = d;
        nearest = s;
      }
    });
    if (nearest && phase !== 'ALERT') {
      nearest.bait.x = player.x;
      nearest.bait.y = player.y;
      nearest.distract = 2.2;
    }
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: player.x, y: player.y, vx: (Math.random() - 0.5) * 24, vy: -6 - Math.random() * 12,
        life: 0.35, color: '#7aaf5a',
      });
    }
  }

  function throwPebble() {
    if (mode !== 'play' || pebbleCd > 0 || freeze > 0) return;
    pebbleCd = CONFIG.PEBBLE_COOLDOWN;
    const ang = player.facing;
    pebble = {
      x: player.x + Math.cos(ang) * 14,
      y: player.y + Math.sin(ang) * 14,
      vx: Math.cos(ang) * CONFIG.PEBBLE_SPEED,
      vy: Math.sin(ang) * CONFIG.PEBBLE_SPEED,
      life: 0.7,
    };
    beep(640, 0.05, 'square');
    if (navigator.vibrate) navigator.vibrate(10);
    if (throwBtn) throwBtn.classList.add('is-cooling');
  }

  function landPebble() {
    if (!pebble) return;
    const lx = pebble.x;
    const ly = pebble.y;
    pebble = null;
    lastKnown.x = lx;
    lastKnown.y = ly;
    beep(140, 0.08, 'triangle');
    setTimeout(() => beep(180, 0.06, 'triangle'), 70);
    meter = Math.min(72, meter + 10);
    let pulled = 0;
    seekers.forEach((s) => {
      if (s.sees) return;
      const d = Math.hypot(s.x - lx, s.y - ly);
      if (d > CONFIG.PEBBLE_HEAR) return;
      s.bait.x = lx;
      s.bait.y = ly;
      s.distract = CONFIG.PEBBLE_DISTRACT;
      s.lureSearch = 0;
      s.wait = 0;
      s.chaseFor = 0;
      s.notice = 0.55;
      pulled += 1;
    });
    if (pulled && navigator.vibrate) navigator.vibrate(18);
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: lx, y: ly, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
        life: 0.28, color: '#c8c0a8',
      });
    }
  }

  function updatePlayer(dt) {
    let ax = joyX;
    let ay = joyY;
    if (K.ArrowLeft || K.KeyA) ax -= 1;
    if (K.ArrowRight || K.KeyD) ax += 1;
    if (K.ArrowUp || K.KeyW) ay -= 1;
    if (K.ArrowDown || K.KeyS) ay += 1;
    player.crouch = !!(K.ShiftLeft || K.ShiftRight);
    player.moving = !!(ax || ay);
    const len = Math.hypot(ax, ay) || 1;
    const speed = (player.crouch ? CONFIG.CROUCH_SPEED : CONFIG.PLAYER_SPEED);
    const dx = (ax / len) * speed * (player.moving ? 1 : 0);
    const dy = (ay / len) * speed * (player.moving ? 1 : 0);
    if (player.moving) player.facing = Math.atan2(dy, dx);
    const wasCover = isHide(tileAtPx(player.x, player.y));
    moveBody(player, dx * 60 * dt, dy * 60 * dt, 8);
    const coverNow = isHide(tileAtPx(player.x, player.y));
    player.hiding = coverNow && (player.crouch || !player.moving);
    if (coverNow && player.moving && !player.crouch) rustle();
    if (coverNow && !wasCover) {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x, y: player.y, vx: (Math.random() - 0.5) * 18, vy: -8 - Math.random() * 10,
          life: 0.4, color: '#4c8a3a',
        });
      }
    }
  }

  function updateSeekers(dt) {
    seekers.forEach((s) => {
      s.sees = seekerSees(s);
      if (s.sees) {
        lastKnown.x = player.x;
        lastKnown.y = player.y;
        s.notice = 1;
        s.distract = 0;
        s.lureSearch = 0;
        s.wait = 0;
        s.chaseFor = CONFIG.ALERT_HOLD;
      } else {
        s.notice = Math.max(0, s.notice - dt * 1.4);
        if (s.chaseFor > 0) s.chaseFor -= dt;
      }

      const hunting = s.sees || s.chaseFor > 0 || phase === 'ALERT' || phase === 'EVASION';
      let tx = s.x;
      let ty = s.y;
      let spd = rule('SEEKER_SPEED');
      let shouldMove = true;

      if (s.sees) {
        tx = player.x;
        ty = player.y;
        spd = rule('SEEKER_CHASE');
      } else if (s.distract > 0) {
        s.distract -= dt;
        const baitDist = Math.hypot(s.bait.x - s.x, s.bait.y - s.y);
        s.notice = Math.max(s.notice, 0.5);
        if (baitDist < 16) {
          if (s.lureSearch <= 0) {
            s.lureSearch = 1.8;
            s.baseFacing = s.facing;
            s.scanT = 0;
          }
          s.lureSearch -= dt;
          s.scanT += dt;
          s.facing = s.baseFacing + Math.sin(s.scanT * 3.2) * 1.15;
          shouldMove = false;
          if (s.lureSearch <= 0) s.distract = 0;
        } else {
          tx = s.bait.x;
          ty = s.bait.y;
          spd = rule('SEEKER_CHASE');
        }
      } else if (hunting) {
        tx = lastKnown.x;
        ty = lastKnown.y;
        spd = rule('SEEKER_CHASE');
      } else if (s.wait > 0) {
        s.wait -= dt;
        s.scanT += dt;
        s.facing = s.baseFacing + Math.sin(s.scanT * 2.2) * 0.7;
        shouldMove = false;
      } else {
        const wp = s.route[s.wi];
        const p = tileCenter(wp.c, wp.r);
        tx = p.x;
        ty = p.y;
        if (Math.hypot(tx - s.x, ty - s.y) < 10) {
          s.baseFacing = s.facing;
          s.wait = wp.wait || 0.6;
          s.scanT = 0;
          s.wi = (s.wi + 1) % s.route.length;
          shouldMove = false;
        }
      }

      if (!shouldMove) return;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 2) {
        s.facing = Math.atan2(dy, dx);
        moveBody(s, (dx / dist) * spd * 60 * dt, (dy / dist) * spd * 60 * dt, 9);
      }
    });
  }

  function updateAlert(dt) {
    const any = seekers.some((s) => s.sees);
    if (any) {
      meter = 100;
      if (phase !== 'ALERT') {
        beep(740, 0.08);
        setTimeout(() => beep(520, 0.12), 90);
        if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
      }
      phase = 'ALERT';
      alertTimer = CONFIG.ALERT_HOLD;
      seekers.forEach((s) => {
        s.chaseFor = Math.max(s.chaseFor, CONFIG.ALERT_HOLD);
        s.wait = 0;
        if (s.sees) {
          s.distract = 0;
          s.lureSearch = 0;
        }
      });
    } else {
      meter = Math.max(0, meter - dt * 14);
    }

    if (!any) {
      if (phase === 'ALERT') {
        alertTimer -= dt;
        if (alertTimer <= 0) {
          phase = 'EVASION';
          evasionTimer = CONFIG.EVASION_HOLD;
        }
      } else if (phase === 'EVASION') {
        evasionTimer -= dt;
        if (evasionTimer <= 0) phase = meter > 28 ? 'CAUTION' : 'SAFE';
      } else if (meter > 28) {
        phase = 'CAUTION';
      } else {
        phase = 'SAFE';
      }
    }

    if (any && !spottedOnce) {
      spottedOnce = true;
      freeze = CONFIG.SPOT_FREEZE;
      beep(880, 0.09);
      if (navigator.vibrate) navigator.vibrate([12, 30, 24]);
    }

    if (phase === 'CAUTION' || phase === 'ALERT') {
      heartT += dt;
      const beat = phase === 'ALERT' ? 0.55 : 0.95;
      if (heartT >= beat) {
        heartT = 0;
        beep(phase === 'ALERT' ? 92 : 70, 0.06, 'sine');
      }
    } else heartT = 0;

    if (audio.drone && audio.ctx && !audio.muted) {
      const f = phase === 'ALERT' ? 118 : phase === 'EVASION' ? 96 : 72;
      audio.drone.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.2);
      audio.filter.frequency.setTargetAtTime(phase === 'ALERT' ? 900 : 280, audio.ctx.currentTime, 0.2);
      audio.gain.gain.setTargetAtTime(droneLevel(), audio.ctx.currentTime, 0.15);
    }
  }

  function checkEnd() {
    if (tileAtPx(player.x, player.y) === 'H') {
      goResult('home');
      return;
    }
    if (time <= 0) {
      goResult('late');
      return;
    }
    for (const s of seekers) {
      const dist = Math.hypot(s.x - player.x, s.y - player.y);
      const catchR = player.hiding ? 9 : CONFIG.CATCH_DIST;
      if (dist < catchR) {
        goResult('caught');
        return;
      }
    }
  }

  function updatePebble(dt) {
    if (pebbleCd > 0) {
      pebbleCd -= dt;
      if (pebbleCd <= 0 && throwBtn) throwBtn.classList.remove('is-cooling');
    }
    if (rustleCd > 0) rustleCd -= dt;
    if (!pebble) return;
    pebble.x += pebble.vx * dt;
    pebble.y += pebble.vy * dt;
    pebble.life -= dt;
    if (pebble.life <= 0 || isSolid(tileAtPx(pebble.x, pebble.y))) landPebble();
  }

  function updateParticles(dt) {
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function drawWorld() {
    drawHideTown({
      ctx, TILE, ROWS, COLS, WORLD_W, WORLD_H,
      player, seekers, particles, pebble, phase, freeze, mode,
      dpr, viewW, viewH, tileAt, tileAtPx, isHide, SHOPS,
      theme: STAGE.theme,
      goalLabel: STAGE.goal,
      CONFIG: Object.assign({}, CONFIG, {
        VIEW_RANGE: rule('VIEW_RANGE'),
        VIEW_CONE: STAGE.viewCone || CONFIG.VIEW_CONE,
      }),
      camera,
    });
  }

  function drawRadar() {
    const w = radar.width;
    const h = radar.height;
    rtx.setTransform(1, 0, 0, 1, 0, 0);
    rtx.clearRect(0, 0, w, h);
    rtx.fillStyle = 'rgba(0, 20, 8, 0.9)';
    rtx.beginPath();
    rtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    rtx.fill();
    rtx.strokeStyle = '#2f8f38';
    rtx.beginPath();
    rtx.arc(w / 2, h / 2, w / 4, 0, Math.PI * 2);
    rtx.stroke();
    const scale = (w / 2 - 8) / 220;
    const plot = (x, y, color, size) => {
      const px = w / 2 + (x - player.x) * scale;
      const py = h / 2 + (y - player.y) * scale;
      rtx.fillStyle = color;
      rtx.beginPath();
      rtx.arc(px, py, size, 0, Math.PI * 2);
      rtx.fill();
    };
    findTiles('H').forEach((t) => {
      const p = tileCenter(t.c, t.r);
      plot(p.x, p.y, '#ffe08a', 3);
    });
    seekers.forEach((s) => plot(s.x, s.y, s.sees ? '#ff3b3b' : '#ff8a3a', 3));
    plot(player.x, player.y, '#4cff4c', 3.5);
    rtx.strokeStyle = 'rgba(80, 255, 90, 0.45)';
    rtx.beginPath();
    rtx.moveTo(w / 2, h / 2);
    rtx.lineTo(w / 2 + Math.cos(radarSweep) * (w / 2), h / 2 + Math.sin(radarSweep) * (h / 2));
    rtx.stroke();
  }

  function updateHud() {
    alertPhase.textContent = COPY[phase.toLowerCase()] || phase;
    alertBox.className = phase.toLowerCase();
    alertFill.style.width = meter + '%';
    const m = Math.max(0, Math.ceil(time));
    const mm = Math.floor(m / 60);
    const ss = String(m % 60).padStart(2, '0');
    timeLeft.textContent = mm + ':' + ss;
    if (stageNum) stageNum.textContent = (stageIndex + 1) + '/' + STAGES.length;
    if (timerBox) timerBox.classList.toggle('urgent', time <= 20);

    const goals = findTiles('H');
    if (goals.length) {
      const gx = goals.reduce((sum, t) => sum + tileCenter(t.c, t.r).x, 0) / goals.length;
      const gy = goals.reduce((sum, t) => sum + tileCenter(t.c, t.r).y, 0) / goals.length;
      const angle = Math.atan2(gy - player.y, gx - player.x) * 180 / Math.PI;
      const tilesAway = Math.max(0, Math.round(Math.hypot(gx - player.x, gy - player.y) / TILE));
      if (goalName) goalName.textContent = STAGE.goal;
      if (goalDistance) goalDistance.textContent = tilesAway + 'm';
      if (goalArrow) goalArrow.style.transform = 'rotate(' + angle + 'deg)';
    }

    if (statusChip && statusText) {
      const inCover = isHide(tileAtPx(player.x, player.y));
      const danger = seekers.some((s) => Math.hypot(s.x - player.x, s.y - player.y) < 92);
      let state = 'moving';
      let label = player.moving ? 'MOVING' : 'STILL';
      if (player.hiding) { state = 'hidden'; label = 'HIDDEN'; }
      else if (inCover) { state = 'cover'; label = 'COVER — HOLD HIDE'; }
      else if (danger || phase === 'ALERT') { state = 'exposed'; label = 'SEEKER CLOSE'; }
      statusChip.dataset.state = state;
      statusText.textContent = label;
    }

    if (throwBtn) {
      const ready = Math.max(0, Math.min(1, 1 - pebbleCd / CONFIG.PEBBLE_COOLDOWN));
      throwBtn.style.setProperty('--cooldown', Math.round(ready * 100) + '%');
      if (throwReady) throwReady.textContent = pebbleCd > 0 ? Math.max(0.1, pebbleCd).toFixed(1) + 's' : 'READY';
    }
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
    lastTs = ts;
    radarSweep += dt * 1.6;
    if (mode === 'play') {
      if (freeze > 0) freeze -= dt;
      time -= dt;
      updatePlayer(dt);
      updateSeekers(dt);
      updateAlert(dt);
      updatePebble(dt);
      updateParticles(dt);
      checkEnd();
      updateHud();
    }
    drawWorld();
    if (mode === 'play') drawRadar();
  }

  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchstart', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && now !== lastTouchEnd) e.preventDefault();
  }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    K[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    unlockAudio();
    if (!e.repeat && (e.code === 'KeyZ' || e.code === 'Space')) throwPebble();
    if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(mode === 'play');
  });
  document.addEventListener('keyup', (e) => { K[e.code] = false; });

  bindPointer(document.getElementById('cv-left'), ['ArrowLeft']);
  bindPointer(document.getElementById('cv-right'), ['ArrowRight']);
  bindPointer(document.getElementById('cv-up'), ['ArrowUp']);
  bindPointer(document.getElementById('cv-down'), ['ArrowDown']);
  bindPointer(document.getElementById('cv-hide'), ['ShiftLeft']);
  bindTap(throwBtn, throwPebble);
  bindTap(document.getElementById('btn-start'), goBrief);
  bindTap(document.getElementById('btn-deploy'), goPlay);
  bindTap(btnRetry, onResultTap);
  bindTap(muteBtn, () => setMuted(!audio.muted));
  bindTap(pauseBtn, () => setPaused(true));
  bindTap(document.getElementById('btn-resume'), () => setPaused(false));
  bindTap(document.getElementById('btn-restart'), goPlay);

  function updateStick(e) {
    if (joyPointer !== e.pointerId || !moveStick) return;
    const rect = moveStick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.31;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joyX = Math.abs(dx / max) < 0.12 ? 0 : dx / max;
    joyY = Math.abs(dy / max) < 0.12 ? 0 : dy / max;
    if (stickKnob) stickKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
  }

  if (moveStick) {
    moveStick.addEventListener('pointerdown', (e) => {
      if (mode !== 'play') return;
      joyPointer = e.pointerId;
      moveStick.setPointerCapture(e.pointerId);
      updateStick(e);
    });
    moveStick.addEventListener('pointermove', updateStick);
    const releaseStick = (e) => {
      if (joyPointer !== e.pointerId) return;
      joyPointer = null;
      joyX = joyY = 0;
      if (stickKnob) stickKnob.style.transform = 'translate(0px, 0px)';
    };
    moveStick.addEventListener('pointerup', releaseStick);
    moveStick.addEventListener('pointercancel', releaseStick);
    moveStick.addEventListener('lostpointercapture', releaseStick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && mode === 'play') setPaused(true);
    if (document.visibilityState === 'visible') unlockAudio();
  });
  window.addEventListener('pageshow', unlockAudio);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  window.onerror = () => {
    resultTitle.textContent = 'ERROR';
    resultMsg.textContent = 'Something broke. Retry from the title.';
  };

  applyMute();
  resize();
  resetWorld();
  goTitle();
  requestAnimationFrame(frame);
})();
