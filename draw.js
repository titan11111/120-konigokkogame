function drawHideTown(S) {
  const ctx = S.ctx;
  const TILE = S.TILE;
  const ROWS = S.ROWS;
  const COLS = S.COLS;
  const WORLD_W = S.WORLD_W;
  const WORLD_H = S.WORLD_H;
  const player = S.player;
  const seekers = S.seekers;
  const particles = S.particles;
  const pebble = S.pebble;
  const phase = S.phase;
  const freeze = S.freeze;
  const mode = S.mode;
  const dpr = S.dpr;
  const viewW = S.viewW;
  const viewH = S.viewH;
  const tileAt = S.tileAt;
  const tileAtPx = S.tileAtPx;
  const isHide = S.isHide;
  const CONFIG = S.CONFIG;
  const SHOPS = S.SHOPS;
  const theme = S.theme || 'town';
  const goalLabel = S.goalLabel || 'HOME';
  let camX = 0;
  let camY = 0;
  const camera = S.camera || { x: null, y: null };

  const TILT = 0.56;
  const ROAD_ROWS = (function detectRoads() {
    const out = {};
    for (let r = 1; r < ROWS.length - 1; r++) {
      let open = 0;
      let n = 0;
      for (let c = 1; c < COLS - 1; c++) {
        n += 1;
        if (ROWS[r][c] !== '#') open += 1;
      }
      if (n && open / n >= 0.72) out[r] = 1;
    }
    return out;
  }());
  const HOUSES = [
    { wall: '#c4ad7e', roof: '#8a3228', side: '#8a7352', trim: '#5a4030' },
    { wall: '#d4cfc4', roof: '#4a5568', side: '#9a9488', trim: '#5a5850' },
    { wall: '#c8b49a', roof: '#5a3a28', side: '#8a7460', trim: '#4a3020' },
    { wall: '#b8c0b0', roof: '#3a4a3a', side: '#7a8478', trim: '#2a3228' },
  ];

  function gy(y) {
    return y * TILT;
  }

  function drawShadow(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(x, gy(y), rx, ry * TILT, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawExtrude(x, y0, w, d0, h, top, front, side) {
    const north = gy(y0);
    const south = gy(y0 + d0);
    const depth = south - north;
    ctx.fillStyle = top;
    ctx.fillRect(x, north - h, w, depth);
    ctx.fillStyle = side;
    ctx.fillRect(x + w - 6, north - h, 6, depth + h);
    ctx.fillStyle = front;
    ctx.fillRect(x, south - h, w, h);
    return south;
  }

  function facingStreet(c, r) {
    return tileAt(c, r + 1) !== '#';
  }

  function isSchool(c, r) {
    if (theme === 'school') return r >= ROWS.length - 3;
    if (theme === 'park') return false;
    return r >= ROWS.length - 2 && c >= 5 && c <= 10;
  }

  function isShopBlock(r) {
    if (theme === 'town') return r >= 7 && r <= ROWS.length - 6;
    if (theme === 'home') return r >= 7 && r <= 16;
    return false;
  }

  function drawGround() {
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = ROWS[r][c];
        if (ch === '#') continue;
        const x = c * TILE;
        const y = gy(r * TILE);
        const h = TILE * TILT;
        if (ch === 'S') {
          ctx.fillStyle = '#3a3a28';
          ctx.fillRect(x, y, TILE, h);
          ctx.fillStyle = 'rgba(220, 190, 70, 0.28)';
          ctx.fillRect(x + 4, y + 4, TILE - 8, h - 8);
        } else if (ROAD_ROWS[r]) {
          ctx.fillStyle = (c + r) % 2 ? '#1c212c' : '#171b24';
          ctx.fillRect(x, y, TILE, h);
          if (c > 1 && c < COLS - 2 && r !== 18) {
            ctx.fillStyle = 'rgba(220, 190, 70, 0.38)';
            ctx.fillRect(x + TILE * 0.45, y + 3, 2, h - 6);
          }
          if ((r === 6 || r === 9 || r === 15) && (c === 4 || c === 5 || c === 10 || c === 11)) {
            ctx.fillStyle = 'rgba(230, 230, 240, 0.32)';
            for (let i = 0; i < 3; i++) ctx.fillRect(x + 6, y + 3 + i * 6, TILE - 12, 3);
          }
          if ((c + r * 2) % 11 === 0) {
            ctx.strokeStyle = 'rgba(40, 44, 52, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x + 20, y + h * 0.5, 8, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (theme === 'park') {
          ctx.fillStyle = (c + r) % 2 ? '#24382c' : '#1e3226';
          ctx.fillRect(x, y, TILE, h);
        } else if (theme === 'school') {
          ctx.fillStyle = (c + r) % 2 ? '#2c3a28' : '#263424';
          ctx.fillRect(x, y, TILE, h);
        } else {
          ctx.fillStyle = (c + r) % 2 ? '#3a3e48' : '#343844';
          ctx.fillRect(x, y, TILE, h);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.fillRect(x + 2, y + 2, TILE - 4, 1);
          ctx.fillRect(x + 2, y + h * 0.5, TILE - 4, 1);
        }
        if (ch === 'H') {
          ctx.fillStyle = 'rgba(255, 210, 120, 0.18)';
          ctx.fillRect(x, y, TILE, h);
        }
      }
    }
  }

  function drawSkyline() {
    for (let i = 0; i < 28; i++) {
      const x = -80 + i * 32;
      const hh = 36 + (i * 19) % 64;
      ctx.fillStyle = i % 3 ? '#120e22' : '#18122c';
      ctx.fillRect(x, gy(-16) - hh, 28, hh);
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 190, 90, 0.22)';
        ctx.fillRect(x + 6, gy(-16) - hh + 8, 4, 4);
        ctx.fillRect(x + 16, gy(-16) - hh + 16, 4, 4);
        ctx.fillRect(x + 10, gy(-16) - hh + 28, 4, 4);
      }
    }
    ctx.fillStyle = 'rgba(255, 160, 70, 0.08)';
    ctx.fillRect(-80, gy(-16) - 20, WORLD_W + 160, 24);
  }

  function drawEdgeTown() {
    for (let r = 1; r < ROWS.length - 1; r++) {
      [-2, -1, COLS, COLS + 1].forEach((c, i) => {
        const shop = SHOPS[(r * 5 + Math.abs(c) * 3 + 1) % SHOPS.length];
        const house = HOUSES[(Math.abs(c) + r) % HOUSES.length];
        const h = 44 + ((c * 9 + r * 11) % 36);
        const x = c * TILE;
        if (theme === 'alley') {
          drawExtrude(x, r * TILE, TILE, TILE, h, '#3a3e48', '#2a2e38', '#1a1e26');
        } else if (theme === 'park' || theme === 'school') {
          const south = drawExtrude(x, r * TILE, TILE, TILE, 34, house.roof, house.wall, house.side);
          ctx.fillStyle = house.roof;
          ctx.fillRect(x - 1, south - 36, TILE + 2, 6);
          ctx.fillStyle = '#ffe08a';
          ctx.fillRect(x + 8, south - 20, 7, 7);
        } else if (isShopBlock(r) || i % 2 === 0) {
          drawExtrude(x, r * TILE, TILE, TILE, h, shop.top, shop.front, shop.side);
          ctx.fillStyle = (r + c) % 3 ? '#f3c45e' : '#2c2448';
          ctx.fillRect(x + 8, gy(r * TILE + TILE) - h + 12, 8, 8);
          ctx.fillRect(x + 22, gy(r * TILE + TILE) - h + 12, 8, 8);
        } else {
          const south = drawExtrude(x, r * TILE, TILE, TILE, 34, house.roof, house.wall, house.side);
          ctx.fillStyle = house.roof;
          ctx.fillRect(x - 1, south - 36, TILE + 2, 6);
          ctx.fillStyle = '#ffe08a';
          ctx.fillRect(x + 8, south - 20, 7, 7);
        }
      });
    }
  }

  function drawCones() {
    seekers.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, gy(s.y));
      ctx.rotate(Math.atan2(Math.sin(s.facing) * TILT, Math.cos(s.facing)));
      ctx.scale(1, TILT);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, CONFIG.VIEW_RANGE);
      g.addColorStop(0, s.sees ? 'rgba(255, 90, 50, 0.55)' : 'rgba(255, 230, 150, 0.5)');
      g.addColorStop(0.35, s.sees ? 'rgba(255, 70, 40, 0.22)' : 'rgba(255, 210, 90, 0.2)');
      g.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, CONFIG.VIEW_RANGE, -CONFIG.VIEW_CONE, CONFIG.VIEW_CONE);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawWindows(x, south, h, lit) {
    ctx.fillStyle = lit ? '#f3c45e' : '#14101c';
    ctx.fillRect(x + 6, south - h + 12, 10, 9);
    ctx.fillRect(x + 24, south - h + 12, 10, 9);
    if (h > 48) {
      ctx.fillRect(x + 6, south - h + 26, 10, 9);
      ctx.fillRect(x + 24, south - h + 26, 10, 9);
    }
    if (lit) {
      ctx.fillStyle = 'rgba(243, 196, 94, 0.22)';
      ctx.fillRect(x + 4, south - 4, TILE - 8, 8);
    }
  }

  function drawSchool(c, r) {
    const x = c * TILE;
    const y0 = r * TILE;
    const h = 52;
    const south = drawExtrude(x, y0, TILE, TILE, h, '#c8b56a', '#a89448', '#6a5a28');
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(x + 14, south - 18, 12, 18);
    ctx.fillStyle = '#7ad7ff';
    ctx.fillRect(x + 6, south - h + 14, 10, 8);
    ctx.fillRect(x + 24, south - h + 14, 10, 8);
    if (c === 7) {
      ctx.fillStyle = '#fff4d0';
      ctx.font = 'bold 8px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('SCHOOL', x + TILE, south - h - 2);
      ctx.textAlign = 'start';
    }
  }

  function drawHouse(c, r) {
    const house = HOUSES[(c * 3 + r) % HOUSES.length];
    const x = c * TILE;
    const y0 = r * TILE;
    const h = 32 + ((c + r) % 10);
    const south = drawExtrude(x, y0, TILE, TILE, h, house.roof, house.wall, house.side);
    ctx.fillStyle = house.roof;
    ctx.beginPath();
    ctx.moveTo(x - 2, gy(y0) - h + 8);
    ctx.lineTo(x + TILE / 2, gy(y0) - h - 10);
    ctx.lineTo(x + TILE + 2, gy(y0) - h + 8);
    ctx.closePath();
    ctx.fill();
    if (!facingStreet(c, r)) return;
    const lit = (c * 5 + r) % 4 !== 2;
    ctx.fillStyle = house.trim;
    ctx.fillRect(x + 16, south - 14, 8, 14);
    ctx.fillStyle = lit ? '#ffe08a' : '#14101c';
    ctx.fillRect(x + 6, south - 22, 8, 8);
    if (lit) {
      ctx.fillStyle = 'rgba(255, 224, 138, 0.18)';
      ctx.fillRect(x + 4, south - 3, TILE - 8, 6);
    }
    if ((c + r) % 3 === 0) {
      ctx.fillStyle = '#6a7080';
      ctx.fillRect(x + 28, south - h - 4, 8, 6);
    }
  }

  function shopGlow(sign) {
    if (sign === '24H') return '70, 255, 170';
    if (sign === 'RAMEN' || sign === 'YAKI' || sign === 'CAFE') return '255, 150, 55';
    if (sign === 'DRUG') return '70, 210, 255';
    if (sign === 'BAKE' || sign === 'BENTO') return '255, 200, 90';
    if (sign === 'TOYS' || sign === 'GAME') return '255, 110, 150';
    if (sign === 'SALON') return '230, 140, 200';
    return '';
  }

  function shopWindow(sign) {
    if (sign === '24H') return '#7dffb8';
    if (sign === 'RAMEN' || sign === 'YAKI' || sign === 'CAFE') return '#ffb060';
    if (sign === 'DRUG') return '#7ad7ff';
    if (sign === 'BAKE' || sign === 'BENTO') return '#ffd27a';
    if (sign === 'TOYS' || sign === 'GAME' || sign === 'SALON') return '#e8a0c8';
    return '#14101c';
  }

  function drawPool(wx, wy, rx, rgb, a) {
    const g = ctx.createRadialGradient(wx, gy(wy), 2, wx, gy(wy), rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    g.addColorStop(0.28, 'rgba(' + rgb + ',' + (a * 0.55) + ')');
    g.addColorStop(0.65, 'rgba(' + rgb + ',' + (a * 0.22) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(wx, gy(wy), rx, Math.max(16, rx * 0.48), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function isLampTile(c, r) {
    return ROAD_ROWS[r] && (c === 2 || c === 13) && tileAt(c, r) === '.';
  }

  function drawLightPools() {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.28)';
    ctx.fillRect(-90, gy(-24), WORLD_W + 180, gy(WORLD_H) + 140);
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = ROWS[r][c];
        if (isLampTile(c, r)) {
          drawPool(c * TILE + 28, r * TILE + 24, 62, '255, 196, 90', 0.5);
        }
        if (ch === 'V') {
          drawPool(c * TILE + 20, r * TILE + 28, 28, '80, 220, 255', 0.28);
        }
        if (ch === 'H') {
          drawPool(c * TILE + 20, r * TILE + 30, 40, '255, 210, 120', 0.36);
        }
        if (ch === 'B') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
          ctx.beginPath();
          ctx.ellipse(c * TILE + 20, gy(r * TILE + 28), 17, 11 * TILT, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (ch === '#' && facingStreet(c, r)) {
          const shop = isShopBlock(r) || (c * 5 + r) % 8 === 0;
          if (shop && theme !== 'park' && theme !== 'school' && theme !== 'alley') {
            const rgb = shopGlow(shopFor(c, r).sign);
            if (rgb) drawPool(c * TILE + 20, r * TILE + TILE + 18, 38, rgb, 0.4);
          } else if ((c * 5 + r) % 4 !== 2) {
            drawPool(c * TILE + 20, r * TILE + TILE + 12, 24, '255, 210, 120', 0.16);
          }
        }
      }
    }
  }

  function shopRunStart(c, r) {
    let x = c;
    while (x > 0 && tileAt(x - 1, r) === '#') x -= 1;
    return x;
  }

  function shopFor(c, r) {
    const start = shopRunStart(c, r);
    let n = 0;
    for (let x = 1; x < start; x += 1) {
      if (tileAt(x, r) === '#' && tileAt(x - 1, r) !== '#') n += 1;
    }
    return SHOPS[(n * 5 + r * 2 + 1) % SHOPS.length];
  }

  function drawShop(c, r) {
    const shop = shopFor(c, r);
    const start = shopRunStart(c, r);
    const x = c * TILE;
    const y0 = r * TILE;
    const h = 38 + ((start * 7 + r * 5) % 22);
    const south = drawExtrude(x, y0, TILE, TILE, h, shop.top, shop.front, shop.side);
    if (!facingStreet(c, r)) {
      drawWindows(x, south, h, (c + r) % 5 !== 1);
      return;
    }
    const signHere = c === 0 || tileAt(c - 1, r) !== '#' || !facingStreet(c - 1, r);
    ctx.fillStyle = shop.awn;
    ctx.fillRect(x + 1, south - h + 2, TILE - 2, 8);
    ctx.fillStyle = shop.awn2;
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 8, south - h + 2, 5, 8);
    ctx.fillStyle = '#0e0810';
    ctx.fillRect(x + 4, south - 22, TILE - 14, 18);
    ctx.fillStyle = shopWindow(shop.sign);
    ctx.fillRect(x + 5, south - 22, TILE - 16, 16);
    ctx.fillStyle = shop.awn2;
    ctx.fillRect(x + 3, south - 8, 6, 8);
    if (signHere) {
      ctx.fillStyle = shop.awn2;
      ctx.fillRect(x + 4, south - h - 10, TILE - 8, 11);
      ctx.fillStyle = '#fff4d0';
      ctx.font = 'bold 8px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(shop.sign, x + TILE / 2, south - h - 2);
      ctx.textAlign = 'start';
    }
    const rgb = shopGlow(shop.sign);
    if (rgb) {
      ctx.fillStyle = 'rgba(' + rgb + ',0.34)';
      ctx.fillRect(x + 2, south - 6, TILE - 4, 10);
    }
  }

  function drawWarehouse(c, r) {
    const x = c * TILE;
    const y0 = r * TILE;
    const h = 46 + ((c * 5 + r) % 18);
    const south = drawExtrude(x, y0, TILE, TILE, h, '#3a3e48', '#2a2e38', '#1a1e26');
    ctx.fillStyle = (c + r) % 4 ? '#3a2818' : '#14101c';
    ctx.fillRect(x + 8, south - h + 14, 10, 8);
    ctx.fillRect(x + 22, south - h + 14, 10, 8);
    if (facingStreet(c, r)) {
      ctx.fillStyle = '#121218';
      ctx.fillRect(x + 12, south - 16, 16, 16);
    }
  }

  function drawBuilding(c, r) {
    if (isSchool(c, r)) drawSchool(c, r);
    else if (theme === 'alley') drawWarehouse(c, r);
    else if (theme === 'park' || theme === 'school') drawHouse(c, r);
    else if (isShopBlock(r) || (c * 5 + r) % 8 === 0) drawShop(c, r);
    else drawHouse(c, r);
  }

  function drawLamp(c, r) {
    const x = c * TILE + 28;
    const y = r * TILE + 22;
    drawShadow(x, y, 6, 3);
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(x - 2, gy(y) - 38, 3, 38);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(x - 8, gy(y) - 40, 14, 4);
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(x, gy(y) - 36, 5, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, gy(y) - 8, 4, x, gy(y) + 6, 48);
    g.addColorStop(0, 'rgba(255, 214, 120, 0.42)');
    g.addColorStop(0.45, 'rgba(255, 196, 90, 0.16)');
    g.addColorStop(1, 'rgba(255, 196, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, gy(y), 46, 28 * TILT, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVending(c, r) {
    const x = c * TILE + 10;
    const y0 = r * TILE + 10;
    drawShadow(x + 10, y0 + 22, 10, 5);
    drawExtrude(x, y0, 20, 16, 28, '#d05050', '#b03a3a', '#7a2424');
    ctx.fillStyle = '#7ad7ff';
    ctx.fillRect(x + 4, gy(y0) - 18, 12, 10);
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x + 4, gy(y0) - 6, 12, 3);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 5, gy(y0) - 2, 4, 3);
    ctx.fillRect(x + 11, gy(y0) - 2, 4, 3);
  }

  function drawBike(c, r) {
    const x = c * TILE + 10;
    const y = r * TILE + 26;
    drawShadow(x + 8, y, 10, 4);
    ctx.strokeStyle = '#c8d0dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, gy(y) - 5, 5, 0, Math.PI * 2);
    ctx.arc(x + 16, gy(y) - 5, 5, 0, Math.PI * 2);
    ctx.moveTo(x, gy(y) - 5);
    ctx.lineTo(x + 8, gy(y) - 14);
    ctx.lineTo(x + 16, gy(y) - 5);
    ctx.stroke();
  }

  function drawPlanter(c, r) {
    const x = c * TILE + 12;
    const y = r * TILE + 24;
    drawShadow(x + 8, y, 10, 4);
    ctx.fillStyle = '#6a4a32';
    ctx.fillRect(x, gy(y) - 8, 16, 8);
    ctx.fillStyle = '#2f6a38';
    ctx.beginPath();
    ctx.ellipse(x + 8, gy(y) - 12, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCrate(c, r) {
    const x = c * TILE + 8;
    const y0 = r * TILE + 18;
    drawShadow(x + 8, y0 + 14, 9, 4);
    drawExtrude(x, y0, 16, 12, 10, '#c4a06a', '#a07840', '#6a4c28');
  }

  function drawPole(c, r) {
    const x = c * TILE + 6;
    const y = r * TILE + 20;
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(x, gy(y) - 46, 3, 46);
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(x - 1, gy(y) - 48, 5, 4);
  }

  function drawBush(c, r) {
    const cx = c * TILE + TILE / 2;
    const cy = r * TILE + TILE * 0.7;
    drawShadow(cx, cy, 14, 8);
    ctx.fillStyle = '#0a1610';
    ctx.beginPath();
    ctx.ellipse(cx - 7, gy(cy) - 8, 11, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 8, gy(cy) - 10, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14351e';
    ctx.beginPath();
    ctx.ellipse(cx, gy(cy) - 18, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d4a28';
    ctx.beginPath();
    ctx.ellipse(cx + 3, gy(cy) - 24, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(c, r) {
    const x = c * TILE + 5;
    const y0 = r * TILE + 8;
    const paints = ['#8a93a4', '#6a3a3a', '#3a4a6a', '#4a5a3a', '#5a4a2a', '#4a3a58'];
    const body = paints[(c + r) % paints.length];
    drawShadow(x + 15, y0 + 22, 16, 7);
    drawExtrude(x, y0 + 8, 30, 18, 10, body, body, '#2a3038');
    drawExtrude(x + 6, y0 + 10, 18, 12, 18, '#7ad0e8', '#4a6d7c', '#2f4a55');
    ctx.fillStyle = '#1a1d22';
    ctx.beginPath();
    ctx.ellipse(x + 6, gy(y0 + 26), 4, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26, gy(y0 + 26), 4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x + 26, gy(y0 + 14), 4, 3);
  }

  function drawHome(c, r) {
    const x = c * TILE + 4;
    const y0 = r * TILE + 4;
    const w = TILE - 8;
    drawShadow(x + w / 2, y0 + 28, 16, 7);
    const south = drawExtrude(x, y0 + 10, w, 22, 28, '#d7c39a', '#c4ad7e', '#8a7352');
    ctx.fillStyle = '#7a2e24';
    ctx.beginPath();
    ctx.moveTo(x - 2, gy(y0 + 10) - 28);
    ctx.lineTo(x + w / 2, gy(y0 + 10) - 46);
    ctx.lineTo(x + w + 2, gy(y0 + 10) - 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(x + w / 2 - 4, south - 16, 8, 16);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(x + 6, south - 22, 7, 7);
    ctx.fillStyle = 'rgba(255, 224, 138, 0.28)';
    ctx.fillRect(x, south - 2, w, 8);
    ctx.fillStyle = '#ffe08a';
    ctx.font = '9px Courier New';
    ctx.fillText(goalLabel, x + 4, gy(y0 + 10) - 32);
    const pulse = 0.55 + Math.sin(performance.now() * 0.005) * 0.18;
    ctx.strokeStyle = 'rgba(255, 232, 150,' + pulse + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, gy(y0) - 52, w + 8, 58);
  }

  function drawGate(c, r, tiles) {
    const span = tiles || 1;
    const x = c * TILE + 4;
    const y0 = r * TILE + 6;
    const w = span * TILE - 8;
    drawShadow(x + w / 2, y0 + 26, w / 2, 6);
    drawExtrude(x, y0, 8, 20, 26, '#c8b56a', '#a89448', '#6a5a28');
    drawExtrude(x + w - 8, y0, 8, 20, 26, '#c8b56a', '#a89448', '#6a5a28');
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(x + 6, gy(y0) - 28, w - 12, 4);
    ctx.fillStyle = 'rgba(255, 224, 138, 0.22)';
    ctx.fillRect(x + 8, gy(y0) - 24, w - 16, 24);
    ctx.fillStyle = '#fff4d0';
    ctx.font = 'bold 8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(goalLabel, x + w / 2, gy(y0) - 32);
    ctx.textAlign = 'start';
    const pulse = 0.48 + Math.sin(performance.now() * 0.005) * 0.18;
    ctx.strokeStyle = 'rgba(255, 232, 150,' + pulse + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, gy(y0) - 38, w + 6, 42);
  }

  function drawWires() {
    ctx.strokeStyle = 'rgba(18, 16, 28, 0.55)';
    ctx.lineWidth = 1.2;
    [2, 6, 9, 15, 18].forEach((r, i) => {
      const y = gy(r * TILE) - 40 - (i % 2) * 6;
      ctx.beginPath();
      ctx.moveTo(-80, y);
      ctx.quadraticCurveTo(WORLD_W / 2, y - 16, WORLD_W + 80, y);
      ctx.stroke();
    });
  }

  function drawKid() {
    ctx.save();
    ctx.translate(player.x, gy(player.y));
    ctx.globalAlpha = player.hiding ? 0.28 : (isHide(tileAtPx(player.x, player.y)) ? 0.7 : 1);
    const ang = player.facing;
    const side = Math.abs(Math.cos(ang)) >= Math.abs(Math.sin(ang))
      ? (Math.cos(ang) >= 0 ? 'right' : 'left')
      : (Math.sin(ang) >= 0 ? 'down' : 'up');
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const squat = player.crouch ? 3 : 0;
    ctx.fillStyle = '#1e3a7a';
    ctx.fillRect(-5, -14 + squat, 5, 12 - squat);
    ctx.fillRect(1, -14 + squat, 5, 12 - squat);
    ctx.fillStyle = '#2a4d9c';
    ctx.fillRect(-7, -24 + squat, 14, 12);

    function pack(px, py) {
      ctx.fillStyle = '#c45c12';
      ctx.fillRect(px, py + squat, 8, 13);
      ctx.fillStyle = '#8a340c';
      ctx.fillRect(px + 1, py + 3 + squat, 6, 2);
      ctx.fillStyle = '#e8c45a';
      ctx.fillRect(px + 3, py + 7 + squat, 2, 3);
    }
    function face(flip) {
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(flip * 1, -30 + squat, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e23b3b';
      ctx.beginPath();
      ctx.arc(flip * 1, -34 + squat, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(flip * 1 - 4, -31 + squat, 2, 2);
      ctx.fillRect(flip * 1 + 1, -31 + squat, 2, 2);
    }
    function nape() {
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(0, -30 + squat, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e23b3b';
      ctx.beginPath();
      ctx.arc(0, -34 + squat, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    if (side === 'left') {
      pack(4, -26);
      face(-1);
    } else if (side === 'right') {
      pack(-12, -26);
      face(1);
    } else if (side === 'down') {
      face(0);
      ctx.fillStyle = '#c45c12';
      ctx.fillRect(-8, -22 + squat, 3, 10);
      ctx.fillRect(5, -22 + squat, 3, 10);
    } else {
      nape();
      pack(-4, -26);
    }
    ctx.restore();
  }

  function drawSeeker(s) {
    ctx.save();
    ctx.translate(s.x, gy(s.y));
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a1a12';
    ctx.fillRect(-6, -16, 5, 14);
    ctx.fillRect(2, -16, 5, 14);
    ctx.fillStyle = s.sees ? '#d62828' : '#e85d04';
    ctx.fillRect(-8, -32, 16, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-9, -44, 18, 14);
    ctx.fillStyle = '#7ad7ff';
    ctx.fillRect(-6, -40, 12, 6);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(8, -28, 3, 0, Math.PI * 2);
    ctx.fill();
    if (s.sees) {
      ctx.fillStyle = '#ff3030';
      ctx.font = 'bold 22px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('!!', 0, -52);
    } else if (s.distract > 0) {
      ctx.fillStyle = '#7ad7ff';
      ctx.font = 'bold 22px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -52);
    } else if (s.notice > 0.15) {
      ctx.fillStyle = s.notice > 0.7 ? '#ff3030' : '#ffe566';
      ctx.font = 'bold 22px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(s.notice > 0.7 ? '!!' : '!', 0, -52);
    }
    ctx.restore();
  }

  function streetProp(c, r) {
    const ch = ROWS[r][c];
    if (ch !== '.') return null;
    const byShop = tileAt(c, r - 1) === '#' || tileAt(c, r + 1) === '#';
    const key = (c * 13 + r * 7) % 11;
    if (ROAD_ROWS[r] && (c === 2 || c === 13)) return () => drawLamp(c, r);
    if (ROAD_ROWS[r] && (c === 1 || c === 14) && r % 3 === 0) return () => drawPole(c, r);
    if (byShop && key === 0) return () => drawBike(c, r);
    if (byShop && key === 1) return () => drawPlanter(c, r);
    if (byShop && key === 2) return () => drawCrate(c, r);
    if (byShop && key === 3) return () => drawPole(c, r);
    return null;
  }

  function drawWorld() {
    const lookAheadX = Math.cos(player.facing) * 28;
    const lookAheadY = Math.sin(player.facing) * 18;
    const targetX = Math.max(-72, Math.min(WORLD_W - viewW + 72, player.x + lookAheadX - viewW / 2));
    const targetY = Math.max(-80, Math.min(gy(WORLD_H) - viewH + 90, gy(player.y) + lookAheadY - viewH * 0.6));
    if (camera.x == null) { camera.x = targetX; camera.y = targetY; }
    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (targetY - camera.y) * 0.12;
    camX = camera.x;
    camY = camera.y;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, '#120c28');
    sky.addColorStop(0.4, '#3a2450');
    sky.addColorStop(0.72, '#1a2744');
    sky.addColorStop(1, '#0b1520');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(-camX, -camY);
    drawSkyline();
    drawEdgeTown();
    drawGround();
    drawLightPools();
    drawWires();
    drawCones();

    const sprites = [];
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = ROWS[r][c];
        const y = (r + 1) * TILE;
        if (ch === '#') sprites.push({ y, x: c, draw: () => drawBuilding(c, r) });
        else if (ch === 'B') sprites.push({ y: y - 8, x: c, draw: () => drawBush(c, r) });
        else if (ch === 'C') sprites.push({ y: y - 6, x: c, draw: () => drawCar(c, r) });
        else if (ch === 'H' && (c === 0 || ROWS[r][c - 1] !== 'H')) {
          let span = 1;
          while (ROWS[r][c + span] === 'H') span += 1;
          sprites.push({
            y: y - 4,
            x: c,
            draw: () => {
              if (goalLabel === 'HOME') drawHome(c, r);
              else drawGate(c, r, span);
            },
          });
        }
        else if (ch === 'V') sprites.push({ y: y - 5, x: c, draw: () => drawVending(c, r) });
        else if (ch === 'S' && (c === 0 || ROWS[r][c - 1] !== 'S')) {
          sprites.push({ y: y - 1, x: c, draw: () => {
            const x = c * TILE + 8;
            drawExtrude(x, r * TILE + 4, 56, 12, 22, '#c8b56a', '#a89448', '#6a5a28');
            ctx.fillStyle = '#3a2a10';
            ctx.fillRect(x + 20, gy(r * TILE + 16) - 2, 16, 18);
          } });
        } else {
          const prop = streetProp(c, r);
          if (prop) sprites.push({ y: y - 3, x: c, draw: prop });
        }
      }
    }
    seekers.forEach((s) => sprites.push({ y: s.y, x: s.x, draw: () => drawSeeker(s) }));
    sprites.push({ y: player.y, x: player.x, draw: drawKid });
    particles.forEach((p) => sprites.push({
      y: p.y,
      x: p.x,
      draw: () => {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, gy(p.y) - 6, 3, 3);
        ctx.globalAlpha = 1;
      },
    }));
    if (pebble) {
      sprites.push({
        y: pebble.y,
        x: pebble.x,
        draw: () => {
          drawShadow(pebble.x, pebble.y, 5, 3);
          ctx.fillStyle = '#e6dcc0';
          ctx.beginPath();
          ctx.arc(pebble.x, gy(pebble.y) - 4, 4, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    }
    sprites.sort((a, b) => a.y - b.y || a.x - b.x);
    sprites.forEach((s) => s.draw());
    ctx.restore();

    ctx.fillStyle = 'rgba(8, 4, 20, 0.1)';
    ctx.fillRect(0, 0, viewW, viewH);
    if (mode === 'play' && (phase === 'ALERT' || freeze > 0)) {
      ctx.fillStyle = freeze > 0 ? 'rgba(255, 220, 80, 0.12)' : 'rgba(140, 0, 20, 0.16)';
      ctx.fillRect(0, 0, viewW, 28);
      ctx.fillRect(0, viewH - 28, viewW, 28);
      ctx.fillRect(0, 0, 18, viewH);
      ctx.fillRect(viewW - 18, 0, 18, viewH);
    }
  }

  drawWorld();
}
