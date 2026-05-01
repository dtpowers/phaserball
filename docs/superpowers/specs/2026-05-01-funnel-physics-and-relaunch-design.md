---
name: Funnel Physics & Re-launch Design
description: Fix funnel collision physics (wrong reflection, repeated damping) and allow re-launch when ball falls back in launch lane
type: project
---

# Funnel Physics & Re-launch Design

## Problem

1. **Ball gets stuck on funnel lines** — `checkFunnelCollision` reflects the wrong angle (approach direction instead of velocity direction) and applies damping every frame the ball is near the line. Gravity pulls the ball back into the line, velocity gets damped to near-zero, and the ball sticks.

2. **No re-launch after ball falls back in launch lane** — `ballLaunched` is set to `true` on launch and never reset. If the ball doesn't clear the launch lane and falls back down, the user cannot press Space to launch again.

## Fix 1 — Funnel Collision Physics

**File:** `src/scenes/GameScene.js:442-472`

### Root Cause

- Line 460 uses `approachAngle` (angle from nearest point on line to ball center) for reflection, not the actual velocity direction. A ball falling straight down but offset from the line bounces sideways instead of upward.
- No per-frame collision guard — gravity pulls the ball back into the line the next frame, damping applies again (0.7×), and after 3-4 frames velocity is near-zero.

### Fix

- **Reflect the actual velocity vector**: Calculate `velocityAngle` from `ball.body.velocity.x/y` and reflect that across the line normal. This is proper specular reflection.
- **Add per-frame collision guard**: Track `this.funnelCollisionCooldown` (left/right) as a frame counter. Once a funnel collides, set cooldown to 2 frames. Only check collision if cooldown is 0. This gives gravity time to pull the ball away before the next collision check, preventing velocity death spiral.

## Fix 2 — Re-launch on Fallback

**File:** `src/scenes/GameScene.js:374-436`

### Root Cause

`ballLaunched` is set to `true` on launch and never reset. The Space key handler checks `!this.ballLaunched`, so the user can't re-launch.

### Fix

In `update()`, after the funnel collision check, detect when the ball has fallen back into the launch lane: `ball.y > 520 && ball.x > 620 && ball.body.velocity.y > 0`. When detected, reset `ballLaunched = false`, `isCharging = false`, `launchPower = 0`, and zero the ball's velocity. The user can then press Space to charge and launch again.

## Success Criteria

- Ball bounces off funnel lines and rolls down toward the drain, never sticking.
- Ball that doesn't clear the launch lane can be re-launched by pressing Space.
- No regression in flipper collision, bumper scoring, or drain detection.
