import Phaser from 'phaser';
import * as planck from 'planck';

const HIGH_SCORE_KEY = 'earkandi_highscore';

// Scale: 100 pixels = 1 meter (Box2D requires ~0.1-10m bodies for solver stability)
const SCALE = 100;
const toM = (px) => px / SCALE;
const toPx = (m) => m * SCALE;

const TABLE = { W: 700, H: 1050 };

const LAUNCH = {
  maxPower:   2600,
  chargeRate: 0.9,
  baseVel:    5,
  velScale:   0.0196875,
  xVel:       -10
};

const FLIPPER = {
  SCALE:      156 / 1224,
  HALF_WIDTH: 78,
  Y:          820,
  REST_ANGLE: 20
};

const BUMPER = { SCALE: 0.288, RADIUS: 36, RESTITUTION: 1.56 };

const BALL = { SPAWN_X: 652, SPAWN_Y: 950, RADIUS: 16, MAX_SPEED: 150 };

// Flipper motor speeds (radians/second) for RevoluteJoint
const FLIPPER_MOTOR_ACTIVE = 5;
const FLIPPER_MOTOR_RETURN = 3;

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
    this._launchClosureBody = null;
    this.launchClosureGfx = null;

    this.addBackground();

    // Planck.js physics world (Y-down gravity to match Phaser coordinate system)
    this._world = new planck.World({ gravity: { x: 0, y: 10 } });

    this.buildTable();

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
    const addWall = (x, y, hw, hh, angle = 0) => {
      const body = this._world.createBody({ type: 'static', position: { x: toM(x), y: toM(y) }, angle });
      const fixture = body.createFixture(planck.Box(toM(hw), toM(hh)));
      fixture.setRestitution(0.3);
      fixture.setFriction(0.4);
    };

    addWall(8, 525, 8, 525);                          // left
    addWall(692, 525, 8, 525);                        // right
    addWall(350, 8, 350, 8);                          // top
    addWall(628, 88, 130, 8, Math.PI / 4);            // corner deflector
    addWall(155, 1016, 139, 8);                       // bottom left
    addWall(513, 1016, 171, 8);                       // bottom right
    addWall(620, 768, 8, 256);                        // launch lane divider
    addWall(660, 1016, 26, 8);                        // launch lane bottom stop

    // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (16,700) -> (294,1016)
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    addWall(155, 858, 210.5, 8, leftAngle);

    // Right funnel: (620,700) -> (342,1016)
    const rightAngle = Phaser.Math.Angle.Between(620, 700, 342, 1016);
    addWall(481, 858, 210.5, 8, rightAngle);

    // Funnel visuals
    const funnelGfx = this.add.graphics();
    funnelGfx.lineStyle(4, 0x3a3a6a, 1);
    funnelGfx.lineBetween(16, 700, 294, 1016);
    funnelGfx.lineBetween(620, 700, 342, 1016);

    const wallGfx = this.add.graphics();
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
    let bumperId = 0;

    bumperDefs.forEach(def => {
      const bumper = this.add.image(def.x, def.y, def.key)
        .setScale(BUMPER.SCALE);

      const body = this._world.createBody({ type: 'static', position: { x: toM(def.x), y: toM(def.y) } });
      const fixture = body.createFixture(planck.Circle(toM(BUMPER.RADIUS)));
      fixture.setRestitution(BUMPER.RESTITUTION);
      const data = { points: def.points, type: def.type, sprite: bumper };
      fixture.setUserData(data);
      this.bumperBodies.set(bumperId, { body, fixture, bumperData: data });
      bumperId++;

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
    const w = FLIPPER.HALF_WIDTH * 2;

    // CCW vertex order for Box2D, converted to meters
    const leftVerts = [
      { x: -w / 2, y: -5 }, { x: -54, y: -18 }, { x: -30, y: -18 }, { x: -6, y: -18 },
      { x: 18, y: -18 }, { x: 42, y: -14 }, { x: 60, y: -8 }, { x: 72, y: -4 },
      { x: 78, y: 0 },
      { x: 72, y: 4 }, { x: 60, y: 8 }, { x: 42, y: 14 }, { x: 18, y: 18 },
      { x: -6, y: 18 }, { x: -30, y: 18 }, { x: -54, y: 18 }, { x: -w / 2, y: 5 }
    ].map(v => ({ x: toM(v.x), y: toM(v.y) }));

    const rightVerts = leftVerts.map(v => ({ x: -v.x, y: v.y }));

    const flipperConfigs = [
      {
        side: 'left', pivotX: 121.6, origin: 0,
        restAngle: Phaser.Math.DegToRad(FLIPPER.REST_ANGLE),
        verts: leftVerts
      },
      {
        side: 'right', pivotX: 514.4, origin: 1,
        restAngle: Phaser.Math.DegToRad(-FLIPPER.REST_ANGLE),
        verts: rightVerts
      }
    ];

    for (const cfg of flipperConfigs) {
      const sprite = this.add.image(cfg.pivotX, FLIPPER.Y, 'flipper')
        .setOrigin(cfg.origin, 0.5)
        .setAngle(cfg.side === 'left' ? FLIPPER.REST_ANGLE : -FLIPPER.REST_ANGLE)
        .setScale(FLIPPER.SCALE)
        .setDepth(2);

      if (cfg.side === 'right') sprite.setFlipX(true);

      const body = this._world.createBody({
        type: 'dynamic',
        position: { x: toM(cfg.pivotX + FLIPPER.HALF_WIDTH), y: toM(FLIPPER.Y) },
        angle: cfg.restAngle,
        linearDamping: 0.1,
        angularDamping: 0.2
      });

      const fFixture = body.createFixture(planck.Polygon(cfg.verts), { density: 0.05 });
      fFixture.setRestitution(0.3);
      fFixture.setFriction(0.4);

      const ground = this._world.createBody({ type: 'static' });
      const pivot = { x: toM(cfg.pivotX), y: toM(FLIPPER.Y) };

      const joint = this._world.createJoint(
        new planck.RevoluteJoint({
          enableLimit: true,
          lowerAngle: Phaser.Math.DegToRad(-40),
          upperAngle: Phaser.Math.DegToRad(40),
          enableMotor: true,
          motorSpeed: 0,
          maxMotorTorque: 50
        }, ground, body, pivot)
      );

      this[cfg.side + 'Flipper'] = sprite;
      this[cfg.side + 'FlipperBody'] = body;
      this[cfg.side + 'FlipperJoint'] = joint;
    }
  }

  flipActive(side) {
    const joint = this[side + 'FlipperJoint'];
    joint.setMotorSpeed(side === 'left' ? -FLIPPER_MOTOR_ACTIVE : FLIPPER_MOTOR_ACTIVE);
    this.sound.play('flipper-activate');
  }

  flipRest(side) {
    const joint = this[side + 'FlipperJoint'];
    joint.setMotorSpeed(side === 'left' ? FLIPPER_MOTOR_RETURN : -FLIPPER_MOTOR_RETURN);
  }

  flipLeft() { this.flipActive('left'); }
  releaseLeft() { this.flipRest('left'); }
  flipRight() { this.flipActive('right'); }
  releaseRight() { this.flipRest('right'); }

  buildUI() {
    this.powerBarBg = this.add.rectangle(40, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(40, 680, 20, 10, 0x57fb88)
      .setOrigin(0.5, 1);
  }

  startCharge() {
    if (this.ballLaunched || this.isCharging) return;
    this.isCharging = true;
    this._ballBody.setLinearVelocity({ x: 0, y: 0 });
    this._world.setGravity({ x: 0, y: 0 });
    this.powerBarBg.setVisible(true);
    this.powerBarFill.setVisible(true);
  }

  releaseCharge() {
    if (!this.isCharging) return;
    this.isCharging = false;
    this.ballLaunched = true;
    this._world.setGravity({ x: 0, y: 10 });
    const yVel = -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale);
    const speed = Math.sqrt(LAUNCH.xVel * LAUNCH.xVel + yVel * yVel);
    let finalX = LAUNCH.xVel;
    let finalY = yVel;
    if (speed > BALL.MAX_SPEED) {
      const scale = BALL.MAX_SPEED / speed;
      finalX = LAUNCH.xVel * scale;
      finalY = yVel * scale;
    }
    this._ballBody.setLinearVelocity({ x: toM(finalX), y: toM(finalY) });
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
    const debounce = new Map();

    this._world.on('begin-contact', (contact) => {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();

      const entry = this._getBumperFixture(fixtureA) || this._getBumperFixture(fixtureB);
      if (!entry) return;

      const id = entry.id;
      const now = this.time.now;
      const last = debounce.get(id);
      if (last && now - last < 300) return;
      debounce.set(id, now);

      const { points, sprite: bumperSprite } = entry.bumperData;

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
  }

  _getBumperFixture(fixture) {
    for (const [id, entry] of this.bumperBodies) {
      if (entry.fixture === fixture) {
        return { id, ...entry };
      }
    }
    return null;
  }

  spawnBall() {
    this.isLosingLife = false;

    // Destroy old ball body if present
    if (this._ballBody) {
      this._world.destroyBody(this._ballBody);
      this._ballBody = null;
    }

    // Planck ball body (bullet = continuous collision detection)
    this._ballBody = this._world.createBody({
      type: 'dynamic',
      position: { x: toM(BALL.SPAWN_X), y: toM(BALL.SPAWN_Y) },
      bullet: true,
      linearDamping: 0.0001,
      angle: 0,
      fixedRotation: true
    });
    const ballFixture = this._ballBody.createFixture(planck.Circle(toM(BALL.RADIUS)), {
      restitution: 0.3,
      friction: 0,
      density: 0.001
    });

    // Visual sprite — created separately from physics body
    this.ball = this.add.image(BALL.SPAWN_X, BALL.SPAWN_Y, 'ball');

    this.ballLaunched = false;
    this.ballBottomSince = 0;
    this.launchPower = 0;
    this.isCharging = false;

    // Remove launch closure body if it exists
    if (this._launchClosureBody) {
      this._world.destroyBody(this._launchClosureBody);
      this._launchClosureBody = null;
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
    // Step Planck physics world
    this._world.step(1 / 60, 10, 8);

    // Sync ball visual sprite from physics body
    if (this._ballBody && this.ball) {
      const pos = this._ballBody.getPosition();
      this.ball.setPosition(toPx(pos.x), toPx(pos.y));
    }

    // Post-step velocity clamp — prevents tunneling from bumper restitution spikes
    if (this._ballBody) {
      const vel = this._ballBody.getLinearVelocity();
      const speedSq = vel.x * vel.x + vel.y * vel.y;
      const maxSq = toM(BALL.MAX_SPEED) * toM(BALL.MAX_SPEED);
      if (speedSq > maxSq) {
        const scale = toM(BALL.MAX_SPEED) / Math.sqrt(speedSq);
        this._ballBody.setLinearVelocity({ x: vel.x * scale, y: vel.y * scale });
      }
    }

    // Charging power bar
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

    // Ball drain detection
    if (this.ball.y > TABLE.H) {
      this.loseLife();
      return;
    }

    // Safety fallback: if launched ball stays at the bottom for >2s, force drain
    if (this.ballLaunched && this.ball.y > 980) {
      this.ballBottomSince += delta;
      if (this.ballBottomSince > 2000) {
        this.loseLife();
        return;
      }
    } else {
      this.ballBottomSince = 0;
    }

    // Sync flipper visual sprites from physics bodies
    // Sprite positions are fixed at pivot; only angle needs sync.
    // Planck Y-down: positive angle = clockwise = same as Phaser convention.
    this.leftFlipper.setAngle(Phaser.Math.RadToDeg(this.leftFlipperBody.getAngle()));
    this.rightFlipper.setAngle(Phaser.Math.RadToDeg(this.rightFlipperBody.getAngle()));

    // Relaunch detection — ball returns to launch lane
    if (this.ball.x > 620 && this.ball.y > 520 && this._ballBody) {
      const vel = this._ballBody.getLinearVelocity();
      if (toPx(vel.y) > 0) {
        this.ballLaunched = false;
        this.isCharging = false;
        this.launchPower = 0;
      }
    }

    // Launch lane closure — seal the lane after ball exits upward
    if (!this._launchClosureBody && this.ball.x < 600 && this.ball.y < 520) {
      const vel = this._ballBody ? this._ballBody.getLinearVelocity() : { y: 0 };
      if (toPx(vel.y) < 0) {
        this._launchClosureBody = this._world.createBody({
          type: 'static',
          position: { x: toM(656), y: toM(510) },
          angle: Phaser.Math.DegToRad(-15.5)
        });
        const closureFixture = this._launchClosureBody.createFixture(planck.Box(toM(37.5), toM(8)));
        closureFixture.setRestitution(0.3);

        this.launchClosureGfx = this.add.graphics();
        this.launchClosureGfx.lineStyle(4, 0x3a3a6a, 1);
        this.launchClosureGfx.lineBetween(620, 520, 692, 500);
      }
    }

    // Background decorative shapes — hand-rolled physics, unchanged
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
      this._world.destroyBody(this._ballBody);
      this._ballBody = null;
      this.ball.destroy();
      this.ball = null;
      this.time.delayedCall(1000, () => this.spawnBall());
    }
  }

  stop() {
    super.stop();
    this._world = null;
  }

  shutdown() {
    super.shutdown();
    this._world = null;
  }
}
