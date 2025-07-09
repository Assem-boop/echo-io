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

const player = {
    x: worldWidth / 2,
    y: worldHeight / 2,
    radius: 10,
    speed: 3,
    stealth: false,
    stealthTimer: 0,
    poisoned: false,
    poisonTimer: 0,
    shield: false,
    dashTimer: 0,
    health: 100
};

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.code === 'Space') createPing(player.x, player.y);
});
window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

const pings = [];
const crystals = [];
const aiBlobs = [];
const minions = [];
const meteors = [];
const storms = [];

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
            radius: 10 + Math.random() * 5,
            speed: 1.2,
            target: null,
            scaredTimer: 0,
            idleTimer: Math.random() * 200,
            idleX: 0,
            idleY: 0
        });
    }
}

createCrystals(50);
createAIBlobs(10);

function update() {
    handleMovement();

    // natural decay - much slower now
    player.radius -= 0.0001;
    if (player.radius < 8) endGame();

    // poison effect - now properly balanced
    if (player.poisoned) {
        player.radius -= 0.001;
        player.poisonTimer--;
        if (player.poisonTimer <= 0) player.poisoned = false;
    }

    updateAI();
    updateHazards();
    updateMinions();
    updatePings();
    checkCollectCrystals();

    createCrystals(50);
    createAIBlobs(10);
}

function handleMovement() {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    let len = Math.hypot(dx, dy);
    if (len) { dx /= len; dy /= len; }

    // Base speed is now 4 (increased from 3)
    // Speed scales inversely with size using a smoother curve
    const baseSpeed = 8;
    const minSpeed = 1.5; // Minimum speed when very large
    const speedScale = Math.max(minSpeed, baseSpeed * (8 / player.radius));
    
    let moveSpeed = speedScale;
    
    // Dash gives a bigger boost now (3x instead of 2x)
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
        if (player.stealthTimer > 120) player.stealth = true;
    } else {
        player.stealth = false;
        player.stealthTimer = 0;
    }

    if (player.radius >= 20 && keys['shift']) player.dashTimer = 30;
    if (player.radius >= 40 && !player.shield) player.shield = true;
}

function updateAI() {
    aiBlobs.forEach(blob => {
        // Idle behavior when not targeting
        blob.idleTimer--;
        if (blob.idleTimer <= 0) {
            blob.idleTimer = 100 + Math.random() * 200;
            blob.idleX = (Math.random() - 0.5) * 100;
            blob.idleY = (Math.random() - 0.5) * 100;
        }

        let dx = 0, dy = 0;
        let distToPlayer = Math.hypot(player.x - blob.x, player.y - blob.y);

        if (blob.scaredTimer > 0) {
            // Run away if scared
            blob.scaredTimer--;
            dx = blob.x - player.x; 
            dy = blob.y - player.y;
        } else if (distToPlayer < 300 && !player.stealth) {
            // Only react to player when close enough
            if (blob.radius < player.radius * 0.8) {
                // Smaller blobs run away
                dx = blob.x - player.x; 
                dy = blob.y - player.y;
            } else if (blob.radius > player.radius * 1.2) {
                // Larger blobs chase
                dx = player.x - blob.x; 
                dy = player.y - blob.y;
            } else {
                // Similar size - random behavior
                if (Math.random() < 0.1) {
                    dx = player.x - blob.x; 
                    dy = player.y - blob.y;
                } else if (!blob.target || Math.random() < 0.05) {
                    blob.target = crystals[Math.floor(Math.random() * crystals.length)];
                }
            }
        } else if (blob.target) {
            // Go after crystals
            dx = blob.target.x - blob.x; 
            dy = blob.target.y - blob.y;
        } else {
            // Idle wandering
            dx = blob.idleX;
            dy = blob.idleY;
        }

        let dist = Math.hypot(dx, dy);
        if (dist > 1) {
            blob.x += (dx / dist) * blob.speed;
            blob.y += (dy / dist) * blob.speed;
        }

        // Collision handling - much more balanced now
        if (distToPlayer < blob.radius + player.radius) {
            if (player.radius > blob.radius * 1.2) {
                // Player can eat smaller blobs
                player.radius += blob.radius * 0.3;
                aiBlobs.splice(aiBlobs.indexOf(blob), 1);
            } else if (blob.radius > player.radius * 1.2) {
                // Larger blobs damage player
                if (player.shield) {
                    player.shield = false;
                    blob.scaredTimer = 100;
                } else {
                    player.radius -= blob.radius * 0.1;
                    blob.radius += 0.5;
                    blob.scaredTimer = 60;
                }
            } else {
                // Similar size - bounce off each other
                const pushForce = 2;
                blob.x += (blob.x - player.x) / dist * pushForce;
                blob.y += (blob.y - player.y) / dist * pushForce;
            }
        }
    });
}

function updateHazards() {
    if (Math.random() < 0.002) {
        meteors.push({ x: Math.random() * worldWidth, y: -50, dx: (Math.random()-0.5)*10, dy: Math.random()*5+2 });
    }
    if (Math.random() < 0.0005) {
        storms.push({ x: Math.random()*worldWidth, y: Math.random()*worldHeight, radius: 200, dx: (Math.random()-0.5)*2, dy: (Math.random()-0.5)*2 });
    }

    meteors.forEach((m, i) => {
        m.x += m.dx; m.y += m.dy;
        if (Math.hypot(player.x - m.x, player.y - m.y) < player.radius+10) {
            player.radius -= 0.3;
            if (Math.random() < 0.3) meteors.splice(i, 1);
        }
        if (m.y > worldHeight + 50) meteors.splice(i, 1);
    });
    
    storms.forEach((s, i) => {
        s.x += s.dx; s.y += s.dy;
        if (Math.hypot(player.x - s.x, player.y - s.y) < s.radius) player.radius -= 0.05;
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
            let d = Math.hypot(dx,dy);
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
                player.poisonTimer = 300; // Reduced poison duration
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
        radius: 0,
        alpha: 1
    }); 
}

function updatePings() {
    for (let i=pings.length-1; i>=0; i--) {
        pings[i].radius += 6;
        pings[i].alpha -= 0.01;
        if (pings[i].alpha <= 0) pings.splice(i,1);
    }
}

function draw() {
    let camX = player.x-canvas.width/2, camY = player.y-canvas.height/2;
    ctx.setTransform(1,0,0,1,-camX,-camY);
    ctx.clearRect(camX,camY,canvas.width,canvas.height);

    // Draw crystals
    crystals.forEach(c => {
        ctx.beginPath(); 
        ctx.arc(c.x, c.y, c.radius, 0, 2*Math.PI);
        ctx.fillStyle = c.type==='poison' ? '#aa00ff' : '#00ff00';
        ctx.fill();
    });

    // Draw meteors
    meteors.forEach(m => {
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 10, 0, 2*Math.PI);
        ctx.fill();
    });

    // Draw storms
    storms.forEach(s => {
        ctx.fillStyle = 'rgba(255,0,0,0.1)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, 2*Math.PI);
        ctx.fill();
    });

    // Draw AI blobs
    aiBlobs.forEach(b => {
        ctx.fillStyle = b.scaredTimer > 0 ? '#ff9999' : '#ff0000';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, 2*Math.PI);
        ctx.fill();
    });

    // Draw minions
    minions.forEach(m => {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, 2*Math.PI);
        ctx.fill();
    });

    // Draw player with proper stealth effect
    if (player.stealth) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, 2*Math.PI);
        ctx.fill();
        
        // Stealth shimmer effect
        if (Math.random() < 0.1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 2, 0, 2*Math.PI);
            ctx.stroke();
        }
    } else {
        ctx.fillStyle = player.poisoned ? '#ff66ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, 2*Math.PI);
        ctx.fill();
        
        // Draw shield if active
        if (player.shield) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 3, 0, 2*Math.PI);
            ctx.stroke();
        }
    }

    drawFog(camX, camY);
    drawMiniMap();
    drawUI();
}

function drawFog(camX, camY) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(camX-50, camY-50, canvas.width+100, canvas.height+100);
    
    // Player vision circle
    let grad = ctx.createRadialGradient(
        player.x, player.y, player.radius * 2,
        player.x, player.y, player.radius * 6
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(camX-50, camY-50, canvas.width+100, canvas.height+100);
    
    // Ping effects
    pings.forEach(p => {
        let g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        g.addColorStop(0, `rgba(255,255,255,${p.alpha*0.5})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2*Math.PI);
        ctx.fill();
    });
}

function drawMiniMap() {
    const scale = 150 / worldWidth;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width-160,10,150,150);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(canvas.width-160,10,150,150);

    function dot(x,y,color,r=2) {
        ctx.beginPath(); 
        ctx.arc(canvas.width-160+x*scale,10+y*scale,r,0,2*Math.PI);
        ctx.fillStyle = color; 
        ctx.fill();
    }

    crystals.forEach(c => dot(c.x,c.y,c.type==='poison'?'#aa00ff':'#00ff00'));
    aiBlobs.forEach(b => dot(b.x,b.y,b.scaredTimer>0?'#ff9999':'#ff0000',b.radius*scale/2));
    meteors.forEach(m => dot(m.x,m.y,'#ff8800'));
    storms.forEach(s => dot(s.x,s.y,'rgba(255,0,0,0.5)',s.radius*scale/4));
    dot(player.x,player.y,player.poisoned?'#ff66ff':'white',player.radius*scale/2);
}

function drawUI() {
    ctx.setTransform(1,0,0,1,0,0);
    
    // Health bar with fixed width
    const healthPercent = Math.min(1, (player.radius - 8) / 32);
    const healthWidth = 200 * healthPercent;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 20, 204, 24);
    ctx.fillStyle = '#333333';
    ctx.fillRect(22, 22, 200, 20);
    ctx.fillStyle = healthPercent > 0.7 ? '#00ff00' : 
                   healthPercent > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillRect(22, 22, healthWidth, 20);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(22, 22, 200, 20);
    
    // Status text
    ctx.font = '16px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    
    const shieldText = `Shield: ${player.shield ? 'ON' : 'OFF'}`;
    const stealthText = `Stealth: ${player.stealth ? 'ON' : 'OFF'}`;
    const poisonText = `Poison: ${player.poisoned ? 'YES' : 'NO'}`;
    
    ctx.fillText(shieldText, 20, 60);
    ctx.fillText(stealthText, 20, 85);
    ctx.fillText(poisonText, 20, 110);
    
    // Size indicator
    ctx.fillText(`Size: ${player.radius.toFixed(1)}`, 20, 135);
}

function endGame() {
    document.getElementById('gameOver').style.display = 'flex';
    cancelAnimationFrame(animHandle);
}

function restartGame() { 
    location.reload(); 
}

let animHandle;
function gameLoop() { 
    update(); 
    draw(); 
    animHandle = requestAnimationFrame(gameLoop); 
}
gameLoop();