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
    dashTimer: 0
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
            radius: 10,
            speed: 1.2,
            target: null,
            scaredTimer: 0
        });
    }
}

createCrystals(50);
createAIBlobs(10);

function update() {
    handleMovement();

    // natural decay
    player.radius -= 0.0003; // reduced decay so longer survival
    if (player.radius < 8) endGame();

    // poison
    if (player.poisoned) {
        player.radius -= 0.002;
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

    let moveSpeed = player.speed * (10 / player.radius);
    if (player.dashTimer > 0) {
        moveSpeed *= 2;
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
        if (!blob.target || !crystals.includes(blob.target)) {
            blob.target = crystals[Math.floor(Math.random() * crystals.length)];
        }

        let dx = 0, dy = 0;
        let distToPlayer = Math.hypot(player.x - blob.x, player.y - blob.y);

        if (blob.scaredTimer > 0) {
            blob.scaredTimer--;
            dx = blob.x - player.x; dy = blob.y - player.y;
        } else if (blob.radius < player.radius * 0.8 && !player.stealth) {
            dx = player.x - blob.x; dy = player.y - blob.y;
        } else if (blob.radius > player.radius * 1.2 && !player.stealth) {
            dx = blob.x - player.x; dy = blob.y - player.y;
        } else if (blob.target) {
            dx = blob.target.x - blob.x; dy = blob.target.y - blob.y;
        }

        let dist = Math.hypot(dx, dy);
        if (dist > 1) {
            blob.x += (dx / dist) * blob.speed;
            blob.y += (dy / dist) * blob.speed;
        }

        if (distToPlayer < blob.radius + player.radius) {
            if (player.radius > blob.radius * 1.1) {
                player.radius += blob.radius * 0.5;
                aiBlobs.splice(aiBlobs.indexOf(blob), 1);
            } else if (blob.radius > player.radius * 1.1) {
                if (player.shield) player.shield = false;
                else {
                    player.radius -= blob.radius * 0.2;
                    blob.radius += 1;
                }
                blob.scaredTimer = 200;
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

    meteors.forEach(m => {
        m.x += m.dx; m.y += m.dy;
        if (Math.hypot(player.x - m.x, player.y - m.y) < player.radius+10) player.radius -= 0.5;
    });
    storms.forEach(s => {
        s.x += s.dx; s.y += s.dy;
        if (Math.hypot(player.x - s.x, player.y - s.y) < s.radius) player.radius -= 0.1;
    });
}

function updateMinions() {
    minions.length = 0;
    if (player.radius >= 25) {
        for (let i=0; i<3; i++) {
            let angle = (performance.now()/500 + i*2*Math.PI/3);
            minions.push({ x: player.x + Math.cos(angle)*(player.radius+15), y: player.y + Math.sin(angle)*(player.radius+15) });
        }
    }
    aiBlobs.forEach(blob => {
        minions.forEach(minion => {
            let dx = blob.x - minion.x, dy = blob.y - minion.y;
            let d = Math.hypot(dx,dy);
            if (d < 20) { blob.x += (dx/d)*2; blob.y += (dy/d)*2; }
        });
    });
}

function checkCollectCrystals() {
    for (let i=crystals.length-1; i>=0; i--) {
        let c = crystals[i];
        if (Math.hypot(c.x - player.x, c.y - player.y) < player.radius + c.radius) {
            if (c.type==='poison') {
                player.radius+=2;
                player.poisoned=true;
                player.poisonTimer=600;
            } else player.radius+=1;
            crystals.splice(i,1);
        }
    }
}

function createPing(x,y) { pings.push({x,y,radius:0}); }
function updatePings() {
    for (let i=pings.length-1; i>=0; i--) {
        pings[i].radius+=6;
        if (pings[i].radius>300) pings.splice(i,1);
    }
}

function draw() {
    let camX=player.x-canvas.width/2, camY=player.y-canvas.height/2;
    ctx.setTransform(1,0,0,1,-camX,-camY);
    ctx.clearRect(camX,camY,canvas.width,canvas.height);

    crystals.forEach(c=>{
        ctx.beginPath(); ctx.arc(c.x,c.y,c.radius,0,2*Math.PI);
        ctx.fillStyle=c.type==='poison'?'purple':'lime'; ctx.fill();
    });

    meteors.forEach(m=>{ctx.fillStyle='orange';ctx.beginPath();ctx.arc(m.x,m.y,10,0,2*Math.PI);ctx.fill();});
    storms.forEach(s=>{ctx.fillStyle='rgba(255,0,0,0.1)';ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,2*Math.PI);ctx.fill();});
    aiBlobs.forEach(b=>{ctx.fillStyle='red';ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,2*Math.PI);ctx.fill();});
    minions.forEach(m=>{ctx.fillStyle='white';ctx.beginPath();ctx.arc(m.x,m.y,3,0,2*Math.PI);ctx.fill();});
    ctx.fillStyle=player.poisoned?'pink':(player.stealth?'rgba(255,255,255,0.3)':'white');
    ctx.beginPath(); ctx.arc(player.x,player.y,player.radius,0,2*Math.PI); ctx.fill();

    drawFog(camX, camY);
    drawMiniMap();
    drawUI();
}

function drawFog(camX, camY) {
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(camX-50, camY-50, canvas.width+100, canvas.height+100);
    let grad=ctx.createRadialGradient(player.x,player.y,0,player.x,player.y,200);
    grad.addColorStop(0,'transparent'); grad.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle=grad; ctx.fillRect(camX-50, camY-50, canvas.width+100, canvas.height+100);
    pings.forEach(p=>{
        let g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.radius/2);
        g.addColorStop(0,'transparent'); g.addColorStop(1,'rgba(0,0,0,0.5)');
        ctx.fillStyle=g; ctx.fillRect(camX-50, camY-50, canvas.width+100, canvas.height+100);
    });
}

function drawMiniMap() {
    const scale = 150 / worldWidth;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(canvas.width-160,10,150,150);
    ctx.strokeStyle='white';
    ctx.strokeRect(canvas.width-160,10,150,150);

    function dot(x,y,color,r=2) {
        ctx.beginPath(); ctx.arc(canvas.width-160+x*scale,10+y*scale,r,0,2*Math.PI);
        ctx.fillStyle=color; ctx.fill();
    }

    crystals.forEach(c=> dot(c.x,c.y,'lime'));
    aiBlobs.forEach(b=> dot(b.x,b.y,'red'));
    meteors.forEach(m=> dot(m.x,m.y,'orange'));
    storms.forEach(s=> dot(s.x,s.y,'rgba(255,0,0,0.5)',4));
    dot(player.x,player.y,'white',3);
}

function drawUI() {
    ctx.fillStyle='white';
    ctx.fillRect(20,20,200,20);
    ctx.fillStyle='green';
    ctx.fillRect(20,20,Math.max(0,(player.radius-8)/32*200),20);
    ctx.strokeStyle='white';
    ctx.strokeRect(20,20,200,20);
    ctx.fillStyle='white';
    ctx.fillText(`Shield:${player.shield?'ON':'OFF'} Stealth:${player.stealth?'ON':'OFF'} Poison:${player.poisoned?'YES':'NO'}`,20,60);
}

function endGame(){
    document.getElementById('gameOver').style.display='flex';
    cancelAnimationFrame(animHandle);
}

function restartGame(){ location.reload(); }

let animHandle;
function gameLoop(){ update(); draw(); animHandle=requestAnimationFrame(gameLoop); }
gameLoop();
