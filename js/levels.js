/** GeoRush level definitions — world units, ground at y=0 */
(function () {
  function coinPocket(name, seed) {
    const objects = [];
    let x = 4;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 14; i++) {
        objects.push({
          type: "coin",
          x: x + i * 1.1 + (row % 2) * 0.35,
          y: 0.8 + row * 1.05 + ((i + seed + row) % 3) * 0.08,
        });
      }
    }
    // light garnish so it is not completely free — still mostly coins
    objects.push({ type: "spike", x: 10 + (seed % 5), w: 1, h: 1 });
    objects.push({ type: "spike", x: 22 + (seed % 3), w: 1, h: 1 });
    objects.push({ type: "block", x: 14, y: 0, w: 2, h: 1 });
    objects.push({ type: "coin", x: 14.4, y: 1.4 });
    objects.push({ type: "coin", x: 15.2, y: 1.4 });
    objects.push({ type: "finish", x: 36 });
    return {
      name,
      length: 42,
      speed: 11.5,
      flash: true,
      theme: {
        skyTop: "#3a2060",
        skyBot: "#120828",
        ground: "#0e0620",
        groundLine: "#ffd166",
        accent: "#ffd166",
        block: "#3a2860",
        blockEdge: "#ffe09a",
        spike: "#1a1028",
        spikeEdge: "#fff0c0",
        player: "#7ef9c0",
        playerInk: "#041510",
        particle: "#fff0a0",
      },
      objects,
    };
  }

  function addCoins(objects, spots) {
    for (const s of spots) {
      objects.push({ type: "coin", x: s[0], y: s[1] ?? 1.1 });
    }
  }

  /** ~2 minute course at speed 12 → length ≈ 1440 */
  function buildFlashRush() {
    const speed = 12;
    const length = 1440;
    const objects = [];
    let x = 14;

    function spikeRow(at, n, gap) {
      for (let i = 0; i < n; i++) {
        objects.push({ type: "spike", x: at + i * (gap || 1.15), w: 1, h: 1 });
      }
    }

    function stairs(at, h) {
      for (let i = 0; i < h; i++) {
        objects.push({ type: "block", x: at + i * 2, y: 0, w: 2, h: i + 1 });
      }
    }

    // Intro warmup
    spikeRow(x, 1);
    objects.push({ type: "coin", x: x + 3, y: 1.2 });
    objects.push({ type: "coin", x: x + 4.2, y: 1.5 });
    x += 10;
    spikeRow(x, 2);
    objects.push({ type: "coin", x: x + 4, y: 1.3 });
    x += 12;

    let section = 0;
    while (x < length - 80) {
      const kind = section % 7;
      if (kind === 0) {
        // spike packs + coins
        spikeRow(x, 1 + (section % 3));
        objects.push({ type: "coin", x: x + 4, y: 1.4 });
        objects.push({ type: "coin", x: x + 5.2, y: 1.8 });
        x += 9 + (section % 4);
        spikeRow(x, 3, 1.15);
        objects.push({ type: "coin", x: x + 5.5, y: 1.5 });
        x += 12;
      } else if (kind === 1) {
        // blocks / stairs
        stairs(x, 2 + (section % 2));
        objects.push({ type: "coin", x: x + 1, y: 2.2 });
        objects.push({ type: "coin", x: x + 3, y: 3.2 });
        x += 12;
        objects.push({ type: "spike", x: x, w: 1, h: 1 });
        objects.push({ type: "spike", x: x + 1.2, w: 1, h: 1 });
        objects.push({ type: "coin", x: x + 3.5, y: 1.3 });
        x += 10;
      } else if (kind === 2) {
        // ceiling spikes
        objects.push({ type: "block", x: x, y: 0, w: 3, h: 1 });
        objects.push({ type: "ceilSpike", x: x + 0.5, y: 3.4, w: 1, h: 1.1 });
        objects.push({ type: "ceilSpike", x: x + 1.7, y: 3.4, w: 1, h: 1.1 });
        objects.push({ type: "coin", x: x + 1.1, y: 1.5 });
        x += 8;
        spikeRow(x, 2);
        objects.push({ type: "ceilSpike", x: x + 4, y: 3.2, w: 1, h: 1.2 });
        objects.push({ type: "coin", x: x + 6, y: 1.6 });
        x += 12;
      } else if (kind === 3) {
        // saws
        objects.push({ type: "saw", x: x, y: 0.75, r: 0.75 });
        objects.push({ type: "coin", x: x + 3, y: 1.8 });
        objects.push({ type: "coin", x: x + 4.2, y: 2.1 });
        x += 8;
        objects.push({
          type: "saw",
          x: x,
          y: 1.4,
          r: 0.7,
          move: 0.9,
          moveSpeed: 3.2,
          phase: section * 0.7,
        });
        objects.push({ type: "coin", x: x + 3.5, y: 1.2 });
        x += 10;
        spikeRow(x, 2);
        x += 9;
      } else if (kind === 4) {
        // pulse lasers
        objects.push({ type: "block", x: x, y: 0, w: 2, h: 1 });
        objects.push({
          type: "laser",
          x: x + 4,
          y: 0.9,
          w: 4.5,
          h: 0.35,
          period: 1.5,
          duty: 0.45,
          phase: section * 0.3,
        });
        objects.push({ type: "coin", x: x + 5.5, y: 2.2 });
        objects.push({ type: "coin", x: x + 6.8, y: 2.5 });
        x += 12;
        objects.push({
          type: "laser",
          x: x,
          y: 0.4,
          w: 3.5,
          h: 0.3,
          period: 1.2,
          duty: 0.4,
          phase: 0.6,
        });
        objects.push({ type: "spike", x: x + 5, w: 1, h: 1 });
        objects.push({ type: "coin", x: x + 7, y: 1.4 });
        x += 12;
      } else if (kind === 5) {
        // floating platforms
        objects.push({ type: "spike", x: x, w: 1, h: 1 });
        objects.push({ type: "spike", x: x + 1.2, w: 1, h: 1 });
        objects.push({ type: "block", x: x + 4, y: 1, w: 2.5, h: 1 });
        objects.push({ type: "coin", x: x + 4.6, y: 2.4 });
        objects.push({ type: "block", x: x + 9, y: 2, w: 2.5, h: 1 });
        objects.push({ type: "coin", x: x + 9.6, y: 3.4 });
        objects.push({ type: "spike", x: x + 5, y: 0, w: 1, h: 1 });
        objects.push({ type: "spike", x: x + 9.5, y: 0, w: 1, h: 1 });
        objects.push({ type: "block", x: x + 14, y: 1, w: 2.5, h: 1 });
        objects.push({ type: "coin", x: x + 14.7, y: 2.4 });
        x += 22;
      } else {
        // mixed gauntlet
        stairs(x, 3);
        objects.push({ type: "ceilSpike", x: x + 2, y: 4.2, w: 1, h: 1 });
        objects.push({ type: "coin", x: x + 4.2, y: 3.5 });
        x += 12;
        objects.push({ type: "saw", x: x, y: 0.8, r: 0.7 });
        objects.push({
          type: "laser",
          x: x + 4,
          y: 1.6,
          w: 3,
          h: 0.3,
          period: 1.35,
          duty: 0.42,
        });
        objects.push({ type: "coin", x: x + 5, y: 2.8 });
        spikeRow(x + 9, 3);
        objects.push({ type: "coin", x: x + 13.5, y: 1.5 });
        x += 18;
      }

      // occasional breathers with coin trails
      if (section % 5 === 4) {
        for (let i = 0; i < 5; i++) {
          objects.push({ type: "coin", x: x + i * 1.3, y: 1.1 + (i % 2) * 0.5 });
        }
        x += 10;
      }

      section += 1;
    }

    // Portals at ~25%, 50%, 75% — exit resumes just past entry
    const portalSpots = [
      { x: Math.floor(length * 0.25), name: "COIN VAULT", seed: 3 },
      { x: Math.floor(length * 0.5), name: "GOLD RUSH", seed: 6 },
      { x: Math.floor(length * 0.75), name: "JACKPOT", seed: 9 },
    ];
    for (const p of portalSpots) {
      objects.push({ type: "coin", x: p.x - 2.2, y: 1.3 });
      objects.push({ type: "coin", x: p.x - 1.1, y: 1.7 });
      objects.push({
        type: "portal",
        x: p.x,
        w: 1.5,
        h: 3.2,
        pocket: coinPocket(p.name, p.seed),
      });
    }

    // finale
    spikeRow(length - 70, 4, 1.15);
    objects.push({ type: "saw", x: length - 58, y: 0.8, r: 0.75 });
    objects.push({
      type: "laser",
      x: length - 50,
      y: 0.8,
      w: 5,
      h: 0.35,
      period: 1.25,
      duty: 0.4,
    });
    stairs(length - 40, 3);
    objects.push({ type: "ceilSpike", x: length - 36, y: 4.2, w: 1, h: 1.1 });
    for (let i = 0; i < 8; i++) {
      objects.push({ type: "coin", x: length - 28 + i * 1.2, y: 1.2 + (i % 3) * 0.35 });
    }
    spikeRow(length - 18, 3);
    objects.push({ type: "finish", x: length - 8 });

    return {
      id: "flash-rush",
      name: "FLASH RUSH",
      difficulty: "Harder",
      diffColor: "#ffd166",
      stars: "★★★★",
      speed,
      length,
      flash: true,
      theme: {
        skyTop: "#1a2858",
        skyBot: "#080818",
        ground: "#060614",
        groundLine: "#7ef9c0",
        accent: "#5ce1ff",
        block: "#1a2a55",
        blockEdge: "#8fd4ff",
        spike: "#0a0e1c",
        spikeEdge: "#e8f6ff",
        player: "#ff4d5e",
        playerInk: "#1a0508",
        particle: "#ffb347",
      },
      objects,
    };
  }

  const firstStepsObjects = [
    { type: "spike", x: 18, w: 1, h: 1 },
    { type: "spike", x: 28, w: 1, h: 1 },
    { type: "spike", x: 29.1, w: 1, h: 1 },
    { type: "block", x: 38, y: 0, w: 3, h: 1 },
    { type: "spike", x: 44, w: 1, h: 1 },
    { type: "spike", x: 52, w: 1, h: 1 },
    { type: "spike", x: 53.1, w: 1, h: 1 },
    { type: "spike", x: 54.2, w: 1, h: 1 },
    { type: "block", x: 62, y: 0, w: 2, h: 1 },
    { type: "block", x: 64, y: 0, w: 2, h: 2 },
    { type: "spike", x: 72, w: 1, h: 1 },
    { type: "spike", x: 80, w: 1, h: 1 },
    { type: "spike", x: 81.2, w: 1, h: 1 },
    { type: "finish", x: 90 },
  ];
  addCoins(firstStepsObjects, [
    [22, 1.2],
    [33, 1.3],
    [39, 1.5],
    [48, 1.2],
    [63, 1.5],
    [76, 1.3],
  ]);

  window.GEORUSH_LEVELS = [
    {
      id: "first-steps",
      name: "FIRST STEPS",
      difficulty: "Lett",
      diffColor: "#3ecf7a",
      stars: "★",
      speed: 11.2,
      length: 95,
      theme: {
        skyTop: "#1a4a8a",
        skyBot: "#0d2858",
        ground: "#0a1f45",
        groundLine: "#c8e8ff",
        accent: "#5ce1ff",
        block: "#163a6e",
        blockEdge: "#8fd4ff",
        spike: "#0a1020",
        spikeEdge: "#e8f6ff",
        player: "#ff4d5e",
        playerInk: "#1a0508",
        particle: "#ff7a8a",
      },
      objects: firstStepsObjects,
    },
    {
      id: "spike-alley",
      name: "SPIKE ALLEY",
      difficulty: "Normal",
      diffColor: "#4db8ff",
      stars: "★★",
      speed: 12.4,
      length: 110,
      theme: {
        skyTop: "#0d5c4a",
        skyBot: "#063528",
        ground: "#042820",
        groundLine: "#9affd0",
        accent: "#7ef9c0",
        block: "#0a4a3a",
        blockEdge: "#7ef9c0",
        spike: "#061510",
        spikeEdge: "#d4ffe8",
        player: "#ff6b35",
        playerInk: "#1a0a04",
        particle: "#ffb347",
      },
      objects: [
        { type: "spike", x: 14, w: 1, h: 1 },
        { type: "coin", x: 16.5, y: 1.3 },
        { type: "spike", x: 20, w: 1, h: 1 },
        { type: "spike", x: 21.1, w: 1, h: 1 },
        { type: "block", x: 28, y: 0, w: 2, h: 1 },
        { type: "coin", x: 28.5, y: 1.5 },
        { type: "spike", x: 33, w: 1, h: 1 },
        { type: "saw", x: 36, y: 0.75, r: 0.7 },
        { type: "coin", x: 39, y: 1.8 },
        { type: "spike", x: 40, w: 1, h: 1 },
        { type: "spike", x: 41.1, w: 1, h: 1 },
        { type: "spike", x: 42.2, w: 1, h: 1 },
        { type: "block", x: 48, y: 0, w: 3, h: 1 },
        { type: "spike", x: 48.5, y: 1, w: 1, h: 1 },
        { type: "coin", x: 50, y: 2.2 },
        { type: "spike", x: 56, w: 1, h: 1 },
        { type: "block", x: 62, y: 0, w: 2, h: 1 },
        { type: "block", x: 64, y: 0, w: 2, h: 2 },
        { type: "block", x: 66, y: 0, w: 2, h: 3 },
        { type: "coin", x: 66.4, y: 3.5 },
        {
          type: "portal",
          x: 70,
          w: 1.4,
          h: 3.2,
          pocket: coinPocket("COIN POCKET", 2),
        },
        { type: "spike", x: 74, w: 1, h: 1 },
        { type: "spike", x: 75.2, w: 1, h: 1 },
        { type: "spike", x: 82, w: 1, h: 1 },
        { type: "ceilSpike", x: 85, y: 3.2, w: 1, h: 1.1 },
        { type: "coin", x: 86.5, y: 1.3 },
        { type: "spike", x: 88, w: 1, h: 1 },
        { type: "spike", x: 89.1, w: 1, h: 1 },
        { type: "spike", x: 90.2, w: 1, h: 1 },
        { type: "spike", x: 91.3, w: 1, h: 1 },
        { type: "finish", x: 104 },
      ],
    },
    {
      id: "sky-blocks",
      name: "SKY BLOCKS",
      difficulty: "Hard",
      diffColor: "#c77dff",
      stars: "★★★",
      speed: 12.8,
      length: 120,
      theme: {
        skyTop: "#4a1a7a",
        skyBot: "#220a42",
        ground: "#180830",
        groundLine: "#e0b0ff",
        accent: "#c77dff",
        block: "#3a1860",
        blockEdge: "#e0b0ff",
        spike: "#12061f",
        spikeEdge: "#f2e0ff",
        player: "#5ce1ff",
        playerInk: "#041018",
        particle: "#a8ecff",
      },
      objects: [
        { type: "spike", x: 12, w: 1, h: 1 },
        { type: "coin", x: 15, y: 1.3 },
        { type: "block", x: 18, y: 0, w: 2, h: 1 },
        { type: "block", x: 24, y: 1, w: 3, h: 1 },
        { type: "spike", x: 24.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 25.6, y: 0, w: 1, h: 1 },
        { type: "coin", x: 25, y: 2.5 },
        { type: "block", x: 32, y: 0, w: 2, h: 1 },
        { type: "block", x: 34, y: 0, w: 2, h: 2 },
        { type: "spike", x: 40, w: 1, h: 1 },
        {
          type: "saw",
          x: 43,
          y: 1.3,
          r: 0.7,
          move: 0.8,
          moveSpeed: 3,
        },
        { type: "block", x: 46, y: 2, w: 4, h: 1 },
        { type: "spike", x: 47, y: 0, w: 1, h: 1 },
        { type: "spike", x: 48.2, y: 0, w: 1, h: 1 },
        { type: "spike", x: 49.4, y: 0, w: 1, h: 1 },
        { type: "coin", x: 47.5, y: 3.4 },
        { type: "block", x: 56, y: 0, w: 2, h: 1 },
        { type: "block", x: 58, y: 0, w: 2, h: 2 },
        {
          type: "portal",
          x: 61,
          w: 1.4,
          h: 3.2,
          pocket: coinPocket("SKY VAULT", 4),
        },
        { type: "spike", x: 64, w: 1, h: 1 },
        { type: "spike", x: 65.2, w: 1, h: 1 },
        { type: "block", x: 72, y: 1, w: 2, h: 1 },
        { type: "block", x: 76, y: 2, w: 2, h: 1 },
        { type: "block", x: 80, y: 1, w: 2, h: 1 },
        { type: "coin", x: 76.5, y: 3.4 },
        { type: "ceilSpike", x: 84, y: 3.3, w: 1, h: 1.1 },
        { type: "spike", x: 86, w: 1, h: 1 },
        { type: "spike", x: 92, w: 1, h: 1 },
        { type: "spike", x: 93.1, w: 1, h: 1 },
        { type: "spike", x: 94.2, w: 1, h: 1 },
        { type: "block", x: 100, y: 0, w: 3, h: 1 },
        { type: "coin", x: 101, y: 1.5 },
        { type: "finish", x: 112 },
      ],
    },
    {
      id: "neon-night",
      name: "NEON NIGHT",
      difficulty: "Harder",
      diffColor: "#ff5d9a",
      stars: "★★★★",
      speed: 13.6,
      length: 130,
      flash: true,
      theme: {
        skyTop: "#6a1458",
        skyBot: "#2a0628",
        ground: "#1a0418",
        groundLine: "#ff9ad5",
        accent: "#ff5d9a",
        block: "#4a1040",
        blockEdge: "#ff9ad5",
        spike: "#140410",
        spikeEdge: "#ffe0f0",
        player: "#7ef9c0",
        playerInk: "#041510",
        particle: "#b8ffd8",
      },
      objects: [
        { type: "spike", x: 12, w: 1, h: 1 },
        { type: "spike", x: 13.1, w: 1, h: 1 },
        { type: "coin", x: 16, y: 1.4 },
        { type: "block", x: 20, y: 0, w: 2, h: 1 },
        { type: "spike", x: 26, w: 1, h: 1 },
        { type: "spike", x: 27.2, w: 1, h: 1 },
        { type: "spike", x: 28.4, w: 1, h: 1 },
        {
          type: "laser",
          x: 30,
          y: 0.9,
          w: 3.5,
          h: 0.3,
          period: 1.4,
          duty: 0.45,
        },
        { type: "coin", x: 31.5, y: 2.2 },
        { type: "block", x: 34, y: 0, w: 2, h: 1 },
        { type: "block", x: 36, y: 0, w: 2, h: 2 },
        { type: "spike", x: 42, w: 1, h: 1 },
        { type: "block", x: 48, y: 1, w: 3, h: 1 },
        { type: "spike", x: 48.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 49.7, y: 0, w: 1, h: 1 },
        { type: "coin", x: 49, y: 2.5 },
        {
          type: "portal",
          x: 53,
          w: 1.4,
          h: 3.2,
          pocket: coinPocket("NEON VAULT", 5),
        },
        { type: "spike", x: 56, w: 1, h: 1 },
        { type: "spike", x: 57.1, w: 1, h: 1 },
        { type: "saw", x: 60, y: 0.8, r: 0.7 },
        { type: "block", x: 64, y: 0, w: 2, h: 1 },
        { type: "block", x: 66, y: 0, w: 2, h: 2 },
        { type: "block", x: 68, y: 0, w: 2, h: 3 },
        { type: "ceilSpike", x: 70, y: 4.3, w: 1, h: 1 },
        { type: "coin", x: 68.4, y: 3.5 },
        { type: "spike", x: 74, w: 1, h: 1 },
        { type: "spike", x: 80, w: 1, h: 1 },
        { type: "spike", x: 81.2, w: 1, h: 1 },
        { type: "block", x: 88, y: 2, w: 3, h: 1 },
        { type: "spike", x: 88.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 89.7, y: 0, w: 1, h: 1 },
        { type: "coin", x: 89, y: 3.4 },
        { type: "spike", x: 96, w: 1, h: 1 },
        {
          type: "laser",
          x: 98,
          y: 0.5,
          w: 3,
          h: 0.3,
          period: 1.15,
          duty: 0.4,
        },
        { type: "spike", x: 102, w: 1, h: 1 },
        { type: "spike", x: 103.1, w: 1, h: 1 },
        { type: "spike", x: 104.2, w: 1, h: 1 },
        { type: "spike", x: 105.3, w: 1, h: 1 },
        { type: "coin", x: 108, y: 1.4 },
        { type: "finish", x: 122 },
      ],
    },
    buildFlashRush(),
    {
      id: "final-rush",
      name: "FINAL RUSH",
      difficulty: "Insane",
      diffColor: "#ff4d5e",
      stars: "★★★★★",
      speed: 14.5,
      length: 145,
      flash: true,
      theme: {
        skyTop: "#8a2a12",
        skyBot: "#3a1008",
        ground: "#220a06",
        groundLine: "#ffb090",
        accent: "#ff7a45",
        block: "#5a2010",
        blockEdge: "#ffb090",
        spike: "#180806",
        spikeEdge: "#ffe8d8",
        player: "#ffe566",
        playerInk: "#1a1404",
        particle: "#fff0a0",
      },
      objects: [
        { type: "spike", x: 10, w: 1, h: 1 },
        { type: "spike", x: 11.1, w: 1, h: 1 },
        { type: "coin", x: 14, y: 1.3 },
        { type: "block", x: 17, y: 0, w: 2, h: 1 },
        { type: "spike", x: 22, w: 1, h: 1 },
        { type: "spike", x: 23.2, w: 1, h: 1 },
        { type: "spike", x: 24.4, w: 1, h: 1 },
        { type: "saw", x: 27, y: 0.8, r: 0.7 },
        { type: "block", x: 30, y: 0, w: 2, h: 1 },
        { type: "block", x: 32, y: 0, w: 2, h: 2 },
        { type: "spike", x: 38, w: 1, h: 1 },
        { type: "block", x: 44, y: 1, w: 2, h: 1 },
        { type: "block", x: 48, y: 2, w: 2, h: 1 },
        { type: "block", x: 52, y: 1, w: 2, h: 1 },
        { type: "spike", x: 44.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 48.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 52.5, y: 0, w: 1, h: 1 },
        { type: "coin", x: 48.5, y: 3.4 },
        {
          type: "portal",
          x: 56,
          w: 1.4,
          h: 3.2,
          pocket: coinPocket("FINAL VAULT", 7),
        },
        { type: "spike", x: 58, w: 1, h: 1 },
        { type: "spike", x: 59.1, w: 1, h: 1 },
        {
          type: "laser",
          x: 61,
          y: 1.0,
          w: 3.5,
          h: 0.3,
          period: 1.2,
          duty: 0.42,
        },
        { type: "block", x: 66, y: 0, w: 2, h: 1 },
        { type: "block", x: 68, y: 0, w: 2, h: 2 },
        { type: "block", x: 70, y: 0, w: 2, h: 3 },
        { type: "ceilSpike", x: 72, y: 4.3, w: 1, h: 1 },
        { type: "coin", x: 70.4, y: 3.5 },
        { type: "spike", x: 76, w: 1, h: 1 },
        { type: "spike", x: 77.2, w: 1, h: 1 },
        { type: "spike", x: 78.4, w: 1, h: 1 },
        {
          type: "saw",
          x: 82,
          y: 1.4,
          r: 0.7,
          move: 0.85,
          moveSpeed: 3.4,
        },
        { type: "block", x: 86, y: 2, w: 4, h: 1 },
        { type: "spike", x: 86.5, y: 0, w: 1, h: 1 },
        { type: "spike", x: 87.7, y: 0, w: 1, h: 1 },
        { type: "spike", x: 88.9, y: 0, w: 1, h: 1 },
        { type: "coin", x: 87.5, y: 3.4 },
        { type: "spike", x: 96, w: 1, h: 1 },
        { type: "block", x: 102, y: 0, w: 2, h: 1 },
        { type: "spike", x: 108, w: 1, h: 1 },
        { type: "spike", x: 109.1, w: 1, h: 1 },
        { type: "spike", x: 110.2, w: 1, h: 1 },
        { type: "spike", x: 111.3, w: 1, h: 1 },
        { type: "coin", x: 114, y: 1.4 },
        { type: "spike", x: 118, w: 1, h: 1 },
        { type: "spike", x: 119.2, w: 1, h: 1 },
        { type: "block", x: 126, y: 0, w: 3, h: 1 },
        { type: "coin", x: 127, y: 1.5 },
        { type: "finish", x: 136 },
      ],
    },
  ];
})();
