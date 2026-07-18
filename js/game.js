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
  let trail = [];
  let shake = 0;
  let finishPulse = 0;
  let lastTs = 0;
  let raf = 0;

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
  }

  function resetPlayer() {
    player = {
      x: 2,
      y: GROUND_Y,
      vx: level().speed,
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
    const t = level().theme;
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

  function explode() {
    const t = level().theme;
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
    const L = level();
    for (const o of L.objects) {
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

  function hitSpike() {
    const L = level();
    const px = player.x + 0.12;
    const py = player.y + 0.12;
    const pw = player.size - 0.24;
    const ph = player.size - 0.24;
    for (const o of L.objects) {
      if (o.type !== "spike") continue;
      const sy = o.y ?? 0;
      const sx = o.x + 0.12;
      const sw = (o.w || 1) - 0.24;
      const sh = (o.h || 1) - 0.05;
      if (px < sx + sw && px + pw > sx && py < sy + sh && py + ph > sy) {
        return true;
      }
    }
    return false;
  }

  function reachedFinish() {
    const fin = level().objects.find((o) => o.type === "finish");
    if (!fin) return player.x >= level().length - 2;
    return player.x + player.size >= fin.x;
  }

  function updateHud(pct) {
    els.attempt.textContent = "ATTEMPT " + attempt;
    els.progressFill.style.width = pct + "%";
    els.progressPct.textContent = pct + "%";
  }

  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt);

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

    if (state !== "playing" || !player) return;

    const L = level();
    player.vx = L.speed;

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

    const pct = Math.min(100, Math.floor((player.x / L.length) * 100));
    updateHud(pct);
    saveBest(L.id, pct);

    if (attemptFlash > 0) attemptFlash -= dt;

    if (player.y < -3) {
      die(pct);
      return;
    }

    if (hitSpike()) {
      die(pct);
      return;
    }

    if (reachedFinish()) {
      finishPulse = 1;
      saveBest(L.id, 100);
      updateHud(100);
      state = "complete";
      els.completePct.textContent = "100% · " + L.name;
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
    const t = level().theme;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.skyTop);
    g.addColorStop(1, t.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const r of bgRects) {
      const x = ((r.x * unit - camX * unit * r.parallax) % (W + r.w * unit)) - r.w * unit * 0.2;
      const y = r.y * groundScreenY;
      ctx.fillStyle = hexAlpha(t.accent, r.a);
      ctx.strokeStyle = hexAlpha(t.accent, r.a * 1.6);
      ctx.lineWidth = 2;
      roundRect(x, y, r.w * unit, r.h * unit, 6);
      ctx.fill();
      ctx.stroke();
    }

    // ground plane
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, groundScreenY, W, H - groundScreenY + 20);
    ctx.strokeStyle = t.groundLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = t.groundLine;
    ctx.shadowBlur = 12;
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

  function drawObjects() {
    const L = level();
    const t = L.theme;
    for (const o of L.objects) {
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
        // inner shine
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
    const t = level().theme;

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
    const text = "ATTEMPT " + attempt;
    ctx.strokeText(text, W / 2, H * 0.42);
    ctx.fillText(text, W / 2, H * 0.42);
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      const m = shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    if (state === "menu") {
      // subtle animated backdrop behind menu
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
      // decorative stairs
      drawDecorStairs(t);
      ctx.restore();
      return;
    }

    drawBackground();
    drawObjects();
    drawParticles();
    drawPlayer();
    drawAttemptFlash();
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
