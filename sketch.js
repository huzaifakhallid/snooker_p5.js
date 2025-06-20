// --- Matter.js Modules ---
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Query = Matter.Query;

// --- Global Variables ---
let engine;
let world;

// --- Game Objects ---
let cueBall;
let reds = [];
let colours = [];
let cue;

// --- Game State Management ---
let gameState = 'PLACING_CUE_BALL';
let score = 0;
let targetBallType = 'red';
let firstHitTypeThisTurn = null;
let pottedBallsThisTurn = [];
let lastCollisionMsg = "";

// --- UI & Timers ---
let splashMessage = { text: '', endTime: 0 };
let gameEndTime = 0;
const GAME_DURATION_MS = 10 * 60 * 1000;

// --- Sound Files ---
let sounds = {};

const config = {
    canvasWidth: 1400,
    canvasHeight: 800,
    tableWidth: 1200,
    tableHeight: 600,
    cushionWidth: 30,
    ballDiameter: 0,
    pocketDiameter: 0,
    maxPower: 30,
    pockets: [],
    spots: [],
    ballColors: {
        cue:    { color: [255, 255, 255], value: 0 },
        red:    { color: [220, 20, 60],   value: 1 },
        yellow: { color: [255, 255, 0],   value: 2 },
        green:  { color: [0, 128, 0],     value: 3 },
        brown:  { color: [139, 69, 19],   value: 4 },
        blue:   { color: [0, 0, 255],     value: 5 },
        pink:   { color: [255, 105, 180], value: 6 },
        black:  { color: [20, 20, 20],    value: 7 }
    }
};

class Ball {
    constructor(x, y, config, type, typeInfo, world) {
        this.config = config;
        this.type = type;
        this.value = typeInfo.value;
        this.color = typeInfo.color;
        this.isPotted = false;
        this.world = world;

        const options = {
            restitution: 0.8,
            friction: 0.02,
            frictionAir: 0.015,
            density: 0.05,
            sleepThreshold: 12,
            label: type + 'Ball'
        };
        this.body = Bodies.circle(x, y, this.config.ballDiameter / 2, options);
    }

    show() {
        if (this.body && !this.isPotted) {
            const pos = this.body.position;
            const angle = this.body.angle;
            push();
            translate(pos.x, pos.y);
            rotate(angle);
            fill(this.color);
            stroke(0);
            strokeWeight(1);
            ellipse(0, 0, this.config.ballDiameter);
            stroke(255, 255, 255, 100);
            line(0, 0, this.config.ballDiameter / 2, 0);
            pop();
        }
    }

    checkPotted(pockets) {
        if (!this.body || this.isPotted) return false;
        const pos = this.body.position;
        for (let pocket of pockets) {
            if (dist(pos.x, pos.y, pocket.x, pocket.y) < this.config.pocketDiameter / 1.8) {
                this.isPotted = true;
                return true;
            }
        }
        return false;
    }

    removeFromWorld() {
        if (this.body) {
            World.remove(this.world, this.body);
            this.body = null;
        }
    }

    respot(allCurrentBallPositions) {
        const originalSpot = this.config.spots.find(s => s.type === this.type);
        if (!originalSpot) return;

        let spotPosition = { x: originalSpot.x, y: originalSpot.y };
        let isSpotOccupied = allCurrentBallPositions.some(p => dist(p.x, p.y, spotPosition.x, spotPosition.y) < this.config.ballDiameter);

        if (isSpotOccupied) {
            const availableSpots = this.config.spots
                .sort((a, b) => this.config.ballColors[b.type].value - this.config.ballColors[a.type].value)
                .filter(spot => !allCurrentBallPositions.some(p => dist(p.x, p.y, spot.x, spot.y) < this.config.ballDiameter));

            if (availableSpots.length > 0) {
                spotPosition = { x: availableSpots[0].x, y: availableSpots[0].y };
            } else {
                let pinkSpot = this.config.spots.find(s => s.type === 'pink');
                let newX = pinkSpot.x + this.config.ballDiameter;
                let newY = pinkSpot.y;
                while (allCurrentBallPositions.some(p => dist(p.x, p.y, newX, newY) < this.config.ballDiameter)) {
                    newX += this.config.ballDiameter;
                }
                spotPosition = { x: newX, y: newY };
            }
        }

        this.isPotted = false;
        const options = { restitution: 0.8, friction: 0.02, frictionAir: 0.015, density: 0.05, sleepThreshold: 12, label: this.type + 'Ball' };
        this.body = Bodies.circle(spotPosition.x, spotPosition.y, this.config.ballDiameter / 2, options);
        World.add(this.world, this.body);
        if (!colours.includes(this)) {
            colours.push(this);
        }
    }
}

class Cue {
    constructor(config) {
        this.config = config;
        this.startPos = null;
        this.endPos = null;
        this.isDragging = false;
        this.power = 0;
        this.angle = 0;
        this.chalking = { active: false, startTime: 0, duration: 4500 };
        this.isChalked = false;
    }

    update(cueBall) {
        if (!this.isDragging && cueBall && cueBall.body) {
            this.angle = atan2(mouseY - cueBall.body.position.y, mouseX - cueBall.body.position.x);
        }
    }

    draw(cueBall, world) {
        if (!cueBall || !cueBall.body) return;
        const cueBallPos = cueBall.body.position;

        push();
        translate(cueBallPos.x, cueBallPos.y);
        rotate(this.angle);

        const rayStart = { x: cueBallPos.x, y: cueBallPos.y };
        const rayEnd = { x: cueBallPos.x + cos(this.angle) * 2000, y: cueBallPos.y + sin(this.angle) * 2000 };
        const allBodies = [...reds, ...colours].map(b => b.body).filter(b => b);
        let collisions = Query.ray(allBodies, rayStart, rayEnd);

        stroke(255, 255, 255, 100);
        strokeWeight(2);
        if (collisions.length > 0) {
            const firstHit = collisions[0].body.position;
            line(0, 0, dist(cueBallPos.x, cueBallPos.y, firstHit.x, firstHit.y), 0);
        } else {
            line(0, 0, this.config.tableWidth, 0);
        }

        let cueOffset = 20 + this.power;
        fill(205, 133, 63);
        stroke(0);
        strokeWeight(1);
        rect(-cueOffset - 300, -4, 300, 8);
        fill(255);
        rect(-cueOffset - 10, -5, 10, 10);
        pop();
    }

    drawUI() {
        let barWidth = 200;
        let barHeight = 20;
        let y = this.config.canvasHeight - 60;

        // Power Meter (Left)
        let powerX = 50;
        push();
        fill(50);
        stroke(255);
        rect(powerX, y, barWidth, barHeight);
        let currentMaxPower = this.isChalked ? this.config.maxPower * 1.2 : this.config.maxPower;
        let powerWidth = map(this.power, 0, currentMaxPower, 0, barWidth);
        fill(255, 0, 0);
        noStroke();
        rect(powerX, y, powerWidth, barHeight);
        fill(255);
        textAlign(CENTER, BOTTOM);
        textSize(16);
        text("Power", powerX + barWidth / 2, y - 5);
        pop();

        // Chalk Meter (Right)
        let chalkX = this.config.canvasWidth - barWidth - 50;
        push();
        fill(50);
        stroke(255);
        rect(chalkX, y, barWidth, barHeight);
        if (this.chalking.active) {
            let elapsed = millis() - this.chalking.startTime;
            let chalkWidth = map(elapsed, 0, this.chalking.duration, 0, barWidth);
            fill(100, 150, 255);
            noStroke();
            rect(chalkX, y, chalkWidth, barHeight);
        } else if (this.isChalked) {
            fill(100, 150, 255);
            noStroke();
            rect(chalkX, y, barWidth, barHeight);
        }
        fill(255);
        textAlign(CENTER, BOTTOM);
        textSize(16);
        text("Chalk (C)", chalkX + barWidth / 2, y - 5);
        pop();
    }

    startDrag() {
        this.isDragging = true;
        this.startPos = { x: mouseX, y: mouseY };
        this.endPos = { x: mouseX, y: mouseY };
    }

    updateDrag() {
        this.endPos = { x: mouseX, y: mouseY };
        let d = dist(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
        let currentMaxPower = this.isChalked ? this.config.maxPower * 1.2 : this.config.maxPower;
        this.power = constrain(d / 5, 0, currentMaxPower);
    }

    endDrag(cueBall, sounds) {
        this.isDragging = false;
        if (this.power > 1) {
            const forceMagnitude = this.power * 0.15;
            const force = { x: cos(this.angle) * forceMagnitude, y: sin(this.angle) * forceMagnitude };
            Body.applyForce(cueBall.body, cueBall.body.position, force);
            Body.set(cueBall.body, { isSleeping: false });

            if (this.power < this.config.maxPower * 0.9 || this.isChalked) {
                playSound(sounds.ball_hit);
            } else {
                playSound(sounds.miscue);
            }

            this.isChalked = false;
            
            return true;
        }
        this.power = 0;
        return false;
    }


    startChalking(sounds) {
        if (this.chalking.active) return;
        this.chalking.active = true;
        this.chalking.startTime = millis();
        playSound(sounds.chalk);
        setTimeout(() => {
            this.chalking.active = false;
            this.isChalked = true;
        }, this.chalking.duration);
    }
}

function playSound(sound) {
    if (sound && sound.play) {
        sound.currentTime = 0;
        sound.play().catch(e => console.error("Sound play failed:", e));
    }
}

function setup() {
    createCanvas(config.canvasWidth, config.canvasHeight);
    try {
        sounds.ball_hit = new Audio('libraries/ball_hit3.mp3');
        sounds.cushion_hit = new Audio('libraries/cushion_hit.mp3');
        sounds.pot = new Audio('libraries/pot.mp3');
        sounds.chalk = new Audio('libraries/chalk.mp3');
        sounds.miscue = new Audio('libraries/miscue.mp3');
    } catch (e) {
        console.error("Error loading sounds", e);
    }

    config.ballDiameter = config.tableWidth / 36;
    config.pocketDiameter = config.ballDiameter * 1.6;
    config.tableX = (width - config.tableWidth) / 2;
    config.tableY = (height - config.tableHeight) / 2;

    const { tableX, tableY, tableWidth, tableHeight, pocketDiameter } = config;
    const cornerOffset = pocketDiameter / 4;
    config.pockets = [
        { x: tableX + cornerOffset, y: tableY + cornerOffset },
        { x: tableX + tableWidth - cornerOffset, y: tableY + cornerOffset },
        { x: tableX + cornerOffset, y: tableY + tableHeight - cornerOffset },
        { x: tableX + tableWidth - cornerOffset, y: tableY + tableHeight - cornerOffset },
        { x: tableX + tableWidth / 2, y: tableY },
        { x: tableX + tableWidth / 2, y: tableY + tableHeight }
    ];

    const baulkLineX = tableX + tableWidth / 4;
    const centerX = tableX + tableWidth / 2;
    const pyramidApexX = tableX + (tableWidth * 3) / 4;
    const centerY = tableY + tableHeight / 2;
    const dRadius = tableHeight / 4;
    config.spots = [
        { x: baulkLineX, y: centerY + dRadius / 2, type: 'yellow' },
        { x: baulkLineX, y: centerY, type: 'green' },
        { x: baulkLineX, y: centerY - dRadius / 2, type: 'brown' },
        { x: centerX, y: centerY, type: 'blue' },
        { x: pyramidApexX, y: centerY, type: 'pink' },
        { x: tableX + tableWidth - (pyramidApexX - centerX), y: centerY, type: 'black' }
    ];

    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 0;
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    engine.enableSleeping = true;

    createCushions();
    cue = new Cue(config);
    Events.on(engine, 'collisionStart', handleCollisions);

    resetGame('start');
}

function draw() {
    background(50);
    Engine.update(engine);
    if (gameState !== 'GAME_OVER' && millis() > gameEndTime) {
        gameState = 'GAME_OVER';
        setSplash("GAME OVER! Final Score: " + score, 100000);
    }

    drawTable(config);
    reds.forEach(ball => ball.show());
    colours.forEach(ball => ball.show());
    if (cueBall) cueBall.show();

    if (gameState === 'PLACING_CUE_BALL') {
        handleCueBallPlacement();
    } else if (gameState === 'AIMING') {
        cue.update(cueBall);
        cue.draw(cueBall, world);
    } else if (gameState === 'BALLS_MOVING') {
        checkBallsStopped();
        checkPockets();
    }

    cue.drawUI();
    displayInfo();
    drawSplashMessage();
}

function drawTable(config) {
    const { tableX, tableY, tableWidth, tableHeight, cushionWidth, pocketDiameter } = config;
    push();
    fill(139, 69, 19);
    noStroke();
    rect(tableX - cushionWidth, tableY - cushionWidth, tableWidth + 2 * cushionWidth, tableHeight + 2 * cushionWidth, 10);
    pop();
    push();
    fill(0, 100, 0);
    noStroke();
    rect(tableX, tableY, tableWidth, tableHeight);
    pop();
    push();
    fill(0);
    noStroke();
    config.pockets.forEach(p => {
        ellipse(p.x, p.y, pocketDiameter, pocketDiameter);
    });
    pop();
    push();
    stroke(255);
    strokeWeight(2);
    const baulkLineX = tableX + tableWidth / 4;
    line(baulkLineX, tableY, baulkLineX, tableY + tableHeight);
    noFill();
    const dCenterY = tableY + tableHeight / 2;
    const dRadius = tableHeight / 4;
    arc(baulkLineX, dCenterY, dRadius * 2, dRadius * 2, HALF_PI, -HALF_PI);
    pop();
}

function handleCueBallPlacement() {
    const { tableX, tableWidth, tableY, tableHeight } = config;
    const baulkLineX = tableX + tableWidth / 4;
    const centerY = tableY + tableHeight / 2;
    const dRadius = tableHeight / 4;

    const allBalls = [...reds, ...colours].filter(b => b.body);
    const isObstructed = allBalls.some(b => dist(mouseX, mouseY, b.body.position.x, b.body.position.y) < config.ballDiameter);
    const isMouseInD = (dist(mouseX, mouseY, baulkLineX, centerY) < dRadius && mouseX < baulkLineX && mouseX > tableX);

    if (isMouseInD && !isObstructed) {
        fill(255, 255, 255, 100);
        noStroke();
        ellipse(mouseX, mouseY, config.ballDiameter);
    }
}

function checkBallsStopped() {
    let allBalls = [...reds, ...colours];
    if (cueBall) allBalls.push(cueBall);
    allBalls = allBalls.filter(b => b && b.body);
    let allStopped = allBalls.every(b => b.body.isSleeping);
    if (allStopped) {
        evaluateTurnResults();
    }
}

function evaluateTurnResults() {
    let foul = false;
    let foulReason = "";
    let penalty = 0;
    let turnSummary = "";
    
    const pottedCueBall = pottedBallsThisTurn.some(b => b.type === 'cue');
    if (pottedCueBall) { foul = true; foulReason = "Foul: Cue ball potted!"; penalty = max(penalty, 4); }
    if (!firstHitTypeThisTurn && pottedBallsThisTurn.length === 0) { foul = true; foulReason = "Foul: No ball hit!"; penalty = max(penalty, 4); } 
    else if (firstHitTypeThisTurn) {
        if (targetBallType === 'red' && firstHitTypeThisTurn !== 'red') { foul = true; foulReason = `Foul: Hit ${firstHitTypeThisTurn} first!`; penalty = max(penalty, config.ballColors[firstHitTypeThisTurn]?.value || 4); }
        else if (targetBallType === 'colour' && firstHitTypeThisTurn === 'red') { foul = true; foulReason = "Foul: Hit red first!"; penalty = max(penalty, 4); }
        else if (reds.length === 0 && targetBallType !== 'colour' && firstHitTypeThisTurn !== targetBallType) { foul = true; foulReason = `Foul: Hit ${firstHitTypeThisTurn} instead of ${targetBallType}!`; penalty = max(penalty, config.ballColors[firstHitTypeThisTurn]?.value || 4); }
    }

    let legallyPottedBall = false;
    const pottedRedCount = pottedBallsThisTurn.filter(b => b.type === 'red').length;
    const pottedColourCount = pottedBallsThisTurn.filter(b => b.type !== 'red' && b.type !== 'cue').length;

    if (!foul) {
        if (targetBallType === 'red' && pottedColourCount > 0) { foul = true; foulReason = "Foul: Potted a colour illegally!"; }
        if (targetBallType === 'colour' && pottedRedCount > 0) { foul = true; foulReason = "Foul: Potted a red illegally!"; }
        if (reds.length === 0 && pottedBallsThisTurn.some(b => b.type !== 'cue' && b.type !== targetBallType)) { foul = true; foulReason = "Foul: Potted the wrong colour!";}
    }

    if (foul) {
        setSplash(foulReason, 3000);
        score = max(0, score - penalty);
        turnSummary = foulReason;
        targetBallType = 'red';
    } else {
        pottedBallsThisTurn.forEach(b => score += b.value);
        if (pottedBallsThisTurn.length > 0) {
            legallyPottedBall = true;
            const pottedNames = pottedBallsThisTurn.map(b => b.type.charAt(0).toUpperCase() + b.type.slice(1));
            turnSummary = `Potted: ${pottedNames.join(', ')}.`;
        } else { turnSummary = "No balls potted."; }
    }
    
    const allCurrentBallPositions = getAllBallPositions();
    pottedBallsThisTurn.forEach(b => {
        if(b.type !== 'red' && b.type !== 'cue') {
            if(reds.length > 0 || foul) {
                 b.respot(allCurrentBallPositions);
            } else {
                 colours = colours.filter(c => c !== b);
            }
        }
    });

    if(legallyPottedBall && !foul) {
        if (pottedRedCount > 0) targetBallType = 'colour';
        else if (reds.length > 0) targetBallType = 'red';
    }

    if(reds.length === 0 && !foul){
        let remainingColours = colours.filter(c => !c.isPotted);
        if(remainingColours.length > 0) {
            targetBallType = remainingColours.sort((a,b) => a.value - b.value)[0].type;
        } else if (gameState !== 'GAME_OVER'){
             gameState = 'GAME_OVER'; setSplash("All balls cleared! Final Score: " + score, 100000);
        }
    }
    
    pottedBallsThisTurn = [];
    firstHitTypeThisTurn = null;
    
    if (!cueBall) {
        gameState = 'PLACING_CUE_BALL'; lastCollisionMsg = turnSummary + " Place cue ball.";
    } else {
        gameState = 'AIMING'; lastCollisionMsg = turnSummary + " Aim your shot.";
    }
}

function checkPockets() {
    if (cueBall && cueBall.checkPotted(config.pockets)) {
        playSound(sounds.pot);
        pottedBallsThisTurn.push(cueBall);
        cueBall.removeFromWorld();
        cueBall = null;
    }

    for (let i = reds.length - 1; i >= 0; i--) {
        let ball = reds[i];
        if (ball.checkPotted(config.pockets)) {
            playSound(sounds.pot);
            pottedBallsThisTurn.push(ball);
            ball.removeFromWorld();
            reds.splice(i, 1);
        }
    }
    
    for (let i = colours.length - 1; i >= 0; i--) {
        let ball = colours[i];
        if (ball.checkPotted(config.pockets)) {
            playSound(sounds.pot);
            pottedBallsThisTurn.push(ball);
            ball.removeFromWorld();
        }
    }
}

function handleCollisions(event) {
    for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const labelA = bodyA.label;
        const labelB = bodyB.label;
        
        const isBallCushion = (labelA.includes('Ball') && labelB.includes('cushion')) || (labelB.includes('Ball') && labelA.includes('cushion'));
        const isBallBall = labelA.includes('Ball') && labelB.includes('Ball');
        if (isBallCushion && max(bodyA.speed, bodyB.speed) > 0.4) playSound(sounds.cushion_hit);
        else if (isBallBall && max(bodyA.speed, bodyB.speed) > 0.3) playSound(sounds.ball_hit);

        if (firstHitTypeThisTurn === null && (labelA === 'cueBall' || labelB === 'cueBall')) {
            const otherBody = (labelA === 'cueBall') ? bodyB : bodyA;
            if (otherBody.label.includes('Ball')) {
                 firstHitTypeThisTurn = otherBody.label.replace('Ball','');
                 lastCollisionMsg = `Cue ball hit ${firstHitTypeThisTurn}.`;
            } else if(otherBody.label.includes('cushion')) {
                 lastCollisionMsg = `Cue ball hit a cushion.`
            }
        }
    }
}

function getAllBallPositions() {
     return [...reds, ...colours, cueBall].filter(b => b && b.body && !b.isPotted).map(b => b.body.position);
}

function resetGame(mode) {
    if (world) {
        World.clear(world);
        Engine.clear(engine);
    }
    createCushions();
    
    reds = [];
    colours = [];
    cueBall = null;
    pottedBallsThisTurn = [];
    firstHitTypeThisTurn = null;

    score = 0;
    targetBallType = 'red';
    gameEndTime = millis() + GAME_DURATION_MS;
    
    createBalls(mode);
    gameState = 'PLACING_CUE_BALL';
    lastCollisionMsg = `New Game (${mode}). Place cue ball in the 'D'.`;
    setSplash(`New Game: ${mode.replace('_', ' ')}!`, 2500);
}

function createCushions() {
    const { tableX, tableY, tableWidth, tableHeight, cushionWidth } = config;
    const cushionOptions = { isStatic: true, restitution: 0.8, friction: 0.1, label: 'cushion' };
    const pocketGap = config.pocketDiameter * 0.9;
    const longSegment = (tableWidth / 2) - (pocketGap / 2);

    const boundaryOptions = { isStatic: true, label: 'boundary' };
    const boundaryOffset = 0; // How far outside the cushions the wall is
    const boundaryThickness = 40; // How thick the invisible wall is

    World.add(world, [
        // --- Original Cushions ---
        Bodies.rectangle(tableX + longSegment / 2, tableY - cushionWidth / 2, longSegment, cushionWidth, cushionOptions),
        Bodies.rectangle(tableX + tableWidth - longSegment / 2, tableY - cushionWidth / 2, longSegment, cushionWidth, cushionOptions),
        Bodies.rectangle(tableX + longSegment / 2, tableY + tableHeight + cushionWidth / 2, longSegment, cushionWidth, cushionOptions),
        Bodies.rectangle(tableX + tableWidth - longSegment / 2, tableY + tableHeight + cushionWidth / 2, longSegment, cushionWidth, cushionOptions),
        Bodies.rectangle(tableX - cushionWidth / 2, tableY + tableHeight / 2, cushionWidth, tableHeight, cushionOptions),
        Bodies.rectangle(tableX + tableWidth + cushionWidth / 2, tableY + tableHeight / 2, cushionWidth, tableHeight, cushionOptions),

        // --- NEW: Invisible Boundary Walls ---
        // Top Boundary
        Bodies.rectangle(width / 2, tableY - cushionWidth - boundaryOffset, width, boundaryThickness, boundaryOptions),
        // Bottom Boundary
        Bodies.rectangle(width / 2, tableY + tableHeight + cushionWidth + boundaryOffset, width, boundaryThickness, boundaryOptions),
        // Left Boundary
        Bodies.rectangle(tableX - cushionWidth - boundaryOffset, height / 2, boundaryThickness, height, boundaryOptions),
        // Right Boundary
        Bodies.rectangle(tableX + tableWidth + cushionWidth + boundaryOffset, height / 2, boundaryThickness, height, boundaryOptions)
    ]);
}

function createBalls(mode) {
    const { tableX, tableY, tableWidth, tableHeight, ballDiameter } = config;

    config.spots.forEach(spot => {
        let pos = { x: spot.x, y: spot.y };
        if (mode === 'random_all') {
            pos = {
                x: random(tableX + ballDiameter, tableX + tableWidth - ballDiameter),
                y: random(tableY + ballDiameter, tableY + tableHeight - ballDiameter)
            };
        }
        colours.push(new Ball(pos.x, pos.y, config, spot.type, config.ballColors[spot.type], world));
    });

    if (mode === 'start') {
        const pyramidApex = { x: tableX + (tableWidth * 3) / 4, y: tableY + tableHeight / 2 };
        let row = 0, col = 0, ballCount = 0;
        for (row = 0; row < 5; row++) {
            for (col = 0; col <= row; col++) {
                if (ballCount < 15) {
                    const x = pyramidApex.x + (row * ballDiameter * 0.866);
                    const y = pyramidApex.y + (col * ballDiameter) - (row * ballDiameter / 2);
                    reds.push(new Ball(x, y, config, 'red', config.ballColors.red, world));
                    ballCount++;
                }
            }
        }
    } else if (mode === 'random_reds' || mode === 'random_all') {
        for (let i = 0; i < 15; i++) {
            const x = random(tableX + ballDiameter, tableX + tableWidth - ballDiameter);
            const y = random(tableY + ballDiameter, tableY + tableHeight - ballDiameter);
            reds.push(new Ball(x, y, config, 'red', config.ballColors.red, world));
        }
    }
    
    [...reds, ...colours].forEach(ball => World.add(world, ball.body));
}

function setSplash(text, durationMillis) {
    splashMessage.text = text;
    splashMessage.endTime = millis() + durationMillis;
}

function drawSplashMessage() {
    if (millis() < splashMessage.endTime) {
        push();
        textAlign(CENTER, CENTER);
        textSize(48);
        const alpha = map(splashMessage.endTime - millis(), 0, 500, 0, 255, true);
        fill(255, 255, 0, alpha);
        stroke(0, alpha);
        strokeWeight(4);
        text(splashMessage.text, width / 2, height / 2 - 150);
        pop();
    }
}

function displayInfo() {
    push();
    fill(255);
    textSize(18);
    textAlign(LEFT, TOP);
    let yPos = 15;
    
    text(`Reset: [1] Start | [2] Random Reds | [3] Random All`, 20, yPos);
    yPos += 25;
    fill(200);
    text(`Log: ${lastCollisionMsg}`, 20, yPos, width/4, 40);

    textSize(28); fill(255); textAlign(CENTER, TOP);
    text(`Score: ${score}`, width / 2, 20);
    const timeLeftMs = max(0, gameEndTime - millis());
    const minutes = floor(timeLeftMs / 60000);
    const seconds = floor((timeLeftMs % 60000) / 1000);
    text(`Time: ${nf(minutes, 2)}:${nf(seconds, 2)}`, width / 2, 55);

    textSize(22); textAlign(CENTER, BOTTOM);
    let targetText = targetBallType === 'colour' ? "ANY COLOUR" : targetBallType.toUpperCase();
    if(reds.length === 0 && targetBallType !== 'colour' && gameState !== "GAME_OVER") { targetText = targetBallType.toUpperCase();}
    text(`Target: ${targetText}`, width / 2, height - 120);

     if (gameState === 'PLACING_CUE_BALL') {
        fill(255, 255, 0); textSize(24); textAlign(CENTER, CENTER);
        text('Place the Cue Ball inside the "D" and click', width / 2, height - 80);
    }
    pop();
}

function keyPressed() {
    if (key === '1') resetGame('start');
    else if (key === '2') resetGame('random_reds');
    else if (key === '3') resetGame('random_all');
    else if (key.toLowerCase() === 'c' && gameState === 'AIMING') {
        cue.startChalking(sounds);
    }
}

function mousePressed() {
    if (gameState === 'PLACING_CUE_BALL') {
        const { tableX, tableWidth, tableY, tableHeight } = config;
        const baulkLineX = tableX + tableWidth / 4;
        const dCenterY = tableY + tableHeight / 2;
        const dRadius = tableHeight / 4;
        const allBalls = [...reds, ...colours].filter(b => b.body);
        const isObstructed = allBalls.some(b => dist(mouseX, mouseY, b.body.position.x, b.body.position.y) < config.ballDiameter);
        const isMouseInD = (dist(mouseX, mouseY, baulkLineX, dCenterY) < dRadius && mouseX < baulkLineX && mouseX > tableX);
        if (isMouseInD && !isObstructed) {
            cueBall = new Ball(mouseX, mouseY, config, 'cue', config.ballColors.cue, world);
            World.add(world, cueBall.body);
            Body.set(cueBall.body, { isSleeping: false });
            gameState = 'AIMING';
            lastCollisionMsg = "Aim your shot.";
        }
    } else if (gameState === 'AIMING') {
        cue.startDrag();
    }
}

function mouseDragged() {
    if (gameState === 'AIMING' && cue.isDragging) {
        cue.updateDrag();
        return false;
    }
}

function mouseReleased() {
    if (gameState === 'AIMING' && cue.isDragging) {
       if (cue.endDrag(cueBall, sounds)) {
            gameState = 'BALLS_MOVING';
            lastCollisionMsg = "Shot taken, balls moving...";
       }
    }
}

function mouseWheel(event) {
    return false;
}