<script>
  // "Fang Nelly" – the tick chases Nelly the apricot poodle.
  // Ported from a standalone HTML5 canvas game into a Svelte component with
  // translations and a leaderboard (fastest catch wins).
  import { onMount, onDestroy, tick as nextTick } from 'svelte';
  import { getLocalizedText, loadTexts, activeLanguage } from '#lib/stores/translatedTexts.js';
  import VirtualKeyboard from '#lib/components/common/VirtualKeyboard.svelte';
  import { PUBLIC_API_KEY } from '$app/env/public';

  const pageTexts = 'puddel';
  let isLoadingTexts = true;

  /* ---------- Constants ---------- */
  const W = 960, H = 480, GROUND = 400, TICKX = 140;
  const POODLE_SPEED = 300, SPEED_START = 230, SPEED_MIN = 150, SPEED_MAX = 650;
  const BOOST = 55, PENALTY = 25, HIT_PENALTY = 60, HIT_PUSH = 70;
  const QUESTION_TIME = 5; // seconds to answer a question
  const START_GAP = 600, LOSE_GAP = 1500, CATCH_GAP = 34;
  const JUMP_V = -760, GRAV = 2100;
  const OBST = [
    { key: 'rock', w: 46, h: 34 },
    { key: 'log', w: 74, h: 26 },
    { key: 'puddle', w: 96, h: 8 },
    { key: 'cone', w: 26, h: 36 },
    { key: 'hedgehog', w: 52, h: 28 }
  ];
  const APR = '#f6b57e', APR_HI = '#fcd3ab', APR_DK = '#dd9458';

  /* ---------- DOM refs ---------- */
  let canvas;
  let ctx;
  let optButtons = [];
  let startButton;

  /* ---------- Game state (imperative, updated by the loop) ---------- */
  let gameState = 'start'; // start | play | question | win | lose
  let overlayKind = 'start'; // start | win | lose | null
  let clock = 0, last = 0, animationFrameId = 0;
  let speed, gap, score, hits, playTime, jy, vy, jumping, obstacles, particles, nextQ, spawnDist, groundOff, shake, flash, usedQ, qCount, winTime, poodleHop;
  let current = null, answering = false;
  let questionVisible = false;
  let questionTimeLeft = QUESTION_TIME;
  let lastTickSecond = 0;
  let questionText = '';
  let questionOptions = ['', '', ''];
  let optionStates = ['', '', ''];
  let toastText = '';
  let toastVisible = false;
  let toastTimer = 0;
  let answerTimer = 0;
  let panelTimers = [];

  // HUD values (reactive copies of the game state)
  let hudSpeed = SPEED_START, hudGap = START_GAP, hudScore = 0, hudTime = 0;
  let finalTime = 0, finalScore = 0, finalHits = 0;

  /* ---------- Leaderboard ---------- */
  let leaderboard = [];
  let showVirtualKeyboard = false;
  let scoreSubmitted = false;

  /* ---------- Audio ---------- */
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  let ac = null, master = null, muted = false, music = null;

  function t(key) {
    return getLocalizedText(pageTexts, key);
  }

  function questions() {
    return getLocalizedText(pageTexts, 'questions');
  }

  async function fetchTexts() {
    isLoadingTexts = true;
    await loadTexts(pageTexts);
    usedQ = [];
    isLoadingTexts = false;
  }

  $: ($activeLanguage, fetchTexts());

  async function fetchLeaderboard() {
    try {
      const response = await fetch('/api/puddel/get_leaderboard', {
        headers: { 'Authorization': `Bearer ${PUBLIC_API_KEY}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        leaderboard = [...data];
      }
    } catch (error) {
      console.error('Could not load leaderboard', error);
    }
  }

  async function storeScore(initials, time) {
    await fetch('/api/puddel/submit_score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUBLIC_API_KEY}`
      },
      body: JSON.stringify({ initials, time })
    });
  }

  async function handleSubmitInitials(initials) {
    await storeScore(initials, finalTime);
    await fetchLeaderboard();
    showVirtualKeyboard = false;
    scoreSubmitted = true;
    await nextTick();
    focusStart();
  }

  function formatTime(seconds) {
    return seconds.toFixed(2).replace('.', t('decimal_separator'));
  }

  /* ---------- Audio helpers ---------- */
  function initAudio() {
    if (ac || !AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ac.destination);
  }
  function tone(o) {
    if (!ac) return;
    const t0 = ac.currentTime + (o.at || 0), dur = o.dur || 0.2;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.3, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, at, cutoff) {
    if (!ac) return;
    const t0 = ac.currentTime + (at || 0), n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 800;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  const sfx = {
    jump() { tone({ f: 320, f2: 760, type: 'square', dur: 0.16, vol: 0.12 }); },
    land() { noise(0.05, 0.12, 0, 500); },
    hit() { noise(0.3, 0.6, 0, 500); tone({ f: 180, f2: 55, type: 'sawtooth', dur: 0.35, vol: 0.35 }); },
    good() { tone({ f: 784, type: 'triangle', dur: 0.12, vol: 0.3 }); tone({ f: 1175, type: 'triangle', dur: 0.3, vol: 0.3, at: 0.1 }); },
    bad() { tone({ f: 220, f2: 110, type: 'sawtooth', dur: 0.45, vol: 0.22 }); tone({ f: 160, type: 'square', dur: 0.45, vol: 0.12 }); },
    pop() { tone({ f: 620, f2: 980, type: 'sine', dur: 0.12, vol: 0.2 }); },
    tick(urgent) { tone({ f: urgent ? 1100 : 740, type: 'square', dur: urgent ? 0.09 : 0.05, vol: urgent ? 0.18 : 0.1 }); },
    catchd() { tone({ f: 523, type: 'triangle', dur: 0.15, vol: 0.3 }); tone({ f: 659, type: 'triangle', dur: 0.15, vol: 0.3, at: 0.12 }); tone({ f: 784, type: 'triangle', dur: 0.4, vol: 0.3, at: 0.24 }); }
  };
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    const s = NOTE[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (s - 69) / 12);
  }
  const MELODY = 'C5:1 E5:1 G5:1 C6:2 G5:1 C6:2 E6:1 D6:1 C6:1 D6:2 -:1 B5:1 C6:1 D6:1 E6:2 D6:1 C6:2 A5:1 G5:1 A5:1 C6:2 G5:1 -:1 F5:1 G5:1 A5:1 B5:1 C6:2 E6:2 D6:1 C6:1 D6:1 E6:1 G6:4 -:1 E6:1 G6:1 C7:6';
  const BASS = ['C3', 'C3', 'C3', 'C3', 'G3', 'G3', 'G3', 'G3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'C3', 'C3', 'G3', 'G3', 'C3', 'C3', 'C3', 'C3', 'C3', 'C3'];
  function playSynthVictory() {
    if (!ac) return;
    const E = 0.19, parts = MELODY.split(' ');
    let at = 0.05;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].split(':'), len = parseInt(p[1], 10) * E;
      if (p[0] !== '-') {
        tone({ f: freq(p[0]), type: 'square', dur: len * 0.9, vol: 0.16, at });
        tone({ f: freq(p[0]) * 2, type: 'sine', dur: len * 0.9, vol: 0.06, at });
      }
      at += len;
    }
    const beats = Math.floor(at / (E * 2));
    for (let b = 0; b < beats; b++) {
      const bt = 0.05 + b * E * 2;
      tone({ f: freq(BASS[b % BASS.length]), type: 'triangle', dur: E * 1.6, vol: 0.22, at: bt });
      noise(0.08, 0.35, bt, 300);
      noise(0.03, 0.12, bt + E, 6000);
    }
    const chord = ['C5', 'E5', 'G5', 'C6'];
    for (let c = 0; c < chord.length; c++) tone({ f: freq(chord[c]), type: 'triangle', dur: 2.2, vol: 0.12, at, attack: 0.2 });
  }
  function playVictoryMusic() {
    // The original game could play an mp3 here; the site ships the built-in synth melody instead.
    // To add a song, create an Audio element in this function and keep playSynthVictory() as the fallback.
    stopMusic();
    playSynthVictory();
  }
  function stopMusic() {
    if (music) { try { music.pause(); music.currentTime = 0; } catch (e) { /* ignore */ } music = null; }
    if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(muted ? 0 : 0.7, ac.currentTime); }
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.7;
    if (music) music.muted = muted;
  }

  /* ---------- Game flow ---------- */
  function reset() {
    speed = SPEED_START; gap = START_GAP; score = 0; hits = 0; playTime = 0; jy = 0; vy = 0; jumping = false;
    obstacles = []; particles = []; nextQ = 2.5; spawnDist = 700; groundOff = 0; shake = 0; flash = 0; usedQ = usedQ || []; qCount = 0; winTime = 0; poodleHop = 0;
    questionVisible = false;
    clearTimeout(answerTimer);
    panelTimers.forEach(clearTimeout); panelTimers = [];
  }
  function startGame() {
    initAudio();
    if (ac && ac.resume) ac.resume();
    stopMusic();
    reset();
    gameState = 'play';
    overlayKind = null;
    showVirtualKeyboard = false;
    scoreSubmitted = false;
    last = performance.now();
  }
  function jump() {
    if (gameState !== 'play' || jumping) return;
    jumping = true; vy = JUMP_V; sfx.jump();
  }
  function toast(msg, ms) {
    toastText = msg; toastVisible = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, ms || 1400);
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /* ---------- Questions ---------- */
  function askQuestion() {
    const list = questions();
    if (!list || list.length === 0) return;
    if (usedQ.length >= list.length) usedQ = [];
    let idx;
    do { idx = Math.floor(Math.random() * list.length); } while (usedQ.indexOf(idx) >= 0);
    usedQ.push(idx);
    const q = list[idx], correct = q[1][0];
    const shuffled = q[1].slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    current = { text: q[0], options: shuffled, correct };
    qCount++;
    questionText = q[0];
    questionOptions = shuffled;
    optionStates = ['', '', ''];
    questionTimeLeft = QUESTION_TIME; lastTickSecond = QUESTION_TIME;
    questionVisible = true; answering = false; gameState = 'question'; sfx.pop();
    setTimeout(() => { try { optButtons[0] && optButtons[0].focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  }
  function answer(i) {
    if (gameState !== 'question' || answering || !current) return;
    answering = true;
    const timedOut = i < 0;
    const right = !timedOut && current.options[i] === current.correct;
    const states = ['', '', ''];
    for (let k = 0; k < 3; k++) {
      if (current.options[k] === current.correct) states[k] = 'right';
      else if (k === i) states[k] = 'wrong';
    }
    optionStates = states;
    if (right) {
      score++; speed = Math.min(SPEED_MAX, speed + BOOST); sfx.good();
      toast(t('toast_correct'), 1600);
    } else {
      speed = Math.max(SPEED_MIN, speed - PENALTY); sfx.bad();
      toast(t(timedOut ? 'toast_timeout' : 'toast_wrong').replace('<ANSWER>', current.correct), 2200);
    }
    answerTimer = setTimeout(() => {
      questionVisible = false;
      if (gameState === 'question') { gameState = 'play'; nextQ = playTime + 7; last = performance.now(); }
    }, right ? 650 : 1100);
  }

  /* ---------- Update ---------- */
  function update(dt) {
    playTime += dt;
    gap += (POODLE_SPEED - speed) * dt;
    groundOff += speed * dt;
    if (jumping) {
      vy += GRAV * dt; jy += vy * dt;
      if (jy >= 0) { jy = 0; vy = 0; jumping = false; sfx.land(); puff(TICKX + 20, GROUND, 6); }
    }
    spawnDist -= speed * dt;
    if (spawnDist <= 0) {
      const type = OBST[Math.floor(Math.random() * OBST.length)];
      obstacles.push({ x: W + 80, w: type.w, h: type.h, key: type.key, hit: false });
      spawnDist = 480 + Math.random() * 520;
    }
    const tx1 = TICKX + 8, tx2 = TICKX + 50, ty1 = GROUND + jy - 30, ty2 = GROUND + jy;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i]; o.x -= speed * dt;
      if (o.x + o.w < -120) { obstacles.splice(i, 1); continue; }
      if (!o.hit && o.x < tx2 && o.x + o.w > tx1 && GROUND - o.h < ty2 && GROUND > ty1) {
        o.hit = true; hits++;
        speed = Math.max(SPEED_MIN, speed - HIT_PENALTY); gap += HIT_PUSH;
        sfx.hit(); shake = 0.35; flash = 0.3;
        toast(t('toast_hit').replace('<OBSTACLE>', t('obstacle_' + o.key)), 1300);
      }
    }
    if (!jumping && Math.random() < dt * 18) puff(TICKX + 10, GROUND, 1);
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    updateParticles(dt);
    if (playTime >= nextQ && !jumping) askQuestion();
    if (gap <= CATCH_GAP) win();
    else if (gap >= LOSE_GAP) lose();
  }
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) particles.push({ x: x + Math.random() * 10 - 5, y: y - 2, vx: -speed * 0.25 - Math.random() * 40, vy: -20 - Math.random() * 40, r: 3 + Math.random() * 4, life: 0.5, max: 0.5, c: 'rgba(120,90,60,' });
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
  }
  function win() {
    gameState = 'win'; winTime = clock; questionVisible = false; gap = CATCH_GAP; sfx.catchd();
    finalTime = Math.round(playTime * 100) / 100; finalScore = score; finalHits = hits;
    for (let i = 0; i < 140; i++) particles.push({ x: Math.random() * W, y: -20 - Math.random() * 300, vx: Math.random() * 60 - 30, vy: 80 + Math.random() * 120, g: 60, r: 4 + Math.random() * 5, life: 6, max: 6, rot: Math.random() * 6, vr: Math.random() * 6 - 3, c: ['#f4a65c', '#ff6b9d', '#5ecb85', '#ffd93d', '#6fb6ff', '#ffffff'][i % 6] });
    panelTimers.push(setTimeout(playVictoryMusic, 400));
    panelTimers.push(setTimeout(() => { showPanel('win'); }, 1300));
  }
  function lose() {
    gameState = 'lose'; questionVisible = false; sfx.bad();
    finalTime = Math.round(playTime * 100) / 100; finalScore = score; finalHits = hits;
    panelTimers.push(setTimeout(() => { showPanel('lose'); }, 600));
  }
  function showPanel(kind) {
    overlayKind = kind;
    showVirtualKeyboard = kind === 'win';
    scoreSubmitted = false;
    if (kind !== 'win') focusStart();
  }
  function focusStart() {
    setTimeout(() => { try { startButton && startButton.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  }

  /* ---------- Drawing ---------- */
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#7cc9f2'); g.addColorStop(1, '#dff3fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(840, 70, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,168,.35)'; ctx.beginPath(); ctx.arc(840, 70, 52, 0, Math.PI * 2); ctx.fill();
    const co = groundOff * 0.15;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 260 + 120 - co) % (W + 240) + W + 240) % (W + 240) - 120, cy = 60 + i * 28;
      cloud(cx, cy, 1 + (i % 3) * 0.25);
    }
    const ho = groundOff * 0.35;
    ctx.fillStyle = '#a9dc8f'; hills(ho, 330, 34, 170, 0);
    ctx.fillStyle = '#8ccc73'; hills(ho * 1.4, 355, 26, 110, 1.7);
  }
  function cloud(x, y, s) {
    ctx.beginPath(); ctx.arc(x, y, 18 * s, 0, Math.PI * 2); ctx.arc(x + 22 * s, y - 8 * s, 22 * s, 0, Math.PI * 2); ctx.arc(x + 46 * s, y, 18 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x, y, 46 * s, 18 * s);
  }
  function hills(off, base, amp, period, ph) {
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base + Math.sin((x + off) / period + ph) * amp + Math.sin((x + off) / (period * 0.37) + ph) * amp * 0.3);
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
  }
  function drawGround() {
    ctx.fillStyle = '#5fb64f'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(0, GROUND + 26, W, H - GROUND - 26);
    ctx.fillStyle = '#4a9c3c';
    const off = groundOff % 44;
    for (let x = -off; x < W + 44; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 6, GROUND - 9); ctx.lineTo(x + 10, GROUND); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 20, GROUND); ctx.lineTo(x + 27, GROUND - 7); ctx.lineTo(x + 31, GROUND); ctx.fill();
      ctx.fillRect(x + 14, GROUND + 14, 10, 3);
    }
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawObstacle(o) {
    const x = o.x, y = GROUND;
    ctx.save();
    if (o.key === 'rock') {
      ctx.fillStyle = '#8d8c92'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 26); ctx.lineTo(x + 24, y - 34); ctx.lineTo(x + 42, y - 22); ctx.lineTo(x + 46, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b4b3b9'; ctx.beginPath(); ctx.moveTo(x + 10, y - 22); ctx.lineTo(x + 24, y - 30); ctx.lineTo(x + 30, y - 18); ctx.closePath(); ctx.fill();
    } else if (o.key === 'log') {
      ctx.fillStyle = '#9b6235'; rr(x, y - 26, 74, 26, 10); ctx.fill();
      ctx.fillStyle = '#7a4826'; ctx.fillRect(x + 16, y - 26, 5, 26); ctx.fillRect(x + 44, y - 26, 5, 26);
      ctx.fillStyle = '#d9a06a'; ctx.beginPath(); ctx.ellipse(x + 74, y - 13, 7, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9b6235'; ctx.beginPath(); ctx.ellipse(x + 74, y - 13, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (o.key === 'puddle') {
      ctx.fillStyle = '#4f8fd6'; ctx.beginPath(); ctx.ellipse(x + 48, y - 2, 48, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x + 34, y - 4, 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (o.key === 'cone') {
      ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.ellipse(x + 13, y - 18, 13, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b5a2b';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.beginPath(); ctx.arc(x + 6 + c * 7 + (r % 2) * 3, y - 30 + r * 7, 3, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#4a3a30'; ctx.beginPath(); ctx.ellipse(x + 30, y - 14, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2e221b'; ctx.lineWidth = 2;
      for (let s = 0; s < 9; s++) { ctx.beginPath(); ctx.moveTo(x + 14 + s * 4, y - 20); ctx.lineTo(x + 10 + s * 4, y - 30 - (s % 2) * 4); ctx.stroke(); }
      ctx.fillStyle = '#c29572'; ctx.beginPath(); ctx.moveTo(x + 10, y - 18); ctx.lineTo(x - 4, y - 6); ctx.lineTo(x + 14, y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x - 3, y - 7, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, y - 12, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawTick(x, y, run) {
    const cx = x + 28, cy = y - 18 + (run ? Math.sin(clock * 22) * 1.2 : 0);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const back = i < 4, k = i % 4;
      const bx = cx - 15 + k * 10, by = cy + (back ? 2 : 7);
      const sw = run ? Math.sin(clock * 26 + k * 1.6 + (back ? 3 : 0)) * 7 : 0;
      ctx.strokeStyle = back ? '#4a2418' : '#5e2e1f'; ctx.lineWidth = back ? 2.5 : 3;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 4 + sw * 0.5, by + 9); ctx.lineTo(bx - 8 + sw, y - (back ? 3 : 0)); ctx.stroke();
    }
    ctx.fillStyle = '#7a3b2c'; ctx.beginPath(); ctx.ellipse(cx, cy, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a2218'; ctx.beginPath(); ctx.ellipse(cx - 7, cy - 4, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8f4a37'; ctx.beginPath(); ctx.ellipse(cx + 6, cy + 4, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5e2e1f'; ctx.beginPath(); ctx.ellipse(cx + 26, cy + 2, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a1a12'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 33, cy); ctx.lineTo(cx + 40, cy - 3); ctx.moveTo(cx + 33, cy + 4); ctx.lineTo(cx + 40, cy + 6); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 27, cy - 1, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + 28, cy - 1, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function fluff(cx, cy, rx, ry, n, r, fill, hi) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = hi;
    for (let j = 0; j < n; j += 2) {
      const b = j / n * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(b) * rx * 0.75 - 2, cy + Math.sin(b) * ry * 0.75 - 3, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawPoodle(x, y, run, sad) {
    const bob = run ? Math.abs(Math.sin(clock * 13)) * 8 : Math.sin(clock * 2.5) * 1.5;
    const by = y - 50 - bob - (poodleHop || 0);
    const sw = run ? Math.sin(clock * 13) : 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = APR_DK; ctx.lineWidth = 5;
    const legs = [[-26, -1], [-14, 1], [14, -1], [26, 1]];
    for (let i = 0; i < 4; i++) {
      const lx = x + legs[i][0], s = sw * legs[i][1] * 12;
      ctx.beginPath(); ctx.moveTo(lx, by + 10); ctx.lineTo(lx + s, y - 8); ctx.stroke();
      ctx.fillStyle = APR; ctx.beginPath(); ctx.arc(lx + s, y - 7, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = APR_DK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 34, by - 6); ctx.lineTo(x - 46, by - 26 + Math.sin(clock * 16) * 4); ctx.stroke();
    fluff(x - 48, by - 30 + Math.sin(clock * 16) * 4, 7, 7, 6, 5, APR, APR_HI);
    fluff(x, by, 38, 22, 12, 10, APR, APR_HI);
    const hx = x + 40, hy = by - 22;
    ctx.strokeStyle = APR; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x + 24, by - 8); ctx.lineTo(hx - 6, hy + 6); ctx.stroke();
    const ew = run ? Math.sin(clock * 13 + 1) * 3 : 0;
    fluff(hx - 14, hy + 14 + ew, 8, 13, 7, 5, APR, APR_HI);
    fluff(hx, hy, 17, 15, 9, 6, APR, APR_HI);
    fluff(hx - 3, hy - 18, 13, 10, 8, 6, APR, APR_HI);
    ctx.fillStyle = APR; ctx.beginPath(); ctx.ellipse(hx + 15, hy + 5, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.ellipse(hx + 25, hy + 2, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 8, hy - 3, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.arc(hx + 9, hy - 3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 10, hy - 4, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 1.5; ctx.beginPath();
    if (sad) ctx.arc(hx + 19, hy + 13, 5, Math.PI * 1.15, Math.PI * 1.85); else ctx.arc(hx + 19, hy + 7, 5, 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.strokeStyle = '#d8343c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 22, by - 14); ctx.lineTo(x + 34, by - 2); ctx.stroke();
    ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(x + 30, by + 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a14'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Nelly', x, by + 42 + bob * 0.3);
    ctx.restore();
  }
  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.rot !== undefined) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); ctx.restore();
      } else {
        ctx.fillStyle = p.c + (p.life / p.max * 0.6) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.4 - p.life / p.max), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawHeart(x, y, s, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.fillStyle = '#ff5c8a';
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-8, -4, -8, -12, 0, -8); ctx.bezierCurveTo(8, -12, 8, -4, 0, 4); ctx.fill(); ctx.restore();
  }
  function draw() {
    ctx.save();
    if (shake > 0 && gameState === 'play') ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22);
    drawSky(); drawGround();
    for (let i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);
    drawParticles();
    const running = gameState === 'play';
    const px = TICKX + gap + 30;
    if (gameState === 'win') {
      const wt = clock - winTime;
      drawPoodle(TICKX + 100, GROUND, false, true);
      drawTick(TICKX + 72, GROUND - 66 - Math.sin(clock * 2.5) * 1.5, false);
      for (let h = 0; h < 5; h++) {
        const hp = ((wt * 0.6 + h * 0.37) % 1.8);
        drawHeart(TICKX + 90 + Math.sin(hp * 6 + h) * 18 + h * 10, GROUND - 100 - hp * 70, 1.4 - hp * 0.4, Math.max(0, 1 - hp / 1.8));
      }
    } else {
      if (px < W + 80) drawPoodle(px, GROUND, running || gameState === 'question', false);
      else {
        ctx.fillStyle = 'rgba(255,255,255,.9)'; rr(W - 150, GROUND - 120, 134, 42, 21); ctx.fill();
        ctx.fillStyle = '#3b281c'; ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(t('nelly_away').replace('<METERS>', String(Math.round(gap / 10))), W - 83, GROUND - 93);
      }
      drawTick(TICKX, GROUND + jy, running && !jumping);
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(216,71,63,' + (flash * 0.9) + ')'; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.restore();
  }
  function updateHud() {
    hudSpeed = speed; hudGap = gap; hudScore = score; hudTime = playTime;
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) || 0; last = now; clock += dt;
    if (gameState === 'play') update(dt);
    else if (gameState === 'question' && !answering) {
      questionTimeLeft = Math.max(0, questionTimeLeft - dt);
      const whole = Math.ceil(questionTimeLeft);
      if (whole < lastTickSecond) { lastTickSecond = whole; sfx.tick(whole <= 2); }
      if (questionTimeLeft <= 0) answer(-1);
    }
    else if (gameState === 'win') updateParticles(dt);
    if (ctx && !isLoadingTexts) { draw(); updateHud(); }
    animationFrameId = requestAnimationFrame(frame);
  }

  /* ---------- Input ---------- */
  function onKeyDown(e) {
    if (e.repeat) return;
    const onPanel = gameState === 'start' || gameState === 'win' || gameState === 'lose';
    const typingInitials = showVirtualKeyboard && !scoreSubmitted;
    if (e.key === ' ' || e.key === 'ArrowUp') {
      if (gameState === 'play') { e.preventDefault(); jump(); }
      else if (onPanel && overlayKind && !typingInitials) {
        if (e.key === ' ' && document.activeElement === startButton) return;
        e.preventDefault(); startGame();
      }
    } else if (e.key === 'Enter' && onPanel && overlayKind && !typingInitials) {
      if (document.activeElement === startButton) return;
      startGame();
    } else if (gameState === 'question' && (e.key === '1' || e.key === '2' || e.key === '3')) {
      answer(parseInt(e.key, 10) - 1);
    }
  }
  function onCanvasPointerDown(e) {
    e.preventDefault();
    if (gameState === 'play') jump();
  }

  onMount(async () => {
    ctx = canvas.getContext('2d');
    await fetchTexts();
    fetchLeaderboard();
    reset();
    document.addEventListener('keydown', onKeyDown);
    last = performance.now();
    animationFrameId = requestAnimationFrame(frame);
    focusStart();
  });

  onDestroy(() => {
    if (typeof document === 'undefined') return;
    document.removeEventListener('keydown', onKeyDown);
    cancelAnimationFrame(animationFrameId);
    clearTimeout(toastTimer); clearTimeout(answerTimer);
    panelTimers.forEach(clearTimeout);
    stopMusic();
    if (ac && ac.close) { try { ac.close(); } catch (e) { /* ignore */ } }
  });

  $: speedPct = (hudSpeed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN) * 100;
  const nellyMarkPct = (POODLE_SPEED - SPEED_MIN) / (SPEED_MAX - SPEED_MIN) * 100;
</script>

<div class="puddel">
  {#if !isLoadingTexts}
    <p class="intro">{t('intro')}</p>

    <section class="hud" aria-live="off">
      <div class="stat">
        <div class="speedrow"><span class="lbl">{t('speed')}</span><small>{t('nelly_speed')}</small></div>
        <div class="bar"><i style="width:{speedPct}%" class:fast={hudSpeed > POODLE_SPEED}></i><b style="left:{nellyMarkPct}%"></b></div>
        <span class="val">{Math.round(hudSpeed / 10)} {t('kmh')}</span>
      </div>
      <div class="stat"><span class="lbl">{t('distance')}</span><span class="val">{Math.max(0, Math.round(hudGap / 10))} {t('meters')}</span></div>
      <div class="stat"><span class="lbl">{t('correct_answers')}</span><span class="val">{hudScore}</span></div>
      <div class="stat"><span class="lbl">{t('time')}</span><span class="val">{fmtTime(hudTime)}</span></div>
    </section>
  {/if}

  <div class="stage" class:expanded={overlayKind === 'win' && showVirtualKeyboard && !scoreSubmitted}>
    <canvas bind:this={canvas} width={W} height={H} aria-label={isLoadingTexts ? '' : t('canvas_label')} on:pointerdown={onCanvasPointerDown}></canvas>

    <div class="toast" class:show={toastVisible}>{toastText}</div>

    {#if questionVisible && !isLoadingTexts}
      <div class="qbox" role="dialog" aria-labelledby="puddel-qtext">
        <div class="qhead">
          <p class="qeyebrow">{t('question')} {qCount} · {t('question_hint')}</p>
          <p class="qtimer" class:urgent={questionTimeLeft <= 2} aria-label={t('time_left')}>{questionTimeLeft.toFixed(1).replace('.', t('decimal_separator'))} s</p>
        </div>
        <div class="qbar" role="timer" aria-live="off"><i class:urgent={questionTimeLeft <= 2} style="width:{questionTimeLeft / QUESTION_TIME * 100}%"></i></div>
        <p id="puddel-qtext" class="qtext">{questionText}</p>
        <div class="opts">
          {#each questionOptions as option, i}
            <button class="opt {optionStates[i]}" type="button" bind:this={optButtons[i]} on:click={() => answer(i)}><kbd>{i + 1}</kbd><span>{option}</span></button>
          {/each}
        </div>
      </div>
    {/if}

    {#if overlayKind && !isLoadingTexts}
      <div class="overlay">
        <div class="panel">
          {#if overlayKind === 'start'}
            <h2>{t('start_title')}</h2>
            <p>{t('start_text')}</p>
            <ul>
              <li>{t('start_rule_1')}</li>
              <li>{t('start_rule_2')}</li>
              <li>{t('start_rule_3')}</li>
            </ul>
            <button class="btn" type="button" bind:this={startButton} on:click={startGame}>{t('start_button')}</button>
          {:else if overlayKind === 'win'}
            <h2>{t('win_title')}</h2>
            <p>{t('win_text')}</p>
            <div class="stats">
              <div><b>{formatTime(finalTime)} s</b>{t('stat_time')}</div>
              <div><b>{finalScore}</b>{t('stat_correct')}</div>
              <div><b>{finalHits}</b>{t('stat_hits')}</div>
            </div>
            {#if showVirtualKeyboard && !scoreSubmitted}
              <p class="pretext">{t('pretext_submit_highscore')}</p>
              <div class="keyboard-wrap">
                <VirtualKeyboard onSubmit={handleSubmitInitials} initials_label={t('initials_label')} submit_label={t('submit_label')} />
              </div>
              <button class="btn secondary" type="button" bind:this={startButton} on:click={startGame}>{t('play_again')}</button>
            {:else}
              <button class="btn" type="button" bind:this={startButton} on:click={startGame}>{t('play_again')}</button>
            {/if}
          {:else}
            <h2>{t('lose_title')}</h2>
            <p>{t('lose_text')}</p>
            <div class="stats">
              <div><b>{fmtTime(finalTime)}</b>{t('stat_time')}</div>
              <div><b>{finalScore}</b>{t('stat_correct')}</div>
              <div><b>{finalHits}</b>{t('stat_hits')}</div>
            </div>
            <button class="btn" type="button" bind:this={startButton} on:click={startGame}>{t('try_again')}</button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if !isLoadingTexts}
    <p class="help">
      <span>{t('help_jump')}</span>
      <span>{t('help_answer')}</span>
      <button class="mute" type="button" aria-pressed={muted} on:click={toggleMute}>{muted ? t('sound_off') : t('sound_on')}</button>
    </p>

    {#if leaderboard && leaderboard.length > 0}
      <div class="leaderboard" tabindex="-1">
        <h2>{t('high_score')}</h2>
        <table>
          <thead>
            <tr>
              <th class="rank">{t('rank')}</th>
              <th class="initials">{t('initials')}</th>
              <th class="time">{t('leaderboard_time')}</th>
            </tr>
          </thead>
          <tbody>
            {#each leaderboard as { initials, time }, i}
              <tr>
                <td class="rank">{i + 1}.</td>
                <td class="initials">{initials}</td>
                <td class="time">{typeof time === 'number' ? formatTime(time) : ''} s</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<style>
  .puddel {
    --bg: #0d1b2a; --fg: #e0e1dd; --muted: #a9b4c4; --panel: #1b263b; --line: #3a4a6a;
    --accent: #f4a65c; --accent-ink: #1f1711; --good: #5ecb85; --bad: #f27d74;
    --display: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    max-width: 980px;
    margin: 0 auto;
    padding: 10px 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--fg);
    font-family: var(--display);
    font-size: 16px;
    line-height: 1.45;
    text-align: left;
    box-sizing: border-box;
  }
  .puddel * { box-sizing: border-box; }
  .intro { margin: 0 auto; color: var(--muted); max-width: 70ch; font-size: 1rem; text-align: center; }
  .hud { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; font-variant-numeric: tabular-nums; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 700; }
  .val { font-size: 22px; line-height: 1.1; font-weight: 700; }
  .bar { position: relative; height: 14px; border-radius: 7px; background: var(--line); overflow: hidden; margin-top: 4px; }
  .bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--bad); border-radius: 7px; transition: width .2s, background .3s; }
  .bar > i.fast { background: var(--good); }
  .bar > b { position: absolute; top: -2px; bottom: -2px; width: 3px; background: var(--fg); opacity: .6; }
  .speedrow { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .speedrow small { color: var(--muted); font-size: 12px; }
  .stage { position: relative; width: 100%; aspect-ratio: 2 / 1; min-height: 340px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, .35); background: #8fd3f4; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
  /* While the initials keyboard is shown the stage grows so the whole panel is visible below the canvas */
  .stage.expanded { aspect-ratio: auto; min-height: 0; }
  .stage.expanded canvas { aspect-ratio: 2 / 1; height: auto; }
  .stage.expanded .overlay { position: relative; inset: auto; overflow: visible; }
  .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(13, 27, 42, .55); padding: 16px; overflow-y: auto; }
  .panel { background: var(--panel); color: var(--fg); border-radius: 18px; padding: 22px 24px; max-width: 480px; width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, .4); margin: auto; }
  .panel h2 { font-size: clamp(24px, 4.5vw, 34px); margin: 0; color: var(--accent); text-wrap: balance; }
  .panel p { margin: 0; font-size: 1rem; }
  .panel ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; text-align: left; font-size: 15px; }
  .panel li { display: flex; gap: 10px; align-items: flex-start; }
  .panel li::before { content: "•"; color: var(--accent); font-weight: 800; }
  .pretext { color: var(--accent); font-weight: 700; }
  .keyboard-wrap { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0; }
  .btn { font-family: var(--display); font-weight: 700; font-size: 20px; border: 0; border-radius: 999px; padding: 12px 28px; background: var(--accent); color: var(--accent-ink); cursor: pointer; box-shadow: 0 4px 0 rgba(0, 0, 0, .3); transition: transform .08s; }
  .btn.secondary { background: var(--line); color: var(--fg); font-size: 16px; padding: 8px 20px; }
  .btn:active { transform: translateY(3px); box-shadow: none; }
  .btn:focus-visible, .opt:focus-visible, .mute:focus-visible { outline: 3px solid var(--fg); outline-offset: 3px; }
  .stats { display: flex; justify-content: center; gap: 18px; font-variant-numeric: tabular-nums; color: var(--muted); flex-wrap: wrap; }
  .stats b { display: block; font-size: 24px; color: var(--fg); }
  .qbox { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 560px); background: var(--panel); color: var(--fg); border-radius: 18px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, .45); animation: pop .25s ease-out; }
  @keyframes pop { from { transform: translate(-50%, -50%) scale(.85); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
  .qeyebrow { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); font-weight: 800; }
  .qhead { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .qtimer { margin: 0; font-variant-numeric: tabular-nums; font-weight: 800; font-size: 20px; color: var(--good); white-space: nowrap; }
  .qtimer.urgent { color: var(--bad); animation: pulse .5s ease-in-out infinite alternate; }
  @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.18); } }
  .qbar { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
  .qbar > i { display: block; height: 100%; background: var(--good); border-radius: 4px; transition: width .1s linear, background .3s; }
  .qbar > i.urgent { background: var(--bad); }
  .qtext { margin: 0; font-size: clamp(19px, 3.4vw, 26px); line-height: 1.25; font-weight: 700; text-wrap: balance; }
  .opts { display: grid; gap: 8px; }
  .opt { display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; font-weight: 700; font-size: 17px; border: 2px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 12px; padding: 10px 14px; cursor: pointer; transition: border-color .1s, background .1s; }
  .opt:hover { border-color: var(--accent); }
  .opt kbd { font-family: var(--display); background: var(--accent); color: var(--accent-ink); border-radius: 8px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; }
  .opt.right { border-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--bg)); }
  .opt.wrong { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--bg)); }
  .toast { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); background: var(--panel); color: var(--fg); font-size: 18px; font-weight: 700; padding: 8px 16px; border-radius: 999px; box-shadow: 0 4px 14px rgba(0, 0, 0, .35); opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap; max-width: 94%; overflow: hidden; text-overflow: ellipsis; }
  .toast.show { opacity: 1; }
  .help { margin: 0; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; justify-content: center; }
  .mute { font: inherit; font-weight: 700; border: 1px solid var(--line); background: var(--panel); color: var(--fg); border-radius: 999px; padding: 4px 12px; cursor: pointer; }

  .leaderboard {
    padding: 10px;
    background-color: #1b263b;
    color: #e0e1dd;
    border-radius: 5px;
    border: 2px solid #f05972;
    box-shadow: 0 0 12px rgba(237, 74, 213, 0.6);
    min-width: 290px;
    max-width: 420px;
    margin: 10px auto;
    font-size: 1.2rem;
    font-family: 'Courier New', Courier, monospace;
  }
  .leaderboard h2 { color: #f05972; margin: 10px auto; max-width: 290px; font-size: 1.5rem; text-align: center; }
  .leaderboard table { width: 100%; border-collapse: collapse; }
  .leaderboard th, .leaderboard td { padding: 5px; text-align: center; }
  .leaderboard th { border-bottom: 2px solid #e0e1dd; }
  .leaderboard tr:first-child td { color: #ffd700; text-shadow: 0 0 10px #ffd700, 0 0 20px #ffd700; font-weight: bold; }
  .leaderboard tr:nth-child(2) td { color: #c0c0c0; text-shadow: 0 0 10px #c0c0c0, 0 0 20px #ffffff; font-weight: bold; }
  .leaderboard tr:nth-child(3) td { color: #cd7f32; text-shadow: 0 0 10px #cd7f32, 0 0 20px #b87333; font-weight: bold; }
  .leaderboard .rank { width: 25%; }
  .leaderboard .initials { width: 40%; }
  .leaderboard td.initials { text-transform: uppercase; }
  .leaderboard .time { width: 35%; font-family: monospace; white-space: nowrap; }

  @media (max-width: 640px) {
    .hud { grid-template-columns: 1fr 1fr; }
    .stat:first-child { grid-column: 1 / -1; }
    .val { font-size: 19px; }
    .panel { padding: 16px 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .qbox { animation: none; } .qtimer.urgent { animation: none; } }
</style>
