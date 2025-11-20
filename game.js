const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.4;
const JUMP_FORCE = -7;
const GAME_SPEED_INITIAL = 4;
const SPAWN_RATE_OBSTACLE = 150; // Frames
const SPAWN_RATE_TOKEN = 100; // Frames

// Game State
let gameSpeed = GAME_SPEED_INITIAL;
let score = 0;
let highScore = localStorage.getItem('dolphinDashHighScore') || 0;
let frameCount = 0;
let isGameOver = false;
let isPlaying = false;
let isPaused = false;
let isFirstPerson = false;
let cameraShake = 0;
let animationId;

// Assets
const dolphinImg = new Image();
dolphinImg.src = 'assets/dolphin.svg';

const dolphinBackImg = new Image();
dolphinBackImg.src = 'assets/dolphin_back.svg';

const boatSources = [
    'assets/boat.svg',
    'assets/boat_sail_blue.svg',
    'assets/boat_sail_red.svg',
    'assets/boat_power_white.svg',
    'assets/boat_power_yellow.svg'
];
const boatImages = boatSources.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

const tokenImg = new Image();
tokenImg.src = 'assets/token.svg';

const bgImg = new Image();
bgImg.src = 'assets/background.svg';

// New obstacle types
const birdImg = new Image();
birdImg.src = 'assets/bird.svg';
birdImg.onerror = function() {
    // Fallback: mark as not loaded to use colored shape
    this.loaded = false;
};
birdImg.onload = function() {
    this.loaded = true;
};

const birdFrontImg = new Image();
birdFrontImg.src = 'assets/bird_front.svg';
birdFrontImg.onerror = function() {
    this.loaded = false;
};
birdFrontImg.onload = function() {
    this.loaded = true;
};

const fishImg = new Image();
fishImg.src = 'assets/fish2.svg';
fishImg.onerror = function() {
    this.loaded = false;
};
fishImg.onload = function() {
    this.loaded = true;
};

const fishFrontImg = new Image();
fishFrontImg.src = 'assets/fish_front.svg';
fishFrontImg.onerror = function() {
    this.loaded = false;
};
fishFrontImg.onload = function() {
    this.loaded = true;
};

const trolleyImg = new Image();
trolleyImg.src = 'assets/trolley.svg';
trolleyImg.onerror = function() {
    this.loaded = false;
};
trolleyImg.onload = function() {
    this.loaded = true;
};

const trolleyFrontImg = new Image();
trolleyFrontImg.src = 'assets/trolley_front.svg';
trolleyFrontImg.onerror = function() {
    this.loaded = false;
};
trolleyFrontImg.onload = function() {
    this.loaded = true;
};

const boatFrontImg = new Image();
boatFrontImg.src = 'assets/boat_front.svg';
boatFrontImg.onerror = function() {
    this.loaded = false;
};
boatFrontImg.onload = function() {
    this.loaded = true;
};

// Entities
let dolphin;
let obstacles = [];
let tokens = [];
let particles = [];
let background;
let soundController;

// Inputs
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const scoreSpan = document.getElementById('score');
const finalScoreSpan = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('high-score-display');
const highScoreSpan = document.getElementById('high-score');
const viewToggleBtn = document.getElementById('view-toggle-btn');
// Resize Canvas
function resize() {
    canvas.width = 800;
    canvas.height = 450;
}
resize();

class SoundController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playTone(freq, type, duration) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    jump() { this.playTone(400, 'sine', 0.1); }
    collect() { this.playTone(800, 'sine', 0.1); this.playTone(1200, 'sine', 0.1); }
    gameOver() { this.playTone(150, 'sawtooth', 0.5); }
}

class Background {
    constructor() {
        this.x = 0;
        this.width = 800; // Assuming SVG is designed for this width or scalable
        this.speed = 1; // Parallax factor
        this.waterParticles = [];
        this.initWaterParticles();
    }
    
    initWaterParticles() {
        // Create floating particles for first-person water effect
        for (let i = 0; i < 30; i++) {
            this.waterParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 3 + 1,
                speed: Math.random() * 2 + 1,
                opacity: Math.random() * 0.3 + 0.1
            });
        }
    }

    update() {
        const parallaxFactor = isFirstPerson ? 0.8 : 0.5;
        this.x -= gameSpeed * parallaxFactor;
        if (this.x <= -this.width) {
            this.x = 0;
        }
        
        // Update water particles for first-person mode
        if (isFirstPerson) {
            this.waterParticles.forEach(particle => {
                particle.x -= gameSpeed * particle.speed;
                if (particle.x < -10) {
                    particle.x = canvas.width + 10;
                    particle.y = Math.random() * canvas.height;
                }
            });
        }
    }

    draw() {
        if (isFirstPerson) {
            this.drawFirstPersonBackground();
        } else {
            this.drawThirdPersonBackground();
        }
    }
    
    drawThirdPersonBackground() {
        // Original side-scrolling background
        ctx.drawImage(bgImg, this.x, 0, this.width, canvas.height);
        ctx.drawImage(bgImg, this.x + this.width, 0, this.width, canvas.height);
    }
    
    drawFirstPersonBackground() {
        // Camera offset based on dolphin position
        const cameraOffsetY = (dolphin.y - canvas.height / 1);
        
        // Water surface Y position in screen space (bottom 3/5ths = water, top 2/5ths = sky)
        // In first-person: water naturally at 2/5 from top (180px at 450px height)
        const waterSurfaceY = (canvas.height * 1 / 6) - cameraOffsetY;
        
        // Draw sky (above water)
        const skyGradient = ctx.createLinearGradient(0, 0, 0, waterSurfaceY);
        skyGradient.addColorStop(0, '#87CEEB'); // Light sky blue
        skyGradient.addColorStop(0.6, '#B0D4F1'); // Lighter blue
        skyGradient.addColorStop(1, '#C9E6FF'); // Very light blue near surface
        
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, canvas.width, Math.max(0, waterSurfaceY));
        
        // Draw water (below surface)
        if (waterSurfaceY < canvas.height) {
            const waterGradient = ctx.createLinearGradient(0, waterSurfaceY, 0, canvas.height);
            waterGradient.addColorStop(0, '#0099cc'); // Surface water
            waterGradient.addColorStop(0.3, '#0077b6'); // Mid ocean blue
            waterGradient.addColorStop(1, '#004466'); // Deep blue
            
            ctx.fillStyle = waterGradient;
            ctx.fillRect(0, Math.max(0, waterSurfaceY), canvas.width, canvas.height - Math.max(0, waterSurfaceY));
        }
        
        // Draw clouds in sky
        this.drawClouds(cameraOffsetY, waterSurfaceY);
        
        // Draw light rays only when looking up (near surface)
        if (waterSurfaceY > 0 && waterSurfaceY < canvas.height * 0.8) {
            this.drawLightRays(waterSurfaceY);
        }
        
        // Draw water surface line with waves
        if (waterSurfaceY > 0 && waterSurfaceY < canvas.height) {
            this.drawWaterSurface(waterSurfaceY);
        }
        
        // Draw water particles only in water section
        this.drawWaterParticles(cameraOffsetY, waterSurfaceY);
        
        // Draw water layers only in water section
        this.drawWaterLayers(cameraOffsetY, waterSurfaceY);
    }
    
    drawClouds(cameraOffsetY, waterSurfaceY) {
        // Only draw clouds if we can see sky
        if (waterSurfaceY <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = 0.6;
        
        // Create a few clouds that move slowly
        const cloudCount = 4;
        for (let i = 0; i < cloudCount; i++) {
            const cloudX = ((frameCount * 0.3 + i * 200) % (canvas.width + 200)) - 100;
            const cloudY = (i * 60 + 30) - (cameraOffsetY * 0.5); // Parallax with camera
            
            // Only draw if in sky section
            if (cloudY < waterSurfaceY && cloudY > -50) {
                ctx.fillStyle = '#FFFFFF';
                // Simple cloud shape with circles
                ctx.beginPath();
                ctx.arc(cloudX, cloudY, 30, 0, Math.PI * 2);
                ctx.arc(cloudX + 25, cloudY - 10, 25, 0, Math.PI * 2);
                ctx.arc(cloudX + 50, cloudY, 30, 0, Math.PI * 2);
                ctx.arc(cloudX + 35, cloudY + 10, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
    
    drawWaterSurface(surfaceY) {
        ctx.save();
        ctx.strokeStyle = '#1E90FF';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        
        // Draw wavy water surface line
        for (let x = 0; x <= canvas.width; x += 5) {
            const waveHeight = Math.sin(x * 0.02 + frameCount * 0.1) * 5 + Math.sin(x * 0.05 + frameCount * 0.05) * 3;
            const y = surfaceY + waveHeight;
            
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.restore();
    }
    
    drawLightRays(surfaceY) {
        ctx.save();
        const rayCount = 5;
        const centerX = canvas.width / 2;
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i - rayCount / 2) * 0.15;
            const rayWidth = 40 + Math.sin(frameCount * 0.02 + i) * 10;
            const rayLength = canvas.height - surfaceY + 100;
            
            ctx.globalAlpha = 0.08 + Math.sin(frameCount * 0.03 + i) * 0.03;
            
            ctx.save();
            ctx.translate(centerX + Math.sin(frameCount * 0.01 + i) * 50, surfaceY);
            ctx.rotate(angle);
            
            // Create gradient for ray starting from surface
            const rayGradient = ctx.createLinearGradient(0, 0, 0, rayLength);
            rayGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
            rayGradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.15)');
            rayGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = rayGradient;
            ctx.fillRect(-rayWidth / 2, 0, rayWidth, rayLength);
            ctx.restore();
        }
        ctx.restore();
    }
    
    drawWaterParticles(cameraOffsetY, waterSurfaceY) {
        ctx.save();
        
        this.waterParticles.forEach(particle => {
            // Calculate particle position with parallax
            const particleY = particle.y - (cameraOffsetY * 0.3);
            
            // Only draw particles in water section
            if (particleY > waterSurfaceY) {
                ctx.globalAlpha = particle.opacity;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(particle.x, particleY, particle.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
    
    drawWaterLayers(cameraOffsetY, waterSurfaceY) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        const layerCount = 3;
        
        for (let i = 0; i < layerCount; i++) {
            const baseY = (canvas.height / layerCount) * i + (frameCount * 0.5 + i * 50) % (canvas.height / layerCount);
            const y = baseY - (cameraOffsetY * 0.2);
            
            // Only draw layers in water section
            if (y > waterSurfaceY) {
                ctx.strokeStyle = '#87CEEB';
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                // Draw wavy line
                for (let x = 0; x < canvas.width; x += 5) {
                    const waveY = y + Math.sin(x * 0.02 + frameCount * 0.05 + i) * 10;
                    if (x === 0) {
                        ctx.moveTo(x, waveY);
                    } else {
                        ctx.lineTo(x, waveY);
                    }
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.color = color;
        this.life = 1.0;
        // For first-person depth effect
        this.depth = 0;
        this.initialSize = this.size;
    }

    update() {
        if (isFirstPerson) {
            // In first person, particles move toward camera (grow larger)
            this.depth += 0.02;
            this.size = this.initialSize * (1 + this.depth * 3); // Grow as they approach
            this.x += this.speedX * 0.5; // Minimal horizontal drift
            this.y += this.speedY * 0.5; // Minimal vertical drift
        } else {
            // In third person, move with world
            this.x += this.speedX - gameSpeed;
            this.y += this.speedY;
        }
        this.life -= 0.02;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Dolphin {
    constructor() {
        this.width = 80;
        this.height = 40;
        this.x = 100;
        this.y = canvas.height / 2;
        this.velocity = 0;
    }

    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Floor Collision
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocity = 0;
        }

        // Ceiling Collision
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
    }

    draw() {
        if (isFirstPerson) {
            // Draw dolphin from behind in center of screen to show hitbox position
            const centerX = canvas.width / 2 - this.width / 2;
            const centerY = canvas.height / 2 - this.height / 2;
            
            ctx.save();
            ctx.globalAlpha = 0.7; // Semi-transparent so you can see through it
            // Use back view image if loaded, otherwise use side view
            const imgToUse = dolphinBackImg.complete && dolphinBackImg.naturalHeight !== 0 ? dolphinBackImg : dolphinImg;
            ctx.drawImage(imgToUse, centerX, centerY, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(dolphinImg, this.x, this.y, this.width, this.height);
        }
    }

    jump() {
        this.velocity = JUMP_FORCE;
        soundController.jump();
        
        // Add camera shake in first person mode
        if (isFirstPerson) {
            cameraShake = 10;
        }
        
        // // Create bubbles
        // const bubbleX = isFirstPerson ? canvas.width / 2 : this.x + 20;
        // const bubbleY = isFirstPerson ? canvas.height / 2 + 30 : this.y + 30;
        // for (let i = 0; i < 5; i++) {
        //     particles.push(new Particle(bubbleX, bubbleY, 'rgba(255, 255, 255, 0.8)'));
        // }
    }
}

class Obstacle {
    constructor(type = null) {
        // If no type specified, default to boat
        if (!type) {
            type = 'boat';
        }
        
        this.type = type;
        this.markedForDeletion = false;
        this.x = canvas.width;
        this.depth = 0; // First-person depth tracking
        
        // Define zones based on current view mode
        let spawnZones;
        
        if (isFirstPerson) {
            // First-person zones (water at bottom 3/5ths = top 2/5ths is sky)
            spawnZones = {
                BIRD_ZONE: { min: 0, max: 180 },        // Top 2/5ths
                BOAT_ZONE: { min: 180, max: 270 },      // Middle 5th (at water surface)
                FISH_ZONE: { min: 180, max: 450 }       // Bottom 3/5ths (in water)
            };
        } else {
            // Third-person zones (traditional side view)
            spawnZones = {
                BIRD_ZONE: { min: 0, max: 300 },        // Top 2/3rds
                BOAT_ZONE: { min: 270, max: 360 },      // Between 3/5 and 4/5 from top
                FISH_ZONE: { min: 300, max: 450 }       // Bottom third
            };
        }
        
        // Set properties based on type
        switch(type) {
            case 'bird':
                this.width = 60;
                this.height = 40;
                this.image = birdImg;
                this.color = '#8B4513'; // Brown fallback
                // Spawn in bird zone
                this.y = Math.random() * (spawnZones.BIRD_ZONE.max - spawnZones.BIRD_ZONE.min - this.height) + spawnZones.BIRD_ZONE.min;
                break;
                
            case 'fish':
                this.width = 70;
                this.height = 35;
                this.image = fishImg;
                this.color = '#FF6347'; // Orange-red fallback
                // Spawn in fish zone
                this.y = Math.random() * (spawnZones.FISH_ZONE.max - spawnZones.FISH_ZONE.min - this.height) + spawnZones.FISH_ZONE.min;
                break;
                
            case 'trolley':
                this.width = 80;
                this.height = 80;
                this.image = trolleyImg;
                this.color = '#C0C0C0'; // Silver fallback
                // Spawn in fish zone (same as fish)
                this.y = Math.random() * (spawnZones.FISH_ZONE.max - spawnZones.FISH_ZONE.min - this.height) + spawnZones.FISH_ZONE.min;
                break;
                
            case 'boat':
            default:
                this.width = 100;
                this.height = 60;
                this.image = boatImages[Math.floor(Math.random() * boatImages.length)];
                this.color = '#4169E1'; // Royal blue fallback
                // Spawn in boat zone
                this.y = Math.random() * (spawnZones.BOAT_ZONE.max - spawnZones.BOAT_ZONE.min - this.height) + spawnZones.BOAT_ZONE.min;
                break;
        }
    }

    update() {
        if (isFirstPerson) {
            // In first person, move toward camera (increase depth) - even slower for better gameplay
            this.depth += gameSpeed * 0.003;
            if (this.depth > 1.2) this.markedForDeletion = true;
        } else {
            // In third person, move left
            this.x -= gameSpeed;
            if (this.x + this.width < 0) this.markedForDeletion = true;
        }
    }

    draw() {
        if (isFirstPerson) {
            // Calculate perspective based on depth
            const scale = 0.2 + (this.depth * 2); // Scale from 0.2x to 2.2x
            const alpha = Math.max(0.2, Math.min(1, this.depth + 0.3));
            
            // Calculate scaled dimensions
            const scaledWidth = this.width * scale;
            const scaledHeight = this.height * scale;
            
            // Position in center horizontally
            const centerX = canvas.width / 2 - scaledWidth / 2;
            
            // Apply camera offset based on dolphin position
            const cameraOffsetY = (dolphin.y - canvas.height / 2);
            const adjustedY = this.y - cameraOffsetY;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Use front-facing images for first-person view
            let imageToUse = this.image;
            if (this.type === 'bird' && birdFrontImg.loaded !== false) {
                imageToUse = birdFrontImg;
            } else if (this.type === 'fish' && fishFrontImg.loaded !== false) {
                imageToUse = fishFrontImg;
            } else if (this.type === 'trolley' && trolleyFrontImg.loaded !== false) {
                imageToUse = trolleyFrontImg;
            } else if (this.type === 'boat' && boatFrontImg.loaded !== false) {
                imageToUse = boatFrontImg;
            }
            
            // Draw image if loaded, otherwise draw colored shape
            if (imageToUse && imageToUse.loaded !== false) {
                ctx.drawImage(imageToUse, centerX, adjustedY, scaledWidth, scaledHeight);
            } else {
                // Fallback colored shape
                ctx.fillStyle = this.color;
                ctx.fillRect(centerX, adjustedY, scaledWidth, scaledHeight);
            }
            ctx.restore();
        } else {
            // Third person view - use side-view images
            if (this.image && this.image.loaded !== false) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                // Fallback colored shape
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
    }
    
    // Helper method to get collision bounds based on view mode
    getBounds() {
        if (isFirstPerson) {
            const scale = 0.2 + (this.depth * 2);
            const scaledWidth = this.width * scale;
            const scaledHeight = this.height * scale;
            const centerX = canvas.width / 2 - scaledWidth / 2;
            const cameraOffsetY = (dolphin.y - canvas.height / 2);
            const adjustedY = this.y - cameraOffsetY;
            
            return {
                x: centerX,
                y: adjustedY,
                width: scaledWidth,
                height: scaledHeight,
                depth: this.depth
            };
        }
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

class Token {
    constructor() {
        this.size = 40;
        this.x = canvas.width;
        this.y = Math.random() * (canvas.height - this.size * 2) + this.size;
        this.markedForDeletion = false;
        this.oscillation = Math.random() * Math.PI * 2;
        // First-person depth tracking
        this.depth = 0; // 0 = far, 1 = at camera
    }

    update() {
        this.oscillation += 0.1;
        const bobbing = Math.sin(this.oscillation) * 0.5;
        
        if (isFirstPerson) {
            // In first person, move toward camera (increase depth) - even slower for better gameplay
            this.depth += gameSpeed * 0.003;
            this.y += bobbing; // Keep bobbing effect
            if (this.depth > 1.2) this.markedForDeletion = true;
        } else {
            // In third person, move left
            this.x -= gameSpeed;
            this.y += bobbing;
            if (this.x + this.size < 0) this.markedForDeletion = true;
        }
    }

    draw() {
        if (isFirstPerson) {
            // Calculate perspective based on depth
            const scale = 0.2 + (this.depth * 2); // Scale from 0.2x to 2.2x
            const alpha = Math.max(0.2, Math.min(1, this.depth + 0.3));
            
            // Calculate scaled dimensions
            const scaledSize = this.size * scale;
            
            // Position in center horizontally
            const centerX = canvas.width / 2 - scaledSize / 2;
            
            // Apply camera offset based on dolphin position
            const cameraOffsetY = (dolphin.y - canvas.height / 2);
            const adjustedY = this.y - cameraOffsetY;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(tokenImg, centerX, adjustedY, scaledSize, scaledSize);
            ctx.restore();
        } else {
            ctx.drawImage(tokenImg, this.x, this.y, this.size, this.size);
        }
    }
    
    // Helper method to get collision bounds based on view mode
    getBounds() {
        if (isFirstPerson) {
            const scale = 0.2 + (this.depth * 2);
            const scaledSize = this.size * scale;
            const centerX = canvas.width / 2 - scaledSize / 2;
            const cameraOffsetY = (dolphin.y - canvas.height / 2);
            const adjustedY = this.y - cameraOffsetY;
            
            return {
                x: centerX,
                y: adjustedY,
                size: scaledSize,
                depth: this.depth
            };
        }
        return {
            x: this.x,
            y: this.y,
            size: this.size
        };
    }
}

function init() {
    dolphin = new Dolphin();
    obstacles = [];
    tokens = [];
    particles = [];
    background = new Background();
    soundController = new SoundController();
    score = 0;
    gameSpeed = GAME_SPEED_INITIAL;
    frameCount = 0;
    isGameOver = false;
    isPaused = false;
    cameraShake = 0;
    scoreSpan.innerText = score;
    highScoreSpan.innerText = highScore;
}

function toggleFirstPerson() {
    isFirstPerson = !isFirstPerson;
    viewToggleBtn.textContent = isFirstPerson ? 'Change View (V)' : 'Change View (V)';
    viewToggleBtn.classList.toggle('active', isFirstPerson);
    soundController.playTone(600, 'sine', 0.1);
}

function handleInput(e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
        return;
    }
    if (e.code === 'KeyV' && isPlaying && !isPaused && !isGameOver) {
        toggleFirstPerson();
        return;
    }
    if ((e.code === 'Space' || e.type === 'click') && isPlaying && !isPaused) {
        dolphin.jump();
    }
}

function togglePause() {
    if (!isPlaying || isGameOver) return;
    isPaused = !isPaused;
    if (!isPaused) {
        animate();
    } else {
        // Draw Pause Screen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }
}

function checkCollisions() {
    // Draw player hitbox for visualization
    // drawPlayerHitbox();
    
    // Obstacles (Simple AABB)
    obstacles.forEach(obstacle => {
        // Draw obstacle hitbox for visualization
        //drawObstacleHitbox(obstacle);
        
        if (isFirstPerson) {
            // In first person, check collision when object reaches camera (depth > 0.8)
            const obstacleBounds = obstacle.getBounds();
            
            // Collision happens when object is close enough (depth > 0.8) and overlaps with center screen
            if (obstacleBounds.depth > 0.8) {
                // Check if obstacle overlaps with dolphin hitbox (matches sprite size)
                const cameraY = canvas.height / 2;
                const dolphinHitboxWidth = dolphin.width; // 80
                const dolphinHitboxHeight = dolphin.height; // 40
                const hitboxLeft = canvas.width / 2 - dolphinHitboxWidth / 2;
                const hitboxRight = canvas.width / 2 + dolphinHitboxWidth / 2;
                const hitboxTop = cameraY - dolphinHitboxHeight / 2;
                const hitboxBottom = cameraY + dolphinHitboxHeight / 2;
                
                if (
                    obstacleBounds.x < hitboxRight &&
                    obstacleBounds.x + obstacleBounds.width > hitboxLeft &&
                    obstacleBounds.y < hitboxBottom &&
                    obstacleBounds.y + obstacleBounds.height > hitboxTop
                ) {
                    gameOver();
                }
            }
        } else {
            // Shrink hitbox slightly for better feel
            const hitX = dolphin.x + 10;
            const hitY = dolphin.y + 10;
            const hitW = dolphin.width - 20;
            const hitH = dolphin.height - 20;

            if (
                hitX < obstacle.x + obstacle.width &&
                hitX + hitW > obstacle.x &&
                hitY < obstacle.y + obstacle.height &&
                hitY + hitH > obstacle.y
            ) {
                gameOver();
            }
        }
    });

    // Tokens
    tokens.forEach((token, index) => {
        // Draw token hitbox for visualization
        //drawTokenHitbox(token);
        
        if (isFirstPerson) {
            // In first person, check collision when token is close enough
            const tokenBounds = token.getBounds();
            
            // Collision happens when token is in collectible range (depth 0.7-1.0)
            if (tokenBounds.depth > 0.7 && tokenBounds.depth < 1.0) {
                // Check if token overlaps with dolphin hitbox (matches sprite size)
                const cameraY = canvas.height / 2;
                const dolphinHitboxWidth = dolphin.width; // 80
                const dolphinHitboxHeight = dolphin.height; // 40
                const hitboxLeft = canvas.width / 2 - dolphinHitboxWidth / 2;
                const hitboxRight = canvas.width / 2 + dolphinHitboxWidth / 2;
                const hitboxTop = cameraY - dolphinHitboxHeight / 2;
                const hitboxBottom = cameraY + dolphinHitboxHeight / 2;
                
                if (
                    tokenBounds.x < hitboxRight &&
                    tokenBounds.x + tokenBounds.size > hitboxLeft &&
                    tokenBounds.y < hitboxBottom &&
                    tokenBounds.y + tokenBounds.size > hitboxTop
                ) {
                    tokens.splice(index, 1);
                    score += 10;
                    scoreSpan.innerText = score;
                    soundController.collect();
                    // Sparkles at center
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(canvas.width / 2, canvas.height / 2, '#ffd700'));
                    }
                }
            }
        } else {
            if (
                dolphin.x < token.x + token.size &&
                dolphin.x + dolphin.width > token.x &&
                dolphin.y < token.y + token.size &&
                dolphin.y + dolphin.height > token.y
            ) {
                tokens.splice(index, 1);
                score += 10;
                scoreSpan.innerText = score;
                soundController.collect();
                // // Sparkles
                // for (let i = 0; i < 8; i++) {
                //     particles.push(new Particle(token.x + token.size / 2, token.y + token.size / 2, '#ffd700'));
                // }
            }
        }
    });
}

function drawPlayerHitbox() {
    ctx.save();
    ctx.strokeStyle = '#00FF00'; // Green for player
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    
    if (isFirstPerson) {
        // Draw hitbox matching dolphin sprite size (80x40)
        const cameraY = canvas.height / 2;
        const hitboxWidth = dolphin.width; // 80
        const hitboxHeight = dolphin.height; // 40
        const hitboxLeft = canvas.width / 2 - hitboxWidth / 2;
        const hitboxTop = cameraY - hitboxHeight / 2;
        
        ctx.strokeRect(hitboxLeft, hitboxTop, hitboxWidth, hitboxHeight);
        
        // Draw crosshair at center
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 10, canvas.height / 2);
        ctx.lineTo(canvas.width / 2 + 10, canvas.height / 2);
        ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10);
        ctx.stroke();
    } else {
        // Draw dolphin hitbox (shrunk)
        const hitX = dolphin.x + 10;
        const hitY = dolphin.y + 10;
        const hitW = dolphin.width - 20;
        const hitH = dolphin.height - 20;
        
        ctx.strokeRect(hitX, hitY, hitW, hitH);
    }
    ctx.restore();
}

function drawObstacleHitbox(obstacle) {
    const bounds = obstacle.getBounds();
    
    ctx.save();
    ctx.strokeStyle = '#FF0000'; // Red for obstacles
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    
    if (isFirstPerson && bounds.depth) {
        // Show depth-based color intensity
        const depthAlpha = Math.min(bounds.depth, 1);
        ctx.globalAlpha = 0.3 + (depthAlpha * 0.4);
        
        // Change color based on collision proximity
        if (bounds.depth > 0.8) {
            ctx.strokeStyle = '#FF0000'; // Bright red when in collision range
        } else {
            ctx.strokeStyle = '#FFAA00'; // Orange when approaching
        }
    }
    
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
}

function drawTokenHitbox(token) {
    const bounds = token.getBounds();
    
    ctx.save();
    ctx.strokeStyle = '#FFFF00'; // Yellow for tokens
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    
    if (isFirstPerson && bounds.depth) {
        // Change color based on collection proximity
        if (bounds.depth > 0.7 && bounds.depth < 1.0) {
            ctx.strokeStyle = '#00FF00'; // Green when collectible
            ctx.globalAlpha = 0.7;
        } else {
            ctx.strokeStyle = '#FFFF00'; // Yellow when not yet collectible
        }
        
        if (bounds.size) {
            ctx.strokeRect(bounds.x, bounds.y, bounds.size, bounds.size);
        }
    } else {
        ctx.strokeRect(bounds.x, bounds.y, bounds.size, bounds.size);
    }
    ctx.restore();
}

function gameOver() {
    isGameOver = true;
    isPlaying = false;
    soundController.gameOver();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('dolphinDashHighScore', highScore);
        highScoreSpan.innerText = highScore;
    }

    finalScoreSpan.innerText = score;
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
    scoreDisplay.classList.add('hidden');
    highScoreDisplay.classList.add('hidden');
    viewToggleBtn.classList.add('hidden');
    cancelAnimationFrame(animationId);
}

function drawSpeedLines() {
    ctx.save();
    const lineCount = 15;
    const speedFactor = gameSpeed / GAME_SPEED_INITIAL;
    
    for (let i = 0; i < lineCount; i++) {
        const y = (frameCount * 5 + i * (canvas.height / lineCount)) % canvas.height;
        const length = 50 + Math.random() * 100;
        const x = canvas.width - length;
        const opacity = 0.1 + (Math.random() * 0.15 * speedFactor);
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawVignette() {
    ctx.save();
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0, 31, 63, 0)');
    gradient.addColorStop(1, 'rgba(0, 31, 63, 0.4)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function animate() {
    if (!isPlaying || isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply camera shake in first person
    if (isFirstPerson && cameraShake > 0) {
        ctx.save();
        const shakeX = (Math.random() - 0.5) * cameraShake;
        const shakeY = (Math.random() - 0.5) * cameraShake;
        ctx.translate(shakeX, shakeY);
        cameraShake *= 0.9; // Decay shake
        if (cameraShake < 0.1) cameraShake = 0;
    }

    // Draw Background
    background.update();
    background.draw();
    
    // Add speed lines in first person mode
    if (isFirstPerson) {
        drawSpeedLines();
    }

    // Update & Draw Dolphin
    dolphin.update();
    dolphin.draw();

    // Handle Obstacles
    // Dynamic spawn rate: Spawn faster as speed increases
    // Base rate 150, decreases as gameSpeed increases
    const currentSpawnRate = Math.max(60, Math.floor(SPAWN_RATE_OBSTACLE - (gameSpeed * 10)));

    if (frameCount % currentSpawnRate === 0) {
        // Randomly select obstacle type based on zones
        // Top third: 33% chance - Birds
        // Middle third: 33% chance - Boats
        // Bottom third: 34% chance - Fish (mostly) or Trolley (5% rare)
        
        const rand = Math.random();
        let obstacleType;
        
        if (rand < 0.33) {
            // Top third - Birds
            obstacleType = 'bird';
        } else if (rand < 0.66) {
            // Middle third - Boats
            obstacleType = 'boat';
        } else {
            // Bottom third - Fish or Trolley
            // 5% chance for trolley when in bottom third
            if (Math.random() < 0.05) {
                obstacleType = 'trolley';
            } else {
                obstacleType = 'fish';
            }
        }
        
        obstacles.push(new Obstacle(obstacleType));
    }
    obstacles.forEach((obstacle, index) => {
        obstacle.update();
        obstacle.draw();
        if (obstacle.markedForDeletion) obstacles.splice(index, 1);
    });

    // Handle Tokens
    if (frameCount % SPAWN_RATE_TOKEN === 0) {
        tokens.push(new Token());
    }
    tokens.forEach((token, index) => {
        token.update();
        token.draw();
        if (token.markedForDeletion) tokens.splice(index, 1);
    });

    // Handle Particles
    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();
        if (particle.life <= 0) particles.splice(index, 1);
    });
    
    // Add vignette effect in first person mode
    if (isFirstPerson) {
        drawVignette();
    }

    // Restore after camera shake
    if (isFirstPerson && cameraShake >= 0) {
        ctx.restore();
    }

    checkCollisions();

    frameCount++;
    gameSpeed += 0.001; // Slowly increase speed

    animationId = requestAnimationFrame(animate);
}

function startGame() {
    init();
    isPlaying = true;
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    highScoreDisplay.classList.remove('hidden');
    viewToggleBtn.classList.remove('hidden');
    animate();
}

// Event Listeners
window.addEventListener('keydown', handleInput);
canvas.addEventListener('click', handleInput);
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
viewToggleBtn.addEventListener('click', toggleFirstPerson);
