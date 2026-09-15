// UMBRY — Signal Canvas (Rev 14: Hex Converter)
// FFVII-Remake reactor aesthetic — rocks dock into a solid hex-prism
// converter (engine housing with an intake aperture on the left and an exit
// port on the right), dissolve into its inner chamber, the chamber roils
// with energy, and the right port fires the laser. Dimensional shading,
// panel lines, rim highlights, recessed inner chamber. No portal ring.

(function () {
  const canvas = document.getElementById("signalCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Cap render resolution. The cinematic scene has soft glows + gradients —
  // dpr=1.25 keeps everything sharp enough while cutting per-frame pixel cost
  // dramatically vs dpr=2 (which on a 1440x900 canvas is 5.2M pixels/frame).
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

  // ============ Palette ============
  const PAL = {
    bg:             '#000000',
    bgDeep:         '#040108',
    viridian:       '#21f2a0',
    viridianSoft:   '#5cffc0',
    viridianBright: '#9affd2',
    viridianDim:    '#0d6e4a',
    magenta:        '#d63aff',
    magentaSoft:    '#ea7dff',
    magentaDeep:    '#8c1bbf',
    purple:         '#6b1f8f',
    purpleDeep:     '#2a0d4a',
    rockLit:        '#7a4a9e',
    rockMid:        '#3a1858',
    rockDark:       '#0e0418',
    rockEdgeLit:    '#c46fff',
    white:          '#ffffff',
    dust:           '#a070d8'
  };

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // ============ Layout ============
  let W = 0, H = 0;
  const portal = { x: 0, y: 0, r: 0 };
  let exitX = 0;

  function recompute() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    portal.x = W * 0.62;
    portal.y = H * 0.52;
    portal.r = Math.min(H * 0.28, W * 0.16);
    exitX = W * 1.05;
    initScene();
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  // ============ Scene ============
  let rocks = [];
  let shards = [];
  let chips = [];
  let dust = [];
  let stars = [];
  let runtime = 0;
  let lastT = 0;
  let portalPulse = 0;
  let beamFlash = 0;

  function makeRock(spawnX, spawnY, size) {
    const facets = [];
    // Slightly smaller stones (was 14-40)
    const baseSize = size || rand(10, 30);
    const numFacets = 3 + Math.floor(Math.random() * 3);
    for (let f = 0; f < numFacets; f++) {
      const verts = [];
      const n = 5 + Math.floor(Math.random() * 3);
      const fSize = baseSize * (0.6 + Math.random() * 0.6);
      const offX = (Math.random() - 0.5) * baseSize * 0.4;
      const offY = (Math.random() - 0.5) * baseSize * 0.4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const r = fSize * (0.65 + Math.random() * 0.6);
        verts.push({ x: Math.cos(a) * r + offX, y: Math.sin(a) * r + offY });
      }
      facets.push({ verts, lit: Math.random() });
    }
    const depth = Math.random();
    const initSize = baseSize * (0.5 + depth * 0.9);
    return {
      x: spawnX, y: spawnY,
      z: depth,
      size: initSize,
      baseSize: initSize,
      vx: rand(0.05, 0.30) * (0.5 + depth * 0.8),
      vy: rand(-0.06, 0.06),
      rot: Math.random() * Math.PI * 2,
      vrot: rand(-0.003, 0.003),
      facets,
      // Bias heavily toward deeper purple — only ~15% magenta-hot stones
      baseHue: Math.random() < 0.15 ? 'magenta' : 'purple',
      // Lifecycle: 'drift' (cloud) → 'inbound' (curving toward portal) → consumed
      state: 'drift',
      // inbound curve parameters (set on state transition):
      startX: 0, startY: 0, cpX: 0, cpY: 0, endX: 0, endY: 0,
      transitT: 0, transitDur: 0,
      // ms until this rock breaks orbit and heads for the portal
      breakT: rand(2000, 7500)
    };
  }

  // Shards are now born at the portal's far-side rim, where a rock just
  // condensed in. They funnel outward toward the beam axis, tightening into
  // the right-edge laser line.
  function makeShard(birthSize) {
    // Shards emerge from the EXIT PORT on the right point of the hex.
    const startX = portal.x + portal.r * 1.00;
    const startY = portal.y + (Math.random() - 0.5) * portal.r * 0.10;
    const midX = startX + (exitX - startX) * 0.45;
    const midY = (startY + portal.y) * 0.5;
    const endX = exitX;
    const endY = portal.y + (Math.random() - 0.5) * 4; // collapses to beam axis
    return {
      sourceX: startX, sourceY: startY,
      cpX: midX, cpY: midY,
      targetX: endX, targetY: endY,
      cx: startX, cy: startY,
      t: 0,
      duration: rand(900, 1300),
      size: Math.max(6, Math.min(14, (birthSize || 12) * 0.45)),
      speed: rand(0.95, 1.35),
      trail: [],
      exited: false,
      sparkleT: 0
    };
  }

  // Condensed-rock chips — tiny purple fragments that ride the beam from
  // portal to the right-edge laser, marking the "compressed rock trail".
  function makeChip(x, y) {
    const life = rand(900, 1500);
    return {
      x, y,
      vx: rand(0.4, 0.85),
      vy: rand(-0.05, 0.05),
      size: rand(0.9, 2.2),
      rot: Math.random() * Math.PI * 2,
      vrot: rand(-0.012, 0.012),
      life,
      maxLife: life,
      hue: Math.random() < 0.25 ? 'magenta' : 'purple'
    };
  }

  function makeDust() {
    return {
      x: rand(0, W * 0.5),
      y: rand(0, H),
      z: rand(0.1, 0.9),
      vx: rand(0.03, 0.18),
      vy: rand(-0.04, 0.04),
      size: rand(0.5, 2.5),
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5 ? 'magenta' : 'purple'
    };
  }

  // Lazy-spawn budget for particles: we start the scene with a slim subset so
  // first paint is fast, then top up to the full target over the first ~1.5s.
  let dustTarget = 0;
  let starTarget = 0;
  let rockTarget = 0;

  function spawnStar() {
    const r = Math.random();
    let tint;
    if (r < 0.78) tint = 'white';
    else if (r < 0.92) tint = 'viridian';
    else tint = 'magenta';
    const bright = Math.random() < 0.06;
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: bright ? (1.4 + Math.random() * 1.2) : (Math.random() * 1.0 + 0.4),
      phase: Math.random() * Math.PI * 2,
      baseA: bright ? (0.55 + Math.random() * 0.35) : (0.28 + Math.random() * 0.42),
      tint,
      bright,
      twSpeed: 0.0008 + Math.random() * 0.0014
    });
  }

  function initScene() {
    rocks = [];
    shards = [];
    chips = [];
    dust = [];
    stars = [];
    // Full targets (matched to old values so the final density is unchanged)
    rockTarget = Math.floor(22 + (W / 100));
    dustTarget = Math.max(120, Math.floor(W / 7));
    starTarget = Math.max(280, Math.floor(W / 3.2));

    // Slim initial seed — gets first frame on screen fast.
    // We top up to full target on idle frames inside the main loop.
    const initialRocks = Math.min(rockTarget, 14);
    const initialDust = Math.min(dustTarget, 50);
    const initialStars = Math.min(starTarget, 140);

    for (let i = 0; i < initialRocks; i++) {
      rocks.push(makeRock(rand(W * 0.02, W * 0.42), rand(H * 0.10, H * 0.92)));
    }
    for (let i = 0; i < initialDust; i++) dust.push(makeDust());
    for (let i = 0; i < initialStars; i++) spawnStar();
  }

  // Called from the frame loop after first paint — slowly fills out particle
  // counts so the scene reaches full density without blocking startup.
  function topUpParticles() {
    if (stars.length < starTarget) {
      const add = Math.min(starTarget - stars.length, 18);
      for (let i = 0; i < add; i++) spawnStar();
    }
    if (dust.length < dustTarget) {
      const add = Math.min(dustTarget - dust.length, 8);
      for (let i = 0; i < add; i++) dust.push(makeDust());
    }
    if (rocks.length < rockTarget) {
      const add = Math.min(rockTarget - rocks.length, 2);
      for (let i = 0; i < add; i++) {
        rocks.push(makeRock(rand(W * 0.02, W * 0.42), rand(H * 0.10, H * 0.92)));
      }
    }
  }

  // ============ Drawing ============
  function drawBackground(t) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, W, H);

    // Magenta nebula occupies the shadow side - layered for depth.
    // Primary: big magenta wash centered left of frame.
    const neb1 = ctx.createRadialGradient(W * 0.18, H * 0.55, 0, W * 0.18, H * 0.55, W * 0.65);
    neb1.addColorStop(0, `rgba(168, 50, 230, 0.36)`);
    neb1.addColorStop(0.28, `rgba(138, 30, 194, 0.22)`);
    neb1.addColorStop(0.6, `rgba(107, 31, 143, 0.10)`);
    neb1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, W, H);

    // Hot plume upper-left for richness
    const neb2 = ctx.createRadialGradient(W * 0.05, H * 0.20, 0, W * 0.05, H * 0.20, W * 0.42);
    neb2.addColorStop(0, `rgba(214, 58, 255, 0.26)`);
    neb2.addColorStop(0.35, `rgba(168, 50, 230, 0.10)`);
    neb2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, W, H);

    // Lower bloom for shadow-side dimension
    const neb3 = ctx.createRadialGradient(W * 0.12, H * 0.90, 0, W * 0.12, H * 0.90, W * 0.38);
    neb3.addColorStop(0, `rgba(186, 65, 220, 0.18)`);
    neb3.addColorStop(0.5, `rgba(138, 30, 194, 0.06)`);
    neb3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb3;
    ctx.fillRect(0, 0, W, H);

    // Tighter, more concentrated viridian aura — reads as a focused glow
    // from the portal, not a green wash across half the hero.
    const aura = ctx.createRadialGradient(portal.x, portal.y, 0, portal.x, portal.y, W * 0.28);
    aura.addColorStop(0, rgba(PAL.viridianDim, 0.42));
    aura.addColorStop(0.35, rgba(PAL.viridianDim, 0.08));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, H);

    // Starfield — mostly white pinpoints with occasional tinted accents.
    // Bright stars get a subtle radial halo to read as distant suns.
    for (const s of stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * s.twSpeed + s.phase);
      const a = s.baseA * tw;
      let color;
      if (s.tint === 'viridian') color = PAL.viridianSoft;
      else if (s.tint === 'magenta') color = PAL.magenta;
      else color = '255, 255, 255';
      if (s.bright) {
        const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s * 4);
        halo.addColorStop(0, rgba(color, a * 0.9));
        halo.addColorStop(0.4, rgba(color, a * 0.25));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(s.x - s.s * 4, s.y - s.s * 4, s.s * 8, s.s * 8);
        ctx.fillStyle = rgba(color, Math.min(1, a * 1.4));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(color, a);
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }
  }

  function drawDust(t) {
    for (const d of dust) {
      const tw = 0.4 + 0.6 * Math.sin(t * 0.0008 + d.phase);
      const color = d.hue === 'magenta' ? PAL.magenta : PAL.dust;
      ctx.fillStyle = rgba(color, 0.15 * tw * d.z);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * d.z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRock(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);

    // Inbound rocks pick up a viridian rim charge as they near the portal
    const chargeLevel = (r.state === 'inbound')
      ? Math.min(1, r.transitT / r.transitDur)
      : 0;

    // As an inbound rock crosses the threshold into the throat, fade its
    // alpha so it visibly dissolves INTO the green hole rather than landing
    // on top of the metal. Fade window: last 30% of the journey.
    if (chargeLevel > 0.70) {
      const fade = 1 - ((chargeLevel - 0.70) / 0.30);
      ctx.globalAlpha = Math.max(0, fade);
    }

    const focus = r.z;
    const haloR = r.size * (1.8 + chargeLevel * 1.0);
    const baseColor = r.baseHue === 'magenta' ? PAL.magenta : PAL.purpleDeep;
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    halo.addColorStop(0, rgba(baseColor, 0.25 * focus));
    halo.addColorStop(0.6, rgba(baseColor, 0.08));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-haloR, -haloR, haloR * 2, haloR * 2);

    for (const f of r.facets) {
      let cx = 0, cy = 0;
      for (const v of f.verts) { cx += v.x; cy += v.y; }
      cx /= f.verts.length; cy /= f.verts.length;

      const lightDirX = Math.cos(-r.rot);
      const lightDirY = Math.sin(-r.rot);
      const cmag = Math.sqrt(cx*cx + cy*cy) || 1;
      const dot = (cx / cmag) * lightDirX + (cy / cmag) * lightDirY;
      const litness = Math.max(0, Math.min(1, 0.45 + dot * 0.45 + f.lit * 0.25));

      ctx.beginPath();
      for (let i = 0; i < f.verts.length; i++) {
        const v = f.verts[i];
        if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(
        cx - r.size * lightDirX, cy - r.size * lightDirY,
        cx + r.size * lightDirX, cy + r.size * lightDirY
      );
      // Darker overall — pull the lit color toward deep purple, keep the dark shadow side near-black
      const litColor = r.baseHue === 'magenta' ? PAL.magentaDeep : PAL.purple;
      const midColor = r.baseHue === 'magenta' ? PAL.purpleDeep : PAL.purpleDeep;
      grad.addColorStop(0, rgba(PAL.rockDark, 1.0 * focus));
      grad.addColorStop(0.5, rgba(midColor, 0.80 + litness * 0.15));
      grad.addColorStop(1, rgba(litColor, 0.50 + litness * 0.30));
      ctx.fillStyle = grad;
      ctx.fill();

      // Subdued rim light — was reading as wireframe outlines. Now reads as
      // facets catching a rim of light, not a low-poly mesh.
      ctx.strokeStyle = rgba(PAL.viridian, (0.06 + chargeLevel * 0.25) * litness * focus);
      ctx.lineWidth = 0.4 + chargeLevel * 0.6;
      ctx.stroke();
      ctx.strokeStyle = rgba(PAL.rockEdgeLit, (0.12 + chargeLevel * 0.20) * focus);
      ctx.lineWidth = 0.4;
      ctx.stroke();

      // Interior crack line for geological detail — one short jagged stroke per facet
      if (f.verts.length >= 4) {
        const v0 = f.verts[0];
        const v2 = f.verts[Math.floor(f.verts.length / 2)];
        const mx = (v0.x + v2.x) * 0.5;
        const my = (v0.y + v2.y) * 0.5;
        ctx.strokeStyle = rgba(PAL.rockDark, 0.55 * focus);
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(v0.x * 0.6 + cx * 0.4, v0.y * 0.6 + cy * 0.4);
        ctx.lineTo(mx, my);
        ctx.lineTo(v2.x * 0.6 + cx * 0.4, v2.y * 0.6 + cy * 0.4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawChip(c) {
    const a = Math.max(0, c.life / c.maxLife);
    const baseColor = c.hue === 'magenta' ? PAL.magenta : PAL.purple;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.globalCompositeOperation = 'lighter';
    const gR = c.size * 4;
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    gg.addColorStop(0, rgba(PAL.viridianSoft, 0.35 * a));
    gg.addColorStop(0.5, rgba(baseColor, 0.20 * a));
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-gR, -gR, gR * 2, gR * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(baseColor, 0.85 * a);
    ctx.fillRect(-c.size, -c.size * 0.6, c.size * 2, c.size * 1.2);
    ctx.fillStyle = rgba(PAL.rockEdgeLit, 0.65 * a);
    ctx.fillRect(-c.size * 0.8, -c.size * 0.5, c.size * 0.5, c.size * 0.5);
    ctx.restore();
  }

  // ============ Converter (Elon/SpaceX industrial redesign) ============
  // Asymmetric machined slab. Massive intake throat on the left swallows
  // matter; precision nozzle on the right fires the beam. Brushed steel
  // body, one top-down floodlight, single serial stencil. No decoration.
  function drawPortal(t) {
    const breath = 1 + 0.015 * Math.sin(t * 0.0022);
    const pulse = portalPulse;
    const p = portal;
    const r = portal.r * breath;

    // Body shape: an asymmetric machined block.
    // Left edge: tall vertical face containing the intake throat.
    // Top + bottom: gentle chamfers angled inward toward the nozzle.
    // Right side: tapers down to the small exit nozzle.
    // We define the body as a polygon anchored so the LEFT face sits at
    // x = p.x - r (where rocks dock) and the nozzle tip sits at x = p.x + r
    // (where shards/beam are born).
    const leftX = p.x - r;
    const rightX = p.x + r;
    const topY = p.y - r * 0.78;
    const botY = p.y + r * 0.78;
    // Chamfer corners on the left face (slight inset top/bottom)
    const leftChamfer = r * 0.12;
    // Right side tapers heavily — nozzle plate height much smaller than left face
    const nozzlePlateHalf = r * 0.30;
    // Step-back before the nozzle — body shoulders inward
    const shoulderX = p.x + r * 0.55;
    const shoulderHalf = r * 0.52;

    const body = [
      { x: leftX,                  y: topY + leftChamfer },     // upper-left chamfer top
      { x: leftX + leftChamfer,    y: topY },                   // top edge of left face
      { x: shoulderX,              y: topY + r * 0.06 },        // gentle taper along top
      { x: shoulderX + r * 0.08,   y: p.y - shoulderHalf },     // shoulder step-in (top)
      { x: rightX - r * 0.02,      y: p.y - nozzlePlateHalf },  // nozzle plate top
      { x: rightX,                 y: p.y - nozzlePlateHalf * 0.45 }, // nozzle tip top
      { x: rightX,                 y: p.y + nozzlePlateHalf * 0.45 }, // nozzle tip bot
      { x: rightX - r * 0.02,      y: p.y + nozzlePlateHalf },  // nozzle plate bot
      { x: shoulderX + r * 0.08,   y: p.y + shoulderHalf },     // shoulder step-in (bot)
      { x: shoulderX,              y: botY - r * 0.06 },        // gentle taper along bottom
      { x: leftX + leftChamfer,    y: botY },                   // bottom edge of left face
      { x: leftX,                  y: botY - leftChamfer }      // lower-left chamfer
    ];

    // 1) Outer aura — single ambient Mako wash, biased toward the intake
    const auraCx = p.x - r * 0.15;
    const outer = ctx.createRadialGradient(auraCx, p.y, r * 0.4, auraCx, p.y, r * 3.0);
    outer.addColorStop(0, rgba(PAL.viridian, 0.18 + pulse * 0.16));
    outer.addColorStop(0.45, rgba(PAL.viridian, 0.05));
    outer.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outer;
    ctx.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);

    // 2) Hard drop shadow — heavy, low and to the right
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(body[0].x + 4, body[0].y + 10);
    for (let i = 1; i < body.length; i++) ctx.lineTo(body[i].x + 4, body[i].y + 10);
    ctx.closePath();
    ctx.fillStyle = rgba('#000000', 0.65);
    ctx.filter = 'blur(10px)';
    ctx.fill();
    ctx.restore();

    // 3) BODY FILL — brushed steel slab. Single overhead light source.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);
    for (let i = 1; i < body.length; i++) ctx.lineTo(body[i].x, body[i].y);
    ctx.closePath();
    // Vertical light gradient — lit top edge, deep shadow bottom
    const steelG = ctx.createLinearGradient(p.x, topY, p.x, botY);
    steelG.addColorStop(0.00, '#3a4a52');   // hot top edge (overhead light)
    steelG.addColorStop(0.18, '#222d33');
    steelG.addColorStop(0.55, '#10171c');
    steelG.addColorStop(1.00, '#04080a');
    ctx.fillStyle = steelG;
    ctx.fill();

    // Brushed-metal horizontal striations (very subtle, only on the body)
    ctx.clip();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#5a6a72';
    ctx.lineWidth = 0.5;
    for (let yy = topY + 3; yy < botY; yy += 3) {
      ctx.beginPath();
      ctx.moveTo(leftX - 2, yy);
      ctx.lineTo(rightX + 2, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 4) Top-edge specular highlight — single thin bright line on top surfaces
    ctx.save();
    ctx.strokeStyle = rgba('#c8d6dc', 0.55);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);
    ctx.lineTo(body[1].x, body[1].y);
    ctx.lineTo(body[2].x, body[2].y);
    ctx.lineTo(body[3].x, body[3].y);
    ctx.stroke();
    ctx.restore();

    // 5) Shadow underside — thin dark line on bottom surfaces
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.75);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(body[8].x, body[8].y);
    ctx.lineTo(body[9].x, body[9].y);
    ctx.lineTo(body[10].x, body[10].y);
    ctx.lineTo(body[11].x, body[11].y);
    ctx.stroke();
    ctx.restore();

    // 6) Body outline — crisp dark edge (no glow)
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.85);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);
    for (let i = 1; i < body.length; i++) ctx.lineTo(body[i].x, body[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 7) Shoulder seam — single panel-break line where the body steps down
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(shoulderX + r * 0.04, p.y - shoulderHalf * 0.95);
    ctx.lineTo(shoulderX + r * 0.04, p.y + shoulderHalf * 0.95);
    ctx.stroke();
    ctx.restore();

    // 8) INTAKE THROAT — massive matte-black opening on the left face,
    //    nearly the full height. This is the dominant feature.
    const throatX = leftX + r * 0.05;
    const throatTop = p.y - r * 0.58;
    const throatBot = p.y + r * 0.58;
    const throatW = r * 0.42;
    ctx.save();
    // Throat cavity (deep matte black with subtle Mako bleed at center)
    ctx.beginPath();
    ctx.moveTo(throatX, throatTop);
    ctx.lineTo(throatX + throatW * 0.55, throatTop + r * 0.05);
    ctx.lineTo(throatX + throatW, p.y - r * 0.04);
    ctx.lineTo(throatX + throatW, p.y + r * 0.04);
    ctx.lineTo(throatX + throatW * 0.55, throatBot - r * 0.05);
    ctx.lineTo(throatX, throatBot);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Mako glow recessed deep inside the throat (pulls toward center axis)
    const throatGlow = ctx.createRadialGradient(
      throatX + throatW * 0.9, p.y, 0,
      throatX + throatW * 0.9, p.y, throatW * 1.4
    );
    throatGlow.addColorStop(0, rgba(PAL.viridianBright, 0.85 + pulse * 0.15));
    throatGlow.addColorStop(0.35, rgba(PAL.viridian, 0.50));
    throatGlow.addColorStop(0.75, rgba(PAL.viridianDim, 0.18));
    throatGlow.addColorStop(1, 'rgba(0,0,0,0)');
    // Clip to throat shape so glow doesn't bleed onto body
    ctx.beginPath();
    ctx.moveTo(throatX, throatTop);
    ctx.lineTo(throatX + throatW * 0.55, throatTop + r * 0.05);
    ctx.lineTo(throatX + throatW, p.y - r * 0.04);
    ctx.lineTo(throatX + throatW, p.y + r * 0.04);
    ctx.lineTo(throatX + throatW * 0.55, throatBot - r * 0.05);
    ctx.lineTo(throatX, throatBot);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = throatGlow;
    ctx.fillRect(throatX - 4, throatTop - 4, throatW * 2 + 8, (throatBot - throatTop) + 8);

    // Internal heat haze — three faint horizontal energy bands receding into the throat
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bandY = p.y + (i - 1) * r * 0.18;
      const bandPhase = (t * 0.0012 + i * 0.4) % 1;
      const bandAlpha = (0.22 + 0.18 * Math.sin(t * 0.003 + i)) * (1 - bandPhase * 0.4);
      const bg = ctx.createLinearGradient(throatX, bandY, throatX + throatW, bandY);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.5, rgba(PAL.viridianBright, bandAlpha));
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(throatX, bandY - 1, throatW, 2);
    }
    ctx.restore();

    // 9) THROAT LIP — bright machined inner rim, like a turbine intake
    ctx.save();
    ctx.strokeStyle = rgba('#1a2429', 0.95);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(throatX, throatTop);
    ctx.lineTo(throatX + throatW * 0.55, throatTop + r * 0.05);
    ctx.moveTo(throatX, throatBot);
    ctx.lineTo(throatX + throatW * 0.55, throatBot - r * 0.05);
    ctx.stroke();
    // Top lip catches overhead light
    ctx.strokeStyle = rgba('#8aa0a8', 0.75);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(throatX, throatTop + 0.5);
    ctx.lineTo(throatX + throatW * 0.55, throatTop + r * 0.05 + 0.5);
    ctx.stroke();
    ctx.restore();

    // 10) CHAMBER WINDOW — a small inspection slot above the throat center axis,
    //     glowing viridian. This is the only window into the reactor; it's
    //     deliberately smaller than the throat, so the throat dominates.
    const winCx = p.x + r * 0.05;
    const winCy = p.y - r * 0.02;
    const winW = r * 0.36;
    const winH = r * 0.22;
    ctx.save();
    // Recessed black window pocket
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.rect(winCx - winW * 0.5, winCy - winH * 0.5, winW, winH);
    ctx.fill();
    // Clip and paint Mako interior + core
    ctx.beginPath();
    ctx.rect(winCx - winW * 0.5, winCy - winH * 0.5, winW, winH);
    ctx.clip();
    // Restrained instrument port — dark interior with a soft viridian core,
    // not a neon screen. Reads as a recessed aperture, not a video-game UI.
    const winG = ctx.createRadialGradient(winCx + winW * 0.1, winCy, 0, winCx, winCy, winW * 0.8);
    winG.addColorStop(0, rgba(PAL.viridianBright, 0.55 + pulse * 0.12));
    winG.addColorStop(0.25, rgba(PAL.viridian, 0.30));
    winG.addColorStop(0.6, rgba(PAL.viridianDim, 0.12));
    winG.addColorStop(1, 'rgba(8, 14, 14, 0.95)');
    ctx.fillStyle = winG;
    ctx.fillRect(winCx - winW, winCy - winH, winW * 2, winH * 2);
    // (Sweeping scan streak removed — was reading as video-game UI.)
    ctx.restore();
    // Window frame — thin bright outline
    ctx.save();
    ctx.strokeStyle = rgba('#8aa0a8', 0.85);
    ctx.lineWidth = 1.0;
    ctx.strokeRect(winCx - winW * 0.5, winCy - winH * 0.5, winW, winH);
    // Bottom shadow inside the frame
    ctx.strokeStyle = rgba('#000000', 0.6);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(winCx - winW * 0.5 + 1, winCy + winH * 0.5 - 0.5);
    ctx.lineTo(winCx + winW * 0.5 - 1, winCy + winH * 0.5 - 0.5);
    ctx.stroke();
    ctx.restore();

    // (UMB-01 serial stencil removed — was reading as HUD chrome.)

    // 12) NOZZLE — small, precision, aggressive. White-hot center.
    const nozzleX = rightX;
    const nozzleY = p.y;
    const nozzleH = r * 0.28;
    ctx.save();
    // Nozzle outer ring (machined steel collar around the bore)
    ctx.fillStyle = '#0a1216';
    ctx.beginPath();
    ctx.moveTo(nozzleX - r * 0.10, nozzleY - nozzleH * 0.95);
    ctx.lineTo(nozzleX + r * 0.02, nozzleY - nozzleH * 0.40);
    ctx.lineTo(nozzleX + r * 0.02, nozzleY + nozzleH * 0.40);
    ctx.lineTo(nozzleX - r * 0.10, nozzleY + nozzleH * 0.95);
    ctx.closePath();
    ctx.fill();
    // Collar top highlight
    ctx.strokeStyle = rgba('#8aa0a8', 0.7);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(nozzleX - r * 0.10, nozzleY - nozzleH * 0.95);
    ctx.lineTo(nozzleX + r * 0.02, nozzleY - nozzleH * 0.40);
    ctx.stroke();
    // White-hot bore at the very tip
    const boreH = nozzleH * 0.55;
    const boreG = ctx.createRadialGradient(nozzleX - 1, nozzleY, 0, nozzleX - 1, nozzleY, boreH * 2);
    boreG.addColorStop(0, rgba(PAL.white, 1.0));
    boreG.addColorStop(0.35, rgba(PAL.viridianBright, 0.95 + pulse * 0.05));
    boreG.addColorStop(0.75, rgba(PAL.viridian, 0.35));
    boreG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = boreG;
    ctx.fillRect(nozzleX - boreH * 2, nozzleY - boreH * 2, boreH * 4, boreH * 4);
    // Bore black ring (the actual aperture, very small)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(nozzleX - r * 0.03, nozzleY, r * 0.04, nozzleH * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright Mako disk inside the aperture
    ctx.fillStyle = rgba(PAL.white, 0.95);
    ctx.beginPath();
    ctx.ellipse(nozzleX - r * 0.03, nozzleY, r * 0.025, nozzleH * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 13) Single status LED — one tiny dot above the nozzle. Tesla-style.
    ctx.save();
    const ledX = shoulderX + r * 0.20;
    const ledY = p.y - shoulderHalf * 0.65;
    const ledPulse = 0.65 + 0.35 * Math.sin(t * 0.004);
    ctx.fillStyle = rgba(PAL.viridianBright, ledPulse);
    ctx.beginPath();
    ctx.arc(ledX, ledY, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // LED halo
    const ledG = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, 5);
    ledG.addColorStop(0, rgba(PAL.viridian, 0.4 * ledPulse));
    ledG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ledG;
    ctx.fillRect(ledX - 5, ledY - 5, 10, 10);
    ctx.restore();
  }

  function drawShard(s) {
    const k = Math.min(1, s.t / s.duration);
    const u = 1 - k;
    const px = u*u*s.sourceX + 2*u*k*s.cpX + k*k*s.targetX;
    const py = u*u*s.sourceY + 2*u*k*s.cpY + k*k*s.targetY;
    s.cx = px; s.cy = py;

    const prevX = s.trail.length ? s.trail[s.trail.length - 1].x : s.sourceX;
    const prevY = s.trail.length ? s.trail[s.trail.length - 1].y : s.sourceY;
    const ang = Math.atan2(py - prevY, px - prevX);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < s.trail.length; i++) {
      const tr = s.trail[i];
      const a = (tr.life / 380) * 0.6;
      ctx.fillStyle = rgba(PAL.viridianBright, a * 0.5);
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 2.2 - i * 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(PAL.white, a * 0.6);
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';

    const gR = s.size * 3;
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    gg.addColorStop(0, rgba(PAL.viridianBright, 0.9));
    gg.addColorStop(0.4, rgba(PAL.viridian, 0.35));
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-gR, -gR, gR * 2, gR * 2);

    ctx.beginPath();
    ctx.moveTo(s.size, 0);
    ctx.lineTo(-s.size * 0.4, s.size * 0.45);
    ctx.lineTo(-s.size * 0.1, 0);
    ctx.lineTo(-s.size * 0.4, -s.size * 0.45);
    ctx.closePath();
    const ag = ctx.createLinearGradient(-s.size, 0, s.size, 0);
    ag.addColorStop(0, rgba(PAL.viridian, 0.7));
    ag.addColorStop(1, rgba(PAL.white, 0.95));
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.strokeStyle = rgba(PAL.viridianBright, 1);
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  function drawExitBeam(t) {
    // Beam originates at the EXIT PORT (right point of the hex).
    const x0 = portal.x + portal.r * 1.02;
    const y = portal.y;
    const x1 = exitX;
    // Surgical thread of light — not a laser. Falls off down the length
    // (a real beam disperses), so the signal reads as far-reaching but precise.
    const intensity = 0.45 + 0.10 * Math.sin(t * 0.003) + portalPulse * 0.25 + beamFlash * 0.35;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const beamLen = x1 - x0;

    // Soft falloff along length: bright at portal, fades into space
    const lengthFade = ctx.createLinearGradient(x0, 0, x1, 0);
    lengthFade.addColorStop(0, rgba(PAL.viridian, 0.55 * intensity));
    lengthFade.addColorStop(0.4, rgba(PAL.viridian, 0.28 * intensity));
    lengthFade.addColorStop(1, rgba(PAL.viridian, 0.04 * intensity));

    // Thin halo — was 40px tall, now 14px
    const haloH = 14;
    ctx.fillStyle = lengthFade;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x0, y - haloH, beamLen, haloH * 2);
    ctx.globalAlpha = 1;

    // Mid — narrow viridian thread, was 6px, now 1.6px, with length falloff
    const midH = 1.6;
    const midFade = ctx.createLinearGradient(x0, 0, x1, 0);
    midFade.addColorStop(0, rgba(PAL.viridianBright, 0.85 * intensity));
    midFade.addColorStop(0.5, rgba(PAL.viridianBright, 0.45 * intensity));
    midFade.addColorStop(1, rgba(PAL.viridianBright, 0.10 * intensity));
    ctx.fillStyle = midFade;
    ctx.fillRect(x0, y - midH, beamLen, midH * 2);

    // Hot core — hairline, only bright near the portal
    const coreFade = ctx.createLinearGradient(x0, 0, x1, 0);
    coreFade.addColorStop(0, rgba(PAL.white, 0.85));
    coreFade.addColorStop(0.3, rgba(PAL.white, 0.45));
    coreFade.addColorStop(1, rgba(PAL.white, 0));
    ctx.fillStyle = coreFade;
    ctx.fillRect(x0, y - 0.5, beamLen, 1.0);

    // Dashed packets removed — was reading as data-stream UI.
    ctx.restore();
  }

  // ============ Update ============
  // Reuse a rock object as a fresh drifting one on the left edge.
  function respawnRock(r) {
    const fresh = makeRock(rand(-30, W * 0.08), rand(H * 0.08, H * 0.94));
    Object.assign(r, fresh);
  }

  function update(dt) {
    // Global speed multiplier — boosts perceived liveliness of the scene
    // without retuning every individual velocity. Was implicitly 1.0; 1.7 reads
    // as cinematic-but-alive rather than slow-motion.
    const SPD = 1.7;
    dt = dt * SPD;
    for (const r of rocks) {
      if (r.state === 'drift') {
        r.x += r.vx * dt * 0.05;
        r.y += r.vy * dt * 0.05;
        r.rot += r.vrot * dt * 0.06;
        r.breakT -= dt;

        // Drifted past the cloud edge: recycle on the left
        if (r.x > W * 0.46) {
          respawnRock(r);
          continue;
        }

        // Time to break orbit and head for the portal
        if (r.breakT <= 0 && r.x < W * 0.42) {
          r.state = 'inbound';
          r.startX = r.x; r.startY = r.y;
          // Rocks dock INTO the intake throat (not just to the rim). End point
          // is past the throat's outer lip and into the dark cavity, where the
          // fade-out in drawRock makes them dissolve into the green glow.
          r.endX = portal.x - portal.r * 0.55;
          r.endY = portal.y + (Math.random() - 0.5) * portal.r * 0.08;
          r.cpX = (r.startX + r.endX) * 0.5 + rand(-30, 60);
          r.cpY = (r.startY + r.endY) * 0.5 + rand(-portal.r * 0.5, portal.r * 0.5);
          r.transitT = 0;
          r.transitDur = rand(1400, 2200);
        }
      } else if (r.state === 'inbound') {
        r.transitT += dt;
        const k = Math.min(1, r.transitT / r.transitDur);
        const u = 1 - k;
        r.x = u*u*r.startX + 2*u*k*r.cpX + k*k*r.endX;
        r.y = u*u*r.startY + 2*u*k*r.cpY + k*k*r.endY;
        // Spin accelerates as it falls into the portal
        r.rot += r.vrot * dt * 0.06 * (1 + k * 6);
        // Condense — shrink as it approaches the rim
        r.size = r.baseSize * (1 - 0.55 * k);

        if (k >= 1) {
          // Consumed — emit a shard from the far rim, pulse, respawn on left
          shards.push(makeShard(r.baseSize));
          portalPulse = Math.min(1, portalPulse + 0.55);
          beamFlash = Math.min(1, beamFlash + 0.6);
          respawnRock(r);
        }
      }
    }
    for (const d of dust) {
      d.x += d.vx * dt * 0.05;
      d.y += d.vy * dt * 0.05;
      if (d.x > W * 0.55) { d.x = rand(-20, 0); d.y = rand(0, H); }
      if (d.y > H + 5) d.y = -5;
      if (d.y < -5) d.y = H + 5;
    }
    for (const s of shards) {
      s.t += dt * s.speed;
      s.trail.push({ x: s.cx, y: s.cy, life: 380 });
      if (s.trail.length > 40) s.trail.shift();
      for (const tr of s.trail) tr.life -= dt;
      s.trail = s.trail.filter(t => t.life > 0);

      // As the shard collapses toward the beam axis it sheds condensed-rock chips
      s.sparkleT -= dt;
      if (s.sparkleT <= 0) {
        s.sparkleT = rand(70, 150);
        chips.push(makeChip(s.cx + rand(-3, 3), s.cy + rand(-3, 3)));
      }

      if (s.t >= s.duration) s.exited = true;
    }
    shards = shards.filter(s => !s.exited);

    // Chips ride the beam axis to the right edge, pulled toward portal.y
    for (const c of chips) {
      c.x += c.vx * dt * 0.18;
      c.y += c.vy * dt * 0.18 + (portal.y - c.y) * 0.0009 * dt;
      c.rot += c.vrot * dt;
      c.life -= dt;
      if (c.x > exitX) c.life = -1;
    }
    chips = chips.filter(c => c.life > 0);

    portalPulse *= Math.pow(0.0002, dt / 1000);
    beamFlash *= Math.pow(0.0005, dt / 1000);
  }

  // ============ Frame ============
  function frame(now) {
    if (!running) return;
    // Clamp only to swallow huge jumps (tab-switch returns ~1s+).
    // Previously 40ms cap silently made the whole scene play in slow-motion
    // whenever a frame took longer than ~40ms to render.
    const raw = now - lastT;
    let dt = raw > 250 ? 32 : raw;
    lastT = now;
    runtime += dt;

    // Render-time scalar: speeds up all time-based pulses, breathing, scan
    // lines, beam shimmer, twinkle, etc. without retuning every coefficient.
    const T = runtime * 1.7;

    drawBackground(T);
    drawDust(T);

    // Draw DRIFT rocks before the converter (they're in the cloud, behind everything)
    // Draw INBOUND rocks AFTER the converter body but with vanish-into-throat
    // logic in drawRock so they appear to enter the green hole.
    const sorted = rocks.slice().sort((a, b) => a.z - b.z);
    for (const r of sorted) {
      if (r.state === 'drift') drawRock(r);
    }

    update(dt);
    drawPortal(T);

    // Inbound rocks now drawn ON TOP of the converter body so they look
    // like they're entering the throat. They fade/shrink at the threshold
    // so they vanish into the green hole, not on top of the metal.
    for (const r of sorted) {
      if (r.state === 'inbound') drawRock(r);
    }

    for (const s of shards) drawShard(s);
    drawExitBeam(T);
    for (const c of chips) drawChip(c);

    drawAtmosphere(T);

    // Quietly top up the particle pool until we hit full density.
    if (stars.length < starTarget || dust.length < dustTarget || rocks.length < rockTarget) {
      topUpParticles();
    }

    if (running) requestAnimationFrame(frame);
  }

  // Vignette + low Mako haze drifting horizontally. Sits on top of everything
  // so the scene feels framed and atmospheric like a cinematic still.
  function drawAtmosphere(t) {
    // Soft Mako haze drifting (very low alpha, large gaussian-ish band)
    const hazePhase = (t * 0.00006) % 1;
    const hazeY = portal.y + Math.sin(t * 0.0004) * H * 0.04;
    const hazeG = ctx.createLinearGradient(0, hazeY - H * 0.35, 0, hazeY + H * 0.35);
    hazeG.addColorStop(0, 'rgba(0,0,0,0)');
    hazeG.addColorStop(0.5, rgba(PAL.viridianDim, 0.07 + hazePhase * 0.02));
    hazeG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hazeG;
    ctx.fillRect(0, hazeY - H * 0.35, W, H * 0.7);

    // Edge vignette — radial darken from corners inward
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.55, 'rgba(0,0,0,0.20)');
    vig.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Subtle film grain — tiny scattered noise pixels (sparse, low alpha).
    // Reduced from 80 to 28 — still reads as grain, much cheaper per frame.
    const grainSeed = Math.floor(t / 80);
    const grainRand = (s) => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let i = 0; i < 28; i++) {
      const gx = grainRand(grainSeed * 1000 + i) * W;
      const gy = grainRand(grainSeed * 1000 + i + 7) * H;
      ctx.fillRect(gx, gy, 1, 1);
    }
  }

  let running = false;
  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  function staticFrame() {
    drawBackground(0);
    drawDust(0);
    for (const r of rocks.slice().sort((a, b) => a.z - b.z)) drawRock(r);
    drawPortal(0);
    drawExitBeam(0);
  }

  // ============ Init ============
  // Paint a single static frame ASAP so users see the scene immediately,
  // even before the rAF animation loop spins up. This kills the perceived
  // "slow to start" lag — the browser commits a real picture on the very
  // first paint instead of staring at black canvas while JS warms up.
  recompute();
  staticFrame();
  if (!reduceMotion) {
    // Defer the animation loop start by one rAF so the browser can commit
    // the static frame + finish initial layout before we begin per-frame work.
    requestAnimationFrame(() => requestAnimationFrame(start));
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) start();
      else stop();
    }
  });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!reduceMotion) start();
  });

  window.addEventListener("resize", () => {
    recompute();
    if (reduceMotion) staticFrame();
  });
})();
