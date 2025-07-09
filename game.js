const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const worldWidth = 3000;
const worldHeight = 3000;

// Player setup
const player = {
    x: worldWidth / 2,
    y: worldHeight / 2,
    radius: 12, // start slightly bigger
    speed: 9,   // slightly faster base speed
    stealth: false,
    stealthTimer: 0,
    poisoned: false,
    poisonTimer: 0,
    shield: false,
    dashTimer: 0,
    pingCooldown: 0
};

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === ' ' || e.code === 'Space') && player.pingCooldown <= 0) {
        createPing(player.x, player.y);
        player.pingCooldown = 40; // faster ping (heartbeat)
    }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

const pings = [];
const crystals = [];
const aiBlobs = [];
const minions = [];
const meteors = [];
const storms = [];
const pingTargets = [];

// Create initial world
function createCrystals(num) {
    while (crystals.length < num) {
        crystals.push({
            x: Math.random() * worldWidth,
            y: Math.random() * worldHeight,
            radius: 5,
            type: Math.random() < 0.1 ? 'poison' : 'normal'
        });
    }
}

function createAIBlobs(num) {
    while (aiBlobs.length < num) {
        aiBlobs.push({
            x: Math.random() * worldWidth,
            y: Math.random() * worldHeight,
            radius: 10 + Math.random() * 8,
            speed: 1.5,
            target: null,
            idleTimer: 50 + Math.random() * 200,
            idleX: 0,
            idleY: 0,
            scaredTimer: 0,
            pingReactionTimer: 0
        });
    }
}

createCrystals(80);
createAIBlobs(20);

function update() {
    handleMovement();
    if (player.pingCooldown > 0) player.pingCooldown--;
    player.radius -= 0.00005; // slower natural shrink
    if (player.radius < 8) endGame();

    if (player.poisoned) {
        player.radius -= 0.0008;
        player.poisonTimer--;
        if (player.poisonTimer <= 0) player.poisoned = false;
    }

    updateAI();
    updateHazards();
    updateMinions();
    updatePings();
    updatePingTargets();
    checkCollectCrystals();

    createCrystals(80);
    createAIBlobs(20);
}

function handleMovement() {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    let len = Math.hypot(dx, dy);
    if (len) { dx /= len; dy /= len; }

    let moveSpeed = player.speed * Math.max(0.8, (12 / player.radius));
    if (player.dashTimer > 0) {
        moveSpeed *= 3;
        player.dashTimer--;
    }

    player.x += dx * moveSpeed;
    player.y += dy * moveSpeed;

    player.x = Math.max(0, Math.min(worldWidth, player.x));
    player.y = Math.max(0, Math.min(worldHeight, player.y));

    if (!dx && !dy) {
        player.stealthTimer++;
        if (player.stealthTimer > 100) player.stealth = true;
    } else {
        player.stealth = false;
        player.stealthTimer = 0;
    }

    if (player.radius >= 20 && keys['shift']) player.dashTimer = 30;
    if (player.radius >= 35 && !player.shield) player.shield = true;
}
function updateAI() {
    aiBlobs.forEach(blob => {
        blob.idleTimer--;
        if (blob.idleTimer <= 0) {
            blob.idleTimer = 80 + Math.random() * 200;
            blob.idleX = (Math.random() - 0.5) * 200;
            blob.idleY = (Math.random() - 0.5) * 200;
        }

        blob.pingReactionTimer--;
        if (blob.pingReactionTimer <= 0) {
            for (const ping of pings) {
                if (Math.hypot(blob.x - ping.x, blob.y - ping.y) < 300) {
                    blob.pingReactionTimer = 80;
                    break;
                }
            }
        }

        // AI strategy
        let dx = 0, dy = 0;
        let closestPrey = null, closestDist = Infinity;
        aiBlobs.forEach(other => {
            if (other !== blob && blob.radius > other.radius * 1.2) {
                const d = Math.hypot(blob.x - other.x, blob.y - other.y);
                if (d < closestDist) { closestDist = d; closestPrey = other; }
            }
        });

        if (closestPrey && closestDist < 200) {
            dx = closestPrey.x - blob.x;
            dy = closestPrey.y - blob.y;
        } else if (blob.radius < player.radius * 0.8 && !player.stealth) {
            dx = blob.x - player.x;
            dy = blob.y - player.y;
        } else if (blob.radius > player.radius * 1.2 && !player.stealth) {
            dx = player.x - blob.x;
            dy = player.y - blob.y;
        } else if (blob.target) {
            dx = blob.target.x - blob.x;
            dy = blob.target.y - blob.y;
        } else {
            dx = blob.idleX;
            dy = blob.idleY;
        }

        let dist = Math.hypot(dx, dy);
        if (dist > 1) {
            blob.x += (dx / dist) * blob.speed;
            blob.y += (dy / dist) * blob.speed;
        }

        // Eating other blobs
        aiBlobs.forEach(other => {
            if (other !== blob && Math.hypot(blob.x - other.x, blob.y - other.y) < blob.radius + other.radius) {
                if (blob.radius > other.radius * 1.2) {
                    blob.radius += other.radius * 0.3;
                    aiBlobs.splice(aiBlobs.indexOf(other), 1);
                }
            }
        });

        // Collide with player
        let dPlayer = Math.hypot(player.x - blob.x, player.y - blob.y);
        if (dPlayer < player.radius + blob.radius) {
            if (player.radius > blob.radius * 1.2) {
                player.radius += blob.radius * 0.3;
                aiBlobs.splice(aiBlobs.indexOf(blob), 1);
            } else if (blob.radius > player.radius * 1.2) {
                if (player.shield) player.shield = false;
                else player.radius -= blob.radius * 0.1;
                blob.scaredTimer = 100;
            }
        }
    });
}
function updateHazards() {
    if (Math.random() < 0.002) {
        meteors.push({
            x: Math.random() * worldWidth,
            y: -50,
            dx: (Math.random()-0.5)*10,
            dy: Math.random()*5+2
        });
    }
    if (Math.random() < 0.0005) {
        storms.push({
            x: Math.random()*worldWidth,
            y: Math.random()*worldHeight,
            radius: 200,
            dx: (Math.random()-0.5)*2,
            dy: (Math.random()-0.5)*2
        });
    }

    meteors.forEach((m, i) => {
        m.x += m.dx; m.y += m.dy;
        if (Math.hypot(player.x - m.x, player.y - m.y) < player.radius+10) {
            player.radius -= 0.4;
            meteors.splice(i, 1);
        }
        if (m.y > worldHeight + 50) meteors.splice(i, 1);
    });

    storms.forEach((s, i) => {
        s.x += s.dx; s.y += s.dy;
        if (Math.hypot(player.x - s.x, player.y - s.y) < s.radius)
            player.radius -= 0.05;
        if (Math.random() < 0.005) storms.splice(i, 1);
    });
}

function updateMinions() {
    minions.length = 0;
    if (player.radius >= 25) {
        for (let i=0; i<3; i++) {
            let angle = (performance.now()/500 + i*2*Math.PI/3);
            minions.push({
                x: player.x + Math.cos(angle)*(player.radius+15),
                y: player.y + Math.sin(angle)*(player.radius+15)
            });
        }
    }

    aiBlobs.forEach(blob => {
        minions.forEach(minion => {
            let dx = blob.x - minion.x, dy = blob.y - minion.y;
            let d = Math.hypot(dx, dy);
            if (d < 20) {
                blob.x += (dx/d)*2;
                blob.y += (dy/d)*2;
            }
        });
    });
}

function checkCollectCrystals() {
    for (let i=crystals.length-1; i>=0; i--) {
        let c = crystals[i];
        if (Math.hypot(c.x - player.x, c.y - player.y) < player.radius + c.radius) {
            if (c.type==='poison') {
                player.radius += 2;
                player.poisoned = true;
                player.poisonTimer = 300;
            } else {
                player.radius += 1;
            }
            crystals.splice(i,1);
        }
    }
}
function createPing(x,y) {
    pings.push({
        x, y,
        radius: 5,
        maxRadius: 300,
        alpha: 1,
        duration: 60, // faster heartbeat
        waveWidth: 4
    });
    pingTargets.push({ x, y, timer: 300 });
    aiBlobs.forEach(blob => {
        if (Math.hypot(blob.x - x, blob.y - y) < 300) {
            blob.pingReactionTimer = 80;
        }
    });
}

function updatePings() {
    for (let i = pings.length - 1; i >= 0; i--) {
        const ping = pings[i];
        ping.radius += 8;
        ping.duration--;
        if (ping.duration <= 0) pings.splice(i, 1);
    }
}

function updatePingTargets() {
    for (let i = pingTargets.length - 1; i >= 0; i--) {
        pingTargets[i].timer--;
        if (pingTargets[i].timer <= 0) pingTargets.splice(i, 1);
    }
}

// Draw everything
function draw() {
    let camX = player.x - canvas.width / 2;
    let camY = player.y - canvas.height / 2;
    ctx.setTransform(1, 0, 0, 1, -camX, -camY);
    ctx.clearRect(camX, camY, canvas.width, canvas.height);

    crystals.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, 2 * Math.PI);
        ctx.fillStyle = c.type==='poison' ? '#aa00ff' : '#00ff00';
        ctx.fill();
    });

    meteors.forEach(m => {
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 10, 0, 2 * Math.PI);
        ctx.fill();
    });

    storms.forEach(s => {
        ctx.fillStyle = 'rgba(255,0,0,0.1)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, 2 * Math.PI);
        ctx.fill();
    });

    aiBlobs.forEach(b => {
        ctx.fillStyle = b.scaredTimer>0 ? '#ff9999' : '#ff0000';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, 2 * Math.PI);
        ctx.fill();
    });

    minions.forEach(m => {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });

    if (player.stealth) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
        ctx.fill();
    } else {
        ctx.fillStyle = player.poisoned ? '#ff66ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    if (player.shield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius+3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    pings.forEach(ping => {
        const progress = 1 - (ping.duration / 60);
        const currentRadius = ping.radius + (ping.maxRadius - ping.radius) * progress;
        const alpha = ping.alpha * (1 - progress);

        ctx.strokeStyle = `rgba(100,200,255,${alpha})`;
        ctx.lineWidth = ping.waveWidth;
        ctx.beginPath();
        ctx.arc(ping.x, ping.y, currentRadius, 0, 2 * Math.PI);
        ctx.stroke();
    });

    pingTargets.forEach(target => {
        const pulse = Math.sin(performance.now()/150)*3 + 8;
        ctx.fillStyle = `rgba(100,200,255,${target.timer/300})`;
        ctx.beginPath();
        ctx.arc(target.x, target.y, pulse, 0, 2 * Math.PI);
        ctx.fill();
    });

    drawFog(camX, camY);
    drawMiniMap();
    drawUI();
}
function drawFog(camX, camY) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(camX - 50, camY - 50, canvas.width + 100, canvas.height + 100);

    let grad = ctx.createRadialGradient(
        player.x, player.y, player.radius * 2,
        player.x, player.y, player.radius * 6
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(camX - 50, camY - 50, canvas.width + 100, canvas.height + 100);

    pings.forEach(ping => {
        const progress = 1 - (ping.duration / 60);
        const currentRadius = ping.radius + (ping.maxRadius - ping.radius) * progress;
        let g = ctx.createRadialGradient(
            ping.x, ping.y, currentRadius * 0.8,
            ping.x, ping.y, currentRadius
        );
        g.addColorStop(0, `rgba(100,200,255,${ping.alpha * 0.4 * (1-progress)})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ping.x, ping.y, currentRadius, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawMiniMap() {
    const scale = 150 / worldWidth;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width - 160, 10, 150, 150);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(canvas.width - 160, 10, 150, 150);

    function dot(x, y, color, r = 2) {
        ctx.beginPath();
        ctx.arc(canvas.width - 160 + x*scale, 10 + y*scale, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    aiBlobs.forEach(b => dot(b.x, b.y, b.scaredTimer>0 ? '#ff9999':'#ff0000', b.radius*scale/2));
    meteors.forEach(m => dot(m.x, m.y, '#ff8800'));
    storms.forEach(s => dot(s.x, s.y, 'rgba(255,0,0,0.5)', s.radius*scale/4));
    dot(player.x, player.y, player.poisoned ? '#ff66ff' : 'white', player.radius*scale/2);

    pingTargets.forEach(target => {
        dot(target.x, target.y, 'rgba(100,200,255,0.8)', 3);
    });
}

function drawUI() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const healthPercent = Math.min(1, (player.radius - 8) / 32);
    const healthWidth = 200 * healthPercent;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 20, 204, 24);
    ctx.fillStyle = '#333';
    ctx.fillRect(22, 22, 200, 20);
    ctx.fillStyle = healthPercent > 0.7 ? '#00ff00' :
                   healthPercent > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillRect(22, 22, healthWidth, 20);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(22, 22, 200, 20);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';

    ctx.fillText(`Shield: ${player.shield?'ON':'OFF'}`, 20, 60);
    ctx.fillText(`Stealth: ${player.stealth?'ON':'OFF'}`, 20, 80);
    ctx.fillText(`Poison: ${player.poisoned?'YES':'NO'}`, 20, 100);
    ctx.fillText(`Size: ${player.radius.toFixed(1)}`, 20, 120);

    if (player.pingCooldown > 0) {
        const cd = player.pingCooldown / 60;
        ctx.fillStyle = 'rgba(100,200,255,0.7)';
        ctx.fillText(`Ping Cooldown: ${(cd*100).toFixed(0)}%`, 20, 140);
    }
}

function endGame() {
    cancelAnimationFrame(animHandle);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
    ctx.font = '20px monospace';
    ctx.fillText('Press R or Click Restart', canvas.width/2, canvas.height/2 + 20);

    const restartBtn = document.getElementById('restartButton');
    if (restartBtn) {
        restartBtn.style.display = 'block';
        restartBtn.onclick = () => location.reload();
    }

    window.addEventListener('keydown', function handler(e) {
        if (e.key.toLowerCase() === 'r') {
            window.removeEventListener('keydown', handler);
            location.reload();
        }
    });
}


let animHandle;
function gameLoop() {
    update();
    draw();
    animHandle = requestAnimationFrame(gameLoop);
}
gameLoop();
