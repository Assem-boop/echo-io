// Get canvas & context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Player object
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 3,
    dx: 0,
    dy: 0
};

// Handle keyboard input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.code === 'Space') {
        createPing(player.x, player.y);
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Pings
const pings = [];
function createPing(x, y) {
    pings.push({ x, y, radius: 0, maxRadius: 300, alpha: 1 });
}

// Crystals
const crystals = [];
function createCrystals(num) {
    for (let i = 0; i < num; i++) {
        crystals.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 5,
            visible: false
        });
    }
}
createCrystals(50);

// AI blobs
const aiBlobs = [];
function createAIBlobs(num) {
    for (let i = 0; i < num; i++) {
        aiBlobs.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 10,
            speed: 1.5,
            target: null
        });
    }
}
createAIBlobs(5);

// Timers for crystal respawn
let crystalSpawnTimer = 0;
let crystalSpawnInterval = 120; // ~2 seconds

// Update
function update() {
    player.dx = 0;
    player.dy = 0;
    if (keys['w'] || keys['arrowup'])    player.dy = -player.speed;
    if (keys['s'] || keys['arrowdown'])  player.dy = player.speed;
    if (keys['a'] || keys['arrowleft'])  player.dx = -player.speed;
    if (keys['d'] || keys['arrowright']) player.dx = player.speed;

    player.x += player.dx;
    player.y += player.dy;

    updatePings();
    updateAIBlobs();
    checkPingCrystalReveal();
    checkPlayerCollectCrystal();

    // spawn new crystals over time
    crystalSpawnTimer++;
    if (crystalSpawnTimer >= crystalSpawnInterval) {
        createCrystals(1);
        crystalSpawnTimer = 0;
    }

    // shrink player slowly
    player.radius -= 0.01;
    if (player.radius < 10) player.radius = 10;
}

function updatePings() {
    for (let i = pings.length - 1; i >= 0; i--) {
        const ping = pings[i];
        ping.radius += 4;
        ping.alpha = 1 - (ping.radius / ping.maxRadius);

        // PUSH AI BLOBS
        aiBlobs.forEach(blob => {
            const dx = blob.x - ping.x;
            const dy = blob.y - ping.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < ping.radius + blob.radius && dist > 0) {
                const pushStrength = (1 - dist / ping.maxRadius) * 3;
                blob.x += (dx / dist) * pushStrength;
                blob.y += (dy / dist) * pushStrength;
            }
        });

        if (ping.radius >= ping.maxRadius) {
            pings.splice(i, 1);
        }
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
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                blob.x += (dx / dist) * blob.speed;
                blob.y += (dy / dist) * blob.speed;
            }
        }
    });

    checkAICollectCrystal();
}

// Reveal crystals when ping hits them
function checkPingCrystalReveal() {
    crystals.forEach(crystal => {
        pings.forEach(ping => {
            const dx = crystal.x - ping.x;
            const dy = crystal.y - ping.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < ping.radius) {
                crystal.visible = true;
            }
        });
    });
}

// Player collects crystals
function checkPlayerCollectCrystal() {
    for (let i = crystals.length - 1; i >= 0; i--) {
        const crystal = crystals[i];
        const dx = crystal.x - player.x;
        const dy = crystal.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + crystal.radius) {
            crystals.splice(i, 1);
            player.radius += 1;
            player.radius = Math.min(player.radius, 50);
        }
    }
}

// AI collects crystals
function checkAICollectCrystal() {
    aiBlobs.forEach(blob => {
        for (let i = crystals.length - 1; i >= 0; i--) {
            const crystal = crystals[i];
            const dx = crystal.x - blob.x;
            const dy = crystal.y - blob.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < blob.radius + crystal.radius) {
                crystals.splice(i, 1);
                blob.radius += 1;
                blob.radius = Math.min(blob.radius, 50);
            }
        }
    });
}

// Draw everything
function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // pings
    pings.forEach(ping => {
        ctx.beginPath();
        ctx.arc(ping.x, ping.y, ping.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${ping.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // crystals
    crystals.forEach(crystal => {
        if (crystal.visible) {
            ctx.beginPath();
            ctx.arc(crystal.x, crystal.y, crystal.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'lime';
            ctx.fill();
        }
    });

    // ai blobs with glow
    aiBlobs.forEach(blob => {
        // glow
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        ctx.fill();

        // blob
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
    });

    // player with glow
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
