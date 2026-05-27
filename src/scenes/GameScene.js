import Phaser from 'phaser';
import * as planck from 'planck';

const HIGH_SCORE_KEY = 'earkandi_highscore';

// Scale: 100 pixels = 1 meter (Box2D requires ~0.1-10m bodies for solver stability)
const SCALE = 100;
const toM = (px) => px / SCALE;
const toPx = (m) => m * SCALE;

// Visual dimensions (pixels) — used for sprite rendering, Graphics, CSS
const TABLE = { W: 700, H: 1050 };

// Physics constants — defined in MKS units (meters, m/s, kg) per Planck.js recommendations

// Ball physics (mass derived from density 0.001 + radius 0.16m circle)
const BALL = {
  SPAWN_X:     6.52,    // m
  SPAWN_Y:     9.50,    // m
  RADIUS:      0.16,    // m (32px diameter ball)
  MAX_SPEED:   24,      // m/s (2400 px/s — prevents tunneling, allows bumper speed spikes)
  DENSITY:     0.001,   // kg/m³
  RESTITUTION: 0.5,
};

// Bumper physics
const BUMPER_PHYSICS = {
  RADIUS:      0.36,    // m (72px diameter)
  RESTITUTION: 1.25,    // ~20% reduction for tighter control
};
// Bumper visual
const BUMPER_VIS = { SCALE: 0.288 }; // texture scale: 250px PNG → ~72px on screen

// Launch mechanics (power is abstract unit, velocities in m/s)
const LAUNCH = {
  MAX_POWER:   2600,       // abstract charge cap
  CHARGE_RATE: 0.9,        // power per ms (delta-based accumulation)
  BASE_VEL_Y:  0.5,        // m/s minimum upward launch
  VEL_SCALE:   0.01,       // m/s per power unit (max ~26.5 m/s, clamped to BALL.MAX_SPEED)
  VEL_X:       -0.1,       // m/s leftward drift
};

// Flipper physics
const FLIPPER = {
  PIVOT_X_L:   1.216,     // m (left flipper pivot)
  PIVOT_X_R:   5.144,     // m (right flipper pivot)
  PIVOT_Y:     8.20,      // m
  HALF_WIDTH:  0.78,      // m (156px total width)
  REST_ANGLE:  Phaser.Math.DegToRad(15), // radians
  DENSITY:     0.1,       // kg/m³
  RESTITUTION: 0.3,
  SCALE:       156 / 1224,// texture scale: 1224px PNG → 156px on screen
};
// Flipper visual position (pixels) — for sprite creation
const FLIPPER_VIS_Y = 820;

// Flipper motor speeds (radians/second) for RevoluteJoint
const FLIPPER_MOTOR_UP = 18;      // rad/s (snap to active position)
const FLIPPER_MOTOR_HOLD = 3;     // rad/s (hold at active angle against gravity)
const FLIPPER_MOTOR_DOWN = 12;    // rad/s (return to rest)
const FLIPPER_MAX_TORQUE = 200;   // N·m
const FLIPPER_ACTIVE_RAD = Phaser.Math.DegToRad(45); // magnitude of active angle from rest, matches joint limits

// Table boundary positions (meters) — for physics body placement
const TABLE_PHYS = {
  WALL_THICKNESS: 0.08,   // m (8px walls)
  WALL_RESTITUTION: 0.3,
  WALL_FRICTION: 0.4,
};

// Launch lane boundaries (meters) — for ball state detection
const LANE = {
  DIVIDER_X: 6.20,   // m — left edge of launch lane
  FUNNEL_Y:  5.20,   // m — below this = ball can relauntch
  ENTRY_Y:   7.00,   // m — above this = ball is in play area
};

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
    this.leftFlipperUp = false;
    this.rightFlipperUp = false;

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
    const w = TABLE_PHYS.WALL_THICKNESS;
    const r = TABLE_PHYS.WALL_RESTITUTION;
    const f = TABLE_PHYS.WALL_FRICTION;
    const addWall = (x, y, hw, hh, angle = 0) => {
      const body = this._world.createBody({ type: 'static', position: { x, y }, angle });
      body.createFixture(planck.Box(hw, hh), { restitution: r, friction: f });
    };

    // Border walls (positions in meters)
    addWall(0.08, 5.25, 0.08, 5.25);                       // left
    addWall(6.92, 5.25, 0.08, 5.25);                       // right
    addWall(3.50, 0.08, 3.50, 0.08);                       // top
    addWall(6.28, 0.88, 1.30, 0.08, Math.PI / 4);         // corner deflector
    addWall(1.55, 10.16, 1.39, 0.08);                      // bottom left
    addWall(5.13, 10.16, 1.71, 0.08);                      // bottom right (gap 2.94..5.12 for drain)
    addWall(6.20, 7.68, 0.08, 2.56);                       // launch lane divider
    addWall(6.60, 10.16, 0.26, 0.08);                      // launch lane bottom stop

    // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (0.16,7.00) -> (2.94,10.16)
    const leftAngle = Phaser.Math.Angle.Between(0.16, 7.00, 2.94, 10.16);
    addWall(1.55, 8.58, 2.105, 0.08, leftAngle);

    // Right funnel: (6.20,7.00) -> (3.42,10.16)
    const rightAngle = Phaser.Math.Angle.Between(6.20, 7.00, 3.42, 10.16);
    addWall(4.81, 8.58, 2.105, 0.08, rightAngle);

    // Funnel visuals (pixels)
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
    // Bumper definitions: positions in pixels (for sprite + Graphics rendering)
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
        .setScale(BUMPER_VIS.SCALE);

      const body = this._world.createBody({ type: 'static', position: { x: toM(def.x), y: toM(def.y) } });
      body.createFixture(planck.Circle(BUMPER_PHYSICS.RADIUS), { restitution: BUMPER_PHYSICS.RESTITUTION });
      const data = { id: bumperId, points: def.points, type: def.type, sprite: bumper };
      body.getFixtureList().setUserData(data);
      this.bumperBodies.set(bumperId, { body, bumperData: data });
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
    // Disable gravity while building flippers so they don't drop
    // before the solver converges on the joint constraints.
    this._world.setGravity({ x: 0, y: 0 });
    const hw = FLIPPER.HALF_WIDTH; // 0.78m

    // Flipper polygon vertices — CCW order, defined in meters
    // Tapered shape: thin at x=-hw (pivot end), wide at x=hw (tip end)
    const verts = [
      { x: -hw, y: -0.05 }, { x: -0.54, y: -0.18 }, { x: -0.30, y: -0.18 }, { x: -0.06, y: -0.18 },
      { x: 0.18, y: -0.18 }, { x: 0.42, y: -0.14 }, { x: 0.60, y: -0.08 }, { x: 0.72, y: -0.04 },
      { x: hw, y: 0 },
      { x: 0.72, y: 0.04 }, { x: 0.60, y: 0.08 }, { x: 0.42, y: 0.14 }, { x: 0.18, y: 0.18 },
      { x: -0.06, y: 0.18 }, { x: -0.30, y: 0.18 }, { x: -0.54, y: 0.18 }, { x: -hw, y: 0.05 }
    ];

    const flipperConfigs = [
      {
        side: 'left', pivotX: FLIPPER.PIVOT_X_L,
      },
      {
        side: 'right', pivotX: FLIPPER.PIVOT_X_R,
      }
    ];

    for (const cfg of flipperConfigs) {
      const isLeft = cfg.side === 'left';
      // Left: pivot at left end, body extends right → offset +hw
      // Right: pivot at right end, body extends left → offset -hw
      const offset = isLeft ? hw : -hw;
      // Sprite origin: (0,0.5) for left (pivot at texture left), (1,0.5) for right (pivot at texture right)
      const originX = isLeft ? 0 : 1;

      // Left flipper: body extends RIGHT from pivot — CCW (negative) lifts tip
      // Right flipper: body extends LEFT from pivot — CW (positive) lifts tip
      // Mirrored geometry means opposite motor directions for the same visual motion
      // Rest angle sign is flipped so both tilt slightly downward from horizontal
      const restAngle = isLeft ? FLIPPER.REST_ANGLE : -FLIPPER.REST_ANGLE;

      const sprite = this.add.image(toPx(cfg.pivotX), FLIPPER_VIS_Y, 'flipper')
        .setOrigin(originX, 0.5)
        .setAngle(Phaser.Math.RadToDeg(restAngle))
        .setScale(FLIPPER.SCALE)
        .setDepth(2);

      if (!isLeft) sprite.setFlipX(true);

      const body = this._world.createBody({
        type: 'dynamic',
        position: { x: cfg.pivotX + offset, y: FLIPPER.PIVOT_Y },
        angle: restAngle,
        linearDamping: 0.1,
        angularDamping: 0.2
      });

      body.createFixture(planck.Polygon(verts), {
        density: FLIPPER.DENSITY,
        restitution: FLIPPER.RESTITUTION,
        friction: TABLE_PHYS.WALL_FRICTION,
      });

      const ground = this._world.createBody({ type: 'static' });
      const pivot = { x: cfg.pivotX, y: FLIPPER.PIVOT_Y };

      // Joint limits: ±45° from rest (jointAngle=0).
      // Mirrored geometry: opposite motor directions for same visual tip motion
      const joint = this._world.createJoint(
        new planck.RevoluteJoint({
          enableLimit: true,
          lowerAngle: -Phaser.Math.DegToRad(45),
          upperAngle: Phaser.Math.DegToRad(45),
          enableMotor: true,
          motorSpeed: 0,
          maxMotorTorque: FLIPPER_MAX_TORQUE
        }, ground, body, pivot)
      );

      // Prevent gravity from rotating flippers before solver converges
      body.setAwake(false);

      this[cfg.side + 'Flipper'] = sprite;
      this[cfg.side + 'FlipperBody'] = body;
      this[cfg.side + 'FlipperJoint'] = joint;
    }

    // Restore gravity now that joint constraints are established
    this._world.setGravity({ x: 0, y: 10 });
  }

  flipUp(side) {
    this[side + 'FlipperUp'] = true;
    const joint = this[side + 'FlipperJoint'];
    const body = this[side + 'FlipperBody'];
    body.setAwake(true);
    // Mirrored geometry: opposite motor directions for same visual tip motion
    // Left: CCW (negative) lifts tip; Right: CW (positive) lifts tip
    const motorDir = side === 'left' ? -1 : 1;
    joint.setMotorSpeed(motorDir * FLIPPER_MOTOR_UP);
    this.sound.play('flipper-activate');
  }

  flipDown(side) {
    this[side + 'FlipperUp'] = false;
    const joint = this[side + 'FlipperJoint'];
    const body = this[side + 'FlipperBody'];
    body.setAwake(true);
    // Mirrored geometry: opposite motor directions
    // Left: CW (positive) drops tip; Right: CCW (negative) drops tip
    const motorDir = side === 'left' ? 1 : -1;
    joint.setMotorSpeed(motorDir * FLIPPER_MOTOR_DOWN);
  }

  flipLeft() { this.flipUp('left'); }
  releaseLeft() { this.flipDown('left'); }
  flipRight() { this.flipUp('right'); }
  releaseRight() { this.flipDown('right'); }

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

    // Velocity in m/s — clamped to BALL.MAX_SPEED
    const yVel = -(LAUNCH.BASE_VEL_Y + this.launchPower * LAUNCH.VEL_SCALE);
    const speed = Math.sqrt(LAUNCH.VEL_X ** 2 + yVel ** 2);
    const finalX = speed > BALL.MAX_SPEED ? LAUNCH.VEL_X * (BALL.MAX_SPEED / speed) : LAUNCH.VEL_X;
    const finalY = speed > BALL.MAX_SPEED ? yVel * (BALL.MAX_SPEED / speed) : yVel;

    this._ballBody.setLinearVelocity({ x: finalX, y: finalY });
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
        scaleX: BUMPER_VIS.SCALE * 1.25,
        scaleY: BUMPER_VIS.SCALE * 1.25,
        duration: 80,
        from: { scaleX: BUMPER_VIS.SCALE, scaleY: BUMPER_VIS.SCALE },
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
    const data = fixture.getUserData();
    if (!data || !data.id) return null;
    return { id: data.id, bumperData: data };
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
      position: { x: BALL.SPAWN_X, y: BALL.SPAWN_Y },
      bullet: true,
      linearDamping: 0.0001,
      angle: 0,
      fixedRotation: true
    });
    this._ballBody.createFixture(planck.Circle(BALL.RADIUS), {
      restitution: BALL.RESTITUTION,
      friction: 0,
      density: BALL.DENSITY
    });

    // Visual sprite — position converted from physics space to pixels
    this.ball = this.add.image(toPx(BALL.SPAWN_X), toPx(BALL.SPAWN_Y), 'ball');

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
    // Velocity is already in m/s from Planck; compare directly against BALL.MAX_SPEED
    if (this._ballBody) {
      const vel = this._ballBody.getLinearVelocity();
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
      if (speed > BALL.MAX_SPEED) {
        const s = BALL.MAX_SPEED / speed;
        this._ballBody.setLinearVelocity({ x: vel.x * s, y: vel.y * s });
      }
    }

    // Charging power bar
    if (!this.ballLaunched && this.isCharging) {
      this.launchPower = Math.min(LAUNCH.MAX_POWER, this.launchPower + delta * LAUNCH.CHARGE_RATE);
      this.powerBarFill.setScale(1, this.launchPower * 0.01);

      const ratio = this.launchPower / LAUNCH.MAX_POWER;
      const r = Math.floor(Phaser.Math.Linear(0x57, 0xe9, ratio));
      const gr = Math.floor(Phaser.Math.Linear(0xfb, 0x45, ratio));
      const b = Math.floor(Phaser.Math.Linear(0x88, 0x60, ratio));
      this.powerBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, gr, b));
    }

    // Ball game-play logic — skip while no ball exists (e.g., between life loss and respawn)
    if (this.ball && this._ballBody) {
      // Ball drain detection — check physics body position (meters)
      {
        const pos = this._ballBody.getPosition();
        if (pos.y > toM(TABLE.H)) {
          this.loseLife();
        }
      }

      // Safety fallback: if launched ball stays at the bottom for >2s, force drain
      if (this.ball && this._ballBody) {
        const pos = this._ballBody.getPosition();
        if (this.ballLaunched && pos.y > toM(980)) {
          this.ballBottomSince += delta;
          if (this.ballBottomSince > 2000) {
            this.loseLife();
          }
        } else {
          this.ballBottomSince = 0;
        }
      }

      // Relaunch detection — ball returns to launch lane (physics space, meters)
      if (this.ball && this._ballBody) {
        const pos = this._ballBody.getPosition();
        if (pos.x > LANE.DIVIDER_X && pos.y > LANE.FUNNEL_Y) {
          const vel = this._ballBody.getLinearVelocity();
          if (vel.y > 0) {
            this.ballLaunched = false;
            this.isCharging = false;
            this.launchPower = 0;
          }
        }
      }

      // Launch lane closure — seal the lane after ball exits upward (meters)
      if (!this._launchClosureBody) {
        const pos = this._ballBody.getPosition();
        if (pos.x < toM(600) && pos.y < LANE.FUNNEL_Y) {
          const vel = this._ballBody.getLinearVelocity();
          if (vel.y < 0) {
            this._launchClosureBody = this._world.createBody({
              type: 'static',
              position: { x: 6.56, y: 5.10 },
              angle: Phaser.Math.DegToRad(-15.5)
            });
            this._launchClosureBody.createFixture(planck.Box(0.375, 0.08), { restitution: 0.3 });

            this.launchClosureGfx = this.add.graphics();
            this.launchClosureGfx.lineStyle(4, 0x3a3a6a, 1);
            this.launchClosureGfx.lineBetween(620, 520, 692, 500);
          }
        }
      }
    }

    // Sync flipper visual sprites from physics bodies
    // Sprite positions are fixed at pivot; only angle needs sync.
    // Planck Y-down: positive angle = clockwise = same as Phaser convention.
    this.leftFlipper.setAngle(Phaser.Math.RadToDeg(this.leftFlipperBody.getAngle()));
    this.rightFlipper.setAngle(Phaser.Math.RadToDeg(this.rightFlipperBody.getAngle()));

    // Flipper state machine: fire → hold → return
    // "up" = fired state. Motor drives tip up until active angle reached, then holds.
    // Not "up" = motor drives tip down to return to rest.
    // Left: negative motor = up, positive = down | Right: positive = up, negative = down
    for (const side of ['left', 'right']) {
      const joint = this[side + 'FlipperJoint'];
      const angle = joint.getJointAngle();
      const upDir = side === 'left' ? -1 : 1; // motor direction that lifts tip
      if (this[side + 'FlipperUp']) {
        // Check if tip reached active position (sign differs per flipper)
        if (upDir * angle >= FLIPPER_ACTIVE_RAD) {
          joint.setMotorSpeed(upDir * FLIPPER_MOTOR_HOLD); // hold against gravity
        }
      } else {
        joint.setMotorSpeed(-upDir * FLIPPER_MOTOR_DOWN); // return to rest
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
      // Pause (not stop) so GameScene.start() triggers proper shutdown->init->create lifecycle.
      // Phaser docs: "If the Scene is running, paused, or sleeping, it will be shutdown and then started."
      this.scene.pause('GameScene');
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

    // Destroy physics world (bodies, joints, and collision listeners become GC-eligible)
    this._world = null;

    // Stop all tweens (bumper glow, score popups, etc.)
    this.tweens.killAll();

    // Destroy all game objects on the display list (spread to avoid mutation during iteration)
    [...this.children.getChildren()].forEach(c => c.destroy());

    // Clear references
    this._ballBody = null;
    this.ball = null;
    this.bgShapes = [];
    this.bumperBodies = null;
    this._launchClosureBody = null;
    this.launchClosureGfx = null;
    this.leftFlipper = null;
    this.rightFlipper = null;
    this.leftFlipperBody = null;
    this.rightFlipperBody = null;
    this.leftFlipperJoint = null;
    this.rightFlipperJoint = null;
  }
}
