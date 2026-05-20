import Phaser from 'phaser';

const Matter = Phaser.Physics.Matter.Matter;

const HIGH_SCORE_KEY = 'earkandi_highscore';

const TABLE = { W: 700, H: 1050 };

const LAUNCH = {
  maxPower:   2600,
  chargeRate: 0.9,
  baseVel:    5,
  velScale:   0.0196875,
  xVel:       -10
};

const FLIPPER = {
  SCALE:           156 / 1224,
  HALF_WIDTH:     78,
  Y:               820,
  REST_ANGLE:      20,
  ACTIVE_ANGLE:    30,
  ACTIVE_DUR:      42,
  REST_DUR:        84,
  STIFFNESS:       1.0,
  PHYSICS:         { restitution: 0.3, friction: 0.4, density: 0.05 }
};

const BUMPER = { SCALE: 0.288, RADIUS: 36, RESTITUTION: 1.56 };

const BALL = { SPAWN_X: 652, SPAWN_Y: 950, RADIUS: 16, MAX_SPEED: 150 };

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;
    this.isLosingLife = false;
    this.ballBottomSince = 0;
    this.launchClosureBody = null;
    this.launchClosureGfx = null;
    // Reusable object for flipper body position sync — avoids per-frame GC
    this._flipperPos = { x: 0, y: 0 };
    // Previous flipper angles for angular velocity calculation
    this._prevFlipperAngleLeft = Phaser.Math.DegToRad(FLIPPER.REST_ANGLE);
    this._prevFlipperAngleRight = Phaser.Math.DegToRad(-FLIPPER.REST_ANGLE);

    this.addBackground();
    this.buildTable();
    this.matter.world.update60Hz();
    this.matter.world.engine.timing.subStep = 20;
    this.matter.world.engine.positionIterations = 10;
    this.matter.world.engine.constraintIterations = 10;

    // After each physics step: clamp velocity to prevent tunneling from
    // bumper restitution spikes, and clamp position to prevent escape.
    Matter.Events.on(this.matter.world.engine, 'afterUpdate', () => {
      if (!this.ball || !this.ball.body) return;
      const b = this.ball.body;
      const r = BALL.RADIUS;
      const pos = b.position;

      // Clamp velocity to prevent tunneling
      const vx = b.velocity.x;
      const vy = b.velocity.y;
      const speedSq = vx * vx + vy * vy;
      const maxSq = BALL.MAX_SPEED * BALL.MAX_SPEED;
      if (speedSq > maxSq) {
        const scale = BALL.MAX_SPEED / Math.sqrt(speedSq);
        b.velocity.x = vx * scale;
        b.velocity.y = vy * scale;
      }

      // Clamp position to prevent escape
      if (pos.x < r) Matter.Body.setPosition(b, { x: r, y: pos.y });
      if (pos.x > TABLE.W - r) Matter.Body.setPosition(b, { x: TABLE.W - r, y: pos.y });
    });

    // World bounds safety net — prevents ball escaping if tunneling occurs
    this.matter.world.setBounds(0, 0, TABLE.W, TABLE.H, true, false, true, true);

    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();

    const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');
    document.getElementById('hi-value').textContent = highScore;

    this.setupInput();
    this.setupCollisions();
    this.spawnBall();
    this.updateLivesDisplay();
  }

  addBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e,
      0, 0, 0, TABLE.W, TABLE.H, 0
    );
    bg.fillRect(0, 0, TABLE.W, TABLE.H);

    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    const minDist = 60;
    const collisionRadius = 25;
    this.bgShapes = [];

    for (let i = 0; i < 15; i++) {
      let x, y, valid;
      let attempts = 0;

      do {
        x = Phaser.Math.Between(40, 660);
        y = Phaser.Math.Between(40, 1010);
        valid = true;

        for (const s of this.bgShapes) {
          const dx = s.sprite.x - x;
          const dy = s.sprite.y - y;
          if (Math.sqrt(dx * dx + dy * dy) < minDist) {
            valid = false;
            break;
          }
        }
        attempts++;
      } while (!valid && attempts < 200);

      const sprite = this.add.image(x, y, shapes[i % shapes.length])
        .setScale(0.2)
        .setAlpha(0.15)
        .setDepth(-1);

      sprite.decVelX = Phaser.Math.FloatBetween(-20, 20) / 60;
      sprite.decVelY = Phaser.Math.FloatBetween(-20, 20) / 60;
      sprite.decAngVel = Phaser.Math.FloatBetween(-15, 15) / 60;
      sprite.decCollisionR = collisionRadius;

      this.bgShapes.push({ sprite });
    }
  }

  buildTable() {
    const wallOpts = { isStatic: true, restitution: 0.3 };
    this.matter.add.rectangle(8, 525, 16, 1050, wallOpts);       // left
    this.matter.add.rectangle(692, 525, 16, 1050, wallOpts);    // right
    this.matter.add.rectangle(350, 8, 700, 16, wallOpts);       // top
    this.matter.add.rectangle(628, 88, 260, 16, { ...wallOpts, angle: Math.PI / 4 });  // corner deflector
    this.matter.add.rectangle(155, 1016, 278, 16, wallOpts);    // bottom left
    this.matter.add.rectangle(513, 1016, 342, 16, wallOpts);    // bottom right
    this.matter.add.rectangle(620, 768, 16, 512, wallOpts);     // launch lane divider
    this.matter.add.rectangle(660, 1016, 52, 16, wallOpts);     // launch lane bottom stop

  // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (16,700) → (294,1016)
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    this.matter.add.rectangle(155, 858, 421, 16, { ...wallOpts, angle: leftAngle });

    // Right funnel: (620,700) → (342,1016)
    const rightAngle = Phaser.Math.Angle.Between(620, 700, 342, 1016);
    this.matter.add.rectangle(481, 858, 421, 16, { ...wallOpts, angle: rightAngle });

   // Funnel visuals
    const funnelGfx = this.add.graphics();
    funnelGfx.lineStyle(4, 0x3a3a6a, 1);
    funnelGfx.lineBetween(16, 700, 294, 1016);
    funnelGfx.lineBetween(620, 700, 342, 1016);

    const wallGfx = this.add.graphics();
    wallGfx.lineStyle(8, 0x5a5a8a, 1);
    wallGfx.lineStyle(8, 0x5a5a8a, 1);
    wallGfx.strokeRect(0, 0, 16, 1008);          // left
    wallGfx.strokeRect(684, 0, 16, 1008);       // right
    wallGfx.strokeRect(0, 0, 700, 16);          // top
    wallGfx.lineBetween(556, 16, 700, 160);     // corner deflector
    wallGfx.strokeRect(16, 1008, 278, 16);      // bottom left (x=16..294)
    wallGfx.strokeRect(342, 1008, 342, 16);     // bottom right (x=342..684)
    wallGfx.strokeRect(612, 512, 16, 512);      // launch lane divider
   wallGfx.strokeRect(634, 1008, 50, 16);      // launch lane stop
  }

  buildBumpers() {
    const bumperDefs = [
      { x: 350, y: 525, points: 250, type: 'flower', key: 'bumper-flower' },
      { x: 186, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 340, y: 140, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 494, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 266, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
      { x: 414, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
      { x: 206, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
      { x: 340, y: 330, points: 200, type: 'moon',   key: 'bumper-moon' },
      { x: 474, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
    ];

    this.bumperBodies = new Map();

    bumperDefs.forEach(def => {
        const bumper = this.add.image(def.x, def.y, def.key)
        .setScale(BUMPER.SCALE);

      const body = this.matter.add.circle(def.x, def.y, BUMPER.RADIUS, {
        isStatic: true,
        restitution: BUMPER.RESTITUTION
      });
      body.bumperData = { points: def.points, type: def.type, sprite: bumper };
      this.bumperBodies.set(body.id, body);

     const glow = this.add.circle(
        def.x, def.y, 48, 0xffffff, 0.05
      ).setDepth(bumper.depth - 1);

      this.tweens.add({
        targets: glow,
        alpha: 0.1,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  buildFlippers() {
    // fromVertices computes centroid — body positioned explicitly each frame
    // Polygon tracks the cropped flipper sprite: thin pivot, thick middle, tapered tip
    const w = FLIPPER.HALF_WIDTH * 2;
    const flipperConfigs = [
      { side: 'left',  pivotX: 121.6, origin: 0, angle: FLIPPER.REST_ANGLE,
        verts: [
          {x:-w/2, y:-5},  {x:-54, y:-18}, {x:-30, y:-18}, {x:-6, y:-18},
          {x:18, y:-18},   {x:42, y:-14},  {x:60, y:-8},  {x:72, y:-4},
          {x:78, y:0},
          {x:72, y:4},     {x:60, y:8},   {x:42, y:14},  {x:18, y:18},
          {x:-6, y:18},    {x:-30, y:18}, {x:-54, y:18},  {x:-w/2, y:5}
        ],
        constraintB: {x:-w/2, y:0} },
      { side: 'right', pivotX: 514.4, origin: 1, angle: -FLIPPER.REST_ANGLE,
        verts: [
          {x:w/2, y:-5},  {x:54, y:-18}, {x:30, y:-18}, {x:6, y:-18},
          {x:-18, y:-18}, {x:-42, y:-14}, {x:-60, y:-8}, {x:-72, y:-4},
          {x:-78, y:0},
          {x:-72, y:4},    {x:-60, y:8},  {x:-42, y:14}, {x:-18, y:18},
          {x:6, y:18},    {x:30, y:18}, {x:54, y:18},  {x:w/2, y:5}
        ],
        constraintB: {x:w/2, y:0} },
    ];

    for (const cfg of flipperConfigs) {
      const sprite = this.add.image(cfg.pivotX, FLIPPER.Y, 'flipper')
        .setOrigin(cfg.origin, 0.5)
        .setAngle(cfg.angle)
        .setScale(FLIPPER.SCALE)
        .setDepth(2);

      if (cfg.side === 'right') sprite.setFlipX(true);

      const body = this.matter.add.fromVertices(
        cfg.pivotX + FLIPPER.HALF_WIDTH, FLIPPER.Y, cfg.verts, FLIPPER.PHYSICS, true
      );
      Matter.Body.setPosition(body, { x: cfg.pivotX + FLIPPER.HALF_WIDTH, y: FLIPPER.Y });

      const constraint = this.matter.add.worldConstraint(
        body, 0, FLIPPER.STIFFNESS,
        { pointA: { x: cfg.pivotX, y: FLIPPER.Y }, pointB: cfg.constraintB }
      );

      this[cfg.side + 'Flipper'] = sprite;
      this[cfg.side + 'FlipperBody'] = body;
      this[cfg.side + 'FlipperConstraint'] = constraint;
    }

    this.flipperRestAngle = { left: FLIPPER.REST_ANGLE, right: -FLIPPER.REST_ANGLE };
    this.flipperActiveAngle = { left: -FLIPPER.ACTIVE_ANGLE, right: FLIPPER.ACTIVE_ANGLE };
  }

  flipperTween(side, active) {
    const flipper = this[side + 'Flipper'];
    this.tweens.add({
      targets: flipper,
      angle: active ? this.flipperActiveAngle[side] : this.flipperRestAngle[side],
      duration: active ? FLIPPER.ACTIVE_DUR : FLIPPER.REST_DUR,
      ease: 'Sine.easeOut'
    });
    if (active) this.sound.play('flipper-activate');
  }

  flipLeft() { this.flipperTween('left', true); }
  releaseLeft() { this.flipperTween('left', false); }
  flipRight() { this.flipperTween('right', true); }
  releaseRight() { this.flipperTween('right', false); }

  buildUI() {
    this.powerBarBg = this.add.rectangle(40, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(40, 680, 20, 10, 0x57fb88)
      .setOrigin(0.5, 1);
  }

  startCharge() {
    if (this.ballLaunched || this.isCharging) return;
    this.isCharging = true;
    this.ball.setVelocity(0, 0);
    this.matter.world.setGravity(0, 0);
    this.powerBarBg.setVisible(true);
    this.powerBarFill.setVisible(true);
  }

  releaseCharge() {
    if (!this.isCharging) return;
    this.isCharging = false;
    this.ballLaunched = true;
    this.matter.world.setGravity(0, 1);
    const yVel = -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale);
    const speed = Math.sqrt(LAUNCH.xVel * LAUNCH.xVel + yVel * yVel);
    if (speed > BALL.MAX_SPEED) {
      const scale = BALL.MAX_SPEED / speed;
      this.ball.setVelocity(LAUNCH.xVel * scale, yVel * scale);
    } else {
      this.ball.setVelocity(LAUNCH.xVel, yVel);
    }
    this.powerBarFill.setScale(1, 1).setFillStyle(0x57fb88);
    this.powerBarBg.setVisible(false);
    this.powerBarFill.setVisible(false);
  }

  setupInput() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

   this.keys = this.input.keyboard.addKeys('SPACE,ENTER');

    this.keys.SPACE.on('down', () => this.startCharge());
    this.keys.SPACE.on('up', () => this.releaseCharge());

    const flipperKeys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT');

    const onLeftDown = () => this.flipLeft();
    const onLeftUp = () => this.releaseLeft();
    const onRightDown = () => this.flipRight();
    const onRightUp = () => this.releaseRight();

    for (const k of ['A', 'LEFT']) {
      flipperKeys[k].on('down', onLeftDown);
      flipperKeys[k].on('up', onLeftUp);
    }
    for (const k of ['D', 'RIGHT']) {
      flipperKeys[k].on('down', onRightDown);
      flipperKeys[k].on('up', onRightUp);
    }

     if (isTouchDevice) {
      const leftBtn = this.add.image(100, 950, 'btn-flip-left')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      leftBtn.on('pointerdown', onLeftDown);
      leftBtn.on('pointerup', onLeftUp);
      leftBtn.on('pointerout', onLeftUp);

      const rightBtn = this.add.image(570, 950, 'btn-flip-right')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      rightBtn.on('pointerdown', onRightDown);
      rightBtn.on('pointerup', onRightUp);
      rightBtn.on('pointerout', onRightUp);

      const launchBtn = this.add.image(668, 980, 'btn-launch')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.7);

      launchBtn.on('pointerdown', () => this.startCharge());
      launchBtn.on('pointerup', () => this.releaseCharge());
    }
  }

  setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
     event.pairs.forEach(pair => {
        const bumperBody = this.bumperBodies.has(pair.bodyA.id)
          ? pair.bodyA
          : this.bumperBodies.has(pair.bodyB.id)
            ? pair.bodyB
            : null;

        if (!bumperBody || !bumperBody.bumperData) return;

        const { points, sprite: bumperSprite } = bumperBody.bumperData;

        this.score += points;
        this.updateScoreDisplay();

        this.tweens.add({
          targets: bumperSprite,
          scaleX: BUMPER.SCALE * 1.25,
          scaleY: BUMPER.SCALE * 1.25,
          duration: 80,
          from: { scaleX: BUMPER.SCALE, scaleY: BUMPER.SCALE },
          yoyo: true,
          ease: 'Sine.easeInOut'
        });

        this.sound.play('bumper-hit');

        const popup = this.add.text(bumperSprite.x, bumperSprite.y - 40, `+${points}`, {
          fontSize: '28px', color: '#ffffff', fontFamily: 'Arial',
          stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
          targets: popup,
          y: bumperSprite.y - 100,
          alpha: 0,
          duration: 800,
          onComplete: () => popup.destroy()
        });
      });
    });
  }

  spawnBall() {
    this.isLosingLife = false;

    this.ball = this.matter.add.image(BALL.SPAWN_X, BALL.SPAWN_Y, 'ball', null, {
      restitution: 0.5,
      friction: 0,
      frictionAir: 0.0001,
      density: 0.001,
      slop: 0.01,
      shape: { type: 'circle', radius: BALL.RADIUS }
    });

    this.ballLaunched = false;
    this.ballBottomSince = 0;
    this.launchPower = 0;
    this.isCharging = false;

    if (this.launchClosureBody) {
      this.matter.world.remove(this.launchClosureBody);
      this.launchClosureBody = null;
    }
    if (this.launchClosureGfx) {
      this.launchClosureGfx.destroy();
      this.launchClosureGfx = null;
    }

   this.powerBarFill.setScale(1, 1).setFillStyle(0x57fb88);
    this.powerBarBg.setVisible(false);
    this.powerBarFill.setVisible(false);
  }

  update(time, delta) {
    if (!this.ballLaunched && this.isCharging) {
      this.launchPower = Math.min(LAUNCH.maxPower, this.launchPower + delta * LAUNCH.chargeRate);
      this.powerBarFill.setScale(1, this.launchPower * 0.01);

      const ratio = this.launchPower / LAUNCH.maxPower;
      const r = Math.floor(Phaser.Math.Linear(0x57, 0xe9, ratio));
      const gr = Math.floor(Phaser.Math.Linear(0xfb, 0x45, ratio));
      const b = Math.floor(Phaser.Math.Linear(0x88, 0x60, ratio));
      this.powerBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, gr, b));
    }

    if (!this.ball) return;

    const body = this.ball.body;

    if (this.ball.y > TABLE.H) {
      this.loseLife();
      return;
    }

    // Safety fallback: if launched ball stays at the bottom for >2s, force drain
    // (guards against ball getting stuck in funnel corner from tunneling)
    if (this.ballLaunched && this.ball.y > 980) {
      this.ballBottomSince += delta;
      if (this.ballBottomSince > 2000) {
        this.loseLife();
        return;
      }
    } else {
      this.ballBottomSince = 0;
    }

    // Sync flipper physics bodies to visual sprites.
    // Set position + angle to match the tween, then set linear velocity
    // to match pure rotation around the pivot (v = omega x r).
    // Matter.js computes angular velocity from (angle - anglePrev) naturally,
    // giving real angular momentum for proper collision energy transfer.
    const pos = this._flipperPos;
    const cx = FLIPPER.HALF_WIDTH;

    // Left flipper
    const leftAngle = Phaser.Math.DegToRad(this.leftFlipper.angle);
    const leftAngVel = (leftAngle - this._prevFlipperAngleLeft) / (delta / 1000);
    this._prevFlipperAngleLeft = leftAngle;

    const lBody = this.leftFlipperBody;
    pos.x = this.leftFlipper.x + cx;
    pos.y = this.leftFlipper.y;
    Matter.Body.setPosition(lBody, pos);
    Matter.Body.setAngle(lBody, leftAngle);

    // Linear velocity of COM for pure rotation around pivot: v = omega x r
    const lDx = lBody.position.x - 121.6;
    const lDy = lBody.position.y - FLIPPER.Y;
    Matter.Body.setVelocity(lBody, { x: -leftAngVel * lDy, y: leftAngVel * lDx });

    // Right flipper
    const rightAngle = Phaser.Math.DegToRad(this.rightFlipper.angle);
    const rightAngVel = (rightAngle - this._prevFlipperAngleRight) / (delta / 1000);
    this._prevFlipperAngleRight = rightAngle;

    const rBody = this.rightFlipperBody;
    pos.x = this.rightFlipper.x - cx;
    pos.y = this.rightFlipper.y;
    Matter.Body.setPosition(rBody, pos);
    Matter.Body.setAngle(rBody, rightAngle);

    // Linear velocity of COM for pure rotation around pivot: v = omega x r
    const rDx = rBody.position.x - 514.4;
    const rDy = rBody.position.y - FLIPPER.Y;
    Matter.Body.setVelocity(rBody, { x: -rightAngVel * rDy, y: rightAngVel * rDx });

    if (this.ball.x > 620 && this.ball.y > 520 && body.velocity.y > 0) {
      this.ballLaunched = false;
      this.isCharging = false;
      this.launchPower = 0;
    }

    if (!this.launchClosureBody && this.ball.x < 600 && this.ball.y < 520 && body.velocity.y < 0) {
      this.launchClosureBody = this.matter.add.rectangle(656, 510, 75, 16, {
        isStatic: true,
        angle: Phaser.Math.DegToRad(-15.5)
      });

      this.launchClosureGfx = this.add.graphics();
      this.launchClosureGfx.lineStyle(4, 0x3a3a6a, 1);
      this.launchClosureGfx.lineBetween(620, 520, 692, 500);
    }

    for (const { sprite } of this.bgShapes) {
      sprite.x += sprite.decVelX;
      sprite.y += sprite.decVelY;
      sprite.angle += sprite.decAngVel;

      if (sprite.x < 40) { sprite.x = 40; sprite.decVelX *= -1; }
      if (sprite.x > 660) { sprite.x = 660; sprite.decVelX *= -1; }
      if (sprite.y < 40) { sprite.y = 40; sprite.decVelY *= -1; }
      if (sprite.y > 1010) { sprite.y = 1010; sprite.decVelY *= -1; }
    }

    for (let i = 0; i < this.bgShapes.length; i++) {
      for (let j = i + 1; j < this.bgShapes.length; j++) {
        const a = this.bgShapes[i].sprite;
        const b = this.bgShapes[j].sprite;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minD = a.decCollisionR + b.decCollisionR;

        if (distSq < minD * minD && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const overlap = minD - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const dvx = a.decVelX - b.decVelX;
          const dvy = a.decVelY - b.decVelY;
          const dvDotN = dvx * nx + dvy * ny;

          if (dvDotN > 0) {
            a.decVelX -= dvDotN * nx;
            a.decVelY -= dvDotN * ny;
            b.decVelX += dvDotN * nx;
            b.decVelY += dvDotN * ny;
          }
        }
      }
    }
  }

  updateScoreDisplay() {
    const el = document.getElementById('score-value');
    el.textContent = this.score;
    // Trigger pop animation
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  }

  updateLivesDisplay() {
    document.getElementById('lives-display').textContent = '⚪'.repeat(this.lives);
  }

  loseLife() {
    if (this.isLosingLife) return;
    this.isLosingLife = true;
    this.lives--;
    this.updateLivesDisplay();
    this.sound.play('ball-drain');
    this.cameras.main.shake(200, 0.03);

    if (this.lives <= 0) {
      const currentHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');
      const newHigh = Math.max(currentHigh, this.score);
      localStorage.setItem(HIGH_SCORE_KEY, newHigh.toString());

      document.getElementById('hi-value').textContent = newHigh;

      this.scene.launch('GameOverScene', { score: this.score, highScore: newHigh });
      this.scene.stop('GameScene');
    } else {
      this.ball.destroy();
      this.ball = null;
      this.time.delayedCall(1000, () => this.spawnBall());
    }
  }
}
