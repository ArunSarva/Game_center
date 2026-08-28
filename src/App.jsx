import { useState, useEffect, useRef } from "react";
import {
  Zap, Wind, Target, Hand, Palette, Grid3x3, Layers, Puzzle, Brain,
  Sparkles, Infinity as InfinityIcon, Flag, ArrowLeft, RotateCcw, Circle, Mountain,
  ChevronsUp, Repeat, Disc, LayoutGrid, Bomb, Volume2, VolumeX, Music,
} from "lucide-react";

/* ------------------------------ audio engine ------------------------------ */

const AudioEngine = (() => {
  let ctx = null;
  let sfxOn = true;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;

  function getCtx() {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, duration = 0.09, type = "square", volume = 0.15, sweep = 0, delay = 0 }) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + sweep), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  const SFX = {
    click: () => tone({ freq: 520, duration: 0.05, volume: 0.1 }),
    select: () => tone({ freq: 680, duration: 0.06, volume: 0.12 }),
    coin: () => { tone({ freq: 988, duration: 0.06, volume: 0.13 }); tone({ freq: 1318, duration: 0.09, volume: 0.13, delay: 0.06 }); },
    score: () => tone({ freq: 700, duration: 0.09, volume: 0.13, sweep: 260 }),
    hit: () => tone({ freq: 180, duration: 0.14, type: "sawtooth", volume: 0.15, sweep: -100 }),
    jump: () => tone({ freq: 300, duration: 0.09, volume: 0.12, sweep: 200 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.15, volume: 0.14, delay: i * 0.1 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, duration: 0.17, type: "sawtooth", volume: 0.14, delay: i * 0.11 })),
    neutral: () => tone({ freq: 440, duration: 0.12, volume: 0.12 }),
    flip: () => tone({ freq: 220, duration: 0.05, volume: 0.11, sweep: 140 }),
  };

  function playSfx(name) {
    if (!sfxOn) return;
    const fn = SFX[name];
    if (fn) fn();
  }
  function playNote(freq, duration = 0.26) {
    if (!sfxOn) return;
    tone({ freq, duration, type: "triangle", volume: 0.16 });
  }

  const MUSIC_NOTES = [130.81, 164.81, 196.0, 164.81, 130.81, 98.0, 130.81, 164.81];
  function musicStepFn() {
    if (!musicOn) return;
    const c = getCtx();
    if (c) {
      const freq = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      const t0 = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.045, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    }
    musicStep++;
    musicTimer = setTimeout(musicStepFn, 280);
  }
  function startMusic() { getCtx(); if (musicOn) return; musicOn = true; musicStepFn(); }
  function stopMusic() { musicOn = false; if (musicTimer) clearTimeout(musicTimer); musicTimer = null; }
  function toggleMusic() { if (musicOn) stopMusic(); else startMusic(); return musicOn; }
  function setSfxOn(v) { sfxOn = v; }
  function isMusicOn() { return musicOn; }

  return { playSfx, playNote, toggleMusic, isMusicOn, setSfxOn };
})();

/* ----------------------------- shared data ----------------------------- */

const EMOJIS = ["⚡", "⭐", "🔥", "💎", "🌟"];
const MEMORY_EMOJIS = ["🎮", "🚀", "🍕", "⭐", "🐼", "🌈", "🎧", "🎲"];

const COLOR_POOL = [
  { name: "Coral", hex: "#FF5D5D" },
  { name: "Teal", hex: "#2FE6C4" },
  { name: "Amber", hex: "#FFC93C" },
  { name: "Violet", hex: "#9B7BFF" },
  { name: "Lime", hex: "#8CE05A" },
  { name: "Sky", hex: "#4FB8FF" },
  { name: "Rose", hex: "#FF7BB0" },
  { name: "Ember", hex: "#FF8A3D" },
];

const QUIZ_POOL = [
  { q: "What is the largest planet in our solar system?", options: ["Earth", "Jupiter", "Saturn", "Mars"], answer: 1 },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "12"], answer: 1 },
  { q: "What is the capital of Japan?", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"], answer: 2 },
  { q: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "What gas do plants absorb from the air?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], answer: 1 },
  { q: "How many colors are in a rainbow?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What is the freezing point of water in Celsius?", options: ["0", "32", "100", "-10"], answer: 0 },
  { q: "Which animal is known as the King of the Jungle?", options: ["Tiger", "Elephant", "Lion", "Bear"], answer: 2 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What do bees make?", options: ["Milk", "Honey", "Silk", "Wax only"], answer: 1 },
  { q: "Which shape has three sides?", options: ["Square", "Triangle", "Circle", "Pentagon"], answer: 1 },
  { q: "What is the main language spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "English"], answer: 1 },
  { q: "How many players are on a standard soccer team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "What is H2O more commonly known as?", options: ["Salt", "Water", "Sugar", "Oxygen"], answer: 1 },
];

const RPS_CHOICES = [
  { id: "rock", emoji: "🪨" },
  { id: "paper", emoji: "📄" },
  { id: "scissors", emoji: "✂️" },
];

const SIMON_COLORS = [
  { id: 0, base: "#2FE6C4", light: "#7dfff0" },
  { id: 1, base: "#FF5D5D", light: "#ffb0b0" },
  { id: 2, base: "#FFC93C", light: "#ffe38a" },
  { id: 3, base: "#9B7BFF", light: "#d3c4ff" },
];
const SIMON_FREQS = [523.25, 392.0, 659.25, 293.66];

function rpsWinner(a, b) {
  if (a === b) return "draw";
  if ((a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper")) return "p1";
  return "p2";
}

/* ----------------------------- 2048 helpers ----------------------------- */

function empty4x4() {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}
function addRandomTile(grid) {
  const empties = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empties.push([r, c]); }));
  if (!empties.length) return grid;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const newGrid = grid.map((row) => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
}
function slideRowLeft(row) {
  const nums = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < 4) nums.push(0);
  return { row: nums, gained };
}
function rotateGridCW(grid) {
  const n = 4;
  const res = empty4x4();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) res[c][n - 1 - r] = grid[r][c];
  return res;
}
function moveGrid(grid, dir) {
  let g = grid.map((row) => [...row]);
  const rotations = { left: 0, up: 3, right: 2, down: 1 }[dir];
  for (let i = 0; i < rotations; i++) g = rotateGridCW(g);
  let moved = false, gained = 0;
  const newRows = g.map((row) => {
    const { row: newRow, gained: g2 } = slideRowLeft(row);
    if (newRow.some((v, i) => v !== row[i])) moved = true;
    gained += g2;
    return newRow;
  });
  let result = newRows;
  const backRotations = (4 - rotations) % 4;
  for (let i = 0; i < backRotations; i++) result = rotateGridCW(result);
  return { grid: result, moved, gained };
}
function canMove(grid) {
  for (const dir of ["left", "right", "up", "down"]) {
    if (moveGrid(grid, dir).moved) return true;
  }
  return false;
}
function tileColor(v) {
  const map = {
    2: "#2a2c66", 4: "#33356f", 8: "#4d3f8c", 16: "#6a3f97", 32: "#8a3f97",
    64: "#b23f8f", 128: "#FFC93C", 256: "#FF9F3C", 512: "#FF7D3C", 1024: "#FF5D5D", 2048: "#2FE6C4",
  };
  return map[v] || "rgba(255,255,255,0.04)";
}

/* ------------------------------ tiny particles --------------------------- */

function spawnBurst(particles, x, y, color, count = 12, sfx) {
  if (sfx) AudioEngine.playSfx(sfx);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.4 + Math.random() * 2.6;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
  }
}
function updateAndDrawParticles(ctx, particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.045;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function spawnPopup(popups, x, y, text, color) {
  popups.push({ x, y, text, color, life: 1 });
}
function updateAndDrawPopups(ctx, popups) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y -= 0.7; p.life -= 0.02;
    if (p.life <= 0) { popups.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/* ------------------------------- overlay -------------------------------- */

function Overlay({ emoji, title, statLines, onRestart, onExit, extraAction, sound = "neutral" }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setShow(true); AudioEngine.playSfx(sound); }, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, []);
  if (!show) return null;
  return (
    <div className="ga-overlay">
      <div className="ga-overlay-card">
        <div className="ga-overlay-emoji">{emoji}</div>
        <h3>{title}</h3>
        {statLines && statLines.map((l, i) => <div key={i} className="ga-overlay-stat">{l}</div>)}
        <div className="ga-overlay-actions">
          {extraAction && <button className="ga-btn" onClick={() => { AudioEngine.playSfx("click"); extraAction.onClick(); }}>{extraAction.label}</button>}
          <button className="ga-btn ga-btn-primary" onClick={() => { AudioEngine.playSfx("click"); onRestart(); }}><RotateCcw size={16} /> Play again</button>
          {onExit && <button className="ga-btn" onClick={() => { AudioEngine.playSfx("click"); onExit(); }}><ArrowLeft size={16} /> Arcade</button>}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- endless: snake ------------------------------ */

function SnakeGame({ onFinish, best, goHome }) {
  const SIZE = 16, CELL = 18;
  function randCell(exclude) {
    let c;
    do { c = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) }; }
    while (exclude.some((s) => s.x === c.x && s.y === c.y));
    return c;
  }
  const initial = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  const [snake, setSnake] = useState(initial);
  const [food, setFood] = useState(() => randCell(initial));
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(160);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);
  const dirRef = useRef({ x: 1, y: 0 });
  const nextDirRef = useRef({ x: 1, y: 0 });
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const snakeRef = useRef(initial);
  const foodRef = useRef(food);
  const particlesRef = useRef([]);

  function reset() {
    setSnake(initial); snakeRef.current = initial;
    const f = randCell(initial);
    setFood(f); foodRef.current = f;
    setScore(0); setSpeed(160); setOver(false); setShake(false);
    dirRef.current = { x: 1, y: 0 }; nextDirRef.current = { x: 1, y: 0 };
    particlesRef.current = [];
  }

  function steer(nd) {
    if (nd.x === -dirRef.current.x && nd.y === -dirRef.current.y) return;
    nextDirRef.current = nd;
  }

  useEffect(() => {
    function onKey(e) {
      const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      steer(nd);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      dirRef.current = nextDirRef.current;
      setSnake((prev) => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
        const hit = head.x < 0 || head.x >= SIZE || head.y < 0 || head.y >= SIZE || prev.some((s) => s.x === head.x && s.y === head.y);
        if (hit) {
          setOver(true);
          spawnBurst(particlesRef.current, head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, "#FF5D5D", 18, "hit");
          setShake(true); setTimeout(() => setShake(false), 280);
          return prev;
        }
        const next = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore((sc) => sc + 10);
          spawnBurst(particlesRef.current, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, "#FFC93C", 14, "coin");
          const f = randCell(next);
          setFood(f); foodRef.current = f;
          setSpeed((sp) => Math.max(70, sp - 4));
        } else {
          next.pop();
        }
        snakeRef.current = next;
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [speed, over, food]);

  useEffect(() => { if (over) onFinish(score); }, [over]);

  useEffect(() => {
    function loop() {
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL);
      ctx.fillStyle = "#FFC93C";
      ctx.fillRect(foodRef.current.x * CELL + 2, foodRef.current.y * CELL + 2, CELL - 4, CELL - 4);
      snakeRef.current.forEach((s, i) => { ctx.fillStyle = i === 0 ? "#2FE6C4" : "rgba(47,230,196,0.75)"; ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2); });
      updateAndDrawParticles(ctx, particlesRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Best: {best ?? 0}</span></div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={SIZE * CELL} height={SIZE * CELL} className="ga-canvas" />
      </div>
      {over && <Overlay emoji="🐍" title="Game over" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <div className="ga-dpad">
        <button onClick={() => steer({ x: 0, y: -1 })}>↑</button>
        <div>
          <button onClick={() => steer({ x: -1, y: 0 })}>←</button>
          <button onClick={() => steer({ x: 0, y: 1 })}>↓</button>
          <button onClick={() => steer({ x: 1, y: 0 })}>→</button>
        </div>
      </div>
      <p className="ga-hint">Arrow keys, WASD, or the pad to steer. Don't hit the wall or yourself.</p>
    </div>
  );
}

/* -------------------------- endless: flappy ------------------------------ */

function FlappyGame({ onFinish, best, goHome }) {
  const W = 320, H = 400, PIPE_W = 46, GAP = 132, GRAVITY = 0.5, FLAP = -8.2, PIPE_SPEED = 2.6, SPAWN_EVERY = 100, BIRD_X = 56, BIRD_R = 13;
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshState() {
    return { birdY: H / 2, vel: 0, pipes: [], particles: [], frame: 0, score: 0, alive: true, ended: false, started: false };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0); setOver(false); setShake(false);
  }
  function flap() {
    const s = stateRef.current;
    if (!s || s.ended) return;
    s.started = true;
    s.vel = FLAP;
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (s.started && s.alive) {
        s.vel += GRAVITY;
        s.birdY += s.vel;
        s.frame++;
        if (s.frame % SPAWN_EVERY === 1) s.pipes.push({ x: W, gapY: 50 + Math.random() * (H - 200), passed: false });
        s.pipes.forEach((p) => (p.x -= PIPE_SPEED));
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);
        s.pipes.forEach((p) => {
          if (!p.passed && p.x + PIPE_W < BIRD_X) {
            p.passed = true; s.score += 1; setScore(s.score);
            spawnBurst(s.particles, BIRD_X, s.birdY, "#FFC93C", 8, "score");
          }
        });
        if (s.birdY - BIRD_R < 0 || s.birdY + BIRD_R > H) s.alive = false;
        s.pipes.forEach((p) => {
          const overlapX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
          if (overlapX && (s.birdY - BIRD_R < p.gapY || s.birdY + BIRD_R > p.gapY + GAP)) s.alive = false;
        });
        if (!s.alive && !s.ended) {
          s.ended = true; setOver(true);
          spawnBurst(s.particles, BIRD_X, s.birdY, "#FF5D5D", 16, "hit");
          setShake(true); setTimeout(() => setShake(false), 280);
        }
      }
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(47,230,196,0.85)";
      s.pipes.forEach((p) => {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - (p.gapY + GAP));
      });
      ctx.fillStyle = "#FFC93C";
      ctx.beginPath(); ctx.arc(BIRD_X, s.birdY, BIRD_R, 0, Math.PI * 2); ctx.fill();
      updateAndDrawParticles(ctx, s.particles);
      if (!s.started) {
        ctx.fillStyle = "rgba(245,243,255,0.85)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Click or press Space to flap", W / 2, H / 2);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.code === "Space") { e.preventDefault(); flap(); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (over) onFinish(score); }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Best: {best ?? 0}</span></div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`} onClick={flap}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && <Overlay emoji="🚀" title="Crashed!" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Click the screen or press Space to flap through the gaps.</p>
    </div>
  );
}

/* -------------------------- endless: reflex ------------------------------ */

function ReflexGame({ onFinish, best, goHome }) {
  const W = 300, H = 360, SIZE = 34;
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const idRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const scoreRef = useRef(0);

  function reset() {
    setTargets([]); setScore(0); setLives(3); setOver(false);
    scoreRef.current = 0; spawnTimerRef.current = 0;
  }

  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      const fallSpeed = 2.6 + Math.min(4, scoreRef.current * 0.06);
      const spawnEvery = Math.max(22, 55 - scoreRef.current);
      spawnTimerRef.current += 1;
      setTargets((prev) => {
        let next = prev.map((t) => ({ ...t, y: t.y + fallSpeed }));
        const missed = next.filter((t) => t.y > H).length;
        next = next.filter((t) => t.y <= H);
        if (missed > 0) {
          setLives((l) => {
            const nl = l - missed;
            if (nl <= 0) setOver(true);
            return Math.max(0, nl);
          });
        }
        if (spawnTimerRef.current >= spawnEvery) {
          spawnTimerRef.current = 0;
          next.push({ id: idRef.current++, x: 12 + Math.random() * (W - SIZE - 12), y: -SIZE, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] });
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [over]);

  useEffect(() => { if (over) onFinish(score); }, [over]);

  function catchTarget(id) {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    setScore((s) => { const ns = s + 1; scoreRef.current = ns; return ns; });
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Lives: {"♥".repeat(lives)}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-canvas-wrap" style={{ width: W, height: H, position: "relative", overflow: "hidden" }}>
        {targets.map((t) => (
          <button key={t.id} className="ga-falling-target" style={{ left: t.x, top: t.y, width: SIZE, height: SIZE }} onClick={() => catchTarget(t.id)}>{t.emoji}</button>
        ))}
      </div>
      {over && <Overlay emoji="⚡" title="Reflexes maxed out" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Tap the sparks before they hit the floor. Three misses ends it.</p>
    </div>
  );
}

/* -------------------------- endless: whack ------------------------------ */

function WhackGame({ onFinish, best, goHome }) {
  const HOLES = 9;
  const [activeIdx, setActiveIdx] = useState(-1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const timerRef = useRef(null);
  const moleTokenRef = useRef(0);

  function popCycle() {
    if (overRef.current) return;
    const delay = 350 + Math.random() * Math.max(150, 700 - scoreRef.current * 15);
    timerRef.current = setTimeout(() => {
      if (overRef.current) return;
      const myToken = ++moleTokenRef.current;
      const idx = Math.floor(Math.random() * HOLES);
      setActiveIdx(idx);
      const visibleFor = Math.max(480, 1050 - scoreRef.current * 12);
      timerRef.current = setTimeout(() => {
        if (overRef.current) return;
        if (moleTokenRef.current !== myToken) return;
        setActiveIdx(-1);
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) { overRef.current = true; setOver(true); }
          return Math.max(0, nl);
        });
        popCycle();
      }, visibleFor);
    }, delay);
  }

  useEffect(() => { popCycle(); return () => clearTimeout(timerRef.current); }, []);
  useEffect(() => { if (over) onFinish(score); }, [over]);

  function reset() {
    clearTimeout(timerRef.current);
    setActiveIdx(-1); setScore(0); setLives(3); setOver(false);
    scoreRef.current = 0; overRef.current = false; moleTokenRef.current = 0;
    popCycle();
  }

  function whack(idx) {
    if (idx !== activeIdx) return;
    AudioEngine.playSfx("hit");
    moleTokenRef.current++;
    setActiveIdx(-1);
    setScore((s) => { const ns = s + 1; scoreRef.current = ns; return ns; });
    popCycle();
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Lives: {"♥".repeat(lives)}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-whack-grid">
        {Array.from({ length: HOLES }).map((_, i) => (
          <button key={i} className={`ga-hole ${i === activeIdx ? "ga-hole-active" : ""}`} onClick={() => whack(i)}>
            {i === activeIdx && <span key={`${i}-${activeIdx}`} className="ga-pop-anim">🐹</span>}
          </button>
        ))}
      </div>
      {over && <Overlay emoji="🔨" title="Out of misses" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Whack the critter the instant it pops up. Three misses ends the round.</p>
    </div>
  );
}

/* -------------------------- endless: hue chase ---------------------------- */

function HueChaseGame({ onFinish, best, goHome }) {
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [over, setOver] = useState(false);
  const [target, setTarget] = useState(null);
  const [options, setOptions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(100);
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const decRef = useRef(2.5);

  function pickRound(curScore) {
    const shuffled = [...COLOR_POOL].sort(() => Math.random() - 0.5);
    const count = Math.min(6, 4 + Math.floor(curScore / 5));
    const opts = shuffled.slice(0, count);
    const t = opts[Math.floor(Math.random() * opts.length)];
    setOptions(opts);
    setTarget(t);
    setTimeLeft(100);
    const duration = Math.max(1300, 3000 - curScore * 60);
    decRef.current = 100 / (duration / 40);
  }

  function reset() {
    scoreRef.current = 0; overRef.current = false;
    setScore(0); setMistakes(0); setOver(false);
    pickRound(0);
  }

  useEffect(() => { pickRound(0); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (overRef.current) return;
      setTimeLeft((t) => {
        const nt = t - decRef.current;
        if (nt <= 0) { registerMistake(); return 100; }
        return nt;
      });
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, []);

  function registerMistake() {
    setMistakes((m) => {
      const nm = m + 1;
      if (nm >= 3) { overRef.current = true; setOver(true); }
      else { pickRound(scoreRef.current); }
      return nm;
    });
  }

  function choose(opt) {
    if (overRef.current) return;
    if (opt.name === target.name) {
      AudioEngine.playSfx("coin");
      const ns = scoreRef.current + 1;
      scoreRef.current = ns;
      setScore(ns);
      pickRound(ns);
    } else {
      AudioEngine.playSfx("hit");
      registerMistake();
    }
  }

  useEffect(() => { if (over) onFinish(score); }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Strikes: {mistakes}/3</span><span>Best: {best ?? 0}</span></div>
      {target && (
        <>
          <div className="ga-hue-target">Tap: <b style={{ color: target.hex }}>{target.name}</b></div>
          <div className="ga-timebar-track"><div className="ga-timebar-fill" style={{ width: `${Math.max(0, timeLeft)}%` }} /></div>
          <div className="ga-hue-grid">
            {options.map((o) => (
              <button key={o.name} className="ga-hue-swatch" style={{ background: o.hex }} onClick={() => choose(o)} aria-label={o.name} />
            ))}
          </div>
        </>
      )}
      {over && <Overlay emoji="🎨" title="Three strikes" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Tap the swatch that matches the named color before time runs out.</p>
    </div>
  );
}

/* ------------------------- challenge: tic tac toe -------------------------- */

function TicTacToeGame({ onFinish, best, goHome }) {
  const empty = Array(9).fill(null);
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const [board, setBoard] = useState(empty);
  const [turn, setTurn] = useState("X");
  const [result, setResult] = useState(null);
  const [wins, setWins] = useState(0);

  function winnerOf(b) {
    for (const [a, c, d] of LINES) { if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; }
    return null;
  }
  function reset() { setBoard(empty); setTurn("X"); setResult(null); }

  function cpuMove(b) {
    const avail = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    for (const i of avail) { const t = [...b]; t[i] = "O"; if (winnerOf(t) === "O") return i; }
    for (const i of avail) { const t = [...b]; t[i] = "X"; if (winnerOf(t) === "X") return i; }
    if (b[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter((i) => avail.includes(i));
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function play(i) {
    if (board[i] || result || turn !== "X") return;
    AudioEngine.playSfx("click");
    const b1 = [...board]; b1[i] = "X";
    const w1 = winnerOf(b1);
    if (w1) { setBoard(b1); setResult("win"); return; }
    if (b1.every(Boolean)) { setBoard(b1); setResult("draw"); return; }
    setBoard(b1); setTurn("O");
    setTimeout(() => {
      const move = cpuMove(b1);
      const b2 = [...b1]; b2[move] = "O";
      const w2 = winnerOf(b2);
      setBoard(b2);
      AudioEngine.playSfx("click");
      if (w2) setResult("lose");
      else if (b2.every(Boolean)) setResult("draw");
      else setTurn("X");
    }, 450);
  }

  useEffect(() => {
    if (result === "win") setWins((w) => { const nw = w + 1; onFinish(nw); return nw; });
  }, [result]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Round wins: {wins}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-ttt-board">
        {board.map((v, i) => <button key={i} className="ga-ttt-cell" onClick={() => play(i)} disabled={!!v || !!result}>{v && <span key={i + "-" + v} className="ga-pop-anim">{v}</span>}</button>)}
      </div>
      {result && (
        <Overlay
          emoji={result === "win" ? "🏆" : result === "lose" ? "🤖" : "🤝"}
          title={result === "win" ? "You win!" : result === "lose" ? "CPU wins" : "Draw"}
          statLines={[`Round wins this session: ${wins}`]}
          onRestart={reset} onExit={goHome}
          sound={result === "win" ? "win" : result === "lose" ? "lose" : "neutral"}
        />
      )}
      <p className="ga-hint">Get three in a row before the CPU does.</p>
    </div>
  );
}

/* --------------------------- challenge: memory ----------------------------- */

function MemoryGame({ onFinish, best, goHome }) {
  function shuffleDeck() {
    return [...MEMORY_EMOJIS, ...MEMORY_EMOJIS]
      .map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
  }
  const [cards, setCards] = useState(shuffleDeck);
  const [selected, setSelected] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);

  function reset() { setCards(shuffleDeck()); setSelected([]); setMoves(0); setLocked(false); setDone(false); }

  function flip(id) {
    if (locked || done) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    AudioEngine.playSfx("click");
    const newCards = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    const newSelected = [...selected, id];
    setCards(newCards);
    setSelected(newSelected);
    if (newSelected.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = newSelected;
      const ca = newCards.find((c) => c.id === a), cb = newCards.find((c) => c.id === b);
      if (ca.emoji === cb.emoji) {
        setTimeout(() => {
          AudioEngine.playSfx("coin");
          setCards((cs) => cs.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
          setSelected([]); setLocked(false);
        }, 400);
      } else {
        setTimeout(() => {
          AudioEngine.playSfx("hit");
          setCards((cs) => cs.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c)));
          setSelected([]); setLocked(false);
        }, 700);
      }
    }
  }

  useEffect(() => { if (cards.length && cards.every((c) => c.matched) && !done) setDone(true); }, [cards, done]);
  useEffect(() => { if (done) onFinish(moves); }, [done]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Moves: {moves}</span><span>Best: {best != null ? best + " moves" : "—"}</span></div>
      <div className="ga-memory-grid">
        {cards.map((c) => (
          <button key={c.id} className={`ga-memory-card ${c.matched ? "is-matched" : ""}`} onClick={() => flip(c.id)}>
            <div className={`ga-memory-inner ${c.flipped || c.matched ? "is-flipped" : ""}`}>
              <div className="ga-memory-face ga-memory-front">?</div>
              <div className="ga-memory-face ga-memory-back">{c.emoji}</div>
            </div>
          </button>
        ))}
      </div>
      {done && <Overlay emoji="🧠" title="Board cleared!" statLines={[`Moves: ${moves}`]} onRestart={reset} onExit={goHome} sound="win" />}
      <p className="ga-hint">Flip two cards at a time and find every pair in the fewest moves.</p>
    </div>
  );
}

/* --------------------------- challenge: 2048 ------------------------------- */

function TwentyFortyEightGame({ onFinish, best, goHome }) {
  function freshGrid() { return addRandomTile(addRandomTile(empty4x4())); }
  const [grid, setGrid] = useState(freshGrid);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState(null);
  const [continued, setContinued] = useState(false);

  function reset() { setGrid(freshGrid()); setScore(0); setStatus(null); setContinued(false); }

  function handleMove(dir) {
    if (status === "lost" || (status === "won" && !continued)) return;
    const { grid: newGrid, moved, gained } = moveGrid(grid, dir);
    if (!moved) return;
    AudioEngine.playSfx(gained > 0 ? "score" : "click");
    const withTile = addRandomTile(newGrid);
    setGrid(withTile);
    setScore((s) => s + gained);
    const maxTile = Math.max(...withTile.flat());
    if (maxTile >= 2048 && status !== "won") setStatus("won");
    else if (!canMove(withTile)) setStatus("lost");
  }

  useEffect(() => {
    function onKey(e) {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [grid, status, continued]);

  useEffect(() => { if (status) onFinish(score); }, [status]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-2048-grid">
        {grid.flat().map((v, i) => (
          <div key={i} className="ga-2048-tile" style={{ background: tileColor(v) }}>{v !== 0 ? v : ""}</div>
        ))}
      </div>
      <div className="ga-dpad">
        <button onClick={() => handleMove("up")}>↑</button>
        <div>
          <button onClick={() => handleMove("left")}>←</button>
          <button onClick={() => handleMove("down")}>↓</button>
          <button onClick={() => handleMove("right")}>→</button>
        </div>
      </div>
      {status === "won" && !continued && (
        <Overlay emoji="🎉" title="You hit 2048!" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} extraAction={{ label: "Keep going", onClick: () => setContinued(true) }} sound="win" />
      )}
      {status === "lost" && <Overlay emoji="🧩" title="No more moves" statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Arrow keys or the pad to slide tiles. Matching numbers merge.</p>
    </div>
  );
}

/* --------------------------- challenge: quiz -------------------------------- */

function QuizGame({ onFinish, best, goHome }) {
  const TOTAL = 10;
  function newSet() { return [...QUIZ_POOL].sort(() => Math.random() - 0.5).slice(0, TOTAL); }
  const [questions, setQuestions] = useState(newSet);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);

  function reset() { setQuestions(newSet()); setIdx(0); setScore(0); setPicked(null); setDone(false); }

  function choose(optIdx) {
    if (picked !== null) return;
    setPicked(optIdx);
    const correct = optIdx === questions[idx].answer;
    AudioEngine.playSfx(correct ? "coin" : "hit");
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else { setIdx((i) => i + 1); setPicked(null); }
    }, 700);
  }

  useEffect(() => { if (done) onFinish(score); }, [done]);

  if (done) {
    return (
      <div className="ga-game-col">
        <Overlay emoji="🧠" title="Quiz complete" statLines={[`Score: ${score} / ${questions.length}`]} onRestart={reset} onExit={goHome} sound={score >= questions.length * 0.7 ? "win" : "neutral"} />
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Question {idx + 1} / {questions.length}</span><span>Score: {score}</span><span>Best: {best != null ? best + "/10" : "—"}</span></div>
      <div className="ga-quiz-q">{q.q}</div>
      <div className="ga-quiz-options">
        {q.options.map((opt, i) => {
          let cls = "ga-quiz-opt";
          if (picked !== null) {
            if (i === q.answer) cls += " is-correct";
            else if (i === picked) cls += " is-wrong";
          }
          return <button key={i} className={cls} onClick={() => choose(i)} disabled={picked !== null}>{opt}</button>;
        })}
      </div>
      <p className="ga-hint">Ten quick questions. Pick fast, no pressure.</p>
    </div>
  );
}

/* ---------------------------- challenge: rps -------------------------------- */

function RPSGame({ onFinish, best, goHome }) {
  const [playerWins, setPlayerWins] = useState(0);
  const [cpuWins, setCpuWins] = useState(0);
  const [lastRound, setLastRound] = useState(null);
  const [matchOver, setMatchOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  function reset() { setPlayerWins(0); setCpuWins(0); setLastRound(null); setMatchOver(false); setRoundCount(0); }

  function play(choiceId) {
    if (matchOver) return;
    const cpuChoice = RPS_CHOICES[Math.floor(Math.random() * 3)].id;
    const result = rpsWinner(choiceId, cpuChoice);
    AudioEngine.playSfx(result === "p1" ? "score" : result === "p2" ? "hit" : "click");
    let pw = playerWins, cw = cpuWins;
    if (result === "p1") pw += 1;
    if (result === "p2") cw += 1;
    setPlayerWins(pw); setCpuWins(cw);
    setLastRound({ p: choiceId, c: cpuChoice, result });
    setRoundCount((r) => r + 1);
    if (pw >= 3 || cw >= 3) setMatchOver(true);
  }

  useEffect(() => {
    if (matchOver) {
      const won = playerWins >= 3;
      setStreak((s) => { const ns = won ? s + 1 : 0; if (won) onFinish(ns); return ns; });
    }
  }, [matchOver]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>You: {playerWins}</span><span>CPU: {cpuWins}</span><span>Best streak: {best ?? 0}</span></div>
      <div className="ga-rps-arena">
        <div className="ga-rps-side"><div key={"p" + roundCount} className="ga-rps-emoji ga-pop-anim">{lastRound ? RPS_CHOICES.find((c) => c.id === lastRound.p).emoji : "❔"}</div><span>You</span></div>
        <div className="ga-rps-vs">VS</div>
        <div className="ga-rps-side"><div key={"c" + roundCount} className="ga-rps-emoji ga-pop-anim">{lastRound ? RPS_CHOICES.find((c) => c.id === lastRound.c).emoji : "❔"}</div><span>CPU</span></div>
      </div>
      <div className="ga-rps-choices">
        {RPS_CHOICES.map((c) => <button key={c.id} className="ga-rps-btn" onClick={() => play(c.id)} disabled={matchOver}>{c.emoji}</button>)}
      </div>
      {matchOver && (
        <Overlay emoji={playerWins >= 3 ? "🏆" : "🤖"} title={playerWins >= 3 ? "You took the match!" : "CPU takes it"} statLines={[`Final: ${playerWins} - ${cpuWins}`]} onRestart={reset} onExit={goHome} sound={playerWins >= 3 ? "win" : "lose"} />
      )}
      <p className="ga-hint">First to three round wins takes the match.</p>
    </div>
  );
}

/* --------------------------- challenge: pong -------------------------------- */

function PongGame({ onFinish, best, goHome }) {
  const W = 320, H = 220, PADDLE_H = 50, PADDLE_W = 8, BALL_R = 6, WIN_SCORE = 7;
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [scores, setScores] = useState({ p: 0, cpu: 0 });
  const [over, setOver] = useState(null);
  const [streak, setStreak] = useState(0);

  function freshBall(dir) {
    const speed = 3.2;
    const angle = Math.random() * 0.6 - 0.3;
    return { x: W / 2, y: H / 2, vx: speed * dir, vy: speed * angle };
  }
  function freshState() {
    return { playerY: H / 2 - PADDLE_H / 2, cpuY: H / 2 - PADDLE_H / 2, ball: freshBall(Math.random() < 0.5 ? 1 : -1), particles: [], p: 0, cpu: 0, ended: false };
  }
  function reset() {
    stateRef.current = freshState();
    setScores({ p: 0, cpu: 0 });
    setOver(null);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        if (s.ball.y - BALL_R < 0) { s.ball.y = BALL_R; s.ball.vy *= -1; }
        if (s.ball.y + BALL_R > H) { s.ball.y = H - BALL_R; s.ball.vy *= -1; }
        if (s.ball.x - BALL_R < 14 + PADDLE_W && s.ball.x - BALL_R > 14 && s.ball.vx < 0) {
          if (s.ball.y > s.playerY && s.ball.y < s.playerY + PADDLE_H) {
            const hitPos = (s.ball.y - (s.playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
            s.ball.vx = Math.abs(s.ball.vx) * 1.04;
            s.ball.vy = hitPos * 4;
            s.ball.x = 14 + PADDLE_W + BALL_R;
            spawnBurst(s.particles, s.ball.x, s.ball.y, "#2FE6C4", 6, "click");
          }
        }
        const cpuX = W - 14 - PADDLE_W;
        if (s.ball.x + BALL_R > cpuX && s.ball.x + BALL_R < cpuX + PADDLE_W && s.ball.vx > 0) {
          if (s.ball.y > s.cpuY && s.ball.y < s.cpuY + PADDLE_H) {
            const hitPos = (s.ball.y - (s.cpuY + PADDLE_H / 2)) / (PADDLE_H / 2);
            s.ball.vx = -Math.abs(s.ball.vx) * 1.04;
            s.ball.vy = hitPos * 4;
            s.ball.x = cpuX - BALL_R;
            spawnBurst(s.particles, s.ball.x, s.ball.y, "#FF5D5D", 6, "click");
          }
        }
        if (s.ball.x < -BALL_R) {
          s.cpu += 1; setScores({ p: s.p, cpu: s.cpu });
          if (s.cpu >= WIN_SCORE) { s.ended = true; setOver("cpu"); }
          else s.ball = freshBall(1);
        } else if (s.ball.x > W + BALL_R) {
          s.p += 1; setScores({ p: s.p, cpu: s.cpu });
          if (s.p >= WIN_SCORE) { s.ended = true; setOver("player"); }
          else s.ball = freshBall(-1);
        }
        const cpuTarget = s.ball.y - PADDLE_H / 2 + (Math.random() - 0.5) * 10;
        const cpuSpeed = 2.6;
        if (s.cpuY < cpuTarget) s.cpuY = Math.min(s.cpuY + cpuSpeed, cpuTarget);
        else s.cpuY = Math.max(s.cpuY - cpuSpeed, cpuTarget);
        s.cpuY = Math.max(0, Math.min(H - PADDLE_H, s.cpuY));
      }
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#2FE6C4"; ctx.fillRect(14, s.playerY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#FF5D5D"; ctx.fillRect(W - 14 - PADDLE_W, s.cpuY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#FFC93C";
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      updateAndDrawParticles(ctx, s.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    function setFromClientY(clientY) {
      const rect = el.getBoundingClientRect();
      const y = ((clientY - rect.top) / rect.height) * H;
      const s = stateRef.current;
      if (s) s.playerY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    }
    function onMouseMove(e) { setFromClientY(e.clientY); }
    function onTouchMove(e) { if (e.touches[0]) { setFromClientY(e.touches[0].clientY); e.preventDefault(); } }
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      const s = stateRef.current;
      if (!s) return;
      const step = 22;
      if (e.key === "ArrowUp") { e.preventDefault(); s.playerY = Math.max(0, s.playerY - step); }
      if (e.key === "ArrowDown") { e.preventDefault(); s.playerY = Math.min(H - PADDLE_H, s.playerY + step); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) {
      const won = over === "player";
      setStreak((s) => { const ns = won ? s + 1 : 0; if (won) onFinish(ns); return ns; });
    }
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>You: {scores.p}</span><span>CPU: {scores.cpu}</span><span>Best streak: {best ?? 0}</span></div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "player" ? "🏆" : "🤖"}
          title={over === "player" ? "You win the match!" : "CPU wins the match"}
          statLines={[`Final: ${scores.p} - ${scores.cpu}`]}
          onRestart={reset} onExit={goHome}
          sound={over === "player" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">Move your mouse (or arrow keys) to control the paddle. First to {WIN_SCORE} wins.</p>
    </div>
  );
}

/* ----------------------- challenge: byte hopper (platformer) ----------------------- */

function PlatformerGame({ onFinish, best, goHome }) {
  const W = 320, H = 220;
  const GROUND_Y = 190;
  const GRAVITY = 0.55, JUMP_VELOCITY = -9.2, MOVE_SPEED = 2.6, MAX_FALL = 10;
  const LEVEL_WIDTH = 900;
  const PLAYER_W = 16, PLAYER_H = 22;

  const PLATFORMS = [
    { x: 0, y: GROUND_Y, w: 200, h: 30 },
    { x: 260, y: GROUND_Y, w: 140, h: 30 },
    { x: 460, y: GROUND_Y, w: 100, h: 30 },
    { x: 620, y: GROUND_Y, w: 280, h: 30 },
    { x: 210, y: 140, w: 60, h: 14 },
    { x: 410, y: 118, w: 60, h: 14 },
  ];
  const GOAL = { x: 862, y: GROUND_Y - 70, w: 8, h: 70 };

  function freshEnemies() {
    return [
      { x: 300, y: GROUND_Y - 18, w: 18, h: 18, vx: 0.8, minX: 270, maxX: 380, alive: true },
      { x: 480, y: GROUND_Y - 18, w: 18, h: 18, vx: 0.9, minX: 465, maxX: 545, alive: true },
      { x: 680, y: GROUND_Y - 18, w: 18, h: 18, vx: 0.7, minX: 630, maxX: 800, alive: true },
    ];
  }
  function freshCoins() {
    return [
      { x: 60, y: GROUND_Y - 24 }, { x: 120, y: GROUND_Y - 24 },
      { x: 225, y: 118 }, { x: 250, y: 118 },
      { x: 300, y: GROUND_Y - 24 }, { x: 350, y: GROUND_Y - 24 },
      { x: 425, y: 96 }, { x: 450, y: 96 },
      { x: 500, y: GROUND_Y - 24 }, { x: 700, y: GROUND_Y - 24 }, { x: 750, y: GROUND_Y - 24 },
    ].map((c, i) => ({ ...c, id: i, r: 6, collected: false }));
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const jumpQueuedRef = useRef(false);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      player: { x: 20, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0, grounded: false, facing: 1 },
      enemies: freshEnemies(),
      coins: freshCoins(),
      particles: [],
      lives: 3,
      coinsCollected: 0,
      camX: 0,
      ended: false,
    };
  }

  function reset() {
    stateRef.current = freshState();
    setCoinsCollected(0);
    setLives(3);
    setOver(null);
    setShake(false);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function respawn(s) {
    s.player.x = 20; s.player.y = GROUND_Y - PLAYER_H; s.player.vx = 0; s.player.vy = 0;
  }

  function hitFlash() { setShake(true); setTimeout(() => setShake(false), 260); }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        p.vx = keysRef.current.left ? -MOVE_SPEED : keysRef.current.right ? MOVE_SPEED : 0;
        if (p.vx < 0) p.facing = -1;
        if (p.vx > 0) p.facing = 1;
        p.x += p.vx;
        p.x = Math.max(0, Math.min(LEVEL_WIDTH - PLAYER_W, p.x));
        for (const plat of PLATFORMS) {
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          if (rectsOverlap(pr, plat)) {
            if (p.vx > 0) p.x = plat.x - PLAYER_W;
            else if (p.vx < 0) p.x = plat.x + plat.w;
          }
        }
        p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
        if (jumpQueuedRef.current && p.grounded) { p.vy = JUMP_VELOCITY; p.grounded = false; AudioEngine.playSfx("jump"); }
        jumpQueuedRef.current = false;
        p.y += p.vy;
        p.grounded = false;
        for (const plat of PLATFORMS) {
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          if (rectsOverlap(pr, plat)) {
            if (p.vy > 0) { p.y = plat.y - PLAYER_H; p.vy = 0; p.grounded = true; }
            else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
          }
        }
        if (p.y > H + 40) {
          s.lives -= 1; setLives(s.lives); hitFlash();
          if (s.lives <= 0) { s.ended = true; setOver("lose"); }
          else respawn(s);
        }
        s.enemies.forEach((e) => {
          if (!e.alive) return;
          e.x += e.vx;
          if (e.x < e.minX || e.x > e.maxX) e.vx *= -1;
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          if (rectsOverlap(pr, e) && !s.ended) {
            const wasAbove = p.y + PLAYER_H - p.vy <= e.y + 6;
            if (p.vy > 0 && wasAbove) {
              e.alive = false;
              p.vy = JUMP_VELOCITY * 0.55;
              spawnBurst(s.particles, e.x + e.w / 2, e.y + e.h / 2, "#FF5D5D", 10, "score");
            } else {
              s.lives -= 1; setLives(s.lives); hitFlash();
              spawnBurst(s.particles, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, "#FF5D5D", 12, "hit");
              if (s.lives <= 0) { s.ended = true; setOver("lose"); }
              else respawn(s);
            }
          }
        });
        s.coins.forEach((c) => {
          if (c.collected) return;
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          const cr = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
          if (rectsOverlap(pr, cr)) {
            c.collected = true;
            s.coinsCollected += 1;
            setCoinsCollected(s.coinsCollected);
            spawnBurst(s.particles, c.x, c.y, "#FFC93C", 8, "coin");
          }
        });
        if (!s.ended && p.x + PLAYER_W >= GOAL.x) { s.ended = true; setOver("win"); spawnBurst(s.particles, p.x, p.y, "#2FE6C4", 20, "score"); }
        s.camX = Math.max(0, Math.min(LEVEL_WIDTH - W, p.x - W / 2));
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 20; i++) {
        const dx = ((i * 97 - s2.camX * 0.3) % W + W) % W;
        ctx.fillRect(dx, 20 + (i % 5) * 30, 2, 2);
      }
      ctx.save();
      ctx.translate(-s2.camX, 0);
      PLATFORMS.forEach((plat) => {
        ctx.fillStyle = plat.y === GROUND_Y ? "#262a6e" : "#33356f";
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      });
      ctx.fillStyle = "#a8a6c8";
      ctx.fillRect(GOAL.x, GOAL.y, 3, GOAL.h);
      ctx.fillStyle = "#FF5D5D";
      ctx.beginPath();
      ctx.moveTo(GOAL.x + 3, GOAL.y);
      ctx.lineTo(GOAL.x + 26, GOAL.y + 9);
      ctx.lineTo(GOAL.x + 3, GOAL.y + 18);
      ctx.fill();
      s2.coins.forEach((c) => {
        if (c.collected) return;
        ctx.fillStyle = "#FFC93C";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      });
      s2.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = "#FF5D5D";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "#0c0e2e";
        ctx.fillRect(e.x + 3, e.y + 5, 3, 3);
        ctx.fillRect(e.x + e.w - 6, e.y + 5, 3, 3);
      });
      ctx.fillStyle = "#2FE6C4";
      ctx.fillRect(s2.player.x, s2.player.y, PLAYER_W, PLAYER_H);
      ctx.fillStyle = "#0c0e2e";
      const eyeX = s2.player.facing === 1 ? s2.player.x + PLAYER_W - 6 : s2.player.x + 3;
      ctx.fillRect(eyeX, s2.player.y + 5, 3, 3);
      updateAndDrawParticles(ctx, s2.particles);
      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) { keysRef.current.left = true; e.preventDefault(); }
      if (["ArrowRight", "d", "D"].includes(e.key)) { keysRef.current.right = true; e.preventDefault(); }
      if ([" ", "ArrowUp", "w", "W", "Spacebar"].includes(e.key)) { jumpQueuedRef.current = true; e.preventDefault(); }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => { if (over) onFinish(coinsCollected); }, [over]);

  function press(dir, isDown) {
    if (dir === "left") keysRef.current.left = isDown;
    if (dir === "right") keysRef.current.right = isDown;
    if (dir === "jump" && isDown) jumpQueuedRef.current = true;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Bytes: {coinsCollected}</span><span>Lives: {"♥".repeat(Math.max(0, lives))}</span><span>Best: {best ?? 0}</span></div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🏁" : "💥"}
          title={over === "win" ? "Reached the server!" : "Out of lives"}
          statLines={[`Bytes collected: ${coinsCollected}`]}
          onRestart={reset} onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad-row">
        <button onMouseDown={() => press("left", true)} onMouseUp={() => press("left", false)} onMouseLeave={() => press("left", false)} onTouchStart={(e) => { e.preventDefault(); press("left", true); }} onTouchEnd={(e) => { e.preventDefault(); press("left", false); }}>←</button>
        <button onMouseDown={() => press("jump", true)} onTouchStart={(e) => { e.preventDefault(); press("jump", true); }}>⤒</button>
        <button onMouseDown={() => press("right", true)} onMouseUp={() => press("right", false)} onMouseLeave={() => press("right", false)} onTouchStart={(e) => { e.preventDefault(); press("right", true); }} onTouchEnd={(e) => { e.preventDefault(); press("right", false); }}>→</button>
      </div>
      <p className="ga-hint">Arrow keys / A-D to run, Space or Up to jump. Stomp bugs, grab bytes, reach the flag.</p>
    </div>
  );
}

/* ----------------------- endless: road hopper (frogger-style) ----------------------- */

function RoadHopperGame({ onFinish, best, goHome }) {
  const W = 300, H = 300, CELL = 30, COLS = 10;
  const START_ROW = 9, GOAL_ROW = 0;
  const RIVER_ROWS = [1, 2, 3];
  const ROAD_ROWS = [5, 6, 7, 8];

  function laneConfig(baseSpeedMul) {
    return {
      road: ROAD_ROWS.map((row, i) => ({
        row, dir: i % 2 === 0 ? 1 : -1, speed: (0.9 + i * 0.35) * baseSpeedMul,
        items: [0, 1, 2].map((k) => ({ x: k * 130 + i * 20, w: 46 })),
      })),
      river: RIVER_ROWS.map((row, i) => ({
        row, dir: i % 2 === 0 ? -1 : 1, speed: (0.6 + i * 0.25) * baseSpeedMul,
        items: [0, 1].map((k) => ({ x: k * 170 + i * 30, w: 90 })),
      })),
    };
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [crossings, setCrossings] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshPlayer() { return { x: Math.floor(COLS / 2) * CELL, row: START_ROW }; }
  function freshState() { return { player: freshPlayer(), lanes: laneConfig(1), particles: [], lives: 3, crossings: 0, ended: false, mult: 1 }; }
  function reset() { stateRef.current = freshState(); setCrossings(0); setLives(3); setOver(false); setShake(false); }
  function respawn(s) { s.player = freshPlayer(); }
  function loseLife(s) {
    s.lives -= 1; setLives(s.lives);
    spawnBurst(s.particles, s.player.x + CELL / 2, s.player.row * CELL + CELL / 2, "#FF5D5D", 12, "hit");
    setShake(true); setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) { s.ended = true; setOver(true); } else respawn(s);
  }

  function move(dir) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const p = s.player;
    if (dir === "left") p.x = Math.max(0, p.x - CELL);
    if (dir === "right") p.x = Math.min((COLS - 1) * CELL, p.x + CELL);
    if (dir === "down") p.row = Math.min(START_ROW, p.row + 1);
    if (dir === "up") {
      p.row = Math.max(0, p.row - 1);
      if (p.row === GOAL_ROW) {
        s.crossings += 1; setCrossings(s.crossings);
        spawnBurst(s.particles, p.x + CELL / 2, CELL / 2, "#FFC93C", 16, "score");
        s.mult += 0.08;
        s.lanes = laneConfig(s.mult);
        respawn(s);
      }
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        [...s.lanes.road, ...s.lanes.river].forEach((lane) => {
          lane.items.forEach((it) => {
            it.x += lane.speed * lane.dir;
            if (lane.dir > 0 && it.x > W) it.x = -it.w;
            if (lane.dir < 0 && it.x < -it.w) it.x = W;
          });
        });
        const p = s.player;
        const roadLane = s.lanes.road.find((l) => l.row === p.row);
        if (roadLane) {
          const hit = roadLane.items.some((it) => p.x + CELL - 6 > it.x && p.x + 6 < it.x + it.w);
          if (hit) loseLife(s);
        }
        const riverLane = s.lanes.river.find((l) => l.row === p.row);
        if (riverLane) {
          const log = riverLane.items.find((it) => p.x + CELL - 4 > it.x && p.x + 4 < it.x + it.w);
          if (log) {
            p.x += riverLane.speed * riverLane.dir;
            if (p.x < -CELL || p.x > W) loseLife(s);
          } else {
            loseLife(s);
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#1c7a4a"; ctx.fillRect(0, 0, W, CELL);
      ctx.fillStyle = "#1c3a7a";
      RIVER_ROWS.forEach((r) => ctx.fillRect(0, r * CELL, W, CELL));
      ctx.fillStyle = "#1c7a4a"; ctx.fillRect(0, 4 * CELL, W, CELL);
      ctx.fillStyle = "#2a2c3e";
      ROAD_ROWS.forEach((r) => ctx.fillRect(0, r * CELL, W, CELL));
      ctx.fillStyle = "#1c7a4a"; ctx.fillRect(0, START_ROW * CELL, W, CELL);
      ctx.fillStyle = "#8a5a2c";
      s2.lanes.river.forEach((lane) => lane.items.forEach((it) => ctx.fillRect(it.x, lane.row * CELL + 4, it.w, CELL - 8)));
      ctx.fillStyle = "#FF5D5D";
      s2.lanes.road.forEach((lane) => lane.items.forEach((it) => ctx.fillRect(it.x, lane.row * CELL + 5, it.w, CELL - 10)));
      ctx.fillStyle = "#2FE6C4";
      ctx.fillRect(s2.player.x + 3, s2.player.row * CELL + 3, CELL - 6, CELL - 6);
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKey(e) {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (over) onFinish(crossings); }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Crossings: {crossings}</span><span>Lives: {"♥".repeat(Math.max(0, lives))}</span><span>Best: {best ?? 0}</span></div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && <Overlay emoji="🐸" title="Out of lives" statLines={[`Crossings: ${crossings}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <div className="ga-dpad">
        <button onClick={() => move("up")}>↑</button>
        <div>
          <button onClick={() => move("left")}>←</button>
          <button onClick={() => move("down")}>↓</button>
          <button onClick={() => move("right")}>→</button>
        </div>
      </div>
      <p className="ga-hint">Hop lanes with the arrows. Dodge traffic, ride the logs, don't fall in.</p>
    </div>
  );
}

/* --------------------------- endless: echo sequence (simon) -------------------------- */

function SimonGame({ onFinish, best, goHome }) {
  const [sequence, setSequence] = useState([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [active, setActive] = useState(null);
  const [status, setStatus] = useState("idle");
  const [over, setOver] = useState(false);
  const seqRef = useRef([]);
  const timeoutsRef = useRef([]);

  function clearTimers() { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = []; }

  function playback(seq) {
    clearTimers();
    const stepTime = Math.max(320, 650 - seq.length * 15);
    seq.forEach((color, i) => {
      const t1 = setTimeout(() => { setActive(color); AudioEngine.playNote(SIMON_FREQS[color], (stepTime * 0.55) / 1000); }, i * stepTime + 150);
      const t2 = setTimeout(() => setActive(null), i * stepTime + stepTime * 0.6);
      timeoutsRef.current.push(t1, t2);
    });
    const tEnd = setTimeout(() => setStatus("input"), seq.length * stepTime + 150);
    timeoutsRef.current.push(tEnd);
  }

  function startRound(baseSeq) {
    const next = [...baseSeq, Math.floor(Math.random() * 4)];
    seqRef.current = next;
    setSequence(next);
    setPlayerStep(0);
    setStatus("playing");
    playback(next);
  }

  function reset() {
    clearTimers();
    seqRef.current = [];
    setSequence([]); setPlayerStep(0); setOver(false);
    startRound([]);
  }

  useEffect(() => { startRound([]); return () => clearTimers(); }, []);

  function press(colorId) {
    if (status !== "input") return;
    setActive(colorId);
    setTimeout(() => setActive(null), 180);
    const seq = seqRef.current;
    if (colorId === seq[playerStep]) {
      AudioEngine.playNote(SIMON_FREQS[colorId], 0.16);
      if (playerStep + 1 === seq.length) {
        setStatus("playing");
        setTimeout(() => startRound(seq), 500);
      } else {
        setPlayerStep((s) => s + 1);
      }
    } else {
      AudioEngine.playSfx("hit");
      setStatus("over");
      setOver(true);
    }
  }

  useEffect(() => { if (over) onFinish(Math.max(0, sequence.length - 1)); }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Round: {Math.max(0, sequence.length - (status === "over" ? 1 : 0))}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-simon-grid">
        {SIMON_COLORS.map((c) => (
          <button key={c.id} className={`ga-simon-pad ${active === c.id ? "is-active" : ""}`} style={{ background: active === c.id ? c.light : c.base, opacity: status === "playing" && active !== c.id ? 0.6 : 1 }} onClick={() => press(c.id)} disabled={status !== "input"} />
        ))}
      </div>
      {over && <Overlay emoji="🎵" title="Sequence broken" statLines={[`Longest streak: ${Math.max(0, sequence.length - 1)}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <p className="ga-hint">Watch the pattern, then repeat it. Each round adds one more step.</p>
    </div>
  );
}

/* ------------------------------ endless: pinball ------------------------------------- */

function PinballGame({ onFinish, best, goHome }) {
  const W = 280, H = 460, LANE_W = 34, FIELD_W = W - LANE_W, BALL_R = 7, GRAVITY = 0.32, LANE_GAP_Y = 70;
  const FLIPPER_LEN = 44, FLIPPER_R = 6;
  const BUMPERS = [{ x: 70, y: 150, r: 16 }, { x: 176, y: 150, r: 16 }, { x: 123, y: 220, r: 18 }];
  const LEFT_SLING = { x: 92, y: 326, r: 13 };
  const RIGHT_SLING = { x: 154, y: 326, r: 13 };

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const flipRef = useRef({ left: false, right: false });
  const launchRef = useRef({ charging: false, charge: 0 });
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [over, setOver] = useState(false);

  function freshBall() { return { x: FIELD_W + LANE_W / 2, y: H - 40, vx: 0, vy: 0, launched: false, enteredField: false }; }
  function freshFlippers() {
    return {
      left: { pivotX: 66, pivotY: 396, angle: (55 * Math.PI) / 180, prevAngle: (55 * Math.PI) / 180, restAngle: (55 * Math.PI) / 180, activeAngle: (-35 * Math.PI) / 180 },
      right: { pivotX: FIELD_W - 66, pivotY: 396, angle: (125 * Math.PI) / 180, prevAngle: (125 * Math.PI) / 180, restAngle: (125 * Math.PI) / 180, activeAngle: (215 * Math.PI) / 180 },
    };
  }
  function freshState() { return { ball: freshBall(), flippers: freshFlippers(), particles: [], popups: [], score: 0, balls: 3, ended: false }; }
  function reset() {
    stateRef.current = freshState();
    launchRef.current = { charging: false, charge: 0 };
    setScore(0); setBalls(3); setOver(false);
  }

  function startCharge() {
    const s = stateRef.current;
    if (!s || s.ball.launched || s.ended) return;
    launchRef.current.charging = true;
  }
  function releaseCharge() {
    const s = stateRef.current;
    if (s && launchRef.current.charging && !s.ball.launched) {
      const charge = launchRef.current.charge;
      s.ball.vy = -(16 + charge * 9);
      s.ball.vx = 0;
      s.ball.launched = true;
      AudioEngine.playSfx("score");
    }
    launchRef.current.charging = false;
    launchRef.current.charge = 0;
  }

  function flipperCollide(f, ball, particles) {
    const tipX = f.pivotX + FLIPPER_LEN * Math.cos(f.angle);
    const tipY = f.pivotY + FLIPPER_LEN * Math.sin(f.angle);
    const abx = tipX - f.pivotX, aby = tipY - f.pivotY;
    const lenSq = abx * abx + aby * aby || 1;
    const len = Math.sqrt(lenSq);
    let t = ((ball.x - f.pivotX) * abx + (ball.y - f.pivotY) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = f.pivotX + abx * t, cy = f.pivotY + aby * t;
    const dx = ball.x - cx, dy = ball.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < BALL_R + FLIPPER_R) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = cx + nx * (BALL_R + FLIPPER_R);
      ball.y = cy + ny * (BALL_R + FLIPPER_R);
      const angularVel = f.angle - f.prevAngle;
      const dirx = abx / len, diry = aby / len;
      const perpx = -diry, perpy = dirx;
      const tangential = angularVel * (t * FLIPPER_LEN);
      ball.vx = nx * 2 + perpx * tangential * 2.4;
      ball.vy = ny * 2 + perpy * tangential * 2.4 - 1.2;
      if (Math.abs(angularVel) > 0.01) spawnBurst(particles, cx, cy, "#2FE6C4", 4);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (launchRef.current.charging) launchRef.current.charge = Math.min(1, launchRef.current.charge + 0.025);
      const flippers = s.flippers;
      ["left", "right"].forEach((side) => {
        const f = flippers[side];
        const active = flipRef.current[side];
        const target = active ? f.activeAngle : f.restAngle;
        f.prevAngle = f.angle;
        f.angle += (target - f.angle) * 0.4;
      });
      if (!s.ended) {
        const b = s.ball;
        if (b.launched) {
          b.vy += GRAVITY;
          b.x += b.vx; b.y += b.vy;
          if (!b.enteredField && b.y <= LANE_GAP_Y) { b.vx = -3; b.enteredField = true; }
          const inLaneColumn = b.x > FIELD_W - 2;
          if (inLaneColumn && b.y > LANE_GAP_Y) {
            if (b.x - BALL_R < FIELD_W) { b.x = FIELD_W + BALL_R; b.vx *= -0.4; }
            if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx *= -0.4; }
          } else {
            if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx *= -0.85; }
            if (b.y > LANE_GAP_Y && b.x + BALL_R > FIELD_W) { b.x = FIELD_W - BALL_R; b.vx *= -0.85; }
          }
          if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy *= -0.85; }
          if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx *= -0.5; }

          BUMPERS.forEach((bp) => {
            const dx = b.x - bp.x, dy = b.y - bp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < bp.r + BALL_R) {
              const nx = dx / (dist || 1), ny = dy / (dist || 1);
              b.x = bp.x + nx * (bp.r + BALL_R);
              b.y = bp.y + ny * (bp.r + BALL_R);
              b.vx = nx * 6.5; b.vy = ny * 6.5;
              s.score += 10; setScore(s.score);
              spawnBurst(s.particles, b.x, b.y, "#FF5D5D", 8, "score");
              spawnPopup(s.popups, b.x, b.y, "+10", "#FF5D5D");
            }
          });
          [LEFT_SLING, RIGHT_SLING].forEach((sl) => {
            const dx = b.x - sl.x, dy = b.y - sl.y;
            const dist = Math.hypot(dx, dy);
            if (dist < sl.r + BALL_R) {
              const nx = dx / (dist || 1), ny = dy / (dist || 1);
              b.x = sl.x + nx * (sl.r + BALL_R);
              b.y = sl.y + ny * (sl.r + BALL_R);
              b.vx = nx * 7; b.vy = ny * 7 - 3;
              s.score += 20; setScore(s.score);
              spawnBurst(s.particles, b.x, b.y, "#9B7BFF", 8, "flip");
              spawnPopup(s.popups, b.x, b.y, "+20", "#9B7BFF");
            }
          });
          flipperCollide(flippers.left, b, s.particles);
          flipperCollide(flippers.right, b, s.particles);

          if (b.y - BALL_R > H) {
            s.balls -= 1; setBalls(s.balls);
            if (s.balls <= 0) { s.ended = true; setOver(true); } else s.ball = freshBall();
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#33356f"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(FIELD_W, LANE_GAP_Y); ctx.lineTo(FIELD_W, H); ctx.stroke();
      if (!s2.ball.launched) {
        const chg = launchRef.current.charge;
        ctx.fillStyle = "#262a6e"; ctx.fillRect(FIELD_W + 8, H - 24, LANE_W - 16, 12);
        ctx.fillStyle = "#FFC93C"; ctx.fillRect(FIELD_W + 8, H - 24, (LANE_W - 16) * chg, 12);
      }
      BUMPERS.forEach((bp) => {
        ctx.fillStyle = "#FF5D5D"; ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0c0e2e"; ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r * 0.4, 0, Math.PI * 2); ctx.fill();
      });
      [LEFT_SLING, RIGHT_SLING].forEach((sl) => {
        ctx.fillStyle = "#9B7BFF"; ctx.beginPath(); ctx.arc(sl.x, sl.y, sl.r, 0, Math.PI * 2); ctx.fill();
      });
      ["left", "right"].forEach((side) => {
        const f = s2.flippers[side];
        const tipX = f.pivotX + FLIPPER_LEN * Math.cos(f.angle);
        const tipY = f.pivotY + FLIPPER_LEN * Math.sin(f.angle);
        ctx.strokeStyle = "#2FE6C4"; ctx.lineWidth = FLIPPER_R * 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(f.pivotX, f.pivotY); ctx.lineTo(tipX, tipY); ctx.stroke();
      });
      ctx.fillStyle = "#FFC93C";
      ctx.beginPath(); ctx.arc(s2.ball.x, s2.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      updateAndDrawParticles(ctx, s2.particles);
      updateAndDrawPopups(ctx, s2.popups);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "z", "Z"].includes(e.key)) { if (!flipRef.current.left) AudioEngine.playSfx("flip"); flipRef.current.left = true; e.preventDefault(); }
      if (["ArrowRight", "/", "x", "X"].includes(e.key)) { if (!flipRef.current.right) AudioEngine.playSfx("flip"); flipRef.current.right = true; e.preventDefault(); }
      if (["ArrowDown", " ", "Spacebar"].includes(e.key)) { startCharge(); e.preventDefault(); }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "z", "Z"].includes(e.key)) flipRef.current.left = false;
      if (["ArrowRight", "/", "x", "X"].includes(e.key)) flipRef.current.right = false;
      if (["ArrowDown", " ", "Spacebar"].includes(e.key)) releaseCharge();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  useEffect(() => { if (over) onFinish(score); }, [over]);

  function press(side, isDown) {
    if (isDown && !flipRef.current[side]) AudioEngine.playSfx("flip");
    flipRef.current[side] = isDown;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Balls: {balls}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && <Overlay emoji="🎯" title="Tilt! Game over" statLines={[`Final score: ${score}`]} onRestart={reset} onExit={goHome} sound="lose" />}
      <div className="ga-dpad-row">
        <button style={{ width: 78, fontSize: 11 }} onMouseDown={() => press("left", true)} onMouseUp={() => press("left", false)} onMouseLeave={() => press("left", false)} onTouchStart={(e) => { e.preventDefault(); press("left", true); }} onTouchEnd={(e) => { e.preventDefault(); press("left", false); }}>L FLIP</button>
        <button style={{ width: 78, fontSize: 11 }} onMouseDown={startCharge} onMouseUp={releaseCharge} onMouseLeave={releaseCharge} onTouchStart={(e) => { e.preventDefault(); startCharge(); }} onTouchEnd={(e) => { e.preventDefault(); releaseCharge(); }}>PULL</button>
        <button style={{ width: 78, fontSize: 11 }} onMouseDown={() => press("right", true)} onMouseUp={() => press("right", false)} onMouseLeave={() => press("right", false)} onTouchStart={(e) => { e.preventDefault(); press("right", true); }} onTouchEnd={(e) => { e.preventDefault(); press("right", false); }}>R FLIP</button>
      </div>
      <p className="ga-hint">Hold Down/Space (or PULL) to charge the plunger, release to launch. Left/Right arrows or Z/X flip the paddles.</p>
    </div>
  );
}

/* --------------------------- challenge: wall smasher (breakout) ---------------------- */

function BrickBreakerGame({ onFinish, best, goHome }) {
  const W = 300, H = 360, PADDLE_W = 60, PADDLE_H = 10, BALL_R = 6;
  const ROWS = 4, COLS = 6, BRICK_W = 42, BRICK_H = 16, BRICK_GAP = 6, BRICK_TOP = 40;
  const BRICK_LEFT = (W - (COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshBricks() {
    const bricks = [];
    const colors = ["#FF5D5D", "#FFC93C", "#2FE6C4", "#9B7BFF"];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({ x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), w: BRICK_W, h: BRICK_H, alive: true, color: colors[r % colors.length] });
      }
    }
    return bricks;
  }
  function freshBall() { return { x: W / 2, y: H - 40, vx: 2.4 * (Math.random() < 0.5 ? 1 : -1), vy: -3.2 }; }
  function freshState() { return { paddleX: W / 2 - PADDLE_W / 2, ball: freshBall(), bricks: freshBricks(), particles: [], lives: 3, score: 0, ended: false }; }
  function reset() { stateRef.current = freshState(); setScore(0); setLives(3); setOver(null); setShake(false); }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const b = s.ball;
        b.x += b.vx; b.y += b.vy;
        if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx *= -1; }
        if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx *= -1; }
        if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy *= -1; }
        const paddleY = H - 20;
        if (b.y + BALL_R > paddleY && b.y + BALL_R < paddleY + PADDLE_H + 8 && b.x > s.paddleX && b.x < s.paddleX + PADDLE_W && b.vy > 0) {
          const hitPos = (b.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
          b.vy = -Math.abs(b.vy);
          b.vx = hitPos * 3.4;
          b.y = paddleY - BALL_R;
        }
        s.bricks.forEach((brick) => {
          if (!brick.alive) return;
          if (b.x + BALL_R > brick.x && b.x - BALL_R < brick.x + brick.w && b.y + BALL_R > brick.y && b.y - BALL_R < brick.y + brick.h) {
            brick.alive = false;
            b.vy *= -1;
            s.score += 10; setScore(s.score);
            spawnBurst(s.particles, brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 10, "coin");
          }
        });
        if (s.bricks.every((br) => !br.alive)) { s.ended = true; setOver("win"); }
        if (b.y - BALL_R > H) {
          s.lives -= 1; setLives(s.lives);
          setShake(true); setTimeout(() => setShake(false), 250);
          if (s.lives <= 0) { s.ended = true; setOver("lose"); } else s.ball = freshBall();
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#0c0e2e"; ctx.fillRect(0, 0, W, H);
      s2.bricks.forEach((brick) => { if (brick.alive) { ctx.fillStyle = brick.color; ctx.fillRect(brick.x, brick.y, brick.w, brick.h); } });
      ctx.fillStyle = "#2FE6C4"; ctx.fillRect(s2.paddleX, H - 20, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#FFC93C";
      ctx.beginPath(); ctx.arc(s2.ball.x, s2.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    function setFromClientX(clientX) {
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * W;
      const s = stateRef.current;
      if (s) s.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    }
    function onMouseMove(e) { setFromClientX(e.clientX); }
    function onTouchMove(e) { if (e.touches[0]) { setFromClientX(e.touches[0].clientX); e.preventDefault(); } }
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => { el.removeEventListener("mousemove", onMouseMove); el.removeEventListener("touchmove", onTouchMove); };
  }, []);

  useEffect(() => {
    function onKey(e) {
      const s = stateRef.current;
      if (!s) return;
      const step = 20;
      if (e.key === "ArrowLeft") { e.preventDefault(); s.paddleX = Math.max(0, s.paddleX - step); }
      if (e.key === "ArrowRight") { e.preventDefault(); s.paddleX = Math.min(W - PADDLE_W, s.paddleX + step); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (over) onFinish(score); }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Score: {score}</span><span>Lives: {"♥".repeat(Math.max(0, lives))}</span><span>Best: {best ?? 0}</span></div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && <Overlay emoji={over === "win" ? "🧱" : "💥"} title={over === "win" ? "Wall cleared!" : "Out of lives"} statLines={[`Score: ${score}`]} onRestart={reset} onExit={goHome} sound={over === "win" ? "win" : "lose"} />}
      <p className="ga-hint">Move your mouse (or arrow keys) to steer the paddle. Clear every brick.</p>
    </div>
  );
}

/* -------------------------- challenge: grid sweeper (minesweeper) -------------------- */

function MinesweeperGame({ onFinish, best, goHome }) {
  const SIZE = 8, MINES = 10;

  function buildBoard(firstSafeIdx) {
    const total = SIZE * SIZE;
    const mineSet = new Set();
    while (mineSet.size < MINES) {
      const idx = Math.floor(Math.random() * total);
      if (idx !== firstSafeIdx) mineSet.add(idx);
    }
    const cells = Array.from({ length: total }, (_, i) => ({ idx: i, mine: mineSet.has(i), revealed: false, flagged: false, count: 0 }));
    function neighbors(i) {
      const r = Math.floor(i / SIZE), c = i % SIZE, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
      }
      return out;
    }
    cells.forEach((cell) => { if (!cell.mine) cell.count = neighbors(cell.idx).filter((n) => cells[n].mine).length; });
    return { cells, neighbors };
  }

  const [board, setBoard] = useState(() => buildBoard(-1));
  const [status, setStatus] = useState("playing");
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [firstClick, setFirstClick] = useState(true);
  const [wins, setWins] = useState(0);

  function reset() {
    setBoard(buildBoard(-1));
    setStatus("playing");
    setFlagsUsed(0);
    setFirstClick(true);
  }

  function revealFlood(cells, neighbors, startIdx) {
    const stack = [startIdx];
    const seen = new Set();
    while (stack.length) {
      const i = stack.pop();
      if (seen.has(i)) continue;
      seen.add(i);
      const cell = cells[i];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.count === 0 && !cell.mine) neighbors(i).forEach((n) => { if (!cells[n].revealed) stack.push(n); });
    }
  }

  function reveal(idx) {
    if (status !== "playing") return;
    const cell = board.cells[idx];
    if (cell.revealed || cell.flagged) return;

    let working = board;
    if (firstClick && cell.mine) {
      working = buildBoard(idx);
      setFirstClick(false);
    } else if (firstClick) {
      setFirstClick(false);
    }

    const cells = working.cells.map((c) => ({ ...c }));
    const target = cells[idx];
    if (target.mine) {
      AudioEngine.playSfx("hit");
      cells.forEach((c) => { if (c.mine) c.revealed = true; });
      setBoard({ cells, neighbors: working.neighbors });
      setStatus("lost");
      return;
    }
    AudioEngine.playSfx("click");
    revealFlood(cells, working.neighbors, idx);
    const won = cells.every((c) => c.mine || c.revealed);
    setBoard({ cells, neighbors: working.neighbors });
    if (won) setStatus("won");
  }

  function toggleFlag(e, idx) {
    e.preventDefault();
    if (status !== "playing") return;
    const cell = board.cells[idx];
    if (cell.revealed) return;
    AudioEngine.playSfx("select");
    const cells = board.cells.map((c) => ({ ...c }));
    cells[idx].flagged = !cells[idx].flagged;
    setBoard({ cells, neighbors: board.neighbors });
    setFlagsUsed(cells.filter((c) => c.flagged).length);
  }

  useEffect(() => {
    if (status === "won") setWins((w) => { const nw = w + 1; onFinish(nw); return nw; });
  }, [status]);

  const numColors = ["", "#4FB8FF", "#2FE6C4", "#FFC93C", "#FF8A3D", "#FF5D5D", "#FF7BB0", "#9B7BFF", "#a8a6c8"];

  return (
    <div className="ga-game-col">
      <div className="ga-hud"><span>Mines left: {MINES - flagsUsed}</span><span>Wins this session: {wins}</span><span>Best: {best ?? 0}</span></div>
      <div className="ga-mine-grid">
        {board.cells.map((c) => (
          <button
            key={c.idx}
            className={`ga-mine-cell ${c.revealed ? "is-revealed" : ""}`}
            onClick={() => reveal(c.idx)}
            onContextMenu={(e) => toggleFlag(e, c.idx)}
            disabled={status !== "playing" && !c.revealed}
          >
            {c.revealed ? (
              <span key={c.idx + "-revealed"} className="ga-pop-anim">
                {c.mine ? "💣" : c.count > 0 ? <span style={{ color: numColors[c.count] }}>{c.count}</span> : ""}
              </span>
            ) : c.flagged ? (
              <span key={c.idx + "-flag"} className="ga-pop-anim">🚩</span>
            ) : ""}
          </button>
        ))}
      </div>
      {status !== "playing" && (
        <Overlay emoji={status === "won" ? "🏆" : "💣"} title={status === "won" ? "Board cleared!" : "Boom!"} statLines={[status === "won" ? "No mines left standing." : "Hit a mine."]} onRestart={reset} onExit={goHome} sound={status === "won" ? "win" : "lose"} />
      )}
      <p className="ga-hint">Click to reveal, right-click (or long-press) to flag a suspected mine.</p>
    </div>
  );
}

/* ------------------------------- registry ------------------------------- */

const GAME_COMPONENTS = {
  snake: SnakeGame,
  flappy: FlappyGame,
  reflex: ReflexGame,
  whack: WhackGame,
  huechase: HueChaseGame,
  tictactoe: TicTacToeGame,
  memory: MemoryGame,
  "2048": TwentyFortyEightGame,
  quiz: QuizGame,
  rps: RPSGame,
  pong: PongGame,
  platformer: PlatformerGame,
  roadhopper: RoadHopperGame,
  simon: SimonGame,
  pinball: PinballGame,
  brickbreaker: BrickBreakerGame,
  minesweeper: MinesweeperGame,
};

const GAMES = [
  { id: "snake", name: "Serpent Loop", category: "endless", tagline: "Eat, grow, don't double back.", difficulty: "Easy", icon: Zap, scoreLabel: "pts", lowerIsBetter: false },
  { id: "flappy", name: "Flap Cadet", category: "endless", tagline: "Thread the gaps forever.", difficulty: "Medium", icon: Wind, scoreLabel: "pts", lowerIsBetter: false },
  { id: "reflex", name: "Reflex Reactor", category: "endless", tagline: "Catch the falling sparks.", difficulty: "Medium", icon: Target, scoreLabel: "pts", lowerIsBetter: false },
  { id: "whack", name: "Whack Rush", category: "endless", tagline: "Bonk critters before they duck.", difficulty: "Easy", icon: Hand, scoreLabel: "pts", lowerIsBetter: false },
  { id: "huechase", name: "Hue Chase", category: "endless", tagline: "Tap the named color, fast.", difficulty: "Hard", icon: Palette, scoreLabel: "pts", lowerIsBetter: false },
  { id: "tictactoe", name: "Tri-Line Duel", category: "challenge", tagline: "Beat the CPU in 3x3.", difficulty: "Easy", icon: Grid3x3, scoreLabel: "wins", lowerIsBetter: false },
  { id: "memory", name: "Mirror Match", category: "challenge", tagline: "Clear the board in fewest flips.", difficulty: "Easy", icon: Layers, scoreLabel: "moves", lowerIsBetter: true },
  { id: "2048", name: "Merge to 2048", category: "challenge", tagline: "Slide tiles to the target.", difficulty: "Medium", icon: Puzzle, scoreLabel: "pts", lowerIsBetter: false },
  { id: "quiz", name: "Brain Sprint", category: "challenge", tagline: "10 questions, one final score.", difficulty: "Medium", icon: Brain, scoreLabel: "/10", lowerIsBetter: false },
  { id: "rps", name: "Best of Five", category: "challenge", tagline: "First to 3 round-wins.", difficulty: "Easy", icon: Sparkles, scoreLabel: "streak", lowerIsBetter: false },
  { id: "pong", name: "Paddle Duel", category: "challenge", tagline: "First to 7 points wins.", difficulty: "Medium", icon: Circle, scoreLabel: "streak", lowerIsBetter: false },
  { id: "platformer", name: "Byte Hopper", category: "challenge", tagline: "Stomp bugs, grab bytes, reach the server.", difficulty: "Hard", icon: Mountain, scoreLabel: "bytes", lowerIsBetter: false },
  { id: "roadhopper", name: "Road Hopper", category: "endless", tagline: "Dodge traffic, ride the logs.", difficulty: "Medium", icon: ChevronsUp, scoreLabel: "crossings", lowerIsBetter: false },
  { id: "simon", name: "Echo Sequence", category: "endless", tagline: "Watch the pattern, repeat it back.", difficulty: "Medium", icon: Repeat, scoreLabel: "streak", lowerIsBetter: false },
  { id: "pinball", name: "Steel Bounce", category: "endless", tagline: "Pull the plunger, flip the paddles, chase the score.", difficulty: "Medium", icon: Disc, scoreLabel: "pts", lowerIsBetter: false },
  { id: "brickbreaker", name: "Wall Smasher", category: "challenge", tagline: "Clear every brick before you run out of balls.", difficulty: "Medium", icon: LayoutGrid, scoreLabel: "pts", lowerIsBetter: false },
  { id: "minesweeper", name: "Grid Sweeper", category: "challenge", tagline: "Clear the board without hitting a mine.", difficulty: "Hard", icon: Bomb, scoreLabel: "wins", lowerIsBetter: false },
];

/* --------------------------------- hub ----------------------------------- */

function JoystickIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect x="13" y="20" width="14" height="15" rx="3" fill="#33356f" />
      <rect x="18" y="6" width="4" height="17" rx="2" fill="#a8a6c8" />
      <circle cx="20" cy="6" r="6" fill="#FF5D5D" />
    </svg>
  );
}

function GameArt({ id, accent }) {
  let shapes = null;
  switch (id) {
    case "snake":
      shapes = (
        <>
          <path d="M10 46 H22 V34 H34 V22 H46 V14" stroke="#2FE6C4" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="14" r="4" fill="#FFC93C" />
        </>
      );
      break;
    case "flappy":
      shapes = (
        <>
          <rect x="12" y="2" width="9" height="22" fill="#2FE6C4" />
          <rect x="12" y="36" width="9" height="26" fill="#2FE6C4" />
          <rect x="42" y="0" width="9" height="28" fill="#2FE6C4" />
          <rect x="42" y="44" width="9" height="20" fill="#2FE6C4" />
          <circle cx="30" cy="34" r="6" fill="#FFC93C" />
        </>
      );
      break;
    case "reflex":
      shapes = (
        <>
          <circle cx="32" cy="46" r="11" fill="none" stroke="#FF5D5D" strokeWidth="3" />
          <circle cx="32" cy="46" r="4" fill="#FF5D5D" />
          <path d="M20 8 L23 16 L31 17 L25 23 L27 31 L20 27 L13 31 L15 23 L9 17 L17 16 Z" fill="#FFC93C" />
        </>
      );
      break;
    case "whack":
      shapes = (
        <>
          <ellipse cx="32" cy="48" rx="18" ry="7" fill="#0c0e2e" />
          <path d="M17 48 a15 16 0 0 1 30 0 Z" fill="#FF5D5D" />
          <circle cx="26" cy="41" r="2.2" fill="#0c0e2e" />
          <circle cx="38" cy="41" r="2.2" fill="#0c0e2e" />
        </>
      );
      break;
    case "huechase":
      shapes = (
        <>
          <rect x="10" y="10" width="18" height="18" rx="4" fill="#FF5D5D" />
          <rect x="36" y="10" width="18" height="18" rx="4" fill="#2FE6C4" />
          <rect x="10" y="36" width="18" height="18" rx="4" fill="#FFC93C" />
          <rect x="36" y="36" width="18" height="18" rx="4" fill="#9B7BFF" />
        </>
      );
      break;
    case "tictactoe":
      shapes = (
        <>
          <line x1="24" y1="8" x2="24" y2="56" stroke="#a8a6c8" strokeWidth="3" />
          <line x1="40" y1="8" x2="40" y2="56" stroke="#a8a6c8" strokeWidth="3" />
          <line x1="8" y1="24" x2="56" y2="24" stroke="#a8a6c8" strokeWidth="3" />
          <line x1="8" y1="40" x2="56" y2="40" stroke="#a8a6c8" strokeWidth="3" />
          <path d="M12 12 L20 20 M20 12 L12 20" stroke="#FFC93C" strokeWidth="3" strokeLinecap="round" />
          <circle cx="48" cy="48" r="6" fill="none" stroke="#FF5D5D" strokeWidth="3" />
        </>
      );
      break;
    case "memory":
      shapes = (
        <>
          <rect x="9" y="16" width="22" height="30" rx="4" fill="#33356f" transform="rotate(-8 20 31)" />
          <rect x="31" y="16" width="22" height="30" rx="4" fill="#2FE6C4" transform="rotate(7 42 31)" />
          <path d="M30 10 L32 16 L38 17 L33 21 L35 27 L30 23 L25 27 L27 21 L22 17 L28 16 Z" fill="#FFC93C" />
        </>
      );
      break;
    case "2048":
      shapes = (
        <>
          <rect x="8" y="36" width="14" height="14" rx="2" fill="#33356f" />
          <rect x="25" y="28" width="17" height="22" rx="2" fill="#8a3f97" />
          <rect x="45" y="16" width="14" height="34" rx="2" fill="#FFC93C" />
        </>
      );
      break;
    case "quiz":
      shapes = (
        <>
          <path d="M10 14 h44 a4 4 0 0 1 4 4 v18 a4 4 0 0 1 -4 4 h-26 l-8 8 v-8 h-10 a4 4 0 0 1 -4 -4 v-18 a4 4 0 0 1 4 -4 Z" fill="#33356f" />
          <text x="32" y="34" fontSize="20" fontWeight="700" fill="#FFC93C" textAnchor="middle">?</text>
        </>
      );
      break;
    case "rps":
      shapes = (
        <>
          <circle cx="20" cy="24" r="9" fill="#a8a6c8" />
          <rect x="36" y="14" width="18" height="18" rx="3" fill="#f5f3ff" />
          <path d="M14 44 L24 54 M24 44 L14 54" stroke="#FF5D5D" strokeWidth="4" strokeLinecap="round" />
        </>
      );
      break;
    case "pong":
      shapes = (
        <>
          <line x1="32" y1="6" x2="32" y2="58" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="4 5" />
          <rect x="8" y="24" width="5" height="18" fill="#2FE6C4" />
          <rect x="51" y="22" width="5" height="18" fill="#FF5D5D" />
          <circle cx="32" cy="32" r="4" fill="#FFC93C" />
        </>
      );
      break;
    case "platformer":
      shapes = (
        <>
          <path d="M4 54 H20 V44 H34 V34 H50 V54 Z" fill="#33356f" />
          <rect x="38" y="20" width="10" height="10" fill="#2FE6C4" />
          <path d="M52 14 V30 M52 14 L60 18 L52 22" stroke="#FF5D5D" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;
    case "roadhopper":
      shapes = (
        <>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 15 + 5} y="30" width="9" height="4" fill="rgba(255,255,255,0.4)" />)}
          <rect x="10" y="14" width="20" height="10" rx="2" fill="#FF5D5D" />
          <circle cx="46" cy="46" r="8" fill="#1c9a5f" />
        </>
      );
      break;
    case "simon":
      shapes = (
        <>
          <path d="M32 32 L32 8 A24 24 0 0 1 56 32 Z" fill="#2FE6C4" />
          <path d="M32 32 L56 32 A24 24 0 0 1 32 56 Z" fill="#FF5D5D" />
          <path d="M32 32 L32 56 A24 24 0 0 1 8 32 Z" fill="#FFC93C" />
          <path d="M32 32 L8 32 A24 24 0 0 1 32 8 Z" fill="#9B7BFF" />
          <circle cx="32" cy="32" r="7" fill="#12143a" />
        </>
      );
      break;
    case "pinball":
      shapes = (
        <>
          <rect x="20" y="4" width="24" height="52" rx="8" fill="none" stroke="#33356f" strokeWidth="3" />
          <circle cx="32" cy="18" r="5" fill="#FF5D5D" />
          <circle cx="32" cy="38" r="4" fill="#FFC93C" />
          <rect x="21" y="48" width="10" height="4" rx="2" fill="#2FE6C4" transform="rotate(-12 26 50)" />
          <rect x="33" y="48" width="10" height="4" rx="2" fill="#2FE6C4" transform="rotate(12 38 50)" />
        </>
      );
      break;
    case "brickbreaker":
      shapes = (
        <>
          {[0, 1, 2, 3].map((c) => <rect key={"a" + c} x={8 + c * 12} y="12" width="10" height="7" fill="#FF5D5D" />)}
          {[0, 1, 2, 3].map((c) => <rect key={"b" + c} x={8 + c * 12} y="21" width="10" height="7" fill="#FFC93C" />)}
          <rect x="22" y="48" width="20" height="5" rx="2" fill="#2FE6C4" />
          <circle cx="32" cy="40" r="4" fill="#f5f3ff" />
        </>
      );
      break;
    case "minesweeper":
      shapes = (
        <>
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
            <rect key={r + "-" + c} x={12 + c * 14} y={12 + r * 14} width="12" height="12" rx="2" fill="#33356f" />
          )))}
          <path d="M39 15 v10 l7 -5 Z" fill="#FF5D5D" />
          <text x="19" y="41" fontSize="10" fontWeight="700" fill="#4FB8FF" textAnchor="middle">2</text>
        </>
      );
      break;
    default:
      shapes = <circle cx="32" cy="32" r="10" fill={accent} />;
  }
  return (
    <svg viewBox="0 0 64 64" className="ga-cabinet-art-svg">
      <rect width="64" height="64" rx="12" fill="#12143a" />
      <rect width="64" height="64" rx="12" fill={accent} opacity="0.1" />
      {shapes}
    </svg>
  );
}

function Cabinet({ game, best, onPlay }) {
  const isEndless = game.category === "endless";
  const accent = isEndless ? "#2FE6C4" : "#FF5D5D";
  const bestLabel = best != null ? (game.scoreLabel === "moves" ? `Best ${best} moves` : game.scoreLabel === "/10" ? `Best ${best}/10` : `Best ${best} ${game.scoreLabel}`) : "No score yet";
  return (
    <button className={`ga-cabinet ${isEndless ? "ga-cabinet-endless" : "ga-cabinet-challenge"}`} onClick={() => { AudioEngine.playSfx("select"); onPlay(game.id); }}>
      <div className="ga-cabinet-art"><GameArt id={game.id} accent={accent} /></div>
      <div className="ga-cabinet-top">
        <span className={`ga-cabinet-cat ${isEndless ? "is-endless" : "is-challenge"}`}>
          {isEndless ? <><InfinityIcon size={12} /> Endless</> : <><Flag size={12} /> Challenge</>}
        </span>
      </div>
      <h3 className="ga-cabinet-name">{game.name}</h3>
      <p className="ga-cabinet-tagline">{game.tagline}</p>
      <div className="ga-cabinet-bottom">
        <span className="ga-badge">{game.difficulty}</span>
        <span className="ga-cabinet-best">{bestLabel}</span>
      </div>
    </button>
  );
}

function Hub({ best, onPlay }) {
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);

  function toggleSfx() {
    const next = !sfxOn;
    setSfxOn(next);
    AudioEngine.setSfxOn(next);
    if (next) AudioEngine.playSfx("select");
  }
  function toggleMusic() {
    const nowOn = AudioEngine.toggleMusic();
    setMusicOn(nowOn);
  }

  const endlessGames = GAMES.filter((g) => g.category === "endless");
  const challengeGames = GAMES.filter((g) => g.category === "challenge");
  const scoreEntries = Object.entries(best).map(([id, val]) => {
    const g = GAMES.find((x) => x.id === id);
    if (!g) return null;
    const suffix = g.scoreLabel === "moves" ? " moves" : g.scoreLabel === "/10" ? "/10" : " " + g.scoreLabel;
    return `${g.name} — ${val}${suffix}`;
  }).filter(Boolean);
  const tickerItems = scoreEntries.length ? [...scoreEntries, ...scoreEntries] : ["No high scores yet — be the first arcade legend.", "No high scores yet — be the first arcade legend."];

  return (
    <div className="ga-hub">
      <header className="ga-marquee">
        <div className="ga-marquee-bulbs">{Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</div>
        <div className="ga-marquee-title-row">
          <JoystickIcon />
          <h1>NEON ARCADE 50</h1>
          <JoystickIcon />
        </div>
        <p className="ga-marquee-sub">One arcade, two wings: chase a high score forever, or beat the game outright.</p>
        <div className="ga-audio-controls">
          <button className="ga-audio-btn" onClick={toggleSfx}>{sfxOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound {sfxOn ? "on" : "off"}</button>
          <button className="ga-audio-btn" onClick={toggleMusic}><Music size={14} /> Music {musicOn ? "on" : "off"}</button>
        </div>
      </header>
      <div className="ga-ticker-wrap">
        <div className="ga-ticker-track">
          {tickerItems.map((t, i) => <span key={i} className="ga-ticker-item">{t}</span>)}
        </div>
      </div>

      <section className="ga-section">
        <div className="ga-section-title is-endless">
          <InfinityIcon size={20} />
          <h2>Endless Wing</h2>
          <span className="ga-section-count">{endlessGames.length} live</span>
        </div>
        <p className="ga-section-desc">No finish line. Play until you slip, then chase your own high score.</p>
        <div className="ga-grid">
          {endlessGames.map((g) => <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={onPlay} />)}
        </div>
      </section>

      <section className="ga-section">
        <div className="ga-section-title is-challenge">
          <Flag size={20} />
          <h2>Challenge Room</h2>
          <span className="ga-section-count">{challengeGames.length} live</span>
        </div>
        <p className="ga-section-desc">Every game here has a real ending — win, lose, or clear the board.</p>
        <div className="ga-grid">
          {challengeGames.map((g) => <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={onPlay} />)}
        </div>
      </section>

      <footer className="ga-footer">17 of 50 planned cabinets are live. More get added to both wings over time.</footer>
    </div>
  );
}

function GameShell({ game, best, onFinish, goHome }) {
  const Comp = GAME_COMPONENTS[game.id];
  const Icon = game.icon;
  return (
    <div className="ga-shell">
      <div className="ga-shell-header">
        <button className="ga-back-btn" onClick={() => { AudioEngine.playSfx("click"); goHome(); }}><ArrowLeft size={16} /> Arcade</button>
        <div className="ga-shell-title"><span className="ga-cabinet-icon small"><Icon size={16} /></span>{game.name}</div>
        <div className="ga-shell-best">Best: {best != null ? `${best}` : "—"}</div>
      </div>
      <div className="ga-cabinet-frame">
        <Comp onFinish={(v) => onFinish(game, v)} best={best} goHome={goHome} />
      </div>
    </div>
  );
}

/* -------------------------------- styles ---------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      .ga-root {
        --bg: #14163b;
        --bg-deep: #0c0e2e;
        --surface: #1f2158;
        --surface-2: #262a6e;
        --ink: #f5f3ff;
        --ink-dim: #a8a6c8;
        --yellow: #ffc93c;
        --teal: #2fe6c4;
        --coral: #ff5d5d;
        --radius: 16px;
        font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
        background-color: #0c0e2e;
        background-image:
          radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1.4px),
          radial-gradient(circle at 50% -10%, #23255f 0%, #14163b 55%, #0c0e2e 100%);
        background-size: 26px 26px, 100% 100%;
        background-position: 0 0, 0 0;
        color: var(--ink);
        min-height: 100vh;
        padding: 28px 16px calc(60px + env(safe-area-inset-bottom));
        box-sizing: border-box;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        overflow-x: hidden;
      }
      .ga-root * { box-sizing: border-box; }
      .ga-hub { max-width: 980px; margin: 0 auto; }

      .ga-marquee-title-row { display: flex; align-items: center; justify-content: center; gap: 14px; }

      .ga-marquee { text-align: center; margin-bottom: 18px; }
      .ga-marquee-bulbs { display: flex; justify-content: center; gap: 6px; margin-bottom: 10px; }
      .ga-marquee-bulbs span { width: 7px; height: 7px; border-radius: 50%; background: var(--yellow); box-shadow: 0 0 4px var(--yellow); display: inline-block; animation: ga-bulb 1.4s ease-in-out infinite; }
      @keyframes ga-bulb { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

      @keyframes ga-pop { from { transform: scale(0.35); opacity: 0.5; } to { transform: scale(1); opacity: 1; } }
      .ga-pop-anim { display: inline-block; animation: ga-pop 0.22s ease; }

      @keyframes ga-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }

      @keyframes ga-shake-x {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(3px); }
      }

      @keyframes ga-shake {
        0%, 100% { transform: translate(0, 0); }
        20% { transform: translate(-4px, 2px); }
        40% { transform: translate(4px, -2px); }
        60% { transform: translate(-3px, -2px); }
        80% { transform: translate(3px, 2px); }
      }
      .ga-shake { animation: ga-shake 0.28s ease; }

      @keyframes ga-overlay-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      .ga-marquee h1 {
        font-family: 'Courier New', monospace;
        font-size: clamp(28px, 6vw, 44px);
        letter-spacing: 4px;
        margin: 0 0 8px;
        color: var(--yellow);
        text-shadow: 0 0 10px rgba(255,201,60,0.5), 0 0 24px rgba(255,93,93,0.25);
      }
      .ga-marquee-sub { color: var(--ink-dim); margin: 0; font-size: 14px; }
      .ga-audio-controls { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
      .ga-audio-btn { display: flex; align-items: center; gap: 5px; background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--ink-dim); padding: 6px 12px; border-radius: 999px; font-size: 11px; cursor: pointer; }
      .ga-audio-btn:hover { color: var(--ink); border-color: var(--teal); }

      .ga-ticker-wrap { overflow: hidden; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 10px 0; margin-bottom: 30px; }
      .ga-ticker-track { display: flex; gap: 40px; width: max-content; animation: ga-scroll 22s linear infinite; }
      @keyframes ga-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .ga-ticker-item { color: var(--teal); font-size: 13px; white-space: nowrap; font-weight: 600; }

      .ga-section { margin-bottom: 34px; }
      .ga-section-title { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
      .ga-section-title h2 { margin: 0; font-size: 20px; }
      .ga-section-title.is-endless { color: var(--teal); }
      .ga-section-title.is-challenge { color: var(--coral); }
      .ga-section-count { margin-left: auto; font-size: 12px; color: var(--ink-dim); background: rgba(255,255,255,0.06); padding: 3px 10px; border-radius: 999px; }
      .ga-section-desc { color: var(--ink-dim); font-size: 13px; margin: 4px 0 16px; }

      .ga-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }

      .ga-cabinet { text-align: left; background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 16px; cursor: pointer; color: var(--ink); display: flex; flex-direction: column; gap: 8px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
      .ga-cabinet:hover { transform: translateY(-3px); }
      .ga-cabinet-endless:hover { border-color: var(--teal); box-shadow: 0 8px 24px rgba(47,230,196,0.15); }
      .ga-cabinet-challenge:hover { border-color: var(--coral); box-shadow: 0 8px 24px rgba(255,93,93,0.15); }
      .ga-cabinet-top { display: flex; align-items: center; justify-content: flex-start; }
      .ga-cabinet-art { border-radius: 12px; overflow: hidden; margin-bottom: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06); }
      .ga-cabinet-art-svg { display: block; width: 100%; height: 64px; transition: transform .2s ease; }
      .ga-cabinet:hover .ga-cabinet-art-svg { transform: scale(1.06); }
      .ga-cabinet-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: var(--surface-2); }
      .ga-cabinet-icon.small { width: 24px; height: 24px; border-radius: 7px; }
      .ga-cabinet-cat { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 8px; border-radius: 999px; }
      .ga-cabinet-cat.is-endless { color: var(--teal); background: rgba(47,230,196,0.12); }
      .ga-cabinet-cat.is-challenge { color: var(--coral); background: rgba(255,93,93,0.12); }
      .ga-cabinet-name { margin: 0; font-size: 16px; }
      .ga-cabinet-tagline { margin: 0; font-size: 12.5px; color: var(--ink-dim); flex-grow: 1; }
      .ga-cabinet-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
      .ga-badge { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: rgba(255,201,60,0.12); color: var(--yellow); }
      .ga-cabinet-best { font-size: 11px; color: var(--ink-dim); }

      .ga-footer { text-align: center; color: var(--ink-dim); font-size: 12px; margin-top: 20px; }

      .ga-shell { max-width: 460px; margin: 0 auto; }
      .ga-shell-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
      .ga-shell-title { display: flex; align-items: center; gap: 8px; font-weight: 700; flex-grow: 1; justify-content: center; }
      .ga-shell-best { font-size: 12px; color: var(--ink-dim); }
      .ga-back-btn { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--ink); padding: 7px 12px; border-radius: 10px; cursor: pointer; font-size: 13px; }
      .ga-back-btn:hover { border-color: var(--teal); }

      .ga-cabinet-frame { position: relative; background: var(--bg-deep); border: 6px solid var(--surface); border-radius: 22px; padding: 18px; box-shadow: inset 0 0 30px rgba(0,0,0,0.5); max-width: 100%; overflow-x: auto; }
      .ga-cabinet-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 16px;
        pointer-events: none;
        background: repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.12) 3px);
        mix-blend-mode: multiply;
      }
      .ga-game-col { display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .ga-hud { display: flex; gap: 16px; font-size: 13px; color: var(--ink-dim); flex-wrap: wrap; justify-content: center; }
      .ga-hint { font-size: 11.5px; color: var(--ink-dim); text-align: center; margin: 0; }

      .ga-canvas-wrap { position: relative; border-radius: 10px; overflow: hidden; line-height: 0; }
      .ga-canvas { display: block; border-radius: 10px; max-width: 100%; height: auto; }

      .ga-overlay { position: absolute; inset: 0; background: rgba(12,14,46,0.88); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; border-radius: 16px; }
      .ga-overlay-card { text-align: center; padding: 18px; animation: ga-overlay-in 0.22s ease; }
      .ga-overlay-emoji { font-size: 34px; }
      .ga-overlay-card h3 { margin: 6px 0; }
      .ga-overlay-stat { color: var(--ink-dim); font-size: 13px; }
      .ga-overlay-actions { display: flex; gap: 8px; margin-top: 14px; justify-content: center; flex-wrap: wrap; }
      .ga-btn { display: flex; align-items: center; gap: 6px; background: var(--surface-2); color: var(--ink); border: 1px solid rgba(255,255,255,0.12); padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; }
      .ga-btn-primary { background: var(--teal); color: #06261f; border-color: var(--teal); font-weight: 700; }

      .ga-falling-target { position: absolute; border-radius: 50%; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.15); font-size: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }

      .ga-whack-grid { display: grid; grid-template-columns: repeat(3, 74px); gap: 10px; }
      .ga-hole { width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #1c1e50, #0c0e2e); border: 1px solid rgba(255,255,255,0.1); font-size: 28px; cursor: pointer; }
      .ga-hole-active { box-shadow: 0 0 0 3px var(--yellow) inset; }

      .ga-hue-target { font-size: 15px; }
      .ga-timebar-track { width: 240px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
      .ga-timebar-fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--yellow)); }
      .ga-hue-grid { display: grid; grid-template-columns: repeat(3, 62px); gap: 10px; }
      .ga-hue-swatch { width: 62px; height: 62px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.15); cursor: pointer; }

      .ga-ttt-board { display: grid; grid-template-columns: repeat(3, 78px); gap: 6px; }
      .ga-ttt-cell { width: 78px; height: 78px; font-size: 30px; font-weight: 800; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: var(--yellow); cursor: pointer; }
      .ga-ttt-cell:disabled { cursor: default; }

      .ga-memory-grid { display: grid; grid-template-columns: repeat(4, 58px); gap: 8px; }
      .ga-memory-card { position: relative; width: 58px; height: 58px; border-radius: 10px; background: transparent; border: none; padding: 0; cursor: pointer; font-size: 22px; perspective: 600px; }
      .ga-memory-inner { position: relative; width: 100%; height: 100%; transition: transform .4s ease; transform-style: preserve-3d; }
      .ga-memory-inner.is-flipped { transform: rotateY(180deg); }
      .ga-memory-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: var(--ink-dim); }
      .ga-memory-back { transform: rotateY(180deg); color: var(--ink); }
      .ga-memory-card.is-matched .ga-memory-face { opacity: 0.5; }

      .ga-2048-grid { display: grid; grid-template-columns: repeat(4, 60px); gap: 8px; background: var(--surface); padding: 8px; border-radius: 12px; }
      .ga-2048-tile { width: 60px; height: 60px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: #fff; }
      .ga-dpad { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .ga-dpad button { width: 40px; height: 34px; border-radius: 8px; background: var(--surface-2); color: var(--ink); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 16px; }
      .ga-dpad > div { display: flex; gap: 6px; }
      .ga-dpad-row { display: flex; flex-direction: row; gap: 10px; }
      .ga-dpad-row button { width: 52px; height: 42px; border-radius: 10px; background: var(--surface-2); color: var(--ink); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 18px; }

      .ga-quiz-q { font-size: 16px; font-weight: 700; text-align: center; max-width: 300px; }
      .ga-quiz-options { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 300px; }
      .ga-quiz-opt { padding: 10px 14px; border-radius: 10px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); color: var(--ink); text-align: left; cursor: pointer; font-size: 14px; }
      .ga-quiz-opt.is-correct { border-color: var(--teal); background: rgba(47,230,196,0.15); animation: ga-pulse 0.4s ease; }
      .ga-quiz-opt.is-wrong { border-color: var(--coral); background: rgba(255,93,93,0.15); animation: ga-shake-x 0.35s ease; }

      .ga-rps-arena { display: flex; align-items: center; gap: 20px; }
      .ga-rps-side { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: var(--ink-dim); }
      .ga-rps-emoji { font-size: 40px; }
      .ga-rps-vs { font-size: 12px; color: var(--ink-dim); }
      .ga-rps-choices { display: flex; gap: 10px; }
      .ga-rps-btn { width: 56px; height: 56px; border-radius: 50%; font-size: 26px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
      .ga-rps-btn:disabled { opacity: 0.4; }

      .ga-simon-grid { display: grid; grid-template-columns: repeat(2, 90px); grid-template-rows: repeat(2, 90px); gap: 10px; }
      .ga-simon-pad { border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: opacity .1s ease, transform .1s ease, box-shadow .1s ease; }
      .ga-simon-pad.is-active { transform: scale(0.94); box-shadow: 0 0 24px rgba(255,255,255,0.35); }
      .ga-simon-pad:disabled { cursor: default; }

      .ga-mine-grid { display: grid; grid-template-columns: repeat(8, 32px); gap: 3px; }
      .ga-mine-cell { width: 32px; height: 32px; border-radius: 4px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--ink); padding: 0; }
      .ga-mine-cell.is-revealed { background: rgba(255,255,255,0.05); cursor: default; }

      @media (max-width: 480px) {
        .ga-whack-grid, .ga-hue-grid { transform: scale(0.92); }
        .ga-mine-grid { grid-template-columns: repeat(8, 28px); gap: 2px; }
        .ga-mine-cell { width: 28px; height: 28px; font-size: 11px; }
        .ga-cabinet-frame { padding: 10px; border-width: 4px; }
        .ga-root { padding: 20px 10px 50px; }
        .ga-marquee h1 { letter-spacing: 2px; }
      }

      .ga-cabinet:active,
      .ga-btn:active,
      .ga-hole:active,
      .ga-hue-swatch:active,
      .ga-ttt-cell:active,
      .ga-memory-card:active,
      .ga-quiz-opt:active,
      .ga-rps-btn:active,
      .ga-simon-pad:active,
      .ga-mine-cell:active,
      .ga-dpad button:active,
      .ga-dpad-row button:active,
      .ga-back-btn:active {
        transform: scale(0.94);
      }
    `}</style>
  );
}

/* --------------------------------- app ------------------------------------ */

const STORAGE_PREFIX = "neon-arcade:";

function storageGet(key) {
  try { return localStorage.getItem(STORAGE_PREFIX + key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, value); } catch (e) {}
}
function storageListKeys(prefix) {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(STORAGE_PREFIX + prefix) === 0) keys.push(k.slice(STORAGE_PREFIX.length));
    }
    return keys;
  } catch (e) { return []; }
}

export default function GameArcadeApp() {
  const [view, setView] = useState("hub");
  const [best, setBest] = useState({});

  useEffect(() => {
    try {
      const keys = storageListKeys("score:");
      const map = {};
      keys.forEach((k) => {
        const raw = storageGet(k);
        if (raw != null) {
          try { map[k.replace("score:", "")] = JSON.parse(raw); } catch (e) {}
        }
      });
      setBest(map);
    } catch (e) {}
  }, []);

  function handleFinish(game, value) {
    setBest((prev) => {
      const prevVal = prev[game.id];
      const better = prevVal == null || (game.lowerIsBetter ? value < prevVal : value > prevVal);
      if (!better) return prev;
      storageSet("score:" + game.id, JSON.stringify(value));
      return { ...prev, [game.id]: value };
    });
  }

  const currentGame = view !== "hub" ? GAMES.find((g) => g.id === view) : null;

  return (
    <div className="ga-root">
      <GlobalStyle />
      {currentGame
        ? <GameShell game={currentGame} best={best[currentGame.id]} onFinish={handleFinish} goHome={() => setView("hub")} />
        : <Hub best={best} onPlay={setView} />}
    </div>
  );
}
