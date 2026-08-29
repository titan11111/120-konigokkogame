// 鬼ごっこゲーム - メタルギアソリッド風ステルスゲーム

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ゲーム状態
const game = {
    running: true,
    time: 300, // 5分
    alertLevel: 0, // 0-100
    gameOver: false,
    won: false
};

// プレイヤー（小学生）
const player = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 20,
    height: 30,
    speed: 3,
    vx: 0,
    vy: 0,
    health: 100,
    hiding: false,
    location: '町中'
};

// 敵（鬼）
const enemies = [
    { x: 100, y: 100, width: 25, height: 35, speed: 2, vx: 2, vy: 0, alertness: 0, viewRange: 150 },
    { x: canvas.width - 100, y: 100, width: 25, height: 35, speed: 2, vx: -2, vy: 0, alertness: 0, viewRange: 150 }
];

// 隠れスポット（建物など）
const hideSpots = [
    { x: 50, y: 200, width: 80, height: 100, name: '公園の茂み' },
    { x: canvas.width - 150, y: 200, width: 80, height: 100, name: '廃屋' },
    { x: canvas.width / 2 - 50, y: 100, width: 100, height: 80, name: '学校' }
];

// ゴール（家）
const goal = { x: canvas.width / 2 - 30, y: 30, width: 60, height: 40 };

// キー入力
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // モバイル操作対応（矢印キーまたはWASD）
    if (['arrowup', 'w'].includes(e.key.toLowerCase())) player.vy = -player.speed;
    if (['arrowdown', 's'].includes(e.key.toLowerCase())) player.vy = player.speed;
    if (['arrowleft', 'a'].includes(e.key.toLowerCase())) player.vx = -player.speed;
    if (['arrowright', 'd'].includes(e.key.toLowerCase())) player.vx = player.speed;
});

window.addEventListener('keyup', (e) => {
    delete keys[e.key.toLowerCase()];
    if (!['arrowup', 'arrowdown', 'w', 's'].some(k => keys[k])) player.vy = 0;
    if (!['arrowleft', 'arrowright', 'a', 'd'].some(k => keys[k])) player.vx = 0;
});

// ゲームループ
function gameLoop() {
    if (!game.running) return;
    
    // プレイヤー更新
    updatePlayer();
    updateEnemies();
    updateAlertLevel();
    checkCollisions();
    
    // タイマー
    game.time -= 0.016;
    if (game.time <= 0) {
        game.gameOver = true;
        game.won = true;
    }
    
    // UI更新
    updateUI();
    
    // 描画
    draw();
    
    if (!game.gameOver) {
        requestAnimationFrame(gameLoop);
    } else {
        showGameOver();
    }
}

function updatePlayer() {
    player.x += player.vx;
    player.y += player.vy;
    
    // 画面境界
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
    
    // 隠れスポット判定
    player.hiding = hideSpots.some(spot => 
        player.x + player.width > spot.x && 
        player.x < spot.x + spot.width &&
        player.y + player.height > spot.y && 
        player.y < spot.y + spot.height
    );
    
    // 位置情報更新
    player.location = hideSpots.find(s => player.hiding && 
        player.x + player.width > s.x && player.x < s.x + s.width)?.name || '町中';
}

function updateEnemies() {
    enemies.forEach(enemy => {
        // パトロール
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        if (enemy.x < 0 || enemy.x > canvas.width) enemy.vx *= -1;
        if (enemy.y < 0 || enemy.y > canvas.height - 200) enemy.vy *= -1;
        
        // プレイヤーへの警戒度
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < enemy.viewRange && !player.hiding) {
            enemy.alertness = Math.min(100, enemy.alertness + 2);
        } else {
            enemy.alertness = Math.max(0, enemy.alertness - 1);
        }
    });
}

function updateAlertLevel() {
    const maxAlertness = Math.max(...enemies.map(e => e.alertness));
    game.alertLevel = Math.max(game.alertLevel - 0.5, maxAlertness);
}

function checkCollisions() {
    // ゴール判定
    if (player.x + player.width > goal.x && 
        player.x < goal.x + goal.width &&
        player.y + player.height > goal.y && 
        player.y < goal.y + goal.height) {
        game.gameOver = true;
        game.won = true;
    }
    
    // 敵との衝突
    enemies.forEach(enemy => {
        if (player.x + player.width > enemy.x && 
            player.x < enemy.x + enemy.width &&
            player.y + player.height > enemy.y && 
            player.y < enemy.y + enemy.height) {
            if (!player.hiding) {
                game.gameOver = true;
                game.won = false;
            }
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景グリッド
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    
    // 隠れスポット
    hideSpots.forEach(spot => {
        ctx.fillStyle = 'rgba(100, 150, 100, 0.5)';
        ctx.fillRect(spot.x, spot.y, spot.width, spot.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(spot.x, spot.y, spot.width, spot.height);
    });
    
    // ゴール（家）
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
    ctx.fillStyle = '#fff';
    ctx.fillText('家', goal.x + 15, goal.y + 25);
    
    // プレイヤー
    ctx.fillStyle = player.hiding ? '#00ff00' : '#0066ff';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // 敵
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.alertness > 50 ? '#ff0000' : enemy.alertness > 25 ? '#ffff00' : '#ff6600';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // 視野範囲を描画
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.viewRange, 0, Math.PI * 2);
        ctx.stroke();
    });
}

function updateUI() {
    document.getElementById('alert-level').style.width = game.alertLevel + '%';
    document.getElementById('alert-status').textContent = 
        game.alertLevel > 66 ? '警戒中!' : game.alertLevel > 33 ? '注意' : '安全';
    document.getElementById('health').textContent = Math.max(0, Math.floor(player.health));
    document.getElementById('location').textContent = player.location;
    document.getElementById('time-left').textContent = Math.max(0, Math.floor(game.time));
}

function showGameOver() {
    const overlay = document.getElementById('game-over');
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');
    
    if (game.won) {
        title.textContent = '帰宅成功！';
        message.textContent = '無事に家に帰ることができました！';
    } else {
        title.textContent = 'つかまった...';
        message.textContent = '鬼に捕まってしまいました。';
    }
    
    overlay.classList.remove('hidden');
}

// ゲーム開始
gameLoop();
