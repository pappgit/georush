(() => {
  const LEVELS = window.GEORUSH_LEVELS;
  const STORAGE_KEY = "georush-best";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const els = {
    menu: document.getElementById("menu"),
    levelSelect: document.getElementById("level-select"),
    hud: document.getElementById("hud"),
    pause: document.getElementById("pause"),
    complete: document.getElementById("complete"),
    attempt: document.getElementById("attempt-label"),
    progressFill: document.getElementById("progress-fill"),
    progressPct: document.getElementById("progress-pct"),
    coinCount: document.getElementById("coin-count"),
    completeCoins: document.getElementById("complete-coins"),
    levelName: document.getElementById("level-name"),
    diffIcon: document.getElementById("diff-icon"),
    levelStars: document.getElementById("level-stars"),
    bestFill: document.getElementById("best-fill"),
    bestPct: document.getElementById("best-pct"),
    levelDots: document.getElementById("level-dots"),
    completePct: document.getElementById("complete-pct"),
  };

  const PLAYER_SIZE = 0.85;
  const GRAVITY = 55;
  const JUMP_VEL = 16.8;
  const GROUND_Y = 0;

  let W = 0;
  let H = 0;
  let unit = 40;
  let groundScreenY = 0;

  let state = "menu"; // menu | select | playing | dying | paused | complete
  let levelIndex = 0;
  let attempt = 1;
  let holding = false;
  let bestMap = loadBest();

  let player = null;
  let particles = [];
  let camX = 0;
  let attemptFlash = 0;
  let deathTimer = 0;
  let bgRects = [];
  let bgLights = [];
  let trail = [];
  let shake = 0;
  let finishPulse = 0;
  let lastTs = 0;
  let raf = 0;
  let coins = 0;
  let portalFlash = 0;
  let timeAlive = 0;

  /** Active run: main course or a portal pocket. */
  let run = null;
  let mainRun = null;
  let mainProgressX = 0;

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveBest(id, pct) {
    const prev = bestMap[id] || 0;
    if (pct > prev) {
      bestMap[id] = pct;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bestMap));
    }
  }

  function level() {
    return LEVELS[levelIndex];
  }

  function theme() {
    return (run && run.theme) || level().theme;
  }

  function cloneObjects(list) {
    return (list || []).map((o, i) => ({
      ...o,
      pocket: o.pocket
        ? {
            ...o.pocket,
            theme: o.pocket.theme ? { ...o.pocket.theme } : undefined,
            objects: (o.pocket.objects || []).map((p) => ({ ...p })),
          }
        : undefined,
      _id: i,
      collected: false,
      used: false,
    }));
  }

  function buildMainRun() {
    const L = level();
    mainRun = {
      mode: "main",
      objects: cloneObjects(L.objects),
      length: L.length,
      speed: L.speed,
      theme: L.theme,
      returnX: 0,
      flash: !!L.flash,
    };
    run = mainRun;
    mainProgressX = 0;
  }

  function enterPortal(portal) {
    const pocket = portal.pocket;
    if (!pocket || run.mode !== "main") return;
    portal.used = true;
    mainProgressX = Math.max(mainProgressX, player.x);
    const exitX = portal.x + (portal.w || 1.4) + 0.45;
    mainRun = run;
    run = {
      mode: "portal",
      objects: cloneObjects(pocket.objects),
      length: pocket.length,
      speed: pocket.speed || level().speed,
      theme: pocket.theme || level().theme,
      returnX: exitX,
      flash: pocket.flash !== false,
      label: pocket.name || "COIN ZONE",
    };
    player.x = 2;
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.rot = 0;
    player.targetRot = 0;
    camX = 0;
    trail = [];
    portalFlash = 0.7;
    attemptFlash = 0.9;
    spawnPortalBurst(player.x, player.y + 1);
  }

  function exitPortal() {
    const returnX = run.returnX;
    run = mainRun;
    // Keep coins; restore position just past the portal entrance.
    player.x = returnX;
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.rot = 0;
    player.targetRot = 0;
    camX = Math.max(0, player.x - 1.5);
    mainProgressX = Math.max(mainProgressX, returnX);
    trail = [];
    portalFlash = 0.55;
    spawnPortalBurst(player.x, player.y + 1);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.max(28, Math.min(H * 0.12, W * 0.055));
    groundScreenY = H * 0.78;
    buildBg();
  }

  function buildBg() {
    bgRects = [];
    bgLights = [];
    for (let i = 0; i < 28; i++) {
      bgRects.push({
        x: Math.random() * 80,
        y: Math.random() * 0.7,
        w: 2 + Math.random() * 8,
        h: 1.5 + Math.random() * 5,
        a: 0.04 + Math.random() * 0.08,
        parallax: 0.15 + Math.random() * 0.35,
      });
    }
    for (let i = 0; i < 10; i++) {
      bgLights.push({
        x: Math.random(),
        y: 0.08 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 5,
        size: 0.04 + Math.random() * 0.1,
        colorPick: Math.random(),
      });
    }
  }

  function resetPlayer() {
    buildMainRun();
    coins = 0;
    timeAlive = 0;
    player = {
      x: 2,
      y: GROUND_Y,
      vx: run.speed,
      vy: 0,
      rot: 0,
      targetRot: 0,
      onGround: true,
      alive: true,
      size: PLAYER_SIZE,
    };
    camX = 0;
    particles = [];
    trail = [];
    attemptFlash = 1.1;
    deathTimer = 0;
    finishPulse = 0;
    shake = 0;
    portalFlash = 0;
    updateCoinHud();
  }

  function startLevel() {
    attempt = 1;
    resetPlayer();
    state = "playing";
    showScreen(null);
    els.hud.classList.remove("hidden");
    updateHud(0);
  }

  function restartAttempt() {
    attempt += 1;
    resetPlayer();
    state = "playing";
  }

  function showScreen(name) {
    els.menu.classList.add("hidden");
    els.levelSelect.classList.add("hidden");
    els.pause.classList.add("hidden");
    els.complete.classList.add("hidden");
    if (name === "menu") els.menu.classList.remove("hidden");
    if (name === "select") els.levelSelect.classList.remove("hidden");
    if (name === "pause") els.pause.classList.remove("hidden");
    if (name === "complete") els.complete.classList.remove("hidden");
    if (name !== null) els.hud.classList.add("hidden");
  }

  function renderLevelCard() {
    const L = level();
    els.levelName.textContent = L.name;
    els.diffIcon.style.background = L.diffColor;
    els.diffIcon.style.boxShadow = `0 0 16px ${L.diffColor}88`;
    els.diffIcon.textContent = L.difficulty[0];
    els.levelStars.textContent = L.stars;
    const best = Math.floor(bestMap[L.id] || 0);
    els.bestFill.style.width = best + "%";
    els.bestPct.textContent = best + "%";

    els.levelDots.innerHTML = "";
    LEVELS.forEach((_, i) => {
      const d = document.createElement("span");
      if (i === levelIndex) d.classList.add("active");
      els.levelDots.appendChild(d);
    });

    const card = document.getElementById("level-card");
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }

  function worldToScreen(x, y) {
    const sx = (x - camX) * unit + W * 0.22;
    const sy = groundScreenY - y * unit;
    return { x: sx, y: sy };
  }

  function jump() {
    if (state !== "playing" || !player || !player.alive) return;
    if (!player.onGround) return;
    player.vy = JUMP_VEL;
    player.onGround = false;
    player.targetRot += Math.PI / 2;
    spawnDust(player.x, player.y, 6);
  }

  function spawnDust(x, y, n) {
    const t = theme();
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3,
        life: 0.35 + Math.random() * 0.2,
        max: 0.55,
        size: 0.1 + Math.random() * 0.15,
        color: t.accent,
      });
    }
  }

  function spawnCoinBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        size: 0.08 + Math.random() * 0.12,
        color: "#ffd166",
      });
    }
  }

  function spawnPortalBurst(x, y) {
    const t = theme();
    for (let i = 0; i < 22; i++) {
      const a = (Math.PI * 2 * i) / 22;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * 6,
        vy: Math.sin(a) * 6,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        size: 0.12 + Math.random() * 0.18,
        color: Math.random() > 0.5 ? t.accent : "#ffffff",
        square: true,
      });
    }
  }

  function explode() {
    const t = theme();
    shake = 0.45;
    for (let i = 0; i < 28; i++) {
      const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.3;
      const sp = 4 + Math.random() * 10;
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        size: 0.15 + Math.random() * 0.28,
        color: Math.random() > 0.4 ? t.player : t.particle,
        square: true,
      });
    }
  }

  /** Highest solid top the player can land on this frame (or null if none). */
  function highestFloor(px, pw, prevY, nextY) {
    let best = null;
    const candidates = [GROUND_Y];
    for (const o of run.objects) {
      if (o.type !== "block") continue;
      const by = o.y ?? 0;
      const left = o.x;
      const right = o.x + o.w;
      const topY = by + o.h;
      if (px + pw > left + 0.1 && px < right - 0.1) candidates.push(topY);
    }
    for (const top of candidates) {
      if (prevY >= top - 0.02 && nextY <= top + 0.08) {
        if (best == null || top > best) best = top;
      }
    }
    return best;
  }

  function playerHitbox() {
    return {
      px: player.x + 0.12,
      py: player.y + 0.12,
      pw: player.size - 0.24,
      ph: player.size - 0.24,
    };
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function laserActive(o, now) {
    const period = o.period || 1.4;
    const duty = o.duty == null ? 0.55 : o.duty;
    const phase = o.phase || 0;
    const t = ((now / 1000 + phase) % period) / period;
    return t < duty;
  }

  function hitHazard() {
    const { px, py, pw, ph } = playerHitbox();
    const now = performance.now();

    for (const o of run.objects) {
      if (o.type === "spike") {
        const sy = o.y ?? 0;
        const sx = o.x + 0.12;
        const sw = (o.w || 1) - 0.24;
        const sh = (o.h || 1) - 0.05;
        if (overlap(px, py, pw, ph, sx, sy, sw, sh)) return true;
      } else if (o.type === "ceilSpike") {
        const h = o.h || 1;
        const top = (o.y ?? 3);
        const bottom = top - h;
        const sx = o.x + 0.12;
        const sw = (o.w || 1) - 0.24;
        if (overlap(px, py, pw, ph, sx, bottom, sw, h - 0.05)) return true;
      } else if (o.type === "saw") {
        const r = o.r || 0.7;
        const cx = o.x + r;
        let cy = (o.y ?? r);
        if (o.move) {
          cy = (o.y ?? r) + Math.sin(now / 1000 * (o.moveSpeed || 3) + (o.phase || 0)) * (o.move || 1);
        }
        const pcx = px + pw / 2;
        const pcy = py + ph / 2;
        const dx = pcx - cx;
        const dy = pcy - cy;
        const pr = Math.min(pw, ph) * 0.45;
        if (dx * dx + dy * dy < (r + pr) * (r + pr) * 0.85) return true;
      } else if (o.type === "laser") {
        if (!laserActive(o, now)) continue;
        const y = o.y ?? 1;
        const h = o.h || 0.35;
        if (overlap(px, py, pw, ph, o.x, y, o.w || 2, h)) return true;
      }
    }
    return false;
  }

  function collectCoins() {
    const { px, py, pw, ph } = playerHitbox();
    for (const o of run.objects) {
      if (o.type !== "coin" || o.collected) continue;
      const cy = o.y ?? 1;
      const cx = o.x;
      const s = o.s || 0.55;
      if (overlap(px, py, pw, ph, cx, cy, s, s)) {
        o.collected = true;
        coins += 1;
        updateCoinHud();
        spawnCoinBurst(cx + s / 2, cy + s / 2);
      }
    }
  }

  function tryPortal() {
    if (run.mode !== "main") return;
    const { px, py, pw, ph } = playerHitbox();
    for (const o of run.objects) {
      if (o.type !== "portal" || o.used) continue;
      const w = o.w || 1.4;
      const h = o.h || 3.2;
      if (overlap(px, py, pw, ph, o.x + 0.15, 0, w - 0.3, h)) {
        enterPortal(o);
        return;
      }
    }
  }

  function reachedFinish() {
    const fin = run.objects.find((o) => o.type === "finish");
    if (!fin) return player.x >= run.length - 2;
    return player.x + player.size >= fin.x;
  }

  function updateCoinHud() {
    if (els.coinCount) els.coinCount.textContent = String(coins);
  }

  function updateHud(pct) {
    els.attempt.textContent = "ATTEMPT " + attempt;
    els.progressFill.style.width = pct + "%";
    els.progressPct.textContent = pct + "%";
    updateCoinHud();
  }

  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (portalFlash > 0) portalFlash = Math.max(0, portalFlash - dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= GRAVITY * 0.25 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (state === "dying") {
      deathTimer -= dt;
      if (deathTimer <= 0) restartAttempt();
      return;
    }

    if (state !== "playing" || !player || !run) return;

    timeAlive += dt;
    player.vx = run.speed;

    if (holding && player.onGround) jump();

    player.vy -= GRAVITY * dt;
    player.x += player.vx * dt;
    const prevY = player.y;
    player.y += player.vy * dt;

    const floor = highestFloor(player.x, player.size, prevY, player.y);
    if (floor != null && player.vy <= 0) {
      player.y = floor;
      player.vy = 0;
      if (!player.onGround) {
        player.onGround = true;
        player.rot = Math.round(player.targetRot / (Math.PI / 2)) * (Math.PI / 2);
        player.targetRot = player.rot;
        spawnDust(player.x + player.size / 2, player.y, 4);
      } else {
        player.onGround = true;
      }
    } else {
      player.onGround = false;
    }

    if (!player.onGround) {
      const diff = player.targetRot - player.rot;
      player.rot += diff * Math.min(1, dt * 10);
    }

    trail.push({ x: player.x, y: player.y, rot: player.rot, life: 0.25 });
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }

    camX = Math.max(0, player.x - 1.5);

    collectCoins();
    tryPortal();

    if (run.mode === "main") {
      mainProgressX = Math.max(mainProgressX, player.x);
    }
    const progressBase = run.mode === "main" ? mainProgressX : mainProgressX;
    const pct = Math.min(100, Math.floor((progressBase / level().length) * 100));
    updateHud(pct);
    saveBest(level().id, pct);

    if (attemptFlash > 0) attemptFlash -= dt;

    if (player.y < -3) {
      die(pct);
      return;
    }

    if (hitHazard()) {
      die(pct);
      return;
    }

    if (reachedFinish()) {
      if (run.mode === "portal") {
        exitPortal();
        return;
      }
      finishPulse = 1;
      saveBest(level().id, 100);
      updateHud(100);
      state = "complete";
      els.completePct.textContent = "100% · " + level().name;
      if (els.completeCoins) els.completeCoins.textContent = coins + " coins";
      showScreen("complete");
    }
  }

  function die(pct) {
    player.alive = false;
    explode();
    saveBest(level().id, pct);
    state = "dying";
    deathTimer = 0.85;
  }

  function drawBackground() {
    const t = theme();
    const now = performance.now();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.skyTop);
    g.addColorStop(1, t.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const flashOn = run && (run.flash || run.mode === "portal");
    if (flashOn) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      const strobe = Math.sin(now / 90) > 0.75 ? 0.14 : 0;
      ctx.fillStyle = hexAlpha(t.accent, 0.04 + pulse * 0.07 + strobe);
      ctx.fillRect(0, 0, W, H);

      for (const light of bgLights) {
        const blink = 0.35 + 0.65 * Math.max(0, Math.sin(now / 1000 * light.speed + light.phase));
        const col = light.colorPick > 0.5 ? t.accent : (t.groundLine || "#fff");
        const lx = (light.x * W + Math.sin(now / 700 + light.phase) * 40 + W) % W;
        const ly = light.y * groundScreenY;
        const r = light.size * H * (0.8 + blink * 0.6);
        const rad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        rad.addColorStop(0, hexAlpha(col, 0.35 * blink));
        rad.addColorStop(0.45, hexAlpha(col, 0.12 * blink));
        rad.addColorStop(1, hexAlpha(col, 0));
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // sweeping light beams
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const bx = ((now * (0.08 + i * 0.03) + i * 220) % (W + 200)) - 100;
        const beam = ctx.createLinearGradient(bx, 0, bx + 90, H);
        beam.addColorStop(0, hexAlpha(t.accent, 0));
        beam.addColorStop(0.5, hexAlpha(t.accent, 0.07 + strobe * 0.05));
        beam.addColorStop(1, hexAlpha(t.accent, 0));
        ctx.fillStyle = beam;
        ctx.fillRect(bx, 0, 90, groundScreenY);
      }
      ctx.restore();
    }

    for (const r of bgRects) {
      const x = ((r.x * unit - camX * unit * r.parallax) % (W + r.w * unit)) - r.w * unit * 0.2;
      const y = r.y * groundScreenY;
      const aBoost = flashOn ? 0.03 * (0.5 + 0.5 * Math.sin(now / 200 + r.x)) : 0;
      ctx.fillStyle = hexAlpha(t.accent, r.a + aBoost);
      ctx.strokeStyle = hexAlpha(t.accent, (r.a + aBoost) * 1.6);
      ctx.lineWidth = 2;
      roundRect(x, y, r.w * unit, r.h * unit, 6);
      ctx.fill();
      ctx.stroke();
    }

    if (run && run.mode === "portal") {
      ctx.fillStyle = hexAlpha("#ffd166", 0.06 + 0.04 * Math.sin(now / 140));
      ctx.fillRect(0, 0, W, H);
    }

    // ground plane
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, groundScreenY, W, H - groundScreenY + 20);
    ctx.strokeStyle = t.groundLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = t.groundLine;
    ctx.shadowBlur = flashOn ? 16 + 8 * Math.sin(now / 120) : 12;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(W, groundScreenY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ground grid ticks
    ctx.strokeStyle = hexAlpha(t.groundLine, 0.15);
    ctx.lineWidth = 1;
    const start = Math.floor(camX);
    for (let i = start; i < start + 40; i++) {
      const p = worldToScreen(i, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, groundScreenY);
      ctx.lineTo(p.x, groundScreenY + 14);
      ctx.stroke();
    }
  }

  function drawCoin(o, t) {
    if (o.collected) return;
    const s = o.s || 0.55;
    const y = o.y ?? 1;
    const bob = Math.sin(performance.now() / 180 + o.x) * 0.12;
    const p = worldToScreen(o.x, y + bob);
    const sz = s * unit;
    ctx.save();
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(p.x + sz / 2, p.y - sz / 2, sz / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff6c0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = hexAlpha("#fff", 0.55);
    ctx.beginPath();
    ctx.arc(p.x + sz * 0.38, p.y - sz * 0.62, sz * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(o, t) {
    const w = (o.w || 1.4) * unit;
    const h = (o.h || 3.2) * unit;
    const p = worldToScreen(o.x, 0);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150 + o.x);
    const grad = ctx.createLinearGradient(p.x, p.y - h, p.x + w, p.y);
    grad.addColorStop(0, hexAlpha("#7b5cff", 0.25 + pulse * 0.25));
    grad.addColorStop(0.5, hexAlpha("#5ce1ff", 0.55));
    grad.addColorStop(1, hexAlpha("#ff5d9a", 0.25 + pulse * 0.25));
    ctx.fillStyle = grad;
    ctx.shadowColor = "#5ce1ff";
    ctx.shadowBlur = 18 + pulse * 10;
    roundRect(p.x, p.y - h, w, h, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    // swirl lines
    ctx.strokeStyle = hexAlpha("#ffffff", 0.45);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = p.y - h * (0.25 + i * 0.25) + Math.sin(performance.now() / 200 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, yy);
      ctx.bezierCurveTo(p.x + w * 0.35, yy - 10, p.x + w * 0.65, yy + 10, p.x + w - 8, yy);
      ctx.stroke();
    }
  }

  function drawSaw(o, t) {
    const r = o.r || 0.7;
    const now = performance.now();
    let cy = o.y ?? r;
    if (o.move) {
      cy = (o.y ?? r) + Math.sin(now / 1000 * (o.moveSpeed || 3) + (o.phase || 0)) * o.move;
    }
    const p = worldToScreen(o.x + r, cy);
    const rad = r * unit;
    const rot = now / 120;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);
    ctx.fillStyle = t.spike;
    ctx.strokeStyle = t.spikeEdge;
    ctx.lineWidth = 3;
    ctx.shadowColor = t.accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * rad * 0.65, Math.sin(a0) * rad * 0.65);
      ctx.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad);
      ctx.lineTo(Math.cos(a2) * rad * 0.65, Math.sin(a2) * rad * 0.65);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = t.blockEdge;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLaser(o, t) {
    const now = performance.now();
    const active = laserActive(o, now);
    const y = o.y ?? 1;
    const h = o.h || 0.35;
    const p = worldToScreen(o.x, y + h);
    const w = (o.w || 2) * unit;
    const hh = h * unit;
    if (!active) {
      ctx.fillStyle = hexAlpha(t.accent, 0.12);
      ctx.fillRect(p.x, p.y, w, hh);
      ctx.strokeStyle = hexAlpha(t.accent, 0.25);
      ctx.strokeRect(p.x, p.y, w, hh);
      return;
    }
    const pulse = 0.6 + 0.4 * Math.sin(now / 60);
    ctx.fillStyle = hexAlpha("#ff4d5e", 0.55 * pulse);
    ctx.shadowColor = "#ff4d5e";
    ctx.shadowBlur = 18;
    ctx.fillRect(p.x, p.y, w, hh);
    ctx.fillStyle = hexAlpha("#fff", 0.7);
    ctx.fillRect(p.x, p.y + hh * 0.3, w, hh * 0.35);
    ctx.shadowBlur = 0;
  }

  function drawObjects() {
    const t = theme();
    const margin = 3;
    for (const o of run.objects) {
      const ox = o.x;
      const ow = o.w || (o.type === "saw" ? (o.r || 0.7) * 2 : 1);
      if (ox + ow < camX - margin || ox > camX + W / unit + margin) {
        if (o.type !== "finish" && o.type !== "portal") continue;
      }

      if (o.type === "block") {
        const y = o.y ?? 0;
        const p = worldToScreen(o.x, y + o.h);
        const w = o.w * unit;
        const h = o.h * unit;
        ctx.fillStyle = t.block;
        ctx.strokeStyle = t.blockEdge;
        ctx.lineWidth = 3;
        ctx.shadowColor = t.blockEdge;
        ctx.shadowBlur = 8;
        roundRect(p.x, p.y, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hexAlpha(t.blockEdge, 0.35);
        ctx.lineWidth = 2;
        roundRect(p.x + 6, p.y + 6, w - 12, h - 12, 2);
        ctx.stroke();
      } else if (o.type === "spike") {
        const y = o.y ?? 0;
        const p = worldToScreen(o.x, y);
        const w = (o.w || 1) * unit;
        const h = (o.h || 1) * unit;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + w / 2, p.y - h);
        ctx.lineTo(p.x + w, p.y);
        ctx.closePath();
        ctx.fillStyle = t.spike;
        ctx.strokeStyle = t.spikeEdge;
        ctx.lineWidth = 3;
        ctx.shadowColor = t.spikeEdge;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (o.type === "ceilSpike") {
        const top = o.y ?? 3;
        const h = o.h || 1;
        const p = worldToScreen(o.x, top);
        const w = (o.w || 1) * unit;
        const hh = h * unit;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + w / 2, p.y + hh);
        ctx.lineTo(p.x + w, p.y);
        ctx.closePath();
        ctx.fillStyle = t.spike;
        ctx.strokeStyle = t.spikeEdge;
        ctx.lineWidth = 3;
        ctx.shadowColor = t.spikeEdge;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (o.type === "saw") {
        drawSaw(o, t);
      } else if (o.type === "laser") {
        drawLaser(o, t);
      } else if (o.type === "coin") {
        drawCoin(o, t);
      } else if (o.type === "portal") {
        drawPortal(o, t);
      } else if (o.type === "finish") {
        const p = worldToScreen(o.x, 0);
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        const h = 4.2 * unit;
        const grad = ctx.createLinearGradient(p.x, p.y - h, p.x + unit * 1.2, p.y);
        grad.addColorStop(0, hexAlpha(t.accent, 0.1 + pulse * 0.25));
        grad.addColorStop(0.5, hexAlpha("#ffffff", 0.55));
        grad.addColorStop(1, hexAlpha(t.accent, 0.1 + pulse * 0.25));
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y - h, unit * 1.1, h);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y - h, unit * 1.1, h);
      }
    }
  }

  function drawPlayer() {
    if (!player) return;
    const t = theme();

    for (const tr of trail) {
      if (!player.alive) break;
      const p = worldToScreen(tr.x, tr.y);
      const a = Math.max(0, tr.life / 0.25) * 0.25;
      ctx.save();
      ctx.translate(p.x + (player.size * unit) / 2, p.y - (player.size * unit) / 2);
      ctx.rotate(tr.rot);
      ctx.fillStyle = hexAlpha(t.player, a);
      ctx.fillRect((-player.size * unit) / 2, (-player.size * unit) / 2, player.size * unit, player.size * unit);
      ctx.restore();
    }

    if (!player.alive) return;

    const p = worldToScreen(player.x, player.y);
    const s = player.size * unit;
    ctx.save();
    ctx.translate(p.x + s / 2, p.y - s / 2);
    ctx.rotate(player.rot);
    ctx.shadowColor = t.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = t.player;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    roundRect(-s / 2, -s / 2, s, s, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // face
    ctx.fillStyle = t.playerInk;
    const e = s * 0.12;
    ctx.fillRect(-s * 0.28, -s * 0.18, e, e * 1.4);
    ctx.fillRect(s * 0.1, -s * 0.18, e, e * 1.4);
    ctx.fillRect(-s * 0.18, s * 0.12, s * 0.36, e * 0.9);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = hexAlpha(p.color, a);
      const sz = p.size * unit;
      if (p.square) {
        ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawAttemptFlash() {
    if (attemptFlash <= 0 || state === "dying") return;
    const a = Math.min(1, attemptFlash);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `900 ${Math.floor(H * 0.12)}px Russo One, Orbitron, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";
    const text = run && run.mode === "portal"
      ? (run.label || "COIN ZONE")
      : "ATTEMPT " + attempt;
    ctx.strokeText(text, W / 2, H * 0.42);
    ctx.fillText(text, W / 2, H * 0.42);
    ctx.restore();
  }

  function drawPortalFlash() {
    if (portalFlash <= 0) return;
    ctx.fillStyle = hexAlpha("#ffffff", portalFlash * 0.55);
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      const m = shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    if (state === "menu") {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2a1050");
      g.addColorStop(1, "#0a0418");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }

    if (state === "select") {
      const t = level().theme;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, t.skyTop);
      g.addColorStop(1, t.skyBot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      drawDecorStairs(t);
      ctx.restore();
      return;
    }

    drawBackground();
    drawObjects();
    drawParticles();
    drawPlayer();
    drawAttemptFlash();
    drawPortalFlash();
    ctx.restore();
  }

  function drawDecorStairs(t) {
    const size = unit * 0.9;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? t.accent : hexAlpha(t.accent, 0.65);
      ctx.fillRect(20 + i * size * 0.15, H - 20 - (i + 1) * size, size, (i + 1) * size);
      ctx.fillRect(W - 20 - size - i * size * 0.15, H - 20 - (i + 1) * size, size, (i + 1) * size);
    }
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function hexAlpha(hex, a) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onDown(e) {
    if (e && e.cancelable) e.preventDefault();
    holding = true;
    if (state === "playing") jump();
  }

  function onUp() {
    holding = false;
  }

  // UI wiring
  document.getElementById("btn-play").addEventListener("click", () => {
    state = "select";
    showScreen("select");
    renderLevelCard();
  });

  document.getElementById("btn-back-menu").addEventListener("click", () => {
    state = "menu";
    showScreen("menu");
  });

  document.getElementById("btn-prev").addEventListener("click", () => {
    levelIndex = (levelIndex - 1 + LEVELS.length) % LEVELS.length;
    renderLevelCard();
  });

  document.getElementById("btn-next").addEventListener("click", () => {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    renderLevelCard();
  });

  document.getElementById("btn-start").addEventListener("click", startLevel);

  document.getElementById("btn-pause").addEventListener("click", (e) => {
    e.stopPropagation();
    if (state !== "playing") return;
    state = "paused";
    showScreen("pause");
    els.hud.classList.remove("hidden");
  });

  document.getElementById("btn-resume").addEventListener("click", () => {
    state = "playing";
    showScreen(null);
    els.hud.classList.remove("hidden");
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    attempt = 1;
    resetPlayer();
    state = "playing";
    showScreen(null);
    els.hud.classList.remove("hidden");
  });

  document.getElementById("btn-quit").addEventListener("click", () => {
    state = "select";
    showScreen("select");
    renderLevelCard();
  });

  document.getElementById("btn-replay").addEventListener("click", startLevel);

  document.getElementById("btn-next-level").addEventListener("click", () => {
    levelIndex = Math.min(LEVELS.length - 1, levelIndex + 1);
    startLevel();
  });

  document.getElementById("btn-to-select").addEventListener("click", () => {
    state = "select";
    showScreen("select");
    renderLevelCard();
  });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (!holding) onDown();
    }
    if (e.code === "Escape" && state === "playing") {
      state = "paused";
      showScreen("pause");
      els.hud.classList.remove("hidden");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") onUp();
  });

  // swipe on level select
  let touchStartX = null;
  els.levelSelect.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  els.levelSelect.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      levelIndex = dx < 0
        ? (levelIndex + 1) % LEVELS.length
        : (levelIndex - 1 + LEVELS.length) % LEVELS.length;
      renderLevelCard();
    }
    touchStartX = null;
  }, { passive: true });

  resize();
  showScreen("menu");
  state = "menu";
  requestAnimationFrame(loop);
})();
