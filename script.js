// script.js – pixelated white waves with glow, made with PixiJS.
// Mouse: a small ripple follows the cursor.
// Click: a ring of light spreads out and square pixels fly away.
// Any key: the wave pattern changes.

const CELL = window.innerWidth < 600 ? 10 : 8; // size of one pixel in screen pixels
const LEVELS = 8;            // how many brightness steps (fewer = more pixelated)
const MAX_BRIGHTNESS = 0.7;  // keeps the waves dim enough to read the text on top

const mouse = { x: -9999, y: -9999 }; // start off-screen
const ripples = [];  // rings created by clicks
const flyers = [];   // pixels flying out after a click
let time = 0;        // keeps counting up, drives the wave movement
let modeIndex = 0;   // which wave pattern is active

// Different wave patterns, a key press moves to the next one
const modes = [
  { fx: 1,   fy: 1,   speed: 1 },
  { fx: 0.5, fy: 2,   speed: 0.6 },
  { fx: 2,   fy: 0.6, speed: 1.4 },
  { fx: 1.5, fy: 1.5, speed: 0.4 }
];

async function start() {
  // Create the Pixi app with a transparent background
  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: false
  });
  document.getElementById("pixi-container").appendChild(app.canvas);

  // Two sprites show the same wave image: a sharp one and a blurred one for the glow
  const wave = new PIXI.Sprite();
  const glow = new PIXI.Sprite();
  glow.blendMode = "add"; // adding light on top of light makes it glow
  glow.alpha = 0.9;
  glow.filters = [new PIXI.BlurFilter({ strength: 14, quality: 3 })];

  // Graphics for the flying pixels: one blurred layer (glow) and one sharp layer
  const flyGlow = new PIXI.Graphics();
  flyGlow.blendMode = "add";
  flyGlow.filters = [new PIXI.BlurFilter({ strength: 8, quality: 2 })];
  const fly = new PIXI.Graphics();

  app.stage.addChild(wave, glow, flyGlow, fly);

  // The wave image is tiny (one image pixel = one big square on screen)
  let cols, rows, ctx, imageData, texture;

  function buildGrid() {
    cols = Math.ceil(app.screen.width / CELL);
    rows = Math.ceil(app.screen.height / CELL);

    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    ctx = canvas.getContext("2d");
    imageData = ctx.createImageData(cols, rows);

    const oldTexture = texture;
    texture = PIXI.Texture.from(canvas);
    texture.source.scaleMode = "nearest"; // no smoothing, keeps hard pixel edges

    // Stretch the tiny image to cover the whole screen
    for (const s of [wave, glow]) {
      s.texture = texture;
      s.width = cols * CELL;
      s.height = rows * CELL;
    }
    if (oldTexture) oldTexture.destroy(true);
  }

  buildGrid();
  window.addEventListener("resize", buildGrid);

  // Runs every frame
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    const m = modes[modeIndex];
    time += 0.025 * dt * m.speed;

    // Mouse position measured in grid cells
    const mcx = mouse.x / CELL;
    const mcy = mouse.y / CELL;

    // Age the click rings and remove old ones
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age > 120) ripples.splice(i, 1);
    }

    // Work out the brightness of every cell
    const data = imageData.data;
    let k = 0;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        // Three sine waves added together make a moving, interfering pattern
        let v =
          Math.sin(cx * 0.07 * m.fx + time) +
          Math.sin(cy * 0.09 * m.fy - time * 0.8) +
          Math.sin((cx * m.fx + cy * m.fy) * 0.05 + time * 0.6);

        // Small circular ripple around the mouse
        const mdx = cx - mcx;
        const mdy = cy - mcy;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 25) {
          v += Math.sin(md * 0.6 - time * 4) * (1 - md / 25) * 2;
        }

        // Turn the range roughly -3..3 into 0..1
        v = (v + 3) / 6;
        // Raising to a power makes only the crests bright, so they look like lines of light
        v = Math.pow(Math.max(0, v), 3);

        // Add the rings from clicks
        for (const r of ripples) {
          const rdx = cx - r.cx;
          const rdy = cy - r.cy;
          const rd = Math.sqrt(rdx * rdx + rdy * rdy);
          const diff = rd - r.age * 0.6; // distance from the ring edge
          v += Math.exp(-(diff * diff) / 18) * (1 - r.age / 120) * 0.9;
        }

        // Cut the brightness into steps to get the pixelated look
        v = Math.min(1, v);
        v = (Math.floor(v * LEVELS) / LEVELS) * MAX_BRIGHTNESS;

        const g = v * 255;
        data[k++] = g;   // red
        data[k++] = g;   // green
        data[k++] = g;   // blue
        data[k++] = 255; // alpha (fully opaque)
      }
    }
    ctx.putImageData(imageData, 0, 0);
    texture.source.update(); // tell Pixi the image changed

    // Move and draw the flying pixels
    fly.clear();
    flyGlow.clear();
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 0.97; // slow down over time
      f.vy *= 0.97;
      f.life -= 0.012 * dt;

      if (f.life <= 0) {
        flyers.splice(i, 1);
        continue;
      }

      // Snap to the grid so they move like pixels, not smooth dots
      const sx = Math.round(f.x / CELL) * CELL;
      const sy = Math.round(f.y / CELL) * CELL;
      const size = CELL * f.size;

      fly.rect(sx, sy, size, size).fill({ color: 0xffffff, alpha: f.life });
      flyGlow.rect(sx - size, sy - size, size * 3, size * 3)
        .fill({ color: 0xffffff, alpha: f.life * 0.6 });
    }
  });

  // Mouse or touch movement
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Click: start a ring and throw out a burst of pixels
  window.addEventListener("pointerdown", (e) => {
    ripples.push({ cx: e.clientX / CELL, cy: e.clientY / CELL, age: 0 });

    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 9;
      flyers.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() < 0.8 ? 1 : 2, // mostly small, some bigger
        life: 0.6 + Math.random() * 0.4
      });
    }
  });

  // Any key: switch to the next wave pattern
  window.addEventListener("keydown", () => {
    modeIndex = (modeIndex + 1) % modes.length;
  });
}

start();