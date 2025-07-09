const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Constants
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// Player
const player = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    radius: 20,
    speed: 0,
    angle: 0,
    vx: 0,
    vy: 0
};

const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Crystals
const crystals = [];
for (let i = 0; i < 100; i++) {
    crystals.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: 5,
        visible: false
    });
}

// AI blobs
const aiBlobs = [];
for (let i = 0; i < 15; i++) {
    aiBlobs.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: 15,
        speed: 1.2,
        target: null
    });
}

// Pings
const pings = [];
function createPing(x, y) {
    pings.push({ x, y, radius: 0, maxRadius: 300, alpha: 1 });
}

// Mini-map
const mapSize = 200;

// Health and score
let score = 0;
let gameOver = false;

// Update
function update() {
    if (gameOver) return;

    // Handle input & velocity with inertia
    let acc = 0.4 * (1 - (player.radius - 20) / 80); // slower when bigger
    if (keys['w'] || keys['arrowup'])    player.vy -= acc;
    if (keys['s'] || keys['arrowdown'])  player.vy += acc;
    if (keys['a'] || keys['arrowleft'])  player.vx -= acc;
    if (keys['d'] || keys['arrowright']) player.vx += acc;

    // Friction
    player.vx *= 0.9;
    player.vy *= 0.9;

    player.x += player.vx;
    player.y += player.vy;

    // Clamp to world
    player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));

    updatePings();
    updateAIBlobs();
    checkPingCrystalReveal();
    checkPlayerCollectCrystal();
    checkAICollidePlayer();

    player.radius -= 0.002;
    if (player.radius < 5) gameOver = true;
}

function updatePings() {
    for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        p.radius += 4;
        p.alpha = 1 - p.radius / p.maxRadius;
        if (p.radius > p.maxRadius) pings.splice(i, 1);
    }
}

function updateAIBlobs() {
    aiBlobs.forEach(blob => {
        if (!blob.target || !crystals.includes(blob.target)) {
            blob.target = crystals[Math.floor(Math.random() * crystals.length)];
        }
        if (blob.target) {
            const dx = blob.target.x - blob.x;
            const dy = blob.target.y - blob.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 1) {
                blob.x += (dx / dist) * blob.speed;
                blob.y += (dy / dist) * blob.speed;
            }
        }
    });
}

function checkPingCrystalReveal() {
    crystals.forEach(crystal => {
        pings.forEach(ping => {
            const dx = crystal.x - ping.x;
            const dy = crystal.y - ping.y;
            if (Math.sqrt(dx*dx + dy*dy) < ping.radius) {
                crystal.visible = true;
            }
        });
    });
}

function checkPlayerCollectCrystal() {
    for (let i = crystals.length - 1; i >= 0; i--) {
        const c = crystals[i];
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        if (Math.sqrt(dx*dx + dy*dy) < player.radius + c.radius) {
            crystals.splice(i, 1);
            player.radius += 0.8;
            score++;
        }
    }
}

function checkAICollidePlayer() {
    aiBlobs.forEach(blob => {
        const dx = player.x - blob.x;
        const dy = player.y - blob.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < player.radius + blob.radius) {
            // Damage depends on blob size
            player.radius -= 0.02 * blob.radius;
            if (player.radius < 5) gameOver = true;
        }
    });
}

// Draw
function draw() {
    // Camera transform
    const zoom = 1.2;
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width/2 - player.x*zoom, canvas.height/2 - player.y*zoom);

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Crystals
    crystals.forEach(c => {
        if (c.visible) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radius, 0, Math.PI*2);
            ctx.fillStyle = 'lime';
            ctx.fill();
        }
    });

    // Pings
    pings.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(0,255,255,${p.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // AI blobs
    aiBlobs.forEach(blob => {
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI*2);
        ctx.fillStyle = 'red';
        ctx.fill();
    });

    // Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // UI (fixed screen)
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = 'white';
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${score}`, 20, 30);

    // Health bar
    ctx.fillStyle = 'gray';
    ctx.fillRect(20, 40, 120, 10);
    ctx.fillStyle = 'lime';
    let healthRatio = (player.radius - 5) / (80 - 5);
    ctx.fillRect(20, 40, 120 * healthRatio, 10);

    // Mini-map
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(canvas.width - mapSize - 20, 20, mapSize, mapSize);

    aiBlobs.forEach(blob => {
        ctx.beginPath();
        ctx.arc(canvas.width - mapSize - 20 + blob.x * mapSize / WORLD_WIDTH,
                20 + blob.y * mapSize / WORLD_HEIGHT, 2, 0, Math.PI*2);
        ctx.fillStyle = 'red';
        ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(canvas.width - mapSize - 20 + player.x * mapSize / WORLD_WIDTH,
            20 + player.y * mapSize / WORLD_HEIGHT, 3, 0, Math.PI*2);
    ctx.fillStyle = 'white';
    ctx.fill();

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px monospace';
        ctx.fillText("GAME OVER", canvas.width/2 - 140, canvas.height/2);
    }
}

// Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();

// Mouse click creates pings
canvas.addEventListener('click', e => {
    createPing(player.x, player.y);
});
