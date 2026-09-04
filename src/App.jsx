import { useState, useEffect, useRef } from "react";
import {
  Zap,
  Wind,
  Target,
  Hand,
  Palette,
  Grid3x3,
  Layers,
  Puzzle,
  Brain,
  Sparkles,
  Infinity as InfinityIcon,
  Flag,
  ArrowLeft,
  RotateCcw,
  Circle,
  Mountain,
  ChevronsUp,
  Repeat,
  Disc,
  LayoutGrid,
  Bomb,
  Volume2,
  VolumeX,
  Music,
  Blocks,
  Ghost,
  Rocket,
  Crosshair,
  TrendingUp,
  Waves,
  Swords,
  Snowflake,
  Car,
  Orbit,
  Flame,
  Goal,
  Coins,
  Spade,
  Ship,
  ShieldAlert,
  Bug,
  CircleDot,
  Pin,
  Grid2x2,
  Dices,
  Gauge,
  Keyboard,
  Shuffle,
  Apple,
  Boxes,
  Dribbble,
  LocateFixed,
  TreePine,
  Music2,
  Box,
  Hash,
} from "lucide-react";

/* ------------------------------ audio engine ------------------------------ */

const AudioEngine = (() => {
  let ctx = null;
  let sfxOn = true;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;

  function getCtx() {
    const AC =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({
    freq = 440,
    duration = 0.09,
    type = "square",
    volume = 0.15,
    sweep = 0,
    delay = 0,
  }) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep)
      osc.frequency.linearRampToValueAtTime(
        Math.max(20, freq + sweep),
        t0 + duration,
      );
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  const SFX = {
    click: () => tone({ freq: 520, duration: 0.05, volume: 0.1 }),
    select: () => tone({ freq: 680, duration: 0.06, volume: 0.12 }),
    coin: () => {
      tone({ freq: 988, duration: 0.06, volume: 0.13 });
      tone({ freq: 1318, duration: 0.09, volume: 0.13, delay: 0.06 });
    },
    score: () => tone({ freq: 700, duration: 0.09, volume: 0.13, sweep: 260 }),
    hit: () =>
      tone({
        freq: 180,
        duration: 0.14,
        type: "sawtooth",
        volume: 0.15,
        sweep: -100,
      }),
    jump: () => tone({ freq: 300, duration: 0.09, volume: 0.12, sweep: 200 }),
    win: () =>
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, duration: 0.15, volume: 0.14, delay: i * 0.1 }),
      ),
    lose: () =>
      [392, 330, 262, 196].forEach((f, i) =>
        tone({
          freq: f,
          duration: 0.17,
          type: "sawtooth",
          volume: 0.14,
          delay: i * 0.11,
        }),
      ),
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

  const MUSIC_NOTES = [
    130.81, 164.81, 196.0, 164.81, 130.81, 98.0, 130.81, 164.81,
  ];
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
  function startMusic() {
    getCtx();
    if (musicOn) return;
    musicOn = true;
    musicStepFn();
  }
  function stopMusic() {
    musicOn = false;
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
  }
  function toggleMusic() {
    if (musicOn) stopMusic();
    else startMusic();
    return musicOn;
  }
  function setSfxOn(v) {
    sfxOn = v;
  }
  function isMusicOn() {
    return musicOn;
  }

  return { playSfx, playNote, toggleMusic, isMusicOn, setSfxOn };
})();

/* ----------------------------- shared data ----------------------------- */

const EMOJIS = ["⚡", "⭐", "🔥", "💎", "🌟"];
const MEMORY_EMOJIS = ["🎮", "🚀", "🍕", "⭐", "🐼", "🌈", "🎧", "🎲"];

const COLOR_POOL = [
  { name: "Coral", hex: "#ff9696" },
  { name: "Teal", hex: "#78efd9" },
  { name: "Amber", hex: "#ffdc80" },
  { name: "Violet", hex: "#bea9ff" },
  { name: "Lime", hex: "#b4eb94" },
  { name: "Sky", hex: "#8dd1ff" },
  { name: "Rose", hex: "#ffa9cc" },
  { name: "Ember", hex: "#ffb381" },
];

const QUIZ_POOL = [
  {
    q: "What is the largest planet in our solar system?",
    options: ["Earth", "Jupiter", "Saturn", "Mars"],
    answer: 1,
  },
  {
    q: "How many legs does a spider have?",
    options: ["6", "8", "10", "12"],
    answer: 1,
  },
  {
    q: "What is the capital of Japan?",
    options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
    answer: 2,
  },
  {
    q: "Which ocean is the largest?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: 3,
  },
  {
    q: "What gas do plants absorb from the air?",
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"],
    answer: 1,
  },
  {
    q: "How many colors are in a rainbow?",
    options: ["5", "6", "7", "8"],
    answer: 2,
  },
  {
    q: "What is the freezing point of water in Celsius?",
    options: ["0", "32", "100", "-10"],
    answer: 0,
  },
  {
    q: "Which animal is known as the King of the Jungle?",
    options: ["Tiger", "Elephant", "Lion", "Bear"],
    answer: 2,
  },
  {
    q: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    answer: 2,
  },
  {
    q: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: 1,
  },
  {
    q: "How many continents are there on Earth?",
    options: ["5", "6", "7", "8"],
    answer: 2,
  },
  {
    q: "What do bees make?",
    options: ["Milk", "Honey", "Silk", "Wax only"],
    answer: 1,
  },
  {
    q: "Which shape has three sides?",
    options: ["Square", "Triangle", "Circle", "Pentagon"],
    answer: 1,
  },
  {
    q: "What is the main language spoken in Brazil?",
    options: ["Spanish", "Portuguese", "French", "English"],
    answer: 1,
  },
  {
    q: "How many players are on a standard soccer team on the field?",
    options: ["9", "10", "11", "12"],
    answer: 2,
  },
  {
    q: "What is H2O more commonly known as?",
    options: ["Salt", "Water", "Sugar", "Oxygen"],
    answer: 1,
  },
];

const RPS_CHOICES = [
  { id: "rock", emoji: "🪨" },
  { id: "paper", emoji: "📄" },
  { id: "scissors", emoji: "✂️" },
];

const SIMON_COLORS = [
  { id: 0, base: "#78efd9", light: "#7dfff0" },
  { id: 1, base: "#ff9696", light: "#ffb0b0" },
  { id: 2, base: "#ffdc80", light: "#ffe38a" },
  { id: 3, base: "#bea9ff", light: "#d3c4ff" },
];
const SIMON_FREQS = [523.25, 392.0, 659.25, 293.66];

function rpsWinner(a, b) {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  )
    return "p1";
  return "p2";
}

/* ----------------------------- 2048 helpers ----------------------------- */

function empty4x4() {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}
function addRandomTile(grid, fourChance = 0.1) {
  const empties = [];
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === 0) empties.push([r, c]);
    }),
  );
  if (!empties.length) return grid;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const newGrid = grid.map((row) => [...row]);
  newGrid[r][c] = Math.random() < fourChance ? 4 : 2;
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
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) res[c][n - 1 - r] = grid[r][c];
  return res;
}
function moveGrid(grid, dir) {
  let g = grid.map((row) => [...row]);
  const rotations = { left: 0, up: 3, right: 2, down: 1 }[dir];
  for (let i = 0; i < rotations; i++) g = rotateGridCW(g);
  let moved = false,
    gained = 0;
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
    2: "#3f4175",
    4: "#47497d",
    8: "#8b82b4",
    16: "#9e82bb",
    32: "#b382bb",
    64: "#cd82b6",
    128: "#ffdc80",
    256: "#ffc180",
    512: "#ffab80",
    1024: "#ff9696",
    2048: "#78efd9",
  };
  return map[v] || "rgba(255,255,255,0.04)";
}

/* ------------------------------ tiny particles --------------------------- */

function spawnBurst(particles, x, y, color, count = 12, sfx) {
  if (sfx) AudioEngine.playSfx(sfx);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.4 + Math.random() * 2.6;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
}
function updateAndDrawParticles(ctx, particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 0.045;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
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
    p.y -= 0.7;
    p.life -= 0.02;
    if (p.life <= 0) {
      popups.splice(i, 1);
      continue;
    }
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

function Overlay({
  emoji,
  title,
  statLines,
  onRestart,
  onExit,
  extraAction,
  sound = "neutral",
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(true);
      AudioEngine.playSfx(sound);
    }, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, []);
  if (!show) return null;
  return (
    <div className="ga-overlay">
      <div className="ga-overlay-card">
        <div className="ga-overlay-emoji">{emoji}</div>
        <h3>{title}</h3>
        {statLines &&
          statLines.map((l, i) => (
            <div key={i} className="ga-overlay-stat">
              {l}
            </div>
          ))}
        <div className="ga-overlay-actions">
          {extraAction && (
            <button
              className="ga-btn"
              onClick={() => {
                AudioEngine.playSfx("click");
                extraAction.onClick();
              }}
            >
              {extraAction.label}
            </button>
          )}
          <button
            className="ga-btn ga-btn-primary"
            onClick={() => {
              AudioEngine.playSfx("click");
              onRestart();
            }}
          >
            <RotateCcw size={16} /> Play again
          </button>
          {onExit && (
            <button
              className="ga-btn"
              onClick={() => {
                AudioEngine.playSfx("click");
                onExit();
              }}
            >
              <ArrowLeft size={16} /> Arcade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- endless: snake ------------------------------ */

function SnakeGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const SIZE = 16,
    CELL = 18;
  const { startSpeed, minSpeed } = {
    easy: { startSpeed: 200, minSpeed: 100 },
    medium: { startSpeed: 160, minSpeed: 70 },
    hard: { startSpeed: 120, minSpeed: 50 },
  }[difficulty];
  function randCell(exclude) {
    let c;
    do {
      c = {
        x: Math.floor(Math.random() * SIZE),
        y: Math.floor(Math.random() * SIZE),
      };
    } while (exclude.some((s) => s.x === c.x && s.y === c.y));
    return c;
  }
  const initial = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ];
  const [snake, setSnake] = useState(initial);
  const [food, setFood] = useState(() => randCell(initial));
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(startSpeed);
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
    setSnake(initial);
    snakeRef.current = initial;
    const f = randCell(initial);
    setFood(f);
    foodRef.current = f;
    setScore(0);
    setSpeed(startSpeed);
    setOver(false);
    setShake(false);
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    particlesRef.current = [];
  }

  function steer(nd) {
    if (nd.x === -dirRef.current.x && nd.y === -dirRef.current.y) return;
    nextDirRef.current = nd;
  }

  useEffect(() => {
    function onKey(e) {
      const map = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
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
        const head = {
          x: prev[0].x + dirRef.current.x,
          y: prev[0].y + dirRef.current.y,
        };
        const hit =
          head.x < 0 ||
          head.x >= SIZE ||
          head.y < 0 ||
          head.y >= SIZE ||
          prev.some((s) => s.x === head.x && s.y === head.y);
        if (hit) {
          setOver(true);
          spawnBurst(
            particlesRef.current,
            head.x * CELL + CELL / 2,
            head.y * CELL + CELL / 2,
            "#ff9696",
            18,
            "hit",
          );
          setShake(true);
          setTimeout(() => setShake(false), 280);
          return prev;
        }
        const next = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore((sc) => sc + 10);
          spawnBurst(
            particlesRef.current,
            food.x * CELL + CELL / 2,
            food.y * CELL + CELL / 2,
            "#ffdc80",
            14,
            "coin",
          );
          const f = randCell(next);
          setFood(f);
          foodRef.current = f;
          setSpeed((sp) => Math.max(minSpeed, sp - 4));
        } else {
          next.pop();
        }
        snakeRef.current = next;
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [speed, over, food]);

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  useEffect(() => {
    function loop() {
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "#242643";
      ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL);
      ctx.fillStyle = "#ffdc80";
      ctx.fillRect(
        foodRef.current.x * CELL + 2,
        foodRef.current.y * CELL + 2,
        CELL - 4,
        CELL - 4,
      );
      snakeRef.current.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? "#78efd9" : "rgba(120,239,217,0.75)";
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      updateAndDrawParticles(ctx, particlesRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas
          ref={canvasRef}
          width={SIZE * CELL}
          height={SIZE * CELL}
          className="ga-canvas"
        />
      </div>
      {over && (
        <Overlay
          emoji="🐍"
          title="Game over"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => steer({ x: 0, y: -1 })}>↑</button>
        <div>
          <button onClick={() => steer({ x: -1, y: 0 })}>←</button>
          <button onClick={() => steer({ x: 0, y: 1 })}>↓</button>
          <button onClick={() => steer({ x: 1, y: 0 })}>→</button>
        </div>
      </div>
      <p className="ga-hint">
        Arrow keys, WASD, or the pad to steer. Don't hit the wall or yourself.
      </p>
    </div>
  );
}

/* -------------------------- endless: flappy ------------------------------ */

function FlappyGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { GAP, PIPE_SPEED } = {
    easy: { GAP: 165, PIPE_SPEED: 2.1 },
    medium: { GAP: 132, PIPE_SPEED: 2.6 },
    hard: { GAP: 104, PIPE_SPEED: 3.3 },
  }[difficulty];
  const W = 320,
    H = 400,
    PIPE_W = 46,
    GRAVITY = 0.5,
    FLAP = -8.2,
    SPAWN_EVERY = 100,
    BIRD_X = 56,
    BIRD_R = 13;
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      birdY: H / 2,
      vel: 0,
      pipes: [],
      particles: [],
      frame: 0,
      score: 0,
      alive: true,
      ended: false,
      started: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setOver(false);
    setShake(false);
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
        if (s.frame % SPAWN_EVERY === 1)
          s.pipes.push({
            x: W,
            gapY: 50 + Math.random() * (H - 200),
            passed: false,
          });
        s.pipes.forEach((p) => (p.x -= PIPE_SPEED));
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);
        s.pipes.forEach((p) => {
          if (!p.passed && p.x + PIPE_W < BIRD_X) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
            spawnBurst(s.particles, BIRD_X, s.birdY, "#ffdc80", 8, "score");
          }
        });
        if (s.birdY - BIRD_R < 0 || s.birdY + BIRD_R > H) s.alive = false;
        s.pipes.forEach((p) => {
          const overlapX =
            BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
          if (
            overlapX &&
            (s.birdY - BIRD_R < p.gapY || s.birdY + BIRD_R > p.gapY + GAP)
          )
            s.alive = false;
        });
        if (!s.alive && !s.ended) {
          s.ended = true;
          setOver(true);
          spawnBurst(s.particles, BIRD_X, s.birdY, "#ff9696", 16, "hit");
          setShake(true);
          setTimeout(() => setShake(false), 280);
        }
      }
      ctx.fillStyle = "#242643";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(120,239,217,0.85)";
      s.pipes.forEach((p) => {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - (p.gapY + GAP));
      });
      ctx.fillStyle = "#ffdc80";
      ctx.beginPath();
      ctx.arc(BIRD_X, s.birdY, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
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
    function onKey(e) {
      if (e.code === "Space") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div
        className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}
        onClick={flap}
      >
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🚀"
          title="Crashed!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Click the screen or press Space to flap through the gaps.
      </p>
    </div>
  );
}

/* -------------------------- endless: reflex ------------------------------ */

function ReflexGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, baseFall, baseSpawn, minSpawn } = {
    easy: { startLives: 4, baseFall: 2.0, baseSpawn: 65, minSpawn: 30 },
    medium: { startLives: 3, baseFall: 2.6, baseSpawn: 55, minSpawn: 22 },
    hard: { startLives: 2, baseFall: 3.4, baseSpawn: 42, minSpawn: 16 },
  }[difficulty];
  const W = 300,
    H = 360,
    SIZE = 34;
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(false);
  const idRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const scoreRef = useRef(0);

  function reset() {
    setTargets([]);
    setScore(0);
    setLives(startLives);
    setOver(false);
    scoreRef.current = 0;
    spawnTimerRef.current = 0;
  }

  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      const fallSpeed = baseFall + Math.min(4, scoreRef.current * 0.06);
      const spawnEvery = Math.max(minSpawn, baseSpawn - scoreRef.current);
      spawnTimerRef.current += 1;
      let shouldSpawn = false;
      if (spawnTimerRef.current >= spawnEvery) {
        spawnTimerRef.current = 0;
        shouldSpawn = true;
      }
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
        if (shouldSpawn) {
          next.push({
            id: idRef.current++,
            x: 12 + Math.random() * (W - SIZE - 12),
            y: -SIZE,
            emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          });
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [over]);

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  function catchTarget(id) {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    setScore((s) => {
      const ns = s + 1;
      scoreRef.current = ns;
      return ns;
    });
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(lives)}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div
        className="ga-canvas-wrap"
        style={{
          width: W,
          height: H,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {targets.map((t) => (
          <button
            key={t.id}
            className="ga-falling-target"
            style={{ left: t.x, top: t.y, width: SIZE, height: SIZE }}
            onClick={() => catchTarget(t.id)}
          >
            {t.emoji}
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="⚡"
          title="Reflexes maxed out"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap the sparks before they hit the floor. Three misses ends it.
      </p>
    </div>
  );
}

/* -------------------------- endless: whack ------------------------------ */

function WhackGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, minVisible, baseVisible, visibleDrop } = {
    easy: {
      startLives: 4,
      minVisible: 620,
      baseVisible: 1250,
      visibleDrop: 10,
    },
    medium: {
      startLives: 3,
      minVisible: 480,
      baseVisible: 1050,
      visibleDrop: 12,
    },
    hard: { startLives: 2, minVisible: 340, baseVisible: 850, visibleDrop: 14 },
  }[difficulty];
  const HOLES = 9;
  const [activeIdx, setActiveIdx] = useState(-1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(false);
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const timerRef = useRef(null);
  const moleTokenRef = useRef(0);

  function popCycle() {
    if (overRef.current) return;
    const delay =
      350 + Math.random() * Math.max(150, 700 - scoreRef.current * 15);
    timerRef.current = setTimeout(() => {
      if (overRef.current) return;
      const myToken = ++moleTokenRef.current;
      const idx = Math.floor(Math.random() * HOLES);
      setActiveIdx(idx);
      const visibleFor = Math.max(
        minVisible,
        baseVisible - scoreRef.current * visibleDrop,
      );
      timerRef.current = setTimeout(() => {
        if (overRef.current) return;
        if (moleTokenRef.current !== myToken) return;
        setActiveIdx(-1);
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) {
            overRef.current = true;
            setOver(true);
          }
          return Math.max(0, nl);
        });
        popCycle();
      }, visibleFor);
    }, delay);
  }

  useEffect(() => {
    popCycle();
    return () => clearTimeout(timerRef.current);
  }, []);
  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  function reset() {
    clearTimeout(timerRef.current);
    setActiveIdx(-1);
    setScore(0);
    setLives(startLives);
    setOver(false);
    scoreRef.current = 0;
    overRef.current = false;
    moleTokenRef.current = 0;
    popCycle();
  }

  function whack(idx) {
    if (idx !== activeIdx) return;
    AudioEngine.playSfx("hit");
    moleTokenRef.current++;
    setActiveIdx(-1);
    setScore((s) => {
      const ns = s + 1;
      scoreRef.current = ns;
      return ns;
    });
    popCycle();
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(lives)}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-whack-grid">
        {Array.from({ length: HOLES }).map((_, i) => (
          <button
            key={i}
            className={`ga-hole ${i === activeIdx ? "ga-hole-active" : ""}`}
            onClick={() => whack(i)}
          >
            {i === activeIdx && (
              <span key={`${i}-${activeIdx}`} className="ga-pop-anim">
                🐹
              </span>
            )}
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🔨"
          title="Out of misses"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Whack the critter the instant it pops up. Three misses ends the round.
      </p>
    </div>
  );
}

/* -------------------------- endless: hue chase ---------------------------- */

function HueChaseGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { maxMistakes, baseDuration, minDuration } = {
    easy: { maxMistakes: 4, baseDuration: 3800, minDuration: 1700 },
    medium: { maxMistakes: 3, baseDuration: 3000, minDuration: 1300 },
    hard: { maxMistakes: 2, baseDuration: 2300, minDuration: 950 },
  }[difficulty];
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
    const duration = Math.max(minDuration, baseDuration - curScore * 60);
    decRef.current = 100 / (duration / 40);
  }

  function reset() {
    scoreRef.current = 0;
    overRef.current = false;
    setScore(0);
    setMistakes(0);
    setOver(false);
    pickRound(0);
  }

  useEffect(() => {
    pickRound(0);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (overRef.current) return;
      setTimeLeft((t) => {
        const nt = t - decRef.current;
        if (nt <= 0) {
          registerMistake();
          return 100;
        }
        return nt;
      });
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, []);

  function registerMistake() {
    setMistakes((m) => {
      const nm = m + 1;
      if (nm >= maxMistakes) {
        overRef.current = true;
        setOver(true);
      } else {
        pickRound(scoreRef.current);
      }
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

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>
          Strikes: {mistakes}/{maxMistakes}
        </span>
        <span>Best: {best ?? 0}</span>
      </div>
      {target && (
        <>
          <div className="ga-hue-target">
            Tap: <b style={{ color: target.hex }}>{target.name}</b>
          </div>
          <div className="ga-timebar-track">
            <div
              className="ga-timebar-fill"
              style={{ width: `${Math.max(0, timeLeft)}%` }}
            />
          </div>
          <div className="ga-hue-grid">
            {options.map((o) => (
              <button
                key={o.name}
                className="ga-hue-swatch"
                style={{ background: o.hex }}
                onClick={() => choose(o)}
                aria-label={o.name}
              />
            ))}
          </div>
        </>
      )}
      {over && (
        <Overlay
          emoji="🎨"
          title="Three strikes"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap the swatch that matches the named color before time runs out.
      </p>
    </div>
  );
}

/* ------------------------- challenge: tic tac toe -------------------------- */

function TicTacToeGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const empty = Array(9).fill(null);
  const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const [board, setBoard] = useState(empty);
  const [turn, setTurn] = useState("X");
  const [result, setResult] = useState(null);
  const [wins, setWins] = useState(0);

  function winnerOf(b) {
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  }
  function reset() {
    setBoard(empty);
    setTurn("X");
    setResult(null);
  }

  function cpuMove(b) {
    const avail = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    if (difficulty === "easy") {
      if (Math.random() < 0.35) {
        for (const i of avail) {
          const t = [...b];
          t[i] = "O";
          if (winnerOf(t) === "O") return i;
        }
      }
      return avail[Math.floor(Math.random() * avail.length)];
    }
    for (const i of avail) {
      const t = [...b];
      t[i] = "O";
      if (winnerOf(t) === "O") return i;
    }
    for (const i of avail) {
      const t = [...b];
      t[i] = "X";
      if (winnerOf(t) === "X") return i;
    }
    if (difficulty === "hard") {
      for (const i of avail) {
        const t = [...b];
        t[i] = "O";
        const buildsThreat = LINES.some(([a, c, d]) => {
          const line = [t[a], t[c], t[d]];
          return (
            line.filter((v) => v === "O").length === 2 && line.includes(null)
          );
        });
        if (buildsThreat) return i;
      }
    }
    if (b[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter((i) => avail.includes(i));
    if (corners.length)
      return corners[Math.floor(Math.random() * corners.length)];
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function play(i) {
    if (board[i] || result || turn !== "X") return;
    AudioEngine.playSfx("click");
    const b1 = [...board];
    b1[i] = "X";
    const w1 = winnerOf(b1);
    if (w1) {
      setBoard(b1);
      setResult("win");
      return;
    }
    if (b1.every(Boolean)) {
      setBoard(b1);
      setResult("draw");
      return;
    }
    setBoard(b1);
    setTurn("O");
    setTimeout(() => {
      const move = cpuMove(b1);
      const b2 = [...b1];
      b2[move] = "O";
      const w2 = winnerOf(b2);
      setBoard(b2);
      AudioEngine.playSfx("click");
      if (w2) setResult("lose");
      else if (b2.every(Boolean)) setResult("draw");
      else setTurn("X");
    }, 450);
  }

  useEffect(() => {
    if (result === "win")
      setWins((w) => {
        const nw = w + 1;
        onFinish(nw);
        return nw;
      });
  }, [result]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Round wins: {wins}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-ttt-board">
        {board.map((v, i) => (
          <button
            key={i}
            className="ga-ttt-cell"
            onClick={() => play(i)}
            disabled={!!v || !!result}
          >
            {v && (
              <span key={i + "-" + v} className="ga-pop-anim">
                {v}
              </span>
            )}
          </button>
        ))}
      </div>
      {result && (
        <Overlay
          emoji={result === "win" ? "🏆" : result === "lose" ? "🤖" : "🤝"}
          title={
            result === "win"
              ? "You win!"
              : result === "lose"
                ? "CPU wins"
                : "Draw"
          }
          statLines={[`Round wins this session: ${wins}`]}
          onRestart={reset}
          onExit={goHome}
          sound={
            result === "win" ? "win" : result === "lose" ? "lose" : "neutral"
          }
        />
      )}
      <p className="ga-hint">Get three in a row before the CPU does.</p>
    </div>
  );
}

/* --------------------------- challenge: memory ----------------------------- */

function MemoryGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { pairCount, mismatchDelay } = {
    easy: { pairCount: 6, mismatchDelay: 900 },
    medium: { pairCount: 8, mismatchDelay: 700 },
    hard: { pairCount: 8, mismatchDelay: 450 },
  }[difficulty];
  function shuffleDeck() {
    const pool = MEMORY_EMOJIS.slice(0, pairCount);
    return [...pool, ...pool]
      .map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
  }
  const [cards, setCards] = useState(shuffleDeck);
  const [selected, setSelected] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setCards(shuffleDeck());
    setSelected([]);
    setMoves(0);
    setLocked(false);
    setDone(false);
  }

  function flip(id) {
    if (locked || done) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    AudioEngine.playSfx("click");
    const newCards = cards.map((c) =>
      c.id === id ? { ...c, flipped: true } : c,
    );
    const newSelected = [...selected, id];
    setCards(newCards);
    setSelected(newSelected);
    if (newSelected.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = newSelected;
      const ca = newCards.find((c) => c.id === a),
        cb = newCards.find((c) => c.id === b);
      if (ca.emoji === cb.emoji) {
        setTimeout(() => {
          AudioEngine.playSfx("coin");
          setCards((cs) =>
            cs.map((c) =>
              c.id === a || c.id === b ? { ...c, matched: true } : c,
            ),
          );
          setSelected([]);
          setLocked(false);
        }, 400);
      } else {
        setTimeout(() => {
          AudioEngine.playSfx("hit");
          setCards((cs) =>
            cs.map((c) =>
              c.id === a || c.id === b ? { ...c, flipped: false } : c,
            ),
          );
          setSelected([]);
          setLocked(false);
        }, mismatchDelay);
      }
    }
  }

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && !done) setDone(true);
  }, [cards, done]);
  useEffect(() => {
    if (done) onFinish(moves);
  }, [done]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Moves: {moves}</span>
        <span>Best: {best != null ? best + " moves" : "—"}</span>
      </div>
      <div className="ga-memory-grid">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`ga-memory-card ${c.matched ? "is-matched" : ""}`}
            onClick={() => flip(c.id)}
          >
            <div
              className={`ga-memory-inner ${c.flipped || c.matched ? "is-flipped" : ""}`}
            >
              <div className="ga-memory-face ga-memory-front">?</div>
              <div className="ga-memory-face ga-memory-back">{c.emoji}</div>
            </div>
          </button>
        ))}
      </div>
      {done && (
        <Overlay
          emoji="🧠"
          title="Board cleared!"
          statLines={[`Moves: ${moves}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <p className="ga-hint">
        Flip two cards at a time and find every pair in the fewest moves.
      </p>
    </div>
  );
}

/* --------------------------- challenge: 2048 ------------------------------- */

function TwentyFortyEightGame({
  onFinish,
  best,
  goHome,
  difficulty = "medium",
}) {
  const fourChance = { easy: 0.05, medium: 0.1, hard: 0.22 }[difficulty];
  function freshGrid() {
    return addRandomTile(addRandomTile(empty4x4(), fourChance), fourChance);
  }
  const [grid, setGrid] = useState(freshGrid);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState(null);
  const [continued, setContinued] = useState(false);

  function reset() {
    setGrid(freshGrid());
    setScore(0);
    setStatus(null);
    setContinued(false);
  }

  function handleMove(dir) {
    if (status === "lost" || (status === "won" && !continued)) return;
    const { grid: newGrid, moved, gained } = moveGrid(grid, dir);
    if (!moved) return;
    AudioEngine.playSfx(gained > 0 ? "score" : "click");
    const withTile = addRandomTile(newGrid, fourChance);
    setGrid(withTile);
    setScore((s) => s + gained);
    const maxTile = Math.max(...withTile.flat());
    if (maxTile >= 2048 && status !== "won") setStatus("won");
    else if (!canMove(withTile)) setStatus("lost");
  }

  useEffect(() => {
    function onKey(e) {
      const map = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      if (map[e.key]) {
        e.preventDefault();
        handleMove(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [grid, status, continued]);

  useEffect(() => {
    if (status) onFinish(score);
  }, [status]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-2048-grid">
        {grid.flat().map((v, i) => (
          <div
            key={i}
            className="ga-2048-tile"
            style={{ background: tileColor(v) }}
          >
            {v !== 0 ? v : ""}
          </div>
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
        <Overlay
          emoji="🎉"
          title="You hit 2048!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          extraAction={{
            label: "Keep going",
            onClick: () => setContinued(true),
          }}
          sound="win"
        />
      )}
      {status === "lost" && (
        <Overlay
          emoji="🧩"
          title="No more moves"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Arrow keys or the pad to slide tiles. Matching numbers merge.
      </p>
    </div>
  );
}

/* --------------------------- challenge: quiz -------------------------------- */

function QuizGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { TOTAL, timeLimitMs } = {
    easy: { TOTAL: 7, timeLimitMs: 0 },
    medium: { TOTAL: 10, timeLimitMs: 12000 },
    hard: { TOTAL: 14, timeLimitMs: 7000 },
  }[difficulty];
  function newSet() {
    return [...QUIZ_POOL].sort(() => Math.random() - 0.5).slice(0, TOTAL);
  }
  const [questions, setQuestions] = useState(newSet);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const [timePct, setTimePct] = useState(100);
  const answeredRef = useRef(false);

  function reset() {
    setQuestions(newSet());
    setIdx(0);
    setScore(0);
    setPicked(null);
    setDone(false);
    answeredRef.current = false;
  }

  function advance() {
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true);
      else {
        setIdx((i) => i + 1);
        setPicked(null);
        answeredRef.current = false;
      }
    }, 700);
  }

  function choose(optIdx) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setPicked(optIdx);
    const correct = optIdx === questions[idx].answer;
    AudioEngine.playSfx(correct ? "coin" : "hit");
    if (correct) setScore((s) => s + 1);
    advance();
  }

  useEffect(() => {
    if (done || timeLimitMs === 0) return;
    setTimePct(100);
    const started = Date.now();
    const id = setInterval(() => {
      const pct = Math.max(
        0,
        100 - ((Date.now() - started) / timeLimitMs) * 100,
      );
      setTimePct(pct);
      if (pct <= 0) {
        clearInterval(id);
        if (!answeredRef.current) {
          answeredRef.current = true;
          AudioEngine.playSfx("hit");
          setPicked(-1);
          advance();
        }
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [idx, done]);

  useEffect(() => {
    if (done) onFinish(score);
  }, [done]);

  if (done) {
    return (
      <div className="ga-game-col">
        <Overlay
          emoji="🧠"
          title="Quiz complete"
          statLines={[`Score: ${score} / ${questions.length}`]}
          onRestart={reset}
          onExit={goHome}
          sound={score >= questions.length * 0.7 ? "win" : "neutral"}
        />
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Question {idx + 1} / {questions.length}
        </span>
        <span>Score: {score}</span>
        <span>Best: {best != null ? best + "/" + TOTAL : "—"}</span>
      </div>
      <div className="ga-quiz-q">{q.q}</div>
      {timeLimitMs > 0 && (
        <div className="ga-timebar-track">
          <div
            className="ga-timebar-fill"
            style={{ width: `${Math.max(0, timePct)}%` }}
          />
        </div>
      )}
      <div className="ga-quiz-options">
        {q.options.map((opt, i) => {
          let cls = "ga-quiz-opt";
          if (picked !== null) {
            if (i === q.answer) cls += " is-correct";
            else if (i === picked) cls += " is-wrong";
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => choose(i)}
              disabled={picked !== null}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <p className="ga-hint">
        {timeLimitMs > 0
          ? "Answer before the bar runs out."
          : "Take your time — no pressure."}
      </p>
    </div>
  );
}

/* ---------------------------- challenge: rps -------------------------------- */

function RPSGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const counterChance = { easy: 0, medium: 0.25, hard: 0.55 }[difficulty];
  const historyRef = useRef({ rock: 0, paper: 0, scissors: 0 });
  const [playerWins, setPlayerWins] = useState(0);
  const [cpuWins, setCpuWins] = useState(0);
  const [lastRound, setLastRound] = useState(null);
  const [matchOver, setMatchOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  function reset() {
    setPlayerWins(0);
    setCpuWins(0);
    setLastRound(null);
    setMatchOver(false);
    setRoundCount(0);
    historyRef.current = { rock: 0, paper: 0, scissors: 0 };
  }

  function play(choiceId) {
    if (matchOver) return;
    historyRef.current[choiceId] += 1;
    let cpuChoice;
    if (Math.random() < counterChance) {
      const favorite = Object.entries(historyRef.current).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      cpuChoice = { rock: "paper", paper: "scissors", scissors: "rock" }[
        favorite
      ];
    } else {
      cpuChoice = RPS_CHOICES[Math.floor(Math.random() * 3)].id;
    }
    const result = rpsWinner(choiceId, cpuChoice);
    AudioEngine.playSfx(
      result === "p1" ? "score" : result === "p2" ? "hit" : "click",
    );
    let pw = playerWins,
      cw = cpuWins;
    if (result === "p1") pw += 1;
    if (result === "p2") cw += 1;
    setPlayerWins(pw);
    setCpuWins(cw);
    setLastRound({ p: choiceId, c: cpuChoice, result });
    setRoundCount((r) => r + 1);
    if (pw >= 3 || cw >= 3) setMatchOver(true);
  }

  useEffect(() => {
    if (matchOver) {
      const won = playerWins >= 3;
      setStreak((s) => {
        const ns = won ? s + 1 : 0;
        if (won) onFinish(ns);
        return ns;
      });
    }
  }, [matchOver]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>You: {playerWins}</span>
        <span>CPU: {cpuWins}</span>
        <span>Best streak: {best ?? 0}</span>
      </div>
      <div className="ga-rps-arena">
        <div className="ga-rps-side">
          <div key={"p" + roundCount} className="ga-rps-emoji ga-pop-anim">
            {lastRound
              ? RPS_CHOICES.find((c) => c.id === lastRound.p).emoji
              : "❔"}
          </div>
          <span>You</span>
        </div>
        <div className="ga-rps-vs">VS</div>
        <div className="ga-rps-side">
          <div key={"c" + roundCount} className="ga-rps-emoji ga-pop-anim">
            {lastRound
              ? RPS_CHOICES.find((c) => c.id === lastRound.c).emoji
              : "❔"}
          </div>
          <span>CPU</span>
        </div>
      </div>
      <div className="ga-rps-choices">
        {RPS_CHOICES.map((c) => (
          <button
            key={c.id}
            className="ga-rps-btn"
            onClick={() => play(c.id)}
            disabled={matchOver}
          >
            {c.emoji}
          </button>
        ))}
      </div>
      {matchOver && (
        <Overlay
          emoji={playerWins >= 3 ? "🏆" : "🤖"}
          title={playerWins >= 3 ? "You took the match!" : "CPU takes it"}
          statLines={[`Final: ${playerWins} - ${cpuWins}`]}
          onRestart={reset}
          onExit={goHome}
          sound={playerWins >= 3 ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">First to three round wins takes the match.</p>
    </div>
  );
}

/* --------------------------- challenge: pong -------------------------------- */

function PongGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { cpuSpeed, cpuNoise, WIN_SCORE } = {
    easy: { cpuSpeed: 2.0, cpuNoise: 18, WIN_SCORE: 5 },
    medium: { cpuSpeed: 2.6, cpuNoise: 10, WIN_SCORE: 7 },
    hard: { cpuSpeed: 3.4, cpuNoise: 4, WIN_SCORE: 9 },
  }[difficulty];
  const W = 320,
    H = 220,
    PADDLE_H = 50,
    PADDLE_W = 8,
    BALL_R = 6;
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
    return {
      playerY: H / 2 - PADDLE_H / 2,
      cpuY: H / 2 - PADDLE_H / 2,
      ball: freshBall(Math.random() < 0.5 ? 1 : -1),
      particles: [],
      p: 0,
      cpu: 0,
      ended: false,
    };
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
        if (s.ball.y - BALL_R < 0) {
          s.ball.y = BALL_R;
          s.ball.vy *= -1;
        }
        if (s.ball.y + BALL_R > H) {
          s.ball.y = H - BALL_R;
          s.ball.vy *= -1;
        }
        if (
          s.ball.x - BALL_R < 14 + PADDLE_W &&
          s.ball.x - BALL_R > 14 &&
          s.ball.vx < 0
        ) {
          if (s.ball.y > s.playerY && s.ball.y < s.playerY + PADDLE_H) {
            const hitPos =
              (s.ball.y - (s.playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
            s.ball.vx = Math.abs(s.ball.vx) * 1.04;
            s.ball.vy = hitPos * 4;
            s.ball.x = 14 + PADDLE_W + BALL_R;
            spawnBurst(s.particles, s.ball.x, s.ball.y, "#78efd9", 6, "click");
          }
        }
        const cpuX = W - 14 - PADDLE_W;
        if (
          s.ball.x + BALL_R > cpuX &&
          s.ball.x + BALL_R < cpuX + PADDLE_W &&
          s.ball.vx > 0
        ) {
          if (s.ball.y > s.cpuY && s.ball.y < s.cpuY + PADDLE_H) {
            const hitPos =
              (s.ball.y - (s.cpuY + PADDLE_H / 2)) / (PADDLE_H / 2);
            s.ball.vx = -Math.abs(s.ball.vx) * 1.04;
            s.ball.vy = hitPos * 4;
            s.ball.x = cpuX - BALL_R;
            spawnBurst(s.particles, s.ball.x, s.ball.y, "#ff9696", 6, "click");
          }
        }
        if (s.ball.x < -BALL_R) {
          s.cpu += 1;
          setScores({ p: s.p, cpu: s.cpu });
          if (s.cpu >= WIN_SCORE) {
            s.ended = true;
            setOver("cpu");
          } else s.ball = freshBall(1);
        } else if (s.ball.x > W + BALL_R) {
          s.p += 1;
          setScores({ p: s.p, cpu: s.cpu });
          if (s.p >= WIN_SCORE) {
            s.ended = true;
            setOver("player");
          } else s.ball = freshBall(-1);
        }
        const cpuTarget =
          s.ball.y - PADDLE_H / 2 + (Math.random() - 0.5) * cpuNoise;
        if (s.cpuY < cpuTarget) s.cpuY = Math.min(s.cpuY + cpuSpeed, cpuTarget);
        else s.cpuY = Math.max(s.cpuY - cpuSpeed, cpuTarget);
        s.cpuY = Math.max(0, Math.min(H - PADDLE_H, s.cpuY));
      }
      ctx.fillStyle = "#242643";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(14, s.playerY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ff9696";
      ctx.fillRect(W - 14 - PADDLE_W, s.cpuY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ffdc80";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
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
    function onMouseMove(e) {
      setFromClientY(e.clientY);
    }
    function onTouchMove(e) {
      if (e.touches[0]) {
        setFromClientY(e.touches[0].clientY);
        e.preventDefault();
      }
    }
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
      if (e.key === "ArrowUp") {
        e.preventDefault();
        s.playerY = Math.max(0, s.playerY - step);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        s.playerY = Math.min(H - PADDLE_H, s.playerY + step);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) {
      const won = over === "player";
      setStreak((s) => {
        const ns = won ? s + 1 : 0;
        if (won) onFinish(ns);
        return ns;
      });
    }
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>You: {scores.p}</span>
        <span>CPU: {scores.cpu}</span>
        <span>Best streak: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "player" ? "🏆" : "🤖"}
          title={
            over === "player" ? "You win the match!" : "CPU wins the match"
          }
          statLines={[`Final: ${scores.p} - ${scores.cpu}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "player" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">
        Move your mouse (or arrow keys) to control the paddle. First to{" "}
        {WIN_SCORE} wins.
      </p>
    </div>
  );
}

/* ----------------------- challenge: byte hopper (platformer) ----------------------- */

function PlatformerGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, enemySpeedMul } = {
    easy: { startLives: 4, enemySpeedMul: 0.75 },
    medium: { startLives: 3, enemySpeedMul: 1 },
    hard: { startLives: 2, enemySpeedMul: 1.4 },
  }[difficulty];
  const W = 320,
    H = 220;
  const GROUND_Y = 190;
  const GRAVITY = 0.55,
    JUMP_VELOCITY = -9.2,
    MOVE_SPEED = 2.6,
    MAX_FALL = 10;
  const LEVEL_WIDTH = 900;
  const PLAYER_W = 16,
    PLAYER_H = 22;

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
      {
        x: 300,
        y: GROUND_Y - 18,
        w: 18,
        h: 18,
        vx: 0.8 * enemySpeedMul,
        minX: 270,
        maxX: 380,
        alive: true,
      },
      {
        x: 480,
        y: GROUND_Y - 18,
        w: 18,
        h: 18,
        vx: 0.9 * enemySpeedMul,
        minX: 465,
        maxX: 545,
        alive: true,
      },
      {
        x: 680,
        y: GROUND_Y - 18,
        w: 18,
        h: 18,
        vx: 0.7 * enemySpeedMul,
        minX: 630,
        maxX: 800,
        alive: true,
      },
    ];
  }
  function freshCoins() {
    return [
      { x: 60, y: GROUND_Y - 24 },
      { x: 120, y: GROUND_Y - 24 },
      { x: 225, y: 118 },
      { x: 250, y: 118 },
      { x: 300, y: GROUND_Y - 24 },
      { x: 350, y: GROUND_Y - 24 },
      { x: 425, y: 96 },
      { x: 450, y: 96 },
      { x: 500, y: GROUND_Y - 24 },
      { x: 700, y: GROUND_Y - 24 },
      { x: 750, y: GROUND_Y - 24 },
    ].map((c, i) => ({ ...c, id: i, r: 6, collected: false }));
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const jumpQueuedRef = useRef(false);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      player: {
        x: 20,
        y: GROUND_Y - PLAYER_H,
        vx: 0,
        vy: 0,
        grounded: false,
        facing: 1,
      },
      enemies: freshEnemies(),
      coins: freshCoins(),
      particles: [],
      lives: startLives,
      coinsCollected: 0,
      camX: 0,
      ended: false,
    };
  }

  function reset() {
    stateRef.current = freshState();
    setCoinsCollected(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  function respawn(s) {
    s.player.x = 20;
    s.player.y = GROUND_Y - PLAYER_H;
    s.player.vx = 0;
    s.player.vy = 0;
  }

  function hitFlash() {
    setShake(true);
    setTimeout(() => setShake(false), 260);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        p.vx = keysRef.current.left
          ? -MOVE_SPEED
          : keysRef.current.right
            ? MOVE_SPEED
            : 0;
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
        if (jumpQueuedRef.current && p.grounded) {
          p.vy = JUMP_VELOCITY;
          p.grounded = false;
          AudioEngine.playSfx("jump");
        }
        jumpQueuedRef.current = false;
        p.y += p.vy;
        p.grounded = false;
        for (const plat of PLATFORMS) {
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          if (rectsOverlap(pr, plat)) {
            if (p.vy > 0) {
              p.y = plat.y - PLAYER_H;
              p.vy = 0;
              p.grounded = true;
            } else if (p.vy < 0) {
              p.y = plat.y + plat.h;
              p.vy = 0;
            }
          }
        }
        if (p.y > H + 40) {
          s.lives -= 1;
          setLives(s.lives);
          hitFlash();
          if (s.lives <= 0) {
            s.ended = true;
            setOver("lose");
          } else respawn(s);
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
              spawnBurst(
                s.particles,
                e.x + e.w / 2,
                e.y + e.h / 2,
                "#ff9696",
                10,
                "score",
              );
            } else {
              s.lives -= 1;
              setLives(s.lives);
              hitFlash();
              spawnBurst(
                s.particles,
                p.x + PLAYER_W / 2,
                p.y + PLAYER_H / 2,
                "#ff9696",
                12,
                "hit",
              );
              if (s.lives <= 0) {
                s.ended = true;
                setOver("lose");
              } else respawn(s);
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
            spawnBurst(s.particles, c.x, c.y, "#ffdc80", 8, "coin");
          }
        });
        if (!s.ended && p.x + PLAYER_W >= GOAL.x) {
          s.ended = true;
          setOver("win");
          spawnBurst(s.particles, p.x, p.y, "#78efd9", 20, "score");
        }
        s.camX = Math.max(0, Math.min(LEVEL_WIDTH - W, p.x - W / 2));
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#242643";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 20; i++) {
        const dx = (((i * 97 - s2.camX * 0.3) % W) + W) % W;
        ctx.fillRect(dx, 20 + (i % 5) * 30, 2, 2);
      }
      ctx.save();
      ctx.translate(-s2.camX, 0);
      PLATFORMS.forEach((plat) => {
        ctx.fillStyle = plat.y === GROUND_Y ? "#3c3f7d" : "#47497d";
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      });
      ctx.fillStyle = "#a8a6c8";
      ctx.fillRect(GOAL.x, GOAL.y, 3, GOAL.h);
      ctx.fillStyle = "#ff9696";
      ctx.beginPath();
      ctx.moveTo(GOAL.x + 3, GOAL.y);
      ctx.lineTo(GOAL.x + 26, GOAL.y + 9);
      ctx.lineTo(GOAL.x + 3, GOAL.y + 18);
      ctx.fill();
      s2.coins.forEach((c) => {
        if (c.collected) return;
        ctx.fillStyle = "#ffdc80";
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      });
      s2.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = "#ff9696";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "#242643";
        ctx.fillRect(e.x + 3, e.y + 5, 3, 3);
        ctx.fillRect(e.x + e.w - 6, e.y + 5, 3, 3);
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.player.x, s2.player.y, PLAYER_W, PLAYER_H);
      ctx.fillStyle = "#242643";
      const eyeX =
        s2.player.facing === 1 ? s2.player.x + PLAYER_W - 6 : s2.player.x + 3;
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
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if ([" ", "ArrowUp", "w", "W", "Spacebar"].includes(e.key)) {
        jumpQueuedRef.current = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(coinsCollected);
  }, [over]);

  function press(dir, isDown) {
    if (dir === "left") keysRef.current.left = isDown;
    if (dir === "right") keysRef.current.right = isDown;
    if (dir === "jump" && isDown) jumpQueuedRef.current = true;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Bytes: {coinsCollected}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🏁" : "💥"}
          title={over === "win" ? "Reached the server!" : "Out of lives"}
          statLines={[`Bytes collected: ${coinsCollected}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("jump", true)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("jump", true);
          }}
        >
          ⤒
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Arrow keys / A-D to run, Space or Up to jump. Stomp bugs, grab bytes,
        reach the flag.
      </p>
    </div>
  );
}

/* ----------------------- endless: road hopper (frogger-style) ----------------------- */

function RoadHopperGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, baseSpeedMul } = {
    easy: { startLives: 4, baseSpeedMul: 0.75 },
    medium: { startLives: 3, baseSpeedMul: 1 },
    hard: { startLives: 2, baseSpeedMul: 1.3 },
  }[difficulty];
  const W = 300,
    H = 300,
    CELL = 30,
    COLS = 10;
  const START_ROW = 9,
    GOAL_ROW = 0;
  const RIVER_ROWS = [1, 2, 3];
  const ROAD_ROWS = [5, 6, 7, 8];

  function laneConfig(baseSpeedMul) {
    return {
      road: ROAD_ROWS.map((row, i) => ({
        row,
        dir: i % 2 === 0 ? 1 : -1,
        speed: (0.9 + i * 0.35) * baseSpeedMul,
        items: [0, 1, 2].map((k) => ({ x: k * 130 + i * 20, w: 46 })),
      })),
      river: RIVER_ROWS.map((row, i) => ({
        row,
        dir: i % 2 === 0 ? -1 : 1,
        speed: (0.6 + i * 0.25) * baseSpeedMul,
        items: [0, 1].map((k) => ({ x: k * 170 + i * 30, w: 90 })),
      })),
    };
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [crossings, setCrossings] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshPlayer() {
    return { x: Math.floor(COLS / 2) * CELL, row: START_ROW };
  }
  function freshState() {
    return {
      player: freshPlayer(),
      lanes: laneConfig(baseSpeedMul),
      particles: [],
      lives: startLives,
      crossings: 0,
      ended: false,
      mult: baseSpeedMul,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setCrossings(0);
    setLives(startLives);
    setOver(false);
    setShake(false);
  }
  function respawn(s) {
    s.player = freshPlayer();
  }
  function loseLife(s) {
    s.lives -= 1;
    setLives(s.lives);
    spawnBurst(
      s.particles,
      s.player.x + CELL / 2,
      s.player.row * CELL + CELL / 2,
      "#ff9696",
      12,
      "hit",
    );
    setShake(true);
    setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    } else respawn(s);
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
        s.crossings += 1;
        setCrossings(s.crossings);
        spawnBurst(
          s.particles,
          p.x + CELL / 2,
          CELL / 2,
          "#ffdc80",
          16,
          "score",
        );
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
          const hit = roadLane.items.some(
            (it) => p.x + CELL - 6 > it.x && p.x + 6 < it.x + it.w,
          );
          if (hit) loseLife(s);
        }
        const riverLane = s.lanes.river.find((l) => l.row === p.row);
        if (riverLane) {
          const log = riverLane.items.find(
            (it) => p.x + CELL - 4 > it.x && p.x + 4 < it.x + it.w,
          );
          if (log) {
            p.x += riverLane.speed * riverLane.dir;
            if (p.x < -CELL || p.x > W) loseLife(s);
          } else {
            loseLife(s);
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#33875c";
      ctx.fillRect(0, 0, W, CELL);
      ctx.fillStyle = "#334e87";
      RIVER_ROWS.forEach((r) => ctx.fillRect(0, r * CELL, W, CELL));
      ctx.fillStyle = "#33875c";
      ctx.fillRect(0, 4 * CELL, W, CELL);
      ctx.fillStyle = "#3f4151";
      ROAD_ROWS.forEach((r) => ctx.fillRect(0, r * CELL, W, CELL));
      ctx.fillStyle = "#33875c";
      ctx.fillRect(0, START_ROW * CELL, W, CELL);
      ctx.fillStyle = "#966b41";
      s2.lanes.river.forEach((lane) =>
        lane.items.forEach((it) =>
          ctx.fillRect(it.x, lane.row * CELL + 4, it.w, CELL - 8),
        ),
      );
      ctx.fillStyle = "#ff9696";
      s2.lanes.road.forEach((lane) =>
        lane.items.forEach((it) =>
          ctx.fillRect(it.x, lane.row * CELL + 5, it.w, CELL - 10),
        ),
      );
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(
        s2.player.x + 3,
        s2.player.row * CELL + 3,
        CELL - 6,
        CELL - 6,
      );
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKey(e) {
      const map = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) onFinish(crossings);
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Crossings: {crossings}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🐸"
          title="Out of lives"
          statLines={[`Crossings: ${crossings}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => move("up")}>↑</button>
        <div>
          <button onClick={() => move("left")}>←</button>
          <button onClick={() => move("down")}>↓</button>
          <button onClick={() => move("right")}>→</button>
        </div>
      </div>
      <p className="ga-hint">
        Hop lanes with the arrows. Dodge traffic, ride the logs, don't fall in.
      </p>
    </div>
  );
}

/* --------------------------- endless: echo sequence (simon) -------------------------- */

function SimonGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { baseStepTime, minStepTime } = {
    easy: { baseStepTime: 800, minStepTime: 420 },
    medium: { baseStepTime: 650, minStepTime: 320 },
    hard: { baseStepTime: 500, minStepTime: 230 },
  }[difficulty];
  const [sequence, setSequence] = useState([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [active, setActive] = useState(null);
  const [status, setStatus] = useState("idle");
  const [over, setOver] = useState(false);
  const seqRef = useRef([]);
  const timeoutsRef = useRef([]);

  function clearTimers() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  function playback(seq) {
    clearTimers();
    const stepTime = Math.max(minStepTime, baseStepTime - seq.length * 15);
    seq.forEach((color, i) => {
      const t1 = setTimeout(
        () => {
          setActive(color);
          AudioEngine.playNote(SIMON_FREQS[color], (stepTime * 0.55) / 1000);
        },
        i * stepTime + 150,
      );
      const t2 = setTimeout(
        () => setActive(null),
        i * stepTime + stepTime * 0.6,
      );
      timeoutsRef.current.push(t1, t2);
    });
    const tEnd = setTimeout(
      () => setStatus("input"),
      seq.length * stepTime + 150,
    );
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
    setSequence([]);
    setPlayerStep(0);
    setOver(false);
    startRound([]);
  }

  useEffect(() => {
    startRound([]);
    return () => clearTimers();
  }, []);

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

  useEffect(() => {
    if (over) onFinish(Math.max(0, sequence.length - 1));
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Round: {Math.max(0, sequence.length - (status === "over" ? 1 : 0))}
        </span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-simon-grid">
        {SIMON_COLORS.map((c) => (
          <button
            key={c.id}
            className={`ga-simon-pad ${active === c.id ? "is-active" : ""}`}
            style={{
              background: active === c.id ? c.light : c.base,
              opacity: status === "playing" && active !== c.id ? 0.6 : 1,
            }}
            onClick={() => press(c.id)}
            disabled={status !== "input"}
          />
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🎵"
          title="Sequence broken"
          statLines={[`Longest streak: ${Math.max(0, sequence.length - 1)}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Watch the pattern, then repeat it. Each round adds one more step.
      </p>
    </div>
  );
}

/* ------------------------------ endless: pinball ------------------------------------- */

function PinballBackbox({
  score,
  best,
  ballsLeft,
  combo,
  multiball,
  tiltHits,
  tiltLimit,
  over,
  matchNumber,
  matched,
}) {
  return (
    <div className="ga-pinball-backbox">
      <div className="ga-pinball-score">{String(score).padStart(6, "0")}</div>
      <div className="ga-pinball-row">
        <span className="ga-pinball-label">HIGH SCORE</span>
        <span className="ga-pinball-score-small">
          {String(best ?? 0).padStart(6, "0")}
        </span>
      </div>
      <div className="ga-pinball-row">
        <span className="ga-pinball-label">BALL</span>
        <span className="ga-pinball-lights">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`ga-pinball-light ${i < ballsLeft ? "is-lit" : ""}`}
            />
          ))}
        </span>
      </div>
      <div className="ga-pinball-row">
        <span className="ga-pinball-label">
          {multiball ? "MULTIBALL!" : `COMBO x${combo}`}
        </span>
        <span className="ga-pinball-tilt">
          {"●".repeat(tiltHits)}
          {"○".repeat(Math.max(0, tiltLimit - tiltHits))} TILT
        </span>
      </div>
      {over && <div className="ga-pinball-gameover">GAME OVER</div>}
      {over && matchNumber != null && (
        <div className={`ga-pinball-match ${matched ? "is-match" : ""}`}>
          MATCH {String(matchNumber).padStart(2, "0")}
          {matched ? " — FREE GAME!" : ""}
        </div>
      )}
    </div>
  );
}

function PinballGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startBalls, tiltLimit, ballSaveMs } = {
    easy: { startBalls: 5, tiltLimit: 4, ballSaveMs: 7000 },
    medium: { startBalls: 3, tiltLimit: 3, ballSaveMs: 5000 },
    hard: { startBalls: 2, tiltLimit: 2, ballSaveMs: 3000 },
  }[difficulty];
  const W = 320,
    H = 620,
    LANE_W = 40,
    FIELD_W = W - LANE_W,
    BALL_R = 7.5,
    GRAVITY = 0.33,
    LANE_GAP_Y = 70;
  const PLUNGER_REST_Y = H - 40,
    PLUNGER_PULL = 26;
  const FLIPPER_LEN = 52,
    FLIPPER_R = 7.5;
  const CENTER_X = FIELD_W / 2;
  const BUMPERS = [
    { x: CENTER_X - 55, y: 190, r: 19 },
    { x: CENTER_X + 55, y: 190, r: 19 },
    { x: CENTER_X, y: 270, r: 21 },
  ];
  const LEFT_SLING = { x: CENTER_X - 40, y: 470, r: 15 };
  const RIGHT_SLING = { x: CENTER_X + 40, y: 470, r: 15 };
  const OUTLANE_TOP_Y = 440;
  const LEFT_FUNNEL = { x1: 0, y1: OUTLANE_TOP_Y, x2: 62, y2: H };
  const RIGHT_FUNNEL = {
    x1: FIELD_W,
    y1: OUTLANE_TOP_Y,
    x2: FIELD_W - 62,
    y2: H,
  };
  const FUNNEL_INSIDE = { x: CENTER_X, y: 300 };
  const DROP_TARGETS = [
    { x: CENTER_X - 45, y: 110, w: 30, h: 13 },
    { x: CENTER_X - 15, y: 110, w: 30, h: 13 },
    { x: CENTER_X + 15, y: 110, w: 30, h: 13 },
  ];
  const SPINNER = { x: CENTER_X, y: 350, r: 13 };
  const TILT_LIMIT = tiltLimit;
  const BALL_SAVE_MS = ballSaveMs;
  const EXTRA_BALL_SCORES = [800, 2000];
  const FLIPPER_LEFT_PIVOT = { x: CENTER_X - 60, y: H - 80 };
  const FLIPPER_RIGHT_PIVOT = { x: CENTER_X + 60, y: H - 80 };

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const flipRef = useRef({ left: false, right: false });
  const launchRef = useRef({ charging: false, charge: 0 });
  const nudgeCooldownRef = useRef(0);
  const [score, setScore] = useState(0);
  const [ballsLeft, setBallsLeft] = useState(startBalls);
  const [combo, setCombo] = useState(1);
  const [multiball, setMultiball] = useState(false);
  const [tiltHits, setTiltHits] = useState(0);
  const [over, setOver] = useState(false);
  const [matchNumber, setMatchNumber] = useState(null);
  const [matched, setMatched] = useState(false);

  function freshBall(overrides) {
    return {
      x: FIELD_W + LANE_W / 2,
      y: PLUNGER_REST_Y,
      vx: 0,
      vy: 0,
      launched: false,
      enteredField: false,
      ...overrides,
    };
  }
  function freshFlippers() {
    return {
      left: {
        pivotX: FLIPPER_LEFT_PIVOT.x,
        pivotY: FLIPPER_LEFT_PIVOT.y,
        angle: (55 * Math.PI) / 180,
        prevAngle: (55 * Math.PI) / 180,
        restAngle: (55 * Math.PI) / 180,
        activeAngle: (-35 * Math.PI) / 180,
      },
      right: {
        pivotX: FLIPPER_RIGHT_PIVOT.x,
        pivotY: FLIPPER_RIGHT_PIVOT.y,
        angle: (125 * Math.PI) / 180,
        prevAngle: (125 * Math.PI) / 180,
        restAngle: (125 * Math.PI) / 180,
        activeAngle: (215 * Math.PI) / 180,
      },
    };
  }
  function freshDropTargets() {
    return DROP_TARGETS.map((t) => ({ ...t, down: false }));
  }
  function freshState() {
    return {
      balls: [freshBall()],
      flippers: freshFlippers(),
      dropTargets: freshDropTargets(),
      dropResetAt: 0,
      spinnerAngle: 0,
      spinnerCooldown: 0,
      particles: [],
      popups: [],
      score: 0,
      ballsLeft: startBalls,
      combo: 1,
      comboTimer: 0,
      tilt: 0,
      tilted: false,
      ballSaveUntil: 0,
      ballSaveUsed: false,
      extraBallGiven: {},
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    launchRef.current = { charging: false, charge: 0 };
    setScore(0);
    setBallsLeft(startBalls);
    setCombo(1);
    setMultiball(false);
    setTiltHits(0);
    setOver(false);
    setMatchNumber(null);
    setMatched(false);
  }

  function addScore(s, base, x, y, color, label) {
    const gained = Math.round(base * s.combo);
    s.score += gained;
    setScore(s.score);
    spawnPopup(
      s.popups,
      x,
      y,
      `+${gained}${s.combo > 1 ? ` x${s.combo}` : ""}`,
      color,
    );
    label && spawnBurst(s.particles, x, y, color, 8, label);
    s.comboTimer = 90;
    if (s.combo < 4) {
      s.combo = Math.min(4, s.combo + 1);
      setCombo(s.combo);
    }
    EXTRA_BALL_SCORES.forEach((threshold) => {
      if (s.score >= threshold && !s.extraBallGiven[threshold]) {
        s.extraBallGiven[threshold] = true;
        s.ballsLeft += 1;
        setBallsLeft(s.ballsLeft);
        spawnPopup(s.popups, CENTER_X, H / 2, "EXTRA BALL!", "#ffdc80");
        AudioEngine.playSfx("coin");
      }
    });
  }

  function startCharge() {
    const s = stateRef.current;
    const b = s && s.balls[0];
    if (!s || !b || b.launched || s.ended) return;
    launchRef.current.charging = true;
  }
  function releaseCharge() {
    const s = stateRef.current;
    const b = s && s.balls[0];
    if (s && b && launchRef.current.charging && !b.launched) {
      const charge = launchRef.current.charge;
      b.vy = -(20 + charge * 10);
      b.vx = 0;
      b.launched = true;
      s.ballSaveUntil = Date.now() + BALL_SAVE_MS;
      s.ballSaveUsed = false;
      AudioEngine.playSfx("score");
    }
    launchRef.current.charging = false;
    launchRef.current.charge = 0;
  }

  function nudge() {
    const s = stateRef.current;
    if (!s || s.ended || s.tilted) return;
    const now = performance.now();
    if (now - nudgeCooldownRef.current < 350) return;
    nudgeCooldownRef.current = now;
    s.balls.forEach((b) => {
      if (b.launched) {
        b.vx += (Math.random() - 0.5) * 5;
        b.vy -= 1.2;
      }
    });
    s.tilt += 1;
    setTiltHits(s.tilt);
    if (s.tilt >= TILT_LIMIT) {
      s.tilted = true;
      spawnPopup(s.popups, CENTER_X, H / 2, "TILT!", "#ff9696");
      AudioEngine.playSfx("hit");
    } else {
      AudioEngine.playSfx("click");
    }
  }

  function startMultiball(s) {
    s.balls.push(
      freshBall({
        x: CENTER_X,
        y: 120,
        vx: (Math.random() - 0.5) * 3,
        vy: 1,
        launched: true,
        enteredField: true,
      }),
    );
    setMultiball(true);
    spawnPopup(s.popups, CENTER_X, H / 2 - 30, "MULTIBALL!", "#78efd9");
    AudioEngine.playSfx("win");
  }

  function edgeCollide(ball, x1, y1, x2, y2, ix, iy) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t,
      cy = y1 + dy * t;
    let nx = -dy,
      ny = dx;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    if ((ix - cx) * nx + (iy - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const relx = ball.x - cx,
      rely = ball.y - cy;
    const proj = relx * nx + rely * ny;
    if (proj < BALL_R) {
      ball.x = cx + nx * BALL_R;
      ball.y = cy + ny * BALL_R;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.6 * vn * nx;
        ball.vy -= 1.6 * vn * ny;
      }
    }
  }

  function flipperCollide(f, ball, particles, tilted) {
    const tipX = f.pivotX + FLIPPER_LEN * Math.cos(f.angle);
    const tipY = f.pivotY + FLIPPER_LEN * Math.sin(f.angle);
    const abx = tipX - f.pivotX,
      aby = tipY - f.pivotY;
    const lenSq = abx * abx + aby * aby || 1;
    const len = Math.sqrt(lenSq);
    let t = ((ball.x - f.pivotX) * abx + (ball.y - f.pivotY) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = f.pivotX + abx * t,
      cy = f.pivotY + aby * t;
    const dx = ball.x - cx,
      dy = ball.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < BALL_R + FLIPPER_R) {
      const nx = dx / dist,
        ny = dy / dist;
      ball.x = cx + nx * (BALL_R + FLIPPER_R);
      ball.y = cy + ny * (BALL_R + FLIPPER_R);
      if (tilted) {
        ball.vx *= -0.5;
        ball.vy *= -0.5;
        return;
      }
      const angularVel = f.angle - f.prevAngle;
      const dirx = abx / len,
        diry = aby / len;
      const perpx = -diry,
        perpy = dirx;
      const tangential = angularVel * (t * FLIPPER_LEN);
      ball.vx = nx * 2.6 + perpx * tangential * 2.8;
      ball.vy = ny * 2.6 + perpy * tangential * 2.8 - 1.4;
      if (Math.abs(angularVel) > 0.01)
        spawnBurst(particles, cx, cy, "#78efd9", 4);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (launchRef.current.charging)
        launchRef.current.charge = Math.min(
          1,
          launchRef.current.charge + 0.025,
        );
      const plungerBall = s.balls[0];
      if (plungerBall && !plungerBall.launched) {
        plungerBall.y =
          PLUNGER_REST_Y + launchRef.current.charge * PLUNGER_PULL;
      }
      const flippers = s.flippers;
      ["left", "right"].forEach((side) => {
        const f = flippers[side];
        const active = !s.tilted && flipRef.current[side];
        const target = active ? f.activeAngle : f.restAngle;
        f.prevAngle = f.angle;
        f.angle += (target - f.angle) * 0.45;
      });
      if (s.comboTimer > 0) {
        s.comboTimer -= 1;
        if (s.comboTimer === 0 && s.combo !== 1) {
          s.combo = 1;
          setCombo(1);
        }
      }
      if (s.spinnerCooldown > 0) s.spinnerCooldown -= 1;
      if (s.dropResetAt && Date.now() > s.dropResetAt) {
        s.dropTargets.forEach((t) => (t.down = false));
        s.dropResetAt = 0;
      }

      if (!s.ended) {
        for (let i = s.balls.length - 1; i >= 0; i--) {
          const b = s.balls[i];
          if (!b.launched) continue;
          b.vx *= 0.9985;
          b.vy += GRAVITY;
          b.x += b.vx;
          b.y += b.vy;
          if (!b.enteredField && b.y <= LANE_GAP_Y) {
            b.vx = -3;
            b.enteredField = true;
          }
          const inLaneColumn = !b.enteredField && b.x > FIELD_W - 2;
          if (inLaneColumn && b.y > LANE_GAP_Y) {
            if (b.x - BALL_R < FIELD_W) {
              b.x = FIELD_W + BALL_R;
              b.vx *= -0.4;
            }
            if (b.x + BALL_R > W) {
              b.x = W - BALL_R;
              b.vx *= -0.4;
            }
          } else {
            if (b.x - BALL_R < 0) {
              b.x = BALL_R;
              b.vx *= -0.85;
            }
            if (b.y > LANE_GAP_Y && b.x + BALL_R > FIELD_W) {
              b.x = FIELD_W - BALL_R;
              b.vx *= -0.85;
            }
          }
          if (b.y - BALL_R < 0) {
            b.y = BALL_R;
            b.vy *= -0.85;
          }
          if (b.x + BALL_R > W) {
            b.x = W - BALL_R;
            b.vx *= -0.5;
          }

          BUMPERS.forEach((bp) => {
            const dx = b.x - bp.x,
              dy = b.y - bp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < bp.r + BALL_R) {
              const nx = dx / (dist || 1),
                ny = dy / (dist || 1);
              b.x = bp.x + nx * (bp.r + BALL_R);
              b.y = bp.y + ny * (bp.r + BALL_R);
              b.vx = nx * 6.5;
              b.vy = ny * 6.5;
              addScore(s, 10, b.x, b.y, "#ff9696", "score");
            }
          });
          [LEFT_SLING, RIGHT_SLING].forEach((sl) => {
            const dx = b.x - sl.x,
              dy = b.y - sl.y;
            const dist = Math.hypot(dx, dy);
            if (dist < sl.r + BALL_R) {
              const nx = dx / (dist || 1),
                ny = dy / (dist || 1);
              b.x = sl.x + nx * (sl.r + BALL_R);
              b.y = sl.y + ny * (sl.r + BALL_R);
              b.vx = nx * 7;
              b.vy = ny * 7 - 3;
              addScore(s, 20, b.x, b.y, "#bea9ff", "flip");
            }
          });
          s.dropTargets.forEach((t) => {
            if (t.down) return;
            const cx = Math.max(t.x - t.w / 2, Math.min(b.x, t.x + t.w / 2));
            const cy = Math.max(t.y - t.h / 2, Math.min(b.y, t.y + t.h / 2));
            const dx = b.x - cx,
              dy = b.y - cy;
            const dist = Math.hypot(dx, dy);
            if (dist < BALL_R) {
              t.down = true;
              const nx = dx / (dist || 1),
                ny = dy / (dist || 1);
              b.x = cx + nx * BALL_R;
              b.y = cy + ny * BALL_R;
              b.vy = Math.abs(b.vy) * -0.6 - 1;
              b.vx += nx * 2;
              addScore(s, 35, b.x, b.y, "#ffdc80", "hit");
              if (s.dropTargets.every((dt) => dt.down)) {
                addScore(s, 150, CENTER_X, t.y, "#ffdc80", "coin");
                s.dropResetAt = Date.now() + 1400;
                if (s.balls.length === 1) startMultiball(s);
              }
            }
          });
          if (s.spinnerCooldown <= 0) {
            const dx = b.x - SPINNER.x,
              dy = b.y - SPINNER.y;
            if (Math.hypot(dx, dy) < SPINNER.r + BALL_R) {
              s.spinnerAngle += Math.PI * 0.9;
              s.spinnerCooldown = 14;
              addScore(s, 5, SPINNER.x, SPINNER.y - 18, "#8dd1ff", null);
            }
          }
          edgeCollide(
            b,
            LEFT_FUNNEL.x1,
            LEFT_FUNNEL.y1,
            LEFT_FUNNEL.x2,
            LEFT_FUNNEL.y2,
            FUNNEL_INSIDE.x,
            FUNNEL_INSIDE.y,
          );
          edgeCollide(
            b,
            RIGHT_FUNNEL.x1,
            RIGHT_FUNNEL.y1,
            RIGHT_FUNNEL.x2,
            RIGHT_FUNNEL.y2,
            FUNNEL_INSIDE.x,
            FUNNEL_INSIDE.y,
          );
          flipperCollide(flippers.left, b, s.particles, s.tilted);
          flipperCollide(flippers.right, b, s.particles, s.tilted);

          if (b.y - BALL_R > H) {
            s.balls.splice(i, 1);
            if (s.balls.length === 0) {
              if (Date.now() < s.ballSaveUntil && !s.ballSaveUsed) {
                s.ballSaveUsed = true;
                s.balls = [freshBall()];
                spawnPopup(s.popups, CENTER_X, H / 2, "BALL SAVED!", "#78efd9");
                AudioEngine.playSfx("score");
              } else {
                setMultiball(false);
                s.ballsLeft -= 1;
                setBallsLeft(s.ballsLeft);
                s.tilt = 0;
                s.tilted = false;
                setTiltHits(0);
                s.combo = 1;
                setCombo(1);
                s.comboTimer = 0;
                if (s.ballsLeft <= 0) {
                  s.ended = true;
                  setOver(true);
                } else s.balls = [freshBall()];
              }
            } else if (s.balls.length === 1) {
              setMultiball(false);
            }
          }
        }
      }

      const s2 = stateRef.current;
      const fieldGrad = ctx.createLinearGradient(0, 0, 0, H);
      fieldGrad.addColorStop(0, "#282847");
      fieldGrad.addColorStop(1, "#232438");
      ctx.fillStyle = fieldGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#6b563c";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.strokeStyle = "#47497d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(FIELD_W, LANE_GAP_Y);
      ctx.lineTo(FIELD_W, H);
      ctx.stroke();
      ctx.strokeStyle = "#898bbd";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(LEFT_FUNNEL.x1, LEFT_FUNNEL.y1);
      ctx.lineTo(LEFT_FUNNEL.x2, LEFT_FUNNEL.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(RIGHT_FUNNEL.x1, RIGHT_FUNNEL.y1);
      ctx.lineTo(RIGHT_FUNNEL.x2, RIGHT_FUNNEL.y2);
      ctx.stroke();
      if (s2.balls[0] && !s2.balls[0].launched) {
        const chg = launchRef.current.charge;
        ctx.fillStyle = "#3c3f7d";
        ctx.fillRect(FIELD_W + 10, H - 26, LANE_W - 20, 14);
        ctx.fillStyle = "#ffdc80";
        ctx.fillRect(FIELD_W + 10, H - 26, (LANE_W - 20) * chg, 14);
      }
      s2.dropTargets.forEach((t) => {
        ctx.fillStyle = t.down ? "#3f4169" : "#ffdc80";
        ctx.fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
        if (!t.down) {
          ctx.strokeStyle = "#a99764";
          ctx.lineWidth = 2;
          ctx.strokeRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
        }
      });
      ctx.save();
      ctx.translate(SPINNER.x, SPINNER.y);
      ctx.rotate(s2.spinnerAngle);
      ctx.strokeStyle = "#8dd1ff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-SPINNER.r, 0);
      ctx.lineTo(SPINNER.r, 0);
      ctx.stroke();
      ctx.restore();
      BUMPERS.forEach((bp) => {
        const glow = ctx.createRadialGradient(bp.x, bp.y, 2, bp.x, bp.y, bp.r);
        glow.addColorStop(0, "#ffbfbf");
        glow.addColorStop(1, "#ff9696");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#242643";
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      [LEFT_SLING, RIGHT_SLING].forEach((sl) => {
        ctx.fillStyle = "#bea9ff";
        ctx.beginPath();
        ctx.arc(sl.x, sl.y, sl.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ["left", "right"].forEach((side) => {
        const f = s2.flippers[side];
        const tipX = f.pivotX + FLIPPER_LEN * Math.cos(f.angle);
        const tipY = f.pivotY + FLIPPER_LEN * Math.sin(f.angle);
        ctx.strokeStyle = s2.tilted ? "#6b6f9a" : "#78efd9";
        ctx.lineWidth = FLIPPER_R * 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(f.pivotX, f.pivotY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      });
      s2.balls.forEach((b) => {
        const shade = ctx.createRadialGradient(
          b.x - 2.5,
          b.y - 2.5,
          1,
          b.x,
          b.y,
          BALL_R,
        );
        shade.addColorStop(0, "#fff8e0");
        shade.addColorStop(1, "#ffdc80");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
      });
      updateAndDrawParticles(ctx, s2.particles);
      updateAndDrawPopups(ctx, s2.popups);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "z", "Z"].includes(e.key)) {
        if (!flipRef.current.left) AudioEngine.playSfx("flip");
        flipRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "/", "x", "X"].includes(e.key)) {
        if (!flipRef.current.right) AudioEngine.playSfx("flip");
        flipRef.current.right = true;
        e.preventDefault();
      }
      if (["ArrowDown", " ", "Spacebar"].includes(e.key)) {
        startCharge();
        e.preventDefault();
      }
      if (["ArrowUp", "n", "N"].includes(e.key)) {
        nudge();
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "z", "Z"].includes(e.key)) flipRef.current.left = false;
      if (["ArrowRight", "/", "x", "X"].includes(e.key))
        flipRef.current.right = false;
      if (["ArrowDown", " ", "Spacebar"].includes(e.key)) releaseCharge();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) {
      onFinish(score);
      const n = Math.floor(Math.random() * 10) * 10;
      setMatchNumber(n);
      const isMatch = score % 100 === n;
      setMatched(isMatch);
      if (isMatch) AudioEngine.playSfx("win");
    }
  }, [over]);

  function press(side, isDown) {
    if (isDown && !flipRef.current[side]) AudioEngine.playSfx("flip");
    flipRef.current[side] = isDown;
  }

  return (
    <div className="ga-game-col">
      <PinballBackbox
        score={score}
        best={best}
        ballsLeft={ballsLeft}
        combo={combo}
        multiball={multiball}
        tiltHits={tiltHits}
        tiltLimit={TILT_LIMIT}
        over={over}
        matchNumber={matchNumber}
        matched={matched}
      />
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🎯"
          title="Game over"
          statLines={[`Final score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button
          style={{ width: 68, fontSize: 11 }}
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          L FLIP
        </button>
        <button
          style={{ width: 68, fontSize: 11 }}
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onMouseLeave={releaseCharge}
          onTouchStart={(e) => {
            e.preventDefault();
            startCharge();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseCharge();
          }}
        >
          PULL
        </button>
        <button
          style={{ width: 68, fontSize: 11 }}
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          R FLIP
        </button>
        <button style={{ width: 68, fontSize: 11 }} onClick={nudge}>
          NUDGE
        </button>
      </div>
      <p className="ga-hint">
        Hold Down/Space (or PULL) to charge the plunger, release to launch.
        Left/Right arrows or Z/X flip the paddles, Up/N nudges the table (don't
        overdo it, or it's TILT). Clear the three drop targets for a bonus and
        multiball.
      </p>
    </div>
  );
}

/* --------------------------- challenge: wall smasher (breakout) ---------------------- */

function BrickBreakerGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, ballSpeedMul } = {
    easy: { startLives: 4, ballSpeedMul: 0.8 },
    medium: { startLives: 3, ballSpeedMul: 1 },
    hard: { startLives: 2, ballSpeedMul: 1.3 },
  }[difficulty];
  const W = 300,
    H = 360,
    PADDLE_W = 60,
    PADDLE_H = 10,
    BALL_R = 6;
  const ROWS = 4,
    COLS = 6,
    BRICK_W = 42,
    BRICK_H = 16,
    BRICK_GAP = 6,
    BRICK_TOP = 40;
  const BRICK_LEFT = (W - (COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshBricks() {
    const bricks = [];
    const colors = ["#ff9696", "#ffdc80", "#78efd9", "#bea9ff"];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          alive: true,
          color: colors[r % colors.length],
        });
      }
    }
    return bricks;
  }
  function freshBall() {
    return {
      x: W / 2,
      y: H - 40,
      vx: 2.4 * ballSpeedMul * (Math.random() < 0.5 ? 1 : -1),
      vy: -3.2 * ballSpeedMul,
    };
  }
  function freshState() {
    return {
      paddleX: W / 2 - PADDLE_W / 2,
      ball: freshBall(),
      bricks: freshBricks(),
      particles: [],
      lives: startLives,
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const b = s.ball;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x - BALL_R < 0) {
          b.x = BALL_R;
          b.vx *= -1;
        }
        if (b.x + BALL_R > W) {
          b.x = W - BALL_R;
          b.vx *= -1;
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R;
          b.vy *= -1;
        }
        const paddleY = H - 20;
        if (
          b.y + BALL_R > paddleY &&
          b.y + BALL_R < paddleY + PADDLE_H + 8 &&
          b.x > s.paddleX &&
          b.x < s.paddleX + PADDLE_W &&
          b.vy > 0
        ) {
          const hitPos = (b.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
          b.vy = -Math.abs(b.vy);
          b.vx = hitPos * 3.4;
          b.y = paddleY - BALL_R;
        }
        s.bricks.forEach((brick) => {
          if (!brick.alive) return;
          if (
            b.x + BALL_R > brick.x &&
            b.x - BALL_R < brick.x + brick.w &&
            b.y + BALL_R > brick.y &&
            b.y - BALL_R < brick.y + brick.h
          ) {
            brick.alive = false;
            b.vy *= -1;
            s.score += 10;
            setScore(s.score);
            spawnBurst(
              s.particles,
              brick.x + brick.w / 2,
              brick.y + brick.h / 2,
              brick.color,
              10,
              "coin",
            );
          }
        });
        if (s.bricks.every((br) => !br.alive)) {
          s.ended = true;
          setOver("win");
        }
        if (b.y - BALL_R > H) {
          s.lives -= 1;
          setLives(s.lives);
          setShake(true);
          setTimeout(() => setShake(false), 250);
          if (s.lives <= 0) {
            s.ended = true;
            setOver("lose");
          } else s.ball = freshBall();
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#242643";
      ctx.fillRect(0, 0, W, H);
      s2.bricks.forEach((brick) => {
        if (brick.alive) {
          ctx.fillStyle = brick.color;
          ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        }
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.paddleX, H - 20, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#ffdc80";
      ctx.beginPath();
      ctx.arc(s2.ball.x, s2.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
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
    function onMouseMove(e) {
      setFromClientX(e.clientX);
    }
    function onTouchMove(e) {
      if (e.touches[0]) {
        setFromClientX(e.touches[0].clientX);
        e.preventDefault();
      }
    }
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
      const step = 20;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        s.paddleX = Math.max(0, s.paddleX - step);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        s.paddleX = Math.min(W - PADDLE_W, s.paddleX + step);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🧱" : "💥"}
          title={over === "win" ? "Wall cleared!" : "Out of lives"}
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">
        Move your mouse (or arrow keys) to steer the paddle. Clear every brick.
      </p>
    </div>
  );
}

/* -------------------------- challenge: grid sweeper (minesweeper) -------------------- */

function MinesweeperGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const SIZE = 8,
    MINES = { easy: 6, medium: 10, hard: 15 }[difficulty];

  function buildBoard(firstSafeIdx) {
    const total = SIZE * SIZE;
    const mineSet = new Set();
    while (mineSet.size < MINES) {
      const idx = Math.floor(Math.random() * total);
      if (idx !== firstSafeIdx) mineSet.add(idx);
    }
    const cells = Array.from({ length: total }, (_, i) => ({
      idx: i,
      mine: mineSet.has(i),
      revealed: false,
      flagged: false,
      count: 0,
    }));
    function neighbors(i) {
      const r = Math.floor(i / SIZE),
        c = i % SIZE,
        out = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE)
            out.push(nr * SIZE + nc);
        }
      return out;
    }
    cells.forEach((cell) => {
      if (!cell.mine)
        cell.count = neighbors(cell.idx).filter((n) => cells[n].mine).length;
    });
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
      if (cell.count === 0 && !cell.mine)
        neighbors(i).forEach((n) => {
          if (!cells[n].revealed) stack.push(n);
        });
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
      cells.forEach((c) => {
        if (c.mine) c.revealed = true;
      });
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
    if (status === "won")
      setWins((w) => {
        const nw = w + 1;
        onFinish(nw);
        return nw;
      });
  }, [status]);

  const numColors = [
    "",
    "#8dd1ff",
    "#78efd9",
    "#ffdc80",
    "#ffb381",
    "#ff9696",
    "#ffa9cc",
    "#bea9ff",
    "#a8a6c8",
  ];

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Mines left: {MINES - flagsUsed}</span>
        <span>Wins this session: {wins}</span>
        <span>Best: {best ?? 0}</span>
      </div>
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
                {c.mine ? (
                  "💣"
                ) : c.count > 0 ? (
                  <span style={{ color: numColors[c.count] }}>{c.count}</span>
                ) : (
                  ""
                )}
              </span>
            ) : c.flagged ? (
              <span key={c.idx + "-flag"} className="ga-pop-anim">
                🚩
              </span>
            ) : (
              ""
            )}
          </button>
        ))}
      </div>
      {status !== "playing" && (
        <Overlay
          emoji={status === "won" ? "🏆" : "💣"}
          title={status === "won" ? "Board cleared!" : "Boom!"}
          statLines={[
            status === "won" ? "No mines left standing." : "Hit a mine.",
          ]}
          onRestart={reset}
          onExit={goHome}
          sound={status === "won" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">
        Click to reveal, right-click (or long-press) to flag a suspected mine.
      </p>
    </div>
  );
}

/* ------------------------------ endless: block blast ---------------------- */

const BLOCK_SHAPES = [
  { cells: [[0, 0]] },
  {
    cells: [
      [0, 0],
      [0, 1],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  {
    cells: [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
  },
  {
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  },
  {
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
  },
  {
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
  },
];
const BLOCK_COLORS = [
  "#ff5fa2",
  "#ff9f43",
  "#ffd93d",
  "#4ecb71",
  "#22d3c0",
  "#4fa8ff",
  "#a66bff",
];

function PiecePreview({ shape, color }) {
  const maxR = Math.max(...shape.cells.map(([r]) => r)) + 1;
  const maxC = Math.max(...shape.cells.map(([, c]) => c)) + 1;
  const filled = new Set(shape.cells.map(([r, c]) => `${r}-${c}`));
  return (
    <div
      className="ga-blockblast-piece"
      style={{
        gridTemplateColumns: `repeat(${maxC}, 1fr)`,
        gridTemplateRows: `repeat(${maxR}, 1fr)`,
      }}
    >
      {Array.from({ length: maxR }).flatMap((_, r) =>
        Array.from({ length: maxC }).map((_, c) => (
          <span
            key={`${r}-${c}`}
            className="ga-blockblast-piece-cell"
            style={{
              background: filled.has(`${r}-${c}`) ? color : "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}

function BlockBlastGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const SIZE = 8;

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function randomPiece() {
    const roll = Math.random();
    let pool = BLOCK_SHAPES;
    if (difficulty === "easy")
      pool =
        roll < 0.65
          ? BLOCK_SHAPES.filter((s) => s.cells.length <= 3)
          : BLOCK_SHAPES;
    else if (difficulty === "hard")
      pool =
        roll < 0.6
          ? BLOCK_SHAPES.filter((s) => s.cells.length >= 4)
          : BLOCK_SHAPES;
    const shape = pool[Math.floor(Math.random() * pool.length)];
    const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    return { shape, color, key: Math.random() };
  }
  function freshTray() {
    return [randomPiece(), randomPiece(), randomPiece()];
  }

  const [board, setBoard] = useState(emptyBoard);
  const [tray, setTray] = useState(freshTray);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);
  const comboRef = useRef(0);

  function reset() {
    setBoard(emptyBoard());
    setTray(freshTray());
    setSelected(null);
    setHover(null);
    setScore(0);
    setCombo(0);
    setOver(false);
    setShake(false);
    comboRef.current = 0;
  }

  function fits(shape, r0, c0, bd) {
    return shape.cells.every(([dr, dc]) => {
      const r = r0 + dr,
        c = c0 + dc;
      return r >= 0 && r < SIZE && c >= 0 && c < SIZE && !bd[r][c];
    });
  }

  function canPlaceAnywhere(shape, bd) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (fits(shape, r, c, bd)) return true;
    return false;
  }

  function selectPiece(idx) {
    if (over || !tray[idx]) return;
    AudioEngine.playSfx("click");
    setSelected((s) => (s === idx ? null : idx));
  }

  function placeAt(r0, c0) {
    if (over || selected === null) return;
    const piece = tray[selected];
    if (!piece || !fits(piece.shape, r0, c0, board)) {
      AudioEngine.playSfx("hit");
      return;
    }
    const nextBoard = board.map((row) => [...row]);
    piece.shape.cells.forEach(([dr, dc]) => {
      nextBoard[r0 + dr][c0 + dc] = piece.color;
    });

    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < SIZE; r++)
      if (nextBoard[r].every(Boolean)) fullRows.push(r);
    for (let c = 0; c < SIZE; c++)
      if (nextBoard.every((row) => row[c])) fullCols.push(c);
    const linesCleared = fullRows.length + fullCols.length;
    fullRows.forEach((r) => {
      for (let c = 0; c < SIZE; c++) nextBoard[r][c] = null;
    });
    fullCols.forEach((c) => {
      for (let r = 0; r < SIZE; r++) nextBoard[r][c] = null;
    });

    let gained = piece.shape.cells.length;
    if (linesCleared > 0) {
      comboRef.current += 1;
      gained += linesCleared * 10 * Math.min(5, comboRef.current);
      AudioEngine.playSfx("coin");
    } else {
      comboRef.current = 0;
      AudioEngine.playSfx("score");
    }
    setCombo(comboRef.current);

    let nextTray = tray.map((p, i) => (i === selected ? null : p));
    if (nextTray.every((p) => !p)) nextTray = freshTray();

    setBoard(nextBoard);
    setTray(nextTray);
    setSelected(null);
    setHover(null);
    setScore((s) => s + gained);

    const live = nextTray.filter(Boolean);
    if (
      live.length &&
      !live.some((p) => canPlaceAnywhere(p.shape, nextBoard))
    ) {
      setOver(true);
      setShake(true);
      setTimeout(() => setShake(false), 280);
    }
  }

  useEffect(() => {
    if (over) onFinish(score);
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        {combo > 1 && <span>Combo x{Math.min(5, combo)}</span>}
        <span>Best: {best ?? 0}</span>
      </div>
      <div
        className={`ga-blockblast-board ${shake ? "ga-shake" : ""}`}
        onMouseLeave={() => setHover(null)}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            let cls = "ga-blockblast-cell";
            const style = {};
            if (cell) {
              cls += " is-filled";
              style.background = cell;
            } else if (selected !== null && hover && tray[selected]) {
              const piece = tray[selected];
              const within = piece.shape.cells.some(
                ([dr, dc]) => hover.r + dr === r && hover.c + dc === c,
              );
              if (within)
                cls += fits(piece.shape, hover.r, hover.c, board)
                  ? " is-preview-valid"
                  : " is-preview-invalid";
            }
            return (
              <button
                key={`${r}-${c}`}
                className={cls}
                style={style}
                onMouseEnter={() => selected !== null && setHover({ r, c })}
                onClick={() => placeAt(r, c)}
              />
            );
          }),
        )}
      </div>
      <div className="ga-blockblast-tray">
        {tray.map((p, i) => (
          <button
            key={i}
            className={`ga-blockblast-slot ${selected === i ? "is-selected" : ""} ${!p ? "is-empty" : ""}`}
            onClick={() => selectPiece(i)}
            disabled={!p}
          >
            {p && <PiecePreview shape={p.shape} color={p.color} />}
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🧱"
          title="Board's full!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap a piece, then tap the board to drop it. Fill a row or column to
        clear it.
      </p>
    </div>
  );
}

/* --------------------------- challenge: dot muncher (pac-man style) --------------------------- */

const MAZE_ROWS = [
  "###############",
  "#...#.....#...#",
  "#.#.#.###.#.#.#",
  "#.............#",
  "#.###.#.#.###.#",
  "#.....#.#.....#",
  "###.#.....#.###",
  "#.....#.#.....#",
  "#.###.#.#.###.#",
  "#.............#",
  "#.#.#.###.#.#.#",
  "#...#.....#...#",
  "###############",
];
const MAZE_COLS = MAZE_ROWS[0].length;
const MAZE_ROWCOUNT = MAZE_ROWS.length;

function mazeOpen(r, c) {
  if (r < 0 || r >= MAZE_ROWCOUNT || c < 0 || c >= MAZE_COLS) return false;
  return MAZE_ROWS[r][c] !== "#";
}

function MazeMuncherGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, ghostMs } = {
    easy: { startLives: 4, ghostMs: 480 },
    medium: { startLives: 3, ghostMs: 380 },
    hard: { startLives: 2, ghostMs: 300 },
  }[difficulty];
  const CELL = 20;
  const W = MAZE_COLS * CELL,
    H = MAZE_ROWCOUNT * CELL;
  const START = { r: 9, c: 7 };
  const GHOST_START = [
    { r: 6, c: 5, color: "#ff9696" },
    { r: 6, c: 7, color: "#ffdc80" },
    { r: 6, c: 9, color: "#bea9ff" },
  ];
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshDots() {
    const grid = [];
    let total = 0;
    for (let r = 0; r < MAZE_ROWCOUNT; r++) {
      const row = [];
      for (let c = 0; c < MAZE_COLS; c++) {
        const open = MAZE_ROWS[r][c] !== "#";
        row.push(open);
        if (open) total += 1;
      }
      grid.push(row);
    }
    return { grid, total };
  }

  function freshState() {
    const { grid, total } = freshDots();
    return {
      player: { r: START.r, c: START.c, facing: "right" },
      dots: grid,
      dotsLeft: total,
      ghosts: GHOST_START.map((g) => ({ ...g, timer: 0 })),
      particles: [],
      lives: startLives,
      score: 0,
      ended: false,
    };
  }

  function reset() {
    const s = freshState();
    if (s.dots[s.player.r][s.player.c]) {
      s.dots[s.player.r][s.player.c] = false;
      s.dotsLeft -= 1;
    }
    stateRef.current = s;
    setScore(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }

  function move(dir) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const [dr, dc] = DIRS[dir];
    const nr = s.player.r + dr,
      nc = s.player.c + dc;
    if (!mazeOpen(nr, nc)) return;
    s.player.r = nr;
    s.player.c = nc;
    s.player.facing = dir;
    if (s.dots[nr][nc]) {
      s.dots[nr][nc] = false;
      s.dotsLeft -= 1;
      s.score += 1;
      setScore(s.score);
      AudioEngine.playSfx("coin");
      if (s.dotsLeft <= 0) {
        s.ended = true;
        setOver("win");
      }
    }
  }

  function loseLife(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    spawnBurst(
      s.particles,
      s.player.c * CELL + CELL / 2,
      s.player.r * CELL + CELL / 2,
      "#ff9696",
      12,
      "hit",
    );
    if (s.lives <= 0) {
      s.ended = true;
      setOver("lose");
    } else {
      s.player.r = START.r;
      s.player.c = START.c;
      s.ghosts.forEach((g, i) => {
        g.r = GHOST_START[i].r;
        g.c = GHOST_START[i].c;
      });
    }
  }

  useEffect(() => {
    reset();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      if (!s.ended) {
        s.ghosts.forEach((g) => {
          g.timer += dt;
          if (g.timer >= ghostMs) {
            g.timer = 0;
            const options = Object.entries(DIRS).filter(([, [dr, dc]]) =>
              mazeOpen(g.r + dr, g.c + dc),
            );
            if (options.length) {
              let pick;
              if (Math.random() < 0.35) {
                pick = options[Math.floor(Math.random() * options.length)];
              } else {
                pick = options.reduce((best, cur) => {
                  const br = g.r + best[1][0],
                    bc = g.c + best[1][1];
                  const cr = g.r + cur[1][0],
                    cc = g.c + cur[1][1];
                  const bd =
                    Math.abs(br - s.player.r) + Math.abs(bc - s.player.c);
                  const cd =
                    Math.abs(cr - s.player.r) + Math.abs(cc - s.player.c);
                  return cd < bd ? cur : best;
                });
              }
              g.r += pick[1][0];
              g.c += pick[1][1];
            }
          }
          if (g.r === s.player.r && g.c === s.player.c) loseLife(s);
        });
      }
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "#14152a";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2b2e57";
      for (let r = 0; r < MAZE_ROWCOUNT; r++) {
        for (let c = 0; c < MAZE_COLS; c++) {
          if (MAZE_ROWS[r][c] === "#") {
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          }
        }
      }
      ctx.fillStyle = "#ffdc80";
      for (let r = 0; r < MAZE_ROWCOUNT; r++) {
        for (let c = 0; c < MAZE_COLS; c++) {
          if (s.dots[r][c]) {
            ctx.beginPath();
            ctx.arc(
              c * CELL + CELL / 2,
              r * CELL + CELL / 2,
              2.5,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }
      s.ghosts.forEach((g) => {
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(
          g.c * CELL + CELL / 2,
          g.r * CELL + CELL / 2,
          CELL / 2 - 2,
          Math.PI,
          0,
        );
        ctx.lineTo(g.c * CELL + CELL - 2, g.r * CELL + CELL - 2);
        ctx.lineTo(g.c * CELL + 2, g.r * CELL + CELL - 2);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = "#ffe066";
      const px = s.player.c * CELL + CELL / 2,
        py = s.player.r * CELL + CELL / 2;
      const angles = {
        right: [0.25, 1.75],
        left: [1.25, 0.75],
        up: [1.75, 1.25],
        down: [0.75, 0.25],
      };
      const [a1, a2] = angles[s.player.facing];
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, CELL / 2 - 2, a1 * Math.PI, a2 * Math.PI);
      ctx.closePath();
      ctx.fill();
      updateAndDrawParticles(ctx, s.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKey(e) {
      const map = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Dots: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "👻" : "💥"}
          title={over === "win" ? "Maze cleared!" : "Caught!"}
          statLines={[`Dots eaten: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => move("up")}>↑</button>
        <div>
          <button onClick={() => move("left")}>←</button>
          <button onClick={() => move("down")}>↓</button>
          <button onClick={() => move("right")}>→</button>
        </div>
      </div>
      <p className="ga-hint">
        Arrow keys to move. Eat every dot, don't let the ghosts catch you.
      </p>
    </div>
  );
}
/* --------------------------- endless: sky barrage (galaga/1942 style) --------------------------- */

function SkyBarrageGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, spawnMs, speedMul } = {
    easy: { startLives: 4, spawnMs: 950, speedMul: 0.8 },
    medium: { startLives: 3, spawnMs: 750, speedMul: 1 },
    hard: { startLives: 2, spawnMs: 560, speedMul: 1.3 },
  }[difficulty];
  const W = 300,
    H = 340;
  const PLAYER_Y = H - 30,
    PLAYER_W = 22,
    PLAYER_H = 16;
  const BULLET_SPEED = 5.2;
  const GUN_LEVELS = [
    { cooldown: 220, shots: [{ dx: 0, angle: 0 }] },
    { cooldown: 195, shots: [{ dx: -6, angle: 0 }, { dx: 6, angle: 0 }] },
    {
      cooldown: 165,
      shots: [
        { dx: -7, angle: -0.14 },
        { dx: 0, angle: 0 },
        { dx: 7, angle: 0.14 },
      ],
    },
    {
      cooldown: 125,
      shots: [
        { dx: -8, angle: -0.22 },
        { dx: -3, angle: 0 },
        { dx: 3, angle: 0 },
        { dx: 8, angle: 0.22 },
      ],
    },
  ];
  const MAX_GUN_LEVEL = GUN_LEVELS.length;
  const POWERUP_INTERVAL = 13000;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [gunLevel, setGunLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      playerX: W / 2 - PLAYER_W / 2,
      bullets: [],
      enemies: [],
      powerup: null,
      particles: [],
      lives: startLives,
      score: 0,
      gunLevel: 1,
      spawnTimer: 0,
      fireTimer: 0,
      powerupTimer: POWERUP_INTERVAL,
      elapsed: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setGunLevel(1);
    setOver(false);
    setShake(false);
  }

  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const rampSpeed = speedMul * (1 + Math.min(1.2, s.elapsed / 40000));
        if (keysRef.current.left) s.playerX = Math.max(0, s.playerX - 3.4);
        if (keysRef.current.right)
          s.playerX = Math.min(W - PLAYER_W, s.playerX + 3.4);
        s.fireTimer -= dt;
        if (s.fireTimer <= 0) {
          const level = GUN_LEVELS[s.gunLevel - 1];
          level.shots.forEach((shot) => {
            s.bullets.push({
              x: s.playerX + PLAYER_W / 2 - 2 + shot.dx,
              y: PLAYER_Y,
              vx: Math.sin(shot.angle) * BULLET_SPEED,
              vy: -Math.cos(shot.angle) * BULLET_SPEED,
            });
          });
          s.fireTimer = level.cooldown;
          AudioEngine.playSfx("select");
        }
        s.powerupTimer -= dt;
        if (s.powerupTimer <= 0) {
          s.powerupTimer = POWERUP_INTERVAL;
          if (s.gunLevel < MAX_GUN_LEVEL && !s.powerup) {
            s.powerup = {
              x: 16 + Math.random() * (W - 32),
              y: -14,
              vy: 1.3,
            };
          }
        }
        if (s.powerup) {
          s.powerup.y += s.powerup.vy;
          if (s.powerup.y > H + 14) s.powerup = null;
        }
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / rampSpeed;
          s.enemies.push({
            x: 16 + Math.random() * (W - 48),
            y: -16,
            w: 20,
            h: 16,
            vy: (1 + Math.random() * 0.6) * rampSpeed,
            phase: Math.random() * Math.PI * 2,
          });
        }
        s.bullets.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
        });
        s.bullets = s.bullets.filter((b) => b.y > -10);
        s.enemies.forEach((e) => {
          e.y += e.vy;
          e.x += Math.sin(e.phase + e.y * 0.05) * 0.6;
        });
        for (const e of s.enemies) {
          for (const b of s.bullets) {
            if (
              !e.dead &&
              b.x < e.x + e.w &&
              b.x + 4 > e.x &&
              b.y < e.y + e.h &&
              b.y + 8 > e.y
            ) {
              e.dead = true;
              b.dead = true;
              s.score += 1;
              setScore(s.score);
              spawnBurst(
                s.particles,
                e.x + e.w / 2,
                e.y + e.h / 2,
                "#ffdc80",
                10,
                "score",
              );
            }
          }
        }
        s.bullets = s.bullets.filter((b) => !b.dead);
        const pr = { x: s.playerX, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
        s.enemies.forEach((e) => {
          if (e.dead) return;
          if (
            pr.x < e.x + e.w &&
            pr.x + pr.w > e.x &&
            pr.y < e.y + e.h &&
            pr.y + pr.h > e.y
          ) {
            e.dead = true;
            spawnBurst(
              s.particles,
              e.x + e.w / 2,
              e.y + e.h / 2,
              "#ff9696",
              12,
              "hit",
            );
            hit(s);
          }
        });
        s.enemies.forEach((e) => {
          if (!e.dead && e.y > H) e.dead = true;
        });
        s.enemies = s.enemies.filter((e) => !e.dead);
        if (
          s.powerup &&
          pr.x < s.powerup.x + 10 &&
          pr.x + pr.w > s.powerup.x - 10 &&
          pr.y < s.powerup.y + 10 &&
          pr.y + pr.h > s.powerup.y - 10
        ) {
          s.gunLevel = Math.min(MAX_GUN_LEVEL, s.gunLevel + 1);
          setGunLevel(s.gunLevel);
          spawnBurst(s.particles, s.powerup.x, s.powerup.y, "#ffdc80", 16, "score");
          AudioEngine.playSfx("win");
          s.powerup = null;
        }
      }
      ctx.fillStyle = "#0e1230";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 53) % W;
        const sy = (i * 97 + s.elapsed * 0.05) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.fillStyle = "#ff9696";
      s.enemies.forEach((e) => {
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y);
        ctx.lineTo(e.x + e.w, e.y + e.h);
        ctx.lineTo(e.x, e.y + e.h);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = "#ffdc80";
      s.bullets.forEach((b) => ctx.fillRect(b.x, b.y - 8, 4, 8));
      if (s.powerup) {
        ctx.fillStyle = "#ffdc80";
        ctx.beginPath();
        ctx.arc(s.powerup.x, s.powerup.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0e1230";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("P", s.powerup.x, s.powerup.y + 3);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#78efd9";
      ctx.beginPath();
      ctx.moveTo(s.playerX + PLAYER_W / 2, PLAYER_Y);
      ctx.lineTo(s.playerX + PLAYER_W, PLAYER_Y + PLAYER_H);
      ctx.lineTo(s.playerX, PLAYER_Y + PLAYER_H);
      ctx.closePath();
      ctx.fill();
      updateAndDrawParticles(ctx, s.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Gun Lv.{gunLevel}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🚀"
          title="Squadron down"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Your gun fires automatically — just dodge with the arrows. Grab the
        gold pickups to power up your gun.
      </p>
    </div>
  );
}
/* --------------------------- endless: byte raider (contra style run-and-gun) --------------------------- */

function ByteRaiderGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, spawnMs, speedMul } = {
    easy: { startLives: 4, spawnMs: 900, speedMul: 0.8 },
    medium: { startLives: 3, spawnMs: 700, speedMul: 1 },
    hard: { startLives: 2, spawnMs: 520, speedMul: 1.3 },
  }[difficulty];
  const W = 320,
    H = 200;
  const PLAYER_W = 18,
    PLAYER_H = 16;
  const BULLET_SPEED = 5.6;
  const GUN_LEVELS = [
    { cooldown: 200, shots: [{ dy: 0, angle: 0 }] },
    { cooldown: 175, shots: [{ dy: -5, angle: 0 }, { dy: 5, angle: 0 }] },
    {
      cooldown: 150,
      shots: [
        { dy: -6, angle: -0.14 },
        { dy: 0, angle: 0 },
        { dy: 6, angle: 0.14 },
      ],
    },
    {
      cooldown: 115,
      shots: [
        { dy: -7, angle: -0.22 },
        { dy: -2, angle: 0 },
        { dy: 2, angle: 0 },
        { dy: 7, angle: 0.22 },
      ],
    },
  ];
  const MAX_GUN_LEVEL = GUN_LEVELS.length;
  const POWERUP_INTERVAL = 13000;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [gunLevel, setGunLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      player: { x: 30, y: H / 2 - PLAYER_H / 2 },
      bullets: [],
      enemies: [],
      powerup: null,
      particles: [],
      lives: startLives,
      score: 0,
      gunLevel: 1,
      spawnTimer: 0,
      fireTimer: 0,
      powerupTimer: POWERUP_INTERVAL,
      elapsed: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setGunLevel(1);
    setOver(false);
    setShake(false);
  }
  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const ramp = speedMul * (1 + Math.min(1.3, s.elapsed / 35000));
        const p = s.player;
        if (keysRef.current.up) p.y = Math.max(0, p.y - 3);
        if (keysRef.current.down) p.y = Math.min(H - PLAYER_H, p.y + 3);
        if (keysRef.current.left) p.x = Math.max(0, p.x - 2.6);
        if (keysRef.current.right) p.x = Math.min(W / 2, p.x + 2.6);
        s.fireTimer -= dt;
        if (s.fireTimer <= 0) {
          const level = GUN_LEVELS[s.gunLevel - 1];
          level.shots.forEach((shot) => {
            s.bullets.push({
              x: p.x + PLAYER_W,
              y: p.y + PLAYER_H / 2 - 2 + shot.dy,
              vx: Math.cos(shot.angle) * BULLET_SPEED,
              vy: Math.sin(shot.angle) * BULLET_SPEED,
            });
          });
          s.fireTimer = level.cooldown;
          AudioEngine.playSfx("select");
        }
        s.powerupTimer -= dt;
        if (s.powerupTimer <= 0) {
          s.powerupTimer = POWERUP_INTERVAL;
          if (s.gunLevel < MAX_GUN_LEVEL && !s.powerup) {
            s.powerup = {
              x: W + 10,
              y: 10 + Math.random() * (H - 30),
              vx: -1.4,
            };
          }
        }
        if (s.powerup) {
          s.powerup.x += s.powerup.vx;
          if (s.powerup.x < -14) s.powerup = null;
        }
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / ramp;
          s.enemies.push({
            x: W + 10,
            y: 10 + Math.random() * (H - 30),
            w: 18,
            h: 16,
            vx: -(1 + Math.random() * 0.7) * ramp,
            wob: Math.random() * Math.PI * 2,
          });
        }
        s.bullets.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
        });
        s.bullets = s.bullets.filter((b) => b.x < W + 10);
        s.enemies.forEach((e) => {
          e.x += e.vx;
          e.y += Math.sin(e.wob + e.x * 0.05) * 0.5;
        });
        for (const e of s.enemies) {
          for (const b of s.bullets) {
            if (
              !e.dead &&
              b.x < e.x + e.w &&
              b.x + 6 > e.x &&
              b.y < e.y + e.h &&
              b.y + 3 > e.y
            ) {
              e.dead = true;
              b.dead = true;
              s.score += 1;
              setScore(s.score);
              spawnBurst(
                s.particles,
                e.x + e.w / 2,
                e.y + e.h / 2,
                "#ffdc80",
                10,
                "score",
              );
            }
          }
        }
        s.bullets = s.bullets.filter((b) => !b.dead);
        const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
        s.enemies.forEach((e) => {
          if (e.dead) return;
          if (
            pr.x < e.x + e.w &&
            pr.x + pr.w > e.x &&
            pr.y < e.y + e.h &&
            pr.y + pr.h > e.y
          ) {
            e.dead = true;
            spawnBurst(
              s.particles,
              e.x + e.w / 2,
              e.y + e.h / 2,
              "#ff9696",
              12,
              "hit",
            );
            hit(s);
          }
        });
        s.enemies = s.enemies.filter((e) => !e.dead && e.x > -30);
        if (
          s.powerup &&
          pr.x < s.powerup.x + 10 &&
          pr.x + pr.w > s.powerup.x - 10 &&
          pr.y < s.powerup.y + 10 &&
          pr.y + pr.h > s.powerup.y - 10
        ) {
          s.gunLevel = Math.min(MAX_GUN_LEVEL, s.gunLevel + 1);
          setGunLevel(s.gunLevel);
          spawnBurst(s.particles, s.powerup.x, s.powerup.y, "#ffdc80", 16, "score");
          AudioEngine.playSfx("win");
          s.powerup = null;
        }
      }
      ctx.fillStyle = "#1c2417";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(180,235,148,0.15)";
      for (let i = 0; i < 6; i++) ctx.fillRect(0, i * (H / 6), W, 2);
      ctx.fillStyle = "#ff9696";
      s.enemies.forEach((e) => ctx.fillRect(e.x, e.y, e.w, e.h));
      ctx.fillStyle = "#ffdc80";
      s.bullets.forEach((b) => ctx.fillRect(b.x, b.y, 8, 3));
      if (s.powerup) {
        ctx.fillStyle = "#ffdc80";
        ctx.beginPath();
        ctx.arc(s.powerup.x, s.powerup.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1c2417";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("P", s.powerup.x, s.powerup.y + 3);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s.player.x, s.player.y, PLAYER_W, PLAYER_H);
      updateAndDrawParticles(ctx, s.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const map = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    function onKeyDown(e) {
      if (map[e.key]) {
        keysRef.current[map[e.key]] = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (map[e.key]) keysRef.current[map[e.key]] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Gun Lv.{gunLevel}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="💥"
          title="Down!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad">
        <button
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
          onMouseLeave={() => press("up", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("up", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("up", false);
          }}
        >
          ↑
        </button>
        <div>
          <button
            onMouseDown={() => press("left", true)}
            onMouseUp={() => press("left", false)}
            onMouseLeave={() => press("left", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("left", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("left", false);
            }}
          >
            ←
          </button>
          <button
            onMouseDown={() => press("down", true)}
            onMouseUp={() => press("down", false)}
            onMouseLeave={() => press("down", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("down", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("down", false);
            }}
          >
            ↓
          </button>
          <button
            onMouseDown={() => press("right", true)}
            onMouseUp={() => press("right", false)}
            onMouseLeave={() => press("right", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("right", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("right", false);
            }}
          >
            →
          </button>
        </div>
      </div>
      <p className="ga-hint">
        Arrows / WASD to move. Your gun fires automatically — grab the gold
        pickups to power it up.
      </p>
    </div>
  );
}
/* --------------------------- challenge: barrel climb (donkey kong style) --------------------------- */

function BarrelClimbGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, spawnMs, barrelSpeed } = {
    easy: { startLives: 4, spawnMs: 2200, barrelSpeed: 1.1 },
    medium: { startLives: 3, spawnMs: 1700, barrelSpeed: 1.4 },
    hard: { startLives: 2, spawnMs: 1300, barrelSpeed: 1.8 },
  }[difficulty];
  const W = 280,
    H = 210;
  const ROWS_Y = [180, 130, 80, 30];
  const LADDER_X = [40, 210, 40];
  const PLAYER_W = 14,
    PLAYER_H = 18;
  const CLIMB_SPEED = 1.6;
  const MOVE_SPEED = 2.2;
  const TOP_ROW = ROWS_Y.length - 1;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const [climbs, setClimbs] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshPlayer() {
    return { x: 10, y: ROWS_Y[0], row: 0, climbing: false, targetRow: 0 };
  }
  function freshState() {
    return {
      player: freshPlayer(),
      barrels: [],
      particles: [],
      lives: startLives,
      climbs: 0,
      spawnTimer: 400,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setClimbs(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }
  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    spawnBurst(
      s.particles,
      s.player.x + PLAYER_W / 2,
      s.player.y,
      "#ff9696",
      12,
      "hit",
    );
    if (s.lives <= 0) {
      s.ended = true;
      setOver("lose");
    } else {
      s.player = freshPlayer();
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        if (!p.climbing) {
          if (keysRef.current.left) p.x = Math.max(0, p.x - MOVE_SPEED);
          if (keysRef.current.right)
            p.x = Math.min(W - PLAYER_W, p.x + MOVE_SPEED);
          const ladderIdxUp = p.row;
          const ladderIdxDown = p.row - 1;
          if (
            keysRef.current.up &&
            p.row < TOP_ROW &&
            Math.abs(p.x + PLAYER_W / 2 - LADDER_X[ladderIdxUp]) < 10
          ) {
            p.climbing = true;
            p.targetRow = p.row + 1;
            p.x = LADDER_X[ladderIdxUp] - PLAYER_W / 2;
          } else if (
            keysRef.current.down &&
            p.row > 0 &&
            Math.abs(p.x + PLAYER_W / 2 - LADDER_X[ladderIdxDown]) < 10
          ) {
            p.climbing = true;
            p.targetRow = p.row - 1;
            p.x = LADDER_X[ladderIdxDown] - PLAYER_W / 2;
          }
        } else {
          const targetY = ROWS_Y[p.targetRow];
          const dir = targetY < p.y ? -1 : 1;
          p.y += dir * CLIMB_SPEED;
          if ((dir < 0 && p.y <= targetY) || (dir > 0 && p.y >= targetY)) {
            p.y = targetY;
            p.climbing = false;
            if (p.targetRow > p.row) {
              s.climbs += 1;
              setClimbs(s.climbs);
              AudioEngine.playSfx("score");
            }
            p.row = p.targetRow;
            if (p.row === TOP_ROW) {
              s.ended = true;
              setOver("win");
            }
          }
        }
        s.spawnTimer -= 16;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs;
          s.barrels.push({
            row: TOP_ROW,
            x: 4,
            y: ROWS_Y[TOP_ROW],
            vx: barrelSpeed,
          });
        }
        s.barrels.forEach((b) => {
          b.x += b.vx;
          if (b.x > W - 20 && b.vx > 0) {
            b.vx = -b.vx;
            b.row -= 1;
          } else if (b.x < 4 && b.vx < 0) {
            b.vx = -b.vx;
            b.row -= 1;
          }
          b.y = ROWS_Y[b.row] ?? -30;
        });
        s.barrels = s.barrels.filter((b) => b.row >= 0);
        if (!p.climbing) {
          s.barrels.forEach((b) => {
            if (b.row !== p.row) return;
            if (p.x < b.x + 16 && p.x + PLAYER_W > b.x) hit(s);
          });
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#241b33";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#4a3b63";
      ROWS_Y.forEach((y) => ctx.fillRect(0, y + PLAYER_H, W, 6));
      ctx.fillStyle = "#8dd1ff";
      LADDER_X.forEach((x, i) => {
        ctx.fillRect(
          x - 3,
          ROWS_Y[i + 1] + PLAYER_H,
          6,
          ROWS_Y[i] - ROWS_Y[i + 1],
        );
      });
      ctx.fillStyle = "#ff9696";
      s2.barrels.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x + 8, b.y + PLAYER_H - 8, 8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.player.x, s2.player.y, PLAYER_W, PLAYER_H);
      ctx.fillStyle = "#ffdc80";
      ctx.beginPath();
      ctx.arc(4, 4, 10, 0, Math.PI * 2);
      ctx.fill();
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const map = {
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
      ArrowUp: "up",
      w: "up",
      ArrowDown: "down",
      s: "down",
    };
    function onKeyDown(e) {
      if (map[e.key]) {
        keysRef.current[map[e.key]] = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (map[e.key]) keysRef.current[map[e.key]] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(climbs);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Climbs: {climbs}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🦍" : "🛢️"}
          title={over === "win" ? "Reached the top!" : "Flattened!"}
          statLines={[`Ladders climbed: ${climbs}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad">
        <button
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
          onMouseLeave={() => press("up", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("up", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("up", false);
          }}
        >
          ↑
        </button>
        <div>
          <button
            onMouseDown={() => press("left", true)}
            onMouseUp={() => press("left", false)}
            onMouseLeave={() => press("left", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("left", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("left", false);
            }}
          >
            ←
          </button>
          <button
            onMouseDown={() => press("down", true)}
            onMouseUp={() => press("down", false)}
            onMouseLeave={() => press("down", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("down", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("down", false);
            }}
          >
            ↓
          </button>
          <button
            onMouseDown={() => press("right", true)}
            onMouseUp={() => press("right", false)}
            onMouseLeave={() => press("right", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("right", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("right", false);
            }}
          >
            →
          </button>
        </div>
      </div>
      <p className="ga-hint">
        Walk to a ladder and hold ↑/↓ to climb. Dodge the barrels, reach the
        top.
      </p>
    </div>
  );
}
/* --------------------------- challenge: bubble trap (bubble bobble style) --------------------------- */

function BubbleTrapGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, enemySpeedMul, enemyCount } = {
    easy: { startLives: 4, enemySpeedMul: 0.8, enemyCount: 5 },
    medium: { startLives: 3, enemySpeedMul: 1, enemyCount: 6 },
    hard: { startLives: 2, enemySpeedMul: 1.3, enemyCount: 8 },
  }[difficulty];
  const W = 300,
    H = 200;
  const GROUND_Y = 176;
  const GRAVITY = 0.5,
    JUMP_VELOCITY = -8.6,
    MOVE_SPEED = 2.2,
    MAX_FALL = 9;
  const PLAYER_W = 16,
    PLAYER_H = 18;
  const PLATFORMS = [
    { x: 0, y: GROUND_Y, w: W, h: 24 },
    { x: 20, y: 130, w: 80, h: 10 },
    { x: 200, y: 130, w: 80, h: 10 },
    { x: 110, y: 84, w: 80, h: 10 },
  ];
  const BUBBLE_SPEED = 3;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const jumpQueuedRef = useRef(false);
  const fireQueuedRef = useRef(false);
  const [popped, setPopped] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshEnemies() {
    const arr = [];
    for (let i = 0; i < enemyCount; i++) {
      const plat = PLATFORMS[i % PLATFORMS.length];
      arr.push({
        x: plat.x + 10 + ((i * 17) % Math.max(20, plat.w - 20)),
        y: plat.y - 14,
        w: 14,
        h: 14,
        vx: (i % 2 === 0 ? 1 : -1) * (0.6 + (i % 3) * 0.2) * enemySpeedMul,
        platIdx: i % PLATFORMS.length,
        alive: true,
      });
    }
    return arr;
  }
  function freshState() {
    return {
      player: {
        x: 20,
        y: GROUND_Y - PLAYER_H,
        vx: 0,
        vy: 0,
        grounded: false,
        facing: 1,
      },
      enemies: freshEnemies(),
      bubbles: [],
      particles: [],
      lives: startLives,
      popped: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setPopped(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }
  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    spawnBurst(
      s.particles,
      s.player.x + PLAYER_W / 2,
      s.player.y + PLAYER_H / 2,
      "#ff9696",
      12,
      "hit",
    );
    if (s.lives <= 0) {
      s.ended = true;
      setOver("lose");
    } else {
      s.player.x = 20;
      s.player.y = GROUND_Y - PLAYER_H;
      s.player.vx = 0;
      s.player.vy = 0;
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        p.vx = keysRef.current.left
          ? -MOVE_SPEED
          : keysRef.current.right
            ? MOVE_SPEED
            : 0;
        if (p.vx < 0) p.facing = -1;
        if (p.vx > 0) p.facing = 1;
        p.x = Math.max(0, Math.min(W - PLAYER_W, p.x + p.vx));
        p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
        if (jumpQueuedRef.current && p.grounded) {
          p.vy = JUMP_VELOCITY;
          p.grounded = false;
          AudioEngine.playSfx("jump");
        }
        jumpQueuedRef.current = false;
        p.y += p.vy;
        p.grounded = false;
        for (const plat of PLATFORMS) {
          const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
          if (rectsOverlap(pr, plat) && p.vy > 0) {
            p.y = plat.y - PLAYER_H;
            p.vy = 0;
            p.grounded = true;
          }
        }
        if (fireQueuedRef.current) {
          fireQueuedRef.current = false;
          s.bubbles.push({
            x: p.x + (p.facing > 0 ? PLAYER_W : -6),
            y: p.y + 4,
            vx: BUBBLE_SPEED * p.facing,
            life: 90,
          });
          AudioEngine.playSfx("select");
        }
        s.bubbles.forEach((b) => {
          b.x += b.vx;
          b.life -= 1;
        });
        s.bubbles = s.bubbles.filter(
          (b) => b.life > 0 && b.x > -10 && b.x < W + 10,
        );
        s.enemies.forEach((e) => {
          if (!e.alive) return;
          const plat = PLATFORMS[e.platIdx];
          e.x += e.vx;
          if (e.x < plat.x || e.x + e.w > plat.x + plat.w) e.vx *= -1;
          e.x = Math.max(plat.x, Math.min(plat.x + plat.w - e.w, e.x));
        });
        for (const e of s.enemies) {
          if (!e.alive) continue;
          for (const b of s.bubbles) {
            if (rectsOverlap(e, { x: b.x - 4, y: b.y - 4, w: 8, h: 8 })) {
              e.alive = false;
              b.life = 0;
              s.popped += 1;
              setPopped(s.popped);
              spawnBurst(
                s.particles,
                e.x + e.w / 2,
                e.y + e.h / 2,
                "#8dd1ff",
                10,
                "coin",
              );
            }
          }
        }
        const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
        s.enemies.forEach((e) => {
          if (e.alive && rectsOverlap(pr, e)) hit(s);
        });
        if (s.enemies.every((e) => !e.alive)) {
          s.ended = true;
          setOver("win");
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#1b2140";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3c3f7d";
      PLATFORMS.forEach((pl) => ctx.fillRect(pl.x, pl.y, pl.w, pl.h));
      ctx.strokeStyle = "#8dd1ff";
      s2.bubbles.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.fillStyle = "#ff9696";
      s2.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillRect(e.x, e.y, e.w, e.h);
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.player.x, s2.player.y, PLAYER_W, PLAYER_H);
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if (["ArrowUp", "w", "W"].includes(e.key)) {
        jumpQueuedRef.current = true;
        e.preventDefault();
      }
      if (e.key === " ") {
        fireQueuedRef.current = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(popped);
    // eslint-disable-next-line
  }, [over]);

  function press(dir, isDown) {
    if (dir === "left") keysRef.current.left = isDown;
    if (dir === "right") keysRef.current.right = isDown;
    if (dir === "jump" && isDown) jumpQueuedRef.current = true;
    if (dir === "fire" && isDown) fireQueuedRef.current = true;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Popped: {popped}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🫧" : "💥"}
          title={over === "win" ? "Level cleared!" : "Out of lives"}
          statLines={[`Enemies popped: ${popped}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("jump", true)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("jump", true);
          }}
        >
          ⤒
        </button>
        <button
          onMouseDown={() => press("fire", true)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("fire", true);
          }}
        >
          🫧
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Arrows to move/jump, Space to blow bubbles. Pop every enemy to clear
        the level.
      </p>
    </div>
  );
}
/* --------------------------- challenge: duel ring (fighting style) --------------------------- */

function DuelRingGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { cpuSpeedMul, cpuAggro } = {
    easy: { cpuSpeedMul: 0.7, cpuAggro: 0.01 },
    medium: { cpuSpeedMul: 1, cpuAggro: 0.018 },
    hard: { cpuSpeedMul: 1.3, cpuAggro: 0.03 },
  }[difficulty];
  const W = 300,
    H = 160;
  const FLOOR_Y = 130;
  const FIGHTER_W = 22,
    FIGHTER_H = 34;
  const PUNCH_RANGE = 30,
    PUNCH_DMG = 6,
    PUNCH_COOLDOWN = 260;
  const KICK_RANGE = 42,
    KICK_DMG = 12,
    KICK_COOLDOWN = 480;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    left: false,
    right: false,
    punch: false,
    kick: false,
  });
  const [roundsWon, setRoundsWon] = useState(0);
  const [roundsLost, setRoundsLost] = useState(0);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshFighters() {
    return {
      p: { x: 40, hp: 100, facing: 1, atkCd: 0, hitFlash: 0 },
      c: {
        x: W - 40 - FIGHTER_W,
        hp: 100,
        facing: -1,
        atkCd: 0,
        hitFlash: 0,
      },
    };
  }
  function freshState() {
    return {
      ...freshFighters(),
      particles: [],
      roundsWon: 0,
      roundsLost: 0,
      ended: false,
      roundOverAt: 0,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setRoundsWon(0);
    setRoundsLost(0);
    setOver(null);
    setShake(false);
  }
  function nextRound(s) {
    const f = freshFighters();
    s.p = f.p;
    s.c = f.c;
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended && !s.roundOverAt) {
        const p = s.p,
          c = s.c;
        const dist = c.x - p.x;
        p.facing = dist >= 0 ? 1 : -1;
        c.facing = dist >= 0 ? -1 : 1;
        if (keysRef.current.left) p.x = Math.max(0, p.x - 2.4);
        if (keysRef.current.right)
          p.x = Math.min(W - FIGHTER_W, p.x + 2.4);
        p.atkCd = Math.max(0, p.atkCd - 16);
        c.atkCd = Math.max(0, c.atkCd - 16);
        p.hitFlash = Math.max(0, p.hitFlash - 16);
        c.hitFlash = Math.max(0, c.hitFlash - 16);

        function tryAttack(attacker, defender, range, dmg, cooldown) {
          if (attacker.atkCd > 0) return;
          if (
            Math.abs(
              defender.x + FIGHTER_W / 2 - (attacker.x + FIGHTER_W / 2),
            ) <= range
          ) {
            attacker.atkCd = cooldown;
            defender.hp = Math.max(0, defender.hp - dmg);
            defender.hitFlash = 180;
            AudioEngine.playSfx("hit");
            spawnBurst(
              s.particles,
              defender.x + FIGHTER_W / 2,
              FLOOR_Y - FIGHTER_H / 2,
              "#ffdc80",
              8,
              "hit",
            );
          }
        }
        if (keysRef.current.punch)
          tryAttack(p, c, PUNCH_RANGE, PUNCH_DMG, PUNCH_COOLDOWN);
        if (keysRef.current.kick)
          tryAttack(p, c, KICK_RANGE, KICK_DMG, KICK_COOLDOWN);

        const absDist = Math.abs(dist);
        if (absDist > 30) {
          c.x += Math.sign(dist) * 1.6 * cpuSpeedMul;
          c.x = Math.max(0, Math.min(W - FIGHTER_W, c.x));
        } else if (Math.random() < cpuAggro) {
          const usePunch = Math.random() < 0.5;
          tryAttack(
            c,
            p,
            usePunch ? PUNCH_RANGE : KICK_RANGE,
            usePunch ? PUNCH_DMG : KICK_DMG,
            usePunch ? PUNCH_COOLDOWN : KICK_COOLDOWN,
          );
        }

        if (c.hp <= 0 || p.hp <= 0) {
          s.roundOverAt = performance.now();
          if (c.hp <= 0) {
            s.roundsWon += 1;
            setRoundsWon(s.roundsWon);
          } else {
            s.roundsLost += 1;
            setRoundsLost(s.roundsLost);
          }
        }
      } else if (s.roundOverAt) {
        if (performance.now() - s.roundOverAt > 900) {
          if (s.roundsWon >= 2) {
            s.ended = true;
            setOver("win");
          } else if (s.roundsLost >= 2) {
            s.ended = true;
            setOver("lose");
          } else {
            s.roundOverAt = 0;
            nextRound(s);
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#2a1830";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#4a3b63";
      ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
      ctx.fillStyle = s2.p.hitFlash > 0 ? "#ffffff" : "#78efd9";
      ctx.fillRect(s2.p.x, FLOOR_Y - FIGHTER_H, FIGHTER_W, FIGHTER_H);
      ctx.fillStyle = s2.c.hitFlash > 0 ? "#ffffff" : "#ff9696";
      ctx.fillRect(s2.c.x, FLOOR_Y - FIGHTER_H, FIGHTER_W, FIGHTER_H);
      function hpBar(x, hp, color) {
        ctx.fillStyle = "#242643";
        ctx.fillRect(x, 8, 100, 8);
        ctx.fillStyle = color;
        ctx.fillRect(x, 8, hp, 8);
      }
      hpBar(10, s2.p.hp, "#78efd9");
      hpBar(W - 110, s2.c.hp, "#ff9696");
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if (["j", "J", " "].includes(e.key)) {
        keysRef.current.punch = true;
        e.preventDefault();
      }
      if (["k", "K"].includes(e.key)) {
        keysRef.current.kick = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
      if (["j", "J", " "].includes(e.key)) keysRef.current.punch = false;
      if (["k", "K"].includes(e.key)) keysRef.current.kick = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(roundsWon);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Rounds: {roundsWon}-{roundsLost}
        </span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🥇" : "🥊"}
          title={over === "win" ? "Match won!" : "Match lost"}
          statLines={[`Rounds: ${roundsWon}-${roundsLost}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("punch", true)}
          onMouseUp={() => press("punch", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("punch", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("punch", false);
          }}
        >
          👊
        </button>
        <button
          onMouseDown={() => press("kick", true)}
          onMouseUp={() => press("kick", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("kick", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("kick", false);
          }}
        >
          🦵
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Arrows to move, J to punch, K to kick. Win 2 rounds to take the match.
      </p>
    </div>
  );
}
/* --------------------------- endless: peak climber (ice climber inspired) --------------------------- */

function PeakClimberGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { gapMul, enemyChance } = {
    easy: { gapMul: 0.85, enemyChance: 0.12 },
    medium: { gapMul: 1, enemyChance: 0.2 },
    hard: { gapMul: 1.2, enemyChance: 0.3 },
  }[difficulty];
  const W = 260,
    H = 320;
  const PLAYER_W = 18,
    PLAYER_H = 20;
  const GRAVITY = 0.32,
    JUMP_VELOCITY = -8.6;
  const PLAT_W = 46,
    PLAT_H = 8;
  const GAP = 52 * gapMul;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const [height, setHeight] = useState(0);
  const [over, setOver] = useState(false);

  function genPlatform(y) {
    return {
      x: 10 + Math.random() * (W - PLAT_W - 20),
      y,
      w: PLAT_W,
      h: PLAT_H,
      enemy: Math.random() < enemyChance,
      ex: 0,
      evx: Math.random() < 0.5 ? 0.6 : -0.6,
    };
  }
  function freshPlatforms() {
    const arr = [];
    let y = H - 20;
    arr.push({ x: W / 2 - PLAT_W / 2, y, w: PLAT_W, h: PLAT_H, enemy: false });
    for (let i = 1; i < 14; i++) {
      y -= GAP;
      arr.push(genPlatform(y));
    }
    return arr;
  }
  function freshState() {
    const plats = freshPlatforms();
    return {
      player: { x: W / 2 - PLAYER_W / 2, y: plats[0].y - PLAYER_H, vy: JUMP_VELOCITY },
      platforms: plats,
      camY: 0,
      particles: [],
      maxHeight: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setHeight(0);
    setOver(false);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        if (keysRef.current.left) p.x -= 2.6;
        if (keysRef.current.right) p.x += 2.6;
        if (p.x < -PLAYER_W) p.x = W;
        if (p.x > W) p.x = -PLAYER_W;
        p.vy += GRAVITY;
        p.y += p.vy;
        if (p.vy > 0) {
          for (const plat of s.platforms) {
            if (
              p.x + PLAYER_W > plat.x &&
              p.x < plat.x + plat.w &&
              p.y + PLAYER_H > plat.y &&
              p.y + PLAYER_H < plat.y + plat.h + 10
            ) {
              p.vy = JUMP_VELOCITY;
              AudioEngine.playSfx("jump");
              spawnBurst(
                s.particles,
                p.x + PLAYER_W / 2,
                plat.y,
                "#8dd1ff",
                6,
                "click",
              );
            }
          }
        }
        const midY = H * 0.45;
        if (p.y < midY) {
          const dy = midY - p.y;
          p.y = midY;
          s.camY += dy;
          s.platforms.forEach((pl) => (pl.y += dy));
          s.maxHeight += dy;
          setHeight(Math.round(s.maxHeight / 10));
        }
        s.platforms.forEach((pl) => {
          if (!pl.enemy) return;
          pl.ex += pl.evx;
          if (pl.ex > pl.w - 14 || pl.ex < 0) pl.evx *= -1;
        });
        const pr = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
        for (const pl of s.platforms) {
          if (!pl.enemy) continue;
          const er = { x: pl.x + pl.ex, y: pl.y - 12, w: 14, h: 12 };
          if (
            pr.x < er.x + er.w &&
            pr.x + pr.w > er.x &&
            pr.y < er.y + er.h &&
            pr.y + pr.h > er.y
          ) {
            s.ended = true;
            setOver(true);
          }
        }
        while (
          s.platforms.length &&
          s.platforms[s.platforms.length - 1].y > -40
        ) {
          s.platforms.push(
            genPlatform(s.platforms[s.platforms.length - 1].y - GAP),
          );
        }
        s.platforms = s.platforms.filter((pl) => pl.y < H + 30);
        if (p.y > H + 30) {
          s.ended = true;
          setOver(true);
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#152238";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 24; i++) {
        const sx = (i * 37) % W;
        const sy = (i * 61 - s2.camY * 0.2) % H;
        const ny = ((sy % H) + H) % H;
        ctx.fillRect(sx, ny, 1, 1);
      }
      ctx.fillStyle = "#8dd1ff";
      s2.platforms.forEach((pl) => ctx.fillRect(pl.x, pl.y, pl.w, pl.h));
      ctx.fillStyle = "#ff9696";
      s2.platforms.forEach((pl) => {
        if (pl.enemy) ctx.fillRect(pl.x + pl.ex, pl.y - 12, 14, 12);
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.player.x, s2.player.y, PLAYER_W, PLAYER_H);
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(height);
    // eslint-disable-next-line
  }, [over]);

  function press(dir, isDown) {
    if (dir === "left") keysRef.current.left = isDown;
    if (dir === "right") keysRef.current.right = isDown;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Height: {height}m</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🧊"
          title="Slipped!"
          statLines={[`Height: ${height}m`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Auto-bounces upward. Steer left/right, dodge the ice critters, climb
        as high as you can.
      </p>
    </div>
  );
}
/* --------------------------- challenge: fairway putt (golf style) --------------------------- */

function NineHoleGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { friction, holeR } = {
    easy: { friction: 0.985, holeR: 12 },
    medium: { friction: 0.978, holeR: 9 },
    hard: { friction: 0.972, holeR: 7 },
  }[difficulty];
  const W = 260,
    H = 300;
  const HOLES = [
    {
      start: { x: 40, y: 260 },
      hole: { x: 200, y: 60 },
      hazards: [{ x: 120, y: 160, r: 22 }],
    },
    {
      start: { x: 40, y: 260 },
      hole: { x: 60, y: 50 },
      hazards: [
        { x: 90, y: 150, r: 18 },
        { x: 180, y: 210, r: 16 },
      ],
    },
    {
      start: { x: 130, y: 270 },
      hole: { x: 210, y: 40 },
      hazards: [
        { x: 130, y: 170, r: 20 },
        { x: 60, y: 90, r: 16 },
      ],
    },
  ];
  const MAX_POWER = 7.5;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [charging, setCharging] = useState(false);
  const [over, setOver] = useState(null);

  function freshBall(idx) {
    return { ...HOLES[idx].start, vx: 0, vy: 0, moving: false };
  }
  function freshState() {
    return {
      holeIdx: 0,
      ball: freshBall(0),
      strokes: 0,
      aim: -Math.PI / 2,
      power: 0,
      powerDir: 1,
      charging: false,
      particles: [],
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setHoleIdx(0);
    setStrokes(0);
    setOver(null);
    setCharging(false);
  }

  function startCharge() {
    const s = stateRef.current;
    if (!s || s.ball.moving || s.ended) return;
    s.charging = true;
    s.power = 0;
    s.powerDir = 1;
    setCharging(true);
  }
  function releaseCharge() {
    const s = stateRef.current;
    if (!s || !s.charging) return;
    s.charging = false;
    setCharging(false);
    const pw = 0.6 + s.power * (MAX_POWER - 0.6);
    s.ball.vx = Math.cos(s.aim) * pw;
    s.ball.vy = Math.sin(s.aim) * pw;
    s.ball.moving = true;
    s.strokes += 1;
    setStrokes(s.strokes);
    AudioEngine.playSfx("select");
  }
  function aim(dir) {
    const s = stateRef.current;
    if (!s || s.ball.moving) return;
    s.aim += dir * 0.08;
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      const cfg = HOLES[s.holeIdx];
      if (!s.ended) {
        if (s.charging) {
          s.power += 0.025 * s.powerDir;
          if (s.power >= 1) {
            s.power = 1;
            s.powerDir = -1;
          }
          if (s.power <= 0) {
            s.power = 0;
            s.powerDir = 1;
          }
        }
        const b = s.ball;
        if (b.moving) {
          b.x += b.vx;
          b.y += b.vy;
          b.vx *= friction;
          b.vy *= friction;
          if (b.x < 6) {
            b.x = 6;
            b.vx *= -0.6;
          }
          if (b.x > W - 6) {
            b.x = W - 6;
            b.vx *= -0.6;
          }
          if (b.y < 6) {
            b.y = 6;
            b.vy *= -0.6;
          }
          if (b.y > H - 6) {
            b.y = H - 6;
            b.vy *= -0.6;
          }
          for (const hz of cfg.hazards) {
            const dx = b.x - hz.x,
              dy = b.y - hz.y;
            if (Math.hypot(dx, dy) < hz.r) {
              Object.assign(b, freshBall(s.holeIdx));
              s.strokes += 1;
              setStrokes(s.strokes);
              AudioEngine.playSfx("hit");
            }
          }
          const dh = Math.hypot(b.x - cfg.hole.x, b.y - cfg.hole.y);
          if (dh < holeR && Math.hypot(b.vx, b.vy) < 2.2) {
            spawnBurst(s.particles, cfg.hole.x, cfg.hole.y, "#ffdc80", 16, "score");
            AudioEngine.playSfx("win");
            if (s.holeIdx + 1 >= HOLES.length) {
              s.ended = true;
              setOver(true);
            } else {
              s.holeIdx += 1;
              setHoleIdx(s.holeIdx);
              s.ball = freshBall(s.holeIdx);
            }
          } else if (Math.hypot(b.vx, b.vy) < 0.05) {
            b.vx = 0;
            b.vy = 0;
            b.moving = false;
          }
        }
      }
      const s2 = stateRef.current;
      const c2 = HOLES[s2.holeIdx];
      ctx.fillStyle = "#1e4b2e";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2c6b3f";
      for (let i = 0; i < 10; i++) ctx.fillRect(0, i * (H / 10), W, 2);
      c2.hazards.forEach((hz) => {
        ctx.fillStyle = "#3b6bb0";
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#242643";
      ctx.beginPath();
      ctx.arc(c2.hole.x, c2.hole.y, holeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5f3ff";
      ctx.fillRect(c2.hole.x, c2.hole.y - 26, 2, 26);
      ctx.fillStyle = "#ff9696";
      ctx.beginPath();
      ctx.moveTo(c2.hole.x + 2, c2.hole.y - 26);
      ctx.lineTo(c2.hole.x + 14, c2.hole.y - 21);
      ctx.lineTo(c2.hole.x + 2, c2.hole.y - 16);
      ctx.fill();
      if (!s2.ball.moving && !s2.ended) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(s2.ball.x, s2.ball.y);
        ctx.lineTo(
          s2.ball.x + Math.cos(s2.aim) * 26,
          s2.ball.y + Math.sin(s2.aim) * 26,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#f5f3ff";
      ctx.beginPath();
      ctx.arc(s2.ball.x, s2.ball.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (s2.charging) {
        ctx.fillStyle = "#242643";
        ctx.fillRect(10, H - 16, 100, 8);
        ctx.fillStyle = "#ffdc80";
        ctx.fillRect(10, H - 16, 100 * s2.power, 8);
      }
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        aim(-1);
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        aim(1);
        e.preventDefault();
      }
      if (e.key === " " && stateRef.current && !stateRef.current.charging) {
        startCharge();
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (e.key === " ") {
        releaseCharge();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(strokes);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Hole: {holeIdx + 1}/{HOLES.length}
        </span>
        <span>Strokes: {strokes}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="⛳"
          title="Course complete!"
          statLines={[`Total strokes: ${strokes}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad-row">
        <button onClick={() => aim(-1)}>↺</button>
        <button
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onTouchStart={(e) => {
            e.preventDefault();
            startCharge();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseCharge();
          }}
        >
          ⛳ Putt
        </button>
        <button onClick={() => aim(1)}>↻</button>
      </div>
      <p className="ga-hint">
        Arrows to aim, hold Space/Putt to charge power, release to hit. Sink 3
        holes in as few strokes as you can.
      </p>
    </div>
  );
}

/* --------------------------- endless: lane racer (racing style) --------------------------- */

function LaneRacerGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { spawnMs, speedMul } = {
    easy: { spawnMs: 950, speedMul: 0.85 },
    medium: { spawnMs: 750, speedMul: 1 },
    hard: { spawnMs: 560, speedMul: 1.25 },
  }[difficulty];
  const W = 220,
    H = 340;
  const LANES = 3;
  const LANE_W = W / LANES;
  const CAR_W = 34,
    CAR_H = 56;
  const PLAYER_Y = H - 70;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  function freshState() {
    return {
      targetLane: 1,
      x: LANE_W * 1 + LANE_W / 2 - CAR_W / 2,
      cars: [],
      particles: [],
      spawnTimer: 0,
      elapsed: 0,
      dashOffset: 0,
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setOver(false);
  }
  function switchLane(dir) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    s.targetLane = Math.max(0, Math.min(LANES - 1, s.targetLane + dir));
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const ramp = speedMul * (1 + Math.min(1.3, s.elapsed / 30000));
        const targetX = LANE_W * s.targetLane + LANE_W / 2 - CAR_W / 2;
        s.x += (targetX - s.x) * 0.25;
        s.dashOffset = (s.dashOffset + 4 * ramp) % 40;
        s.score += dt * 0.01 * ramp;
        setScore(Math.round(s.score));
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / ramp;
          const lane = Math.floor(Math.random() * LANES);
          s.cars.push({
            lane,
            x: LANE_W * lane + LANE_W / 2 - CAR_W / 2,
            y: -CAR_H,
            vy: (2.2 + Math.random() * 1.4) * ramp,
            color: ["#ff9696", "#ffdc80", "#8dd1ff", "#bea9ff"][
              Math.floor(Math.random() * 4)
            ],
          });
        }
        s.cars.forEach((c) => (c.y += c.vy));
        s.cars = s.cars.filter((c) => c.y < H + CAR_H);
        const pr = { x: s.x, y: PLAYER_Y, w: CAR_W, h: CAR_H };
        for (const c of s.cars) {
          if (
            pr.x < c.x + CAR_W &&
            pr.x + pr.w > c.x &&
            pr.y < c.y + CAR_H &&
            pr.y + pr.h > c.y
          ) {
            s.ended = true;
            setOver(true);
            spawnBurst(
              s.particles,
              pr.x + CAR_W / 2,
              pr.y + CAR_H / 2,
              "#ff9696",
              16,
              "hit",
            );
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#232323";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -s2.dashOffset;
      for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(LANE_W * i, 0);
        ctx.lineTo(LANE_W * i, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      s2.cars.forEach((c) => {
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, CAR_W, CAR_H);
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(s2.x, PLAYER_Y, CAR_W, CAR_H);
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        switchLane(-1);
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        switchLane(1);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🚗"
          title="Crashed!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button onClick={() => switchLane(-1)}>←</button>
        <button onClick={() => switchLane(1)}>→</button>
      </div>
      <p className="ga-hint">
        Arrows to switch lanes. Dodge the traffic, survive as long as you can.
      </p>
    </div>
  );
}
/* --------------------------- endless: asteroid blitz --------------------------- */

function AsteroidBlitzGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, spawnMs } = {
    easy: { startLives: 4, spawnMs: 3200 },
    medium: { startLives: 3, spawnMs: 2600 },
    hard: { startLives: 2, spawnMs: 2000 },
  }[difficulty];
  const W = 280,
    H = 280;
  const THRUST = 0.12,
    DRAG = 0.988,
    TURN_SPEED = 0.06,
    BULLET_SPEED = 4.2;
  const GUN_LEVELS = [
    { cooldown: 260, offsets: [0] },
    { cooldown: 230, offsets: [-0.08, 0.08] },
    { cooldown: 195, offsets: [-0.16, 0, 0.16] },
    { cooldown: 150, offsets: [-0.24, -0.08, 0.08, 0.24] },
  ];
  const MAX_GUN_LEVEL = GUN_LEVELS.length;
  const POWERUP_INTERVAL = 13000;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    left: false,
    right: false,
    thrust: false,
  });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [gunLevel, setGunLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function wrap(v, max) {
    if (v < 0) return v + max;
    if (v > max) return v - max;
    return v;
  }
  function makeAsteroid(size, x, y) {
    const speed = 0.5 + Math.random() * 0.7 + (3 - size) * 0.3;
    const ang = Math.random() * Math.PI * 2;
    return {
      x: x ?? Math.random() * W,
      y: y ?? Math.random() * H,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      size,
      r: size * 10 + 6,
    };
  }
  function freshState() {
    return {
      ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bullets: [],
      asteroids: [makeAsteroid(3), makeAsteroid(3), makeAsteroid(3)],
      powerup: null,
      particles: [],
      lives: startLives,
      score: 0,
      gunLevel: 1,
      fireTimer: 0,
      spawnTimer: spawnMs,
      powerupTimer: POWERUP_INTERVAL,
      invuln: 1200,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setGunLevel(1);
    setOver(false);
    setShake(false);
  }
  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    s.ship.x = W / 2;
    s.ship.y = H / 2;
    s.ship.vx = 0;
    s.ship.vy = 0;
    s.invuln = 1500;
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const sh = s.ship;
        if (keysRef.current.left) sh.angle -= TURN_SPEED;
        if (keysRef.current.right) sh.angle += TURN_SPEED;
        if (keysRef.current.thrust) {
          sh.vx += Math.cos(sh.angle) * THRUST;
          sh.vy += Math.sin(sh.angle) * THRUST;
          spawnBurst(
            s.particles,
            sh.x - Math.cos(sh.angle) * 8,
            sh.y - Math.sin(sh.angle) * 8,
            "#ffdc80",
            1,
            null,
          );
        }
        sh.vx *= DRAG;
        sh.vy *= DRAG;
        sh.x = wrap(sh.x + sh.vx, W);
        sh.y = wrap(sh.y + sh.vy, H);
        s.invuln = Math.max(0, s.invuln - dt);
        s.fireTimer -= dt;
        if (s.fireTimer <= 0) {
          const level = GUN_LEVELS[s.gunLevel - 1];
          level.offsets.forEach((off) => {
            const ang = sh.angle + off;
            s.bullets.push({
              x: sh.x + Math.cos(ang) * 10,
              y: sh.y + Math.sin(ang) * 10,
              vx: Math.cos(ang) * BULLET_SPEED,
              vy: Math.sin(ang) * BULLET_SPEED,
              life: 60,
            });
          });
          s.fireTimer = level.cooldown;
          AudioEngine.playSfx("select");
        }
        s.powerupTimer -= dt;
        if (s.powerupTimer <= 0) {
          s.powerupTimer = POWERUP_INTERVAL;
          if (s.gunLevel < MAX_GUN_LEVEL && !s.powerup) {
            const ang = Math.random() * Math.PI * 2;
            s.powerup = {
              x: Math.random() * W,
              y: Math.random() * H,
              vx: Math.cos(ang) * 0.5,
              vy: Math.sin(ang) * 0.5,
            };
          }
        }
        if (s.powerup) {
          s.powerup.x = wrap(s.powerup.x + s.powerup.vx, W);
          s.powerup.y = wrap(s.powerup.y + s.powerup.vy, H);
        }
        s.bullets.forEach((b) => {
          b.x = wrap(b.x + b.vx, W);
          b.y = wrap(b.y + b.vy, H);
          b.life -= 1;
        });
        s.bullets = s.bullets.filter((b) => b.life > 0);
        s.asteroids.forEach((a) => {
          a.x = wrap(a.x + a.vx, W);
          a.y = wrap(a.y + a.vy, H);
        });
        const newAsteroids = [];
        for (const a of s.asteroids) {
          let destroyed = false;
          for (const b of s.bullets) {
            if (b.dead) continue;
            const dx = a.x - b.x,
              dy = a.y - b.y;
            if (Math.hypot(dx, dy) < a.r) {
              b.dead = true;
              destroyed = true;
              s.score += (4 - a.size) * 10;
              setScore(s.score);
              spawnBurst(s.particles, a.x, a.y, "#bea9ff", 12, "score");
              if (a.size > 1) {
                newAsteroids.push(makeAsteroid(a.size - 1, a.x, a.y));
                newAsteroids.push(makeAsteroid(a.size - 1, a.x, a.y));
              }
              break;
            }
          }
          if (!destroyed) newAsteroids.push(a);
        }
        s.bullets = s.bullets.filter((b) => !b.dead);
        s.asteroids = newAsteroids;
        if (s.invuln <= 0) {
          for (const a of s.asteroids) {
            if (Math.hypot(a.x - sh.x, a.y - sh.y) < a.r + 6) {
              hit(s);
              break;
            }
          }
        }
        if (s.powerup && Math.hypot(s.powerup.x - sh.x, s.powerup.y - sh.y) < 16) {
          s.gunLevel = Math.min(MAX_GUN_LEVEL, s.gunLevel + 1);
          setGunLevel(s.gunLevel);
          spawnBurst(s.particles, s.powerup.x, s.powerup.y, "#ffdc80", 16, "score");
          AudioEngine.playSfx("win");
          s.powerup = null;
        }
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs;
          s.asteroids.push(makeAsteroid(3));
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#101225";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#bea9ff";
      s2.asteroids.forEach((a) => {
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.fillStyle = "#ffdc80";
      s2.bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      if (s2.powerup) {
        ctx.fillStyle = "#ffdc80";
        ctx.beginPath();
        ctx.arc(s2.powerup.x, s2.powerup.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#101225";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("P", s2.powerup.x, s2.powerup.y + 3);
        ctx.textAlign = "left";
      }
      const sh2 = s2.ship;
      ctx.save();
      ctx.translate(sh2.x, sh2.y);
      ctx.rotate(sh2.angle);
      ctx.fillStyle =
        s2.invuln > 0 && Math.floor(s2.invuln / 100) % 2 === 0
          ? "rgba(120,239,217,0.4)"
          : "#78efd9";
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, 7);
      ctx.lineTo(-8, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if (["ArrowUp", "w", "W"].includes(e.key)) {
        keysRef.current.thrust = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.thrust = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Gun Lv.{gunLevel}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="☄️"
          title="Ship lost"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ↺
        </button>
        <button
          onMouseDown={() => press("thrust", true)}
          onMouseUp={() => press("thrust", false)}
          onMouseLeave={() => press("thrust", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("thrust", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("thrust", false);
          }}
        >
          ▲
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          ↻
        </button>
      </div>
      <p className="ga-hint">
        Rotate and thrust to steer — your gun fires automatically. Grab the
        gold pickups to power it up. Rocks split when hit.
      </p>
    </div>
  );
}
/* --------------------------- challenge: bomber quest (bomberman style) --------------------------- */

function BomberQuestGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, enemyMs, softChance } = {
    easy: { startLives: 4, enemyMs: 650, softChance: 0.55 },
    medium: { startLives: 3, enemyMs: 500, softChance: 0.65 },
    hard: { startLives: 2, enemyMs: 380, softChance: 0.75 },
  }[difficulty];
  const ROWS = 9,
    COLS = 11,
    CELL = 24;
  const W = COLS * CELL,
    H = ROWS * CELL;
  const BOMB_FUSE = 1400,
    FLAME_TIME = 350;

  function buildGrid() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        if (r % 2 === 0 && c % 2 === 0) {
          row.push(1);
        } else {
          row.push(Math.random() < softChance ? 2 : 0);
        }
      }
      grid.push(row);
    }
    const clearZones = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, COLS - 1],
      [0, COLS - 2],
      [1, COLS - 1],
      [ROWS - 1, 0],
      [ROWS - 1, 1],
      [ROWS - 2, 0],
      [ROWS - 1, COLS - 1],
      [ROWS - 1, COLS - 2],
      [ROWS - 2, COLS - 1],
    ];
    clearZones.forEach(([r, c]) => {
      if (grid[r][c] !== 1) grid[r][c] = 0;
    });
    return grid;
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [kills, setKills] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      grid: buildGrid(),
      player: { r: 0, c: 0 },
      enemies: [
        { r: 0, c: COLS - 1, timer: 0, alive: true },
        { r: ROWS - 1, c: 0, timer: 0, alive: true },
        { r: ROWS - 1, c: COLS - 1, timer: 0, alive: true },
      ],
      bombs: [],
      flames: [],
      particles: [],
      lives: startLives,
      kills: 0,
      hitCooldown: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setKills(0);
    setLives(startLives);
    setOver(null);
    setShake(false);
  }
  function passable(s, r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (s.grid[r][c] !== 0) return false;
    if (s.bombs.some((b) => b.r === r && b.c === c)) return false;
    return true;
  }
  function move(dir) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[
      dir
    ];
    const nr = s.player.r + d[0],
      nc = s.player.c + d[1];
    if (passable(s, nr, nc)) {
      s.player.r = nr;
      s.player.c = nc;
    }
  }
  function placeBomb() {
    const s = stateRef.current;
    if (!s || s.ended) return;
    if (s.bombs.some((b) => b.r === s.player.r && b.c === s.player.c)) return;
    if (s.bombs.length >= 1) return;
    s.bombs.push({ r: s.player.r, c: s.player.c, timer: BOMB_FUSE });
    AudioEngine.playSfx("select");
  }
  function explode(s, bomb) {
    const cells = [{ r: bomb.r, c: bomb.c }];
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    dirs.forEach(([dr, dc]) => {
      const nr = bomb.r + dr,
        nc = bomb.c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
      if (s.grid[nr][nc] === 1) return;
      cells.push({ r: nr, c: nc });
      if (s.grid[nr][nc] === 2) s.grid[nr][nc] = 0;
    });
    cells.forEach((cell) => {
      s.flames.push({ ...cell, timer: FLAME_TIME });
      spawnBurst(
        s.particles,
        cell.c * CELL + CELL / 2,
        cell.r * CELL + CELL / 2,
        "#ffb381",
        6,
        null,
      );
    });
    AudioEngine.playSfx("hit");
    return cells;
  }
  function hitPlayer(s) {
    if (s.hitCooldown > 0) return;
    s.hitCooldown = 900;
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) {
      s.ended = true;
      setOver("lose");
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      if (!s.ended) {
        s.hitCooldown = Math.max(0, s.hitCooldown - dt);
        s.bombs.forEach((b) => (b.timer -= dt));
        const toExplode = s.bombs.filter((b) => b.timer <= 0);
        s.bombs = s.bombs.filter((b) => b.timer > 0);
        toExplode.forEach((b) => {
          const cells = explode(s, b);
          cells.forEach((cell) => {
            if (cell.r === s.player.r && cell.c === s.player.c) hitPlayer(s);
            s.enemies.forEach((e) => {
              if (e.alive && e.r === cell.r && e.c === cell.c) {
                e.alive = false;
                s.kills += 1;
                setKills(s.kills);
                AudioEngine.playSfx("score");
              }
            });
          });
        });
        s.flames.forEach((f) => (f.timer -= dt));
        s.flames = s.flames.filter((f) => f.timer > 0);
        s.enemies.forEach((e) => {
          if (!e.alive) return;
          e.timer -= dt;
          if (e.timer <= 0) {
            e.timer = enemyMs;
            const dirs = [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ].filter(([dr, dc]) => passable(s, e.r + dr, e.c + dc));
            if (dirs.length) {
              const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
              e.r += dr;
              e.c += dc;
            }
          }
          if (e.r === s.player.r && e.c === s.player.c) hitPlayer(s);
        });
        if (s.enemies.every((e) => !e.alive)) {
          s.ended = true;
          setOver("win");
        }
      }
      const ctx = canvasRef.current.getContext("2d");
      const s2 = stateRef.current;
      ctx.fillStyle = "#1c1730";
      ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = s2.grid[r][c];
          if (v === 1) {
            ctx.fillStyle = "#4a3b63";
            ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          } else if (v === 2) {
            ctx.fillStyle = "#8dd1ff";
            ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
          }
        }
      }
      s2.flames.forEach((f) => {
        ctx.fillStyle = "rgba(255,150,120,0.85)";
        ctx.fillRect(f.c * CELL + 2, f.r * CELL + 2, CELL - 4, CELL - 4);
      });
      s2.bombs.forEach((b) => {
        ctx.fillStyle = "#242643";
        ctx.beginPath();
        ctx.arc(
          b.c * CELL + CELL / 2,
          b.r * CELL + CELL / 2,
          CELL / 2 - 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
      ctx.fillStyle = "#ff9696";
      s2.enemies.forEach((e) => {
        if (!e.alive) return;
        ctx.fillRect(e.c * CELL + 4, e.r * CELL + 4, CELL - 8, CELL - 8);
      });
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(
        s2.player.c * CELL + 4,
        s2.player.r * CELL + 4,
        CELL - 8,
        CELL - 8,
      );
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKey(e) {
      const map = {
        ArrowUp: "up",
        w: "up",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
        ArrowRight: "right",
        d: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
      if (e.key === " ") {
        e.preventDefault();
        placeBomb();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (over) onFinish(kills);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Kills: {kills}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "💣" : "💥"}
          title={over === "win" ? "Arena cleared!" : "Caught in the blast"}
          statLines={[`Enemies destroyed: ${kills}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => move("up")}>↑</button>
        <div>
          <button onClick={() => move("left")}>←</button>
          <button onClick={() => move("down")}>↓</button>
          <button onClick={() => move("right")}>→</button>
        </div>
      </div>
      <div className="ga-dpad-row">
        <button onClick={placeBomb}>💣 Bomb</button>
      </div>
      <p className="ga-hint">
        Arrows to move, Space or Bomb to drop one. Blast walls and enemies,
        don't get caught in your own fire.
      </p>
    </div>
  );
}
/* --------------------------- challenge: air hockey --------------------------- */

function AirHockeyGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { cpuSpeed, puckSpeedMul } = {
    easy: { cpuSpeed: 1.6, puckSpeedMul: 0.85 },
    medium: { cpuSpeed: 2.2, puckSpeedMul: 1 },
    hard: { cpuSpeed: 2.8, puckSpeedMul: 1.2 },
  }[difficulty];
  const W = 220,
    H = 320;
  const GOAL_W = 70;
  const PADDLE_R = 16,
    PUCK_R = 8;
  const WIN_SCORE = 7;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [over, setOver] = useState(null);

  function freshPuck(towardTop) {
    return {
      x: W / 2,
      y: H / 2,
      vx: (Math.random() - 0.5) * 3,
      vy: (towardTop ? -2.4 : 2.4) * puckSpeedMul,
    };
  }
  function freshState() {
    return {
      player: { x: W / 2, y: H - 40 },
      cpu: { x: W / 2, y: 40 },
      puck: freshPuck(Math.random() < 0.5),
      particles: [],
      playerScore: 0,
      cpuScore: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setPlayerScore(0);
    setCpuScore(0);
    setOver(null);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const p = s.player;
        if (keysRef.current.left) p.x = Math.max(PADDLE_R, p.x - 3);
        if (keysRef.current.right) p.x = Math.min(W - PADDLE_R, p.x + 3);
        if (keysRef.current.up) p.y = Math.max(H / 2 + PADDLE_R, p.y - 3);
        if (keysRef.current.down) p.y = Math.min(H - PADDLE_R, p.y + 3);
        const c = s.cpu;
        const dx = s.puck.x - c.x;
        c.x += Math.max(-cpuSpeed, Math.min(cpuSpeed, dx));
        c.x = Math.max(PADDLE_R, Math.min(W - PADDLE_R, c.x));
        c.y = 40 + Math.sin(performance.now() / 400) * 8;

        const pk = s.puck;
        pk.x += pk.vx;
        pk.y += pk.vy;
        if (pk.x < PUCK_R) {
          pk.x = PUCK_R;
          pk.vx *= -1;
        }
        if (pk.x > W - PUCK_R) {
          pk.x = W - PUCK_R;
          pk.vx *= -1;
        }
        if (pk.y < PUCK_R) {
          if (pk.x < W / 2 - GOAL_W / 2 || pk.x > W / 2 + GOAL_W / 2) {
            pk.y = PUCK_R;
            pk.vy *= -1;
          }
        }
        if (pk.y > H - PUCK_R) {
          if (pk.x < W / 2 - GOAL_W / 2 || pk.x > W / 2 + GOAL_W / 2) {
            pk.y = H - PUCK_R;
            pk.vy *= -1;
          }
        }
        [p, c].forEach((paddle) => {
          const ddx = pk.x - paddle.x,
            ddy = pk.y - paddle.y;
          const dist = Math.hypot(ddx, ddy);
          if (dist < PADDLE_R + PUCK_R) {
            const ang = Math.atan2(ddy, ddx);
            const speed = Math.max(3, Math.hypot(pk.vx, pk.vy) * 1.15);
            pk.vx = Math.cos(ang) * speed;
            pk.vy = Math.sin(ang) * speed;
            pk.x = paddle.x + Math.cos(ang) * (PADDLE_R + PUCK_R);
            pk.y = paddle.y + Math.sin(ang) * (PADDLE_R + PUCK_R);
            AudioEngine.playSfx("hit");
          }
        });
        if (pk.y < -PUCK_R) {
          s.playerScore += 1;
          setPlayerScore(s.playerScore);
          spawnBurst(s.particles, pk.x, 0, "#78efd9", 14, "score");
          if (s.playerScore >= WIN_SCORE) {
            s.ended = true;
            setOver("win");
          } else {
            s.puck = freshPuck(false);
          }
        } else if (pk.y > H + PUCK_R) {
          s.cpuScore += 1;
          setCpuScore(s.cpuScore);
          spawnBurst(s.particles, pk.x, H, "#ff9696", 14, "hit");
          if (s.cpuScore >= WIN_SCORE) {
            s.ended = true;
            setOver("lose");
          } else {
            s.puck = freshPuck(true);
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#0e2338";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffdc80";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W / 2 - GOAL_W / 2, 2);
      ctx.lineTo(W / 2 + GOAL_W / 2, 2);
      ctx.moveTo(W / 2 - GOAL_W / 2, H - 2);
      ctx.lineTo(W / 2 + GOAL_W / 2, H - 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#ff9696";
      ctx.beginPath();
      ctx.arc(s2.cpu.x, s2.cpu.y, PADDLE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#78efd9";
      ctx.beginPath();
      ctx.arc(s2.player.x, s2.player.y, PADDLE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5f3ff";
      ctx.beginPath();
      ctx.arc(s2.puck.x, s2.puck.y, PUCK_R, 0, Math.PI * 2);
      ctx.fill();
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if (["ArrowUp", "w", "W"].includes(e.key)) {
        keysRef.current.up = true;
        e.preventDefault();
      }
      if (["ArrowDown", "s", "S"].includes(e.key)) {
        keysRef.current.down = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.up = false;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.down = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(playerScore);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>You: {playerScore}</span>
        <span>CPU: {cpuScore}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🏒" : "🥅"}
          title={over === "win" ? "Match won!" : "Match lost"}
          statLines={[`Final score: ${playerScore}-${cpuScore}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad">
        <button
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
          onMouseLeave={() => press("up", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("up", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("up", false);
          }}
        >
          ↑
        </button>
        <div>
          <button
            onMouseDown={() => press("left", true)}
            onMouseUp={() => press("left", false)}
            onMouseLeave={() => press("left", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("left", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("left", false);
            }}
          >
            ←
          </button>
          <button
            onMouseDown={() => press("down", true)}
            onMouseUp={() => press("down", false)}
            onMouseLeave={() => press("down", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("down", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("down", false);
            }}
          >
            ↓
          </button>
          <button
            onMouseDown={() => press("right", true)}
            onMouseUp={() => press("right", false)}
            onMouseLeave={() => press("right", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("right", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("right", false);
            }}
          >
            →
          </button>
        </div>
      </div>
      <p className="ga-hint">
        Arrows to move your paddle. First to 7 goals wins the match.
      </p>
    </div>
  );
}
/* --------------------------- challenge: missile defense --------------------------- */

function MissileDefenseGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { missileSpeedMul, wavesToWin } = {
    easy: { missileSpeedMul: 0.8, wavesToWin: 4 },
    medium: { missileSpeedMul: 1, wavesToWin: 5 },
    hard: { missileSpeedMul: 1.3, wavesToWin: 6 },
  }[difficulty];
  const W = 280,
    H = 260;
  const GROUND_Y = H - 16;
  const CITY_X = [40, 100, 180, 240];
  const TURRET_X = W / 2;
  const BLAST_MAX = 26,
    BLAST_TIME = 420;
  const INTERCEPTOR_SPEED = 5;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [wave, setWave] = useState(1);
  const [citiesLeft, setCitiesLeft] = useState(CITY_X.length);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(null);

  function freshState() {
    return {
      cities: CITY_X.map((x) => ({ x, alive: true })),
      missiles: [],
      interceptors: [],
      blasts: [],
      particles: [],
      wave: 1,
      missilesThisWave: 5,
      spawned: 0,
      spawnTimer: 500,
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setWave(1);
    setCitiesLeft(CITY_X.length);
    setScore(0);
    setOver(null);
  }
  function fireAt(x, y) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    if (s.interceptors.length >= 3) return;
    const ang = Math.atan2(y - GROUND_Y, x - TURRET_X);
    s.interceptors.push({
      x: TURRET_X,
      y: GROUND_Y,
      tx: x,
      ty: y,
      vx: Math.cos(ang) * INTERCEPTOR_SPEED,
      vy: Math.sin(ang) * INTERCEPTOR_SPEED,
    });
    AudioEngine.playSfx("select");
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.spawnTimer -= 16;
        if (s.spawnTimer <= 0 && s.spawned < s.missilesThisWave) {
          s.spawnTimer = 700;
          s.spawned += 1;
          const alive = s.cities.filter((c) => c.alive);
          const target = alive.length
            ? alive[Math.floor(Math.random() * alive.length)].x
            : TURRET_X;
          s.missiles.push({
            x: Math.random() * W,
            y: -6,
            tx: target + (Math.random() - 0.5) * 12,
            ty: GROUND_Y,
            speed: (0.7 + Math.random() * 0.5) * missileSpeedMul,
          });
        }
        s.missiles.forEach((m) => {
          const dx = m.tx - m.x,
            dy = m.ty - m.y;
          const dist = Math.hypot(dx, dy) || 1;
          m.x += (dx / dist) * m.speed;
          m.y += (dy / dist) * m.speed;
        });
        s.interceptors.forEach((ic) => {
          ic.x += ic.vx;
          ic.y += ic.vy;
        });
        s.interceptors.forEach((ic) => {
          if (Math.hypot(ic.tx - ic.x, ic.ty - ic.y) < 6) {
            ic.dead = true;
            s.blasts.push({ x: ic.tx, y: ic.ty, r: 4, timer: BLAST_TIME });
          }
        });
        s.interceptors = s.interceptors.filter(
          (ic) => !ic.dead && ic.y < H && ic.y > -20,
        );
        s.blasts.forEach((b) => {
          b.timer -= 16;
          b.r = BLAST_MAX * (1 - Math.abs(b.timer / BLAST_TIME - 0.5) * 2);
        });
        s.blasts = s.blasts.filter((b) => b.timer > 0);
        s.missiles.forEach((m) => {
          for (const b of s.blasts) {
            if (Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
              m.dead = true;
              s.score += 15;
              setScore(s.score);
              spawnBurst(s.particles, m.x, m.y, "#ffdc80", 8, "score");
            }
          }
        });
        s.missiles = s.missiles.filter((m) => {
          if (m.dead) return false;
          if (m.y >= GROUND_Y - 4) {
            const city = s.cities.find(
              (c) => c.alive && Math.abs(c.x - m.x) < 16,
            );
            if (city) {
              city.alive = false;
              setCitiesLeft(s.cities.filter((c) => c.alive).length);
              spawnBurst(s.particles, city.x, GROUND_Y, "#ff9696", 14, "hit");
            }
            return false;
          }
          return true;
        });
        if (s.cities.every((c) => !c.alive)) {
          s.ended = true;
          setOver("lose");
        } else if (s.spawned >= s.missilesThisWave && s.missiles.length === 0) {
          if (s.wave >= wavesToWin) {
            s.ended = true;
            setOver("win");
          } else {
            s.wave += 1;
            setWave(s.wave);
            s.missilesThisWave += 2;
            s.spawned = 0;
            s.spawnTimer = 900;
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#0a0f1e";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3c3f7d";
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      s2.cities.forEach((c) => {
        if (!c.alive) return;
        ctx.fillStyle = "#78efd9";
        ctx.fillRect(c.x - 10, GROUND_Y - 12, 20, 12);
      });
      ctx.fillStyle = "#8dd1ff";
      ctx.fillRect(TURRET_X - 6, GROUND_Y - 10, 12, 10);
      ctx.strokeStyle = "#ff9696";
      s2.missiles.forEach((m) => {
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - (m.tx - m.x) * 0.1, m.y - (m.ty - m.y) * 0.1);
        ctx.stroke();
      });
      ctx.strokeStyle = "#ffdc80";
      s2.interceptors.forEach((ic) => {
        ctx.beginPath();
        ctx.moveTo(TURRET_X, GROUND_Y);
        ctx.lineTo(ic.x, ic.y);
        ctx.stroke();
      });
      s2.blasts.forEach((b) => {
        ctx.fillStyle = "rgba(255,220,128,0.5)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(2, b.r), 0, Math.PI * 2);
        ctx.fill();
      });
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function onPointer(e) {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    fireAt(x, y);
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Wave: {wave}/{wavesToWin}
        </span>
        <span>Cities: {citiesLeft}</span>
        <span>Score: {score}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="ga-canvas"
          onMouseDown={onPointer}
          onTouchStart={onPointer}
        />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🛡️" : "🏚️"}
          title={over === "win" ? "Skies cleared!" : "Cities lost"}
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">
        Tap/click anywhere to fire an interceptor. Protect your cities
        through {wavesToWin} waves.
      </p>
    </div>
  );
}
/* --------------------------- endless: centipede swarm --------------------------- */

function CentipedeSwarmGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, wormMs, mushroomCount } = {
    easy: { startLives: 4, wormMs: 130, mushroomCount: 18 },
    medium: { startLives: 3, wormMs: 100, mushroomCount: 26 },
    hard: { startLives: 2, wormMs: 75, mushroomCount: 34 },
  }[difficulty];
  const ROWS = 14,
    COLS = 13,
    CELL = 20;
  const W = COLS * CELL,
    H = ROWS * CELL;
  const PLAYER_MIN_ROW = ROWS - 3;
  const BULLET_SPEED = 6;
  const GUN_LEVELS = [
    { cooldown: 160, offsets: [0] },
    { cooldown: 140, offsets: [-1, 1] },
    { cooldown: 120, offsets: [-1, 0, 1] },
    { cooldown: 90, offsets: [-2, -1, 0, 1, 2] },
  ];
  const MAX_GUN_LEVEL = GUN_LEVELS.length;
  const POWERUP_INTERVAL = 13000;
  const POWERUP_FALL_MS = 450;

  function freshMushrooms() {
    const set = new Set();
    while (set.size < mushroomCount) {
      const r = Math.floor(Math.random() * (ROWS - 5));
      const c = Math.floor(Math.random() * COLS);
      set.add(r + "," + c);
    }
    return set;
  }
  function freshWorm(row) {
    const cols = [];
    for (let i = 0; i < 10; i++) cols.push(COLS - 1 - i);
    return { row, cols, dir: -1 };
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [gunLevel, setGunLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [shake, setShake] = useState(false);

  function freshState() {
    return {
      player: { r: ROWS - 1, c: Math.floor(COLS / 2) },
      worms: [freshWorm(0)],
      mushrooms: freshMushrooms(),
      bullets: [],
      powerup: null,
      particles: [],
      lives: startLives,
      score: 0,
      gunLevel: 1,
      wormTimer: 0,
      moveAccum: 0,
      fireTimer: 0,
      powerupTimer: POWERUP_INTERVAL,
      powerupFallTimer: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setGunLevel(1);
    setOver(false);
    setShake(false);
  }
  function hit(s) {
    s.lives -= 1;
    setLives(s.lives);
    setShake(true);
    setTimeout(() => setShake(false), 250);
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    } else {
      s.player.r = ROWS - 1;
      s.player.c = Math.floor(COLS / 2);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      if (!s.ended) {
        s.moveAccum += dt;
        if (s.moveAccum > 55) {
          s.moveAccum = 0;
          if (keysRef.current.left) s.player.c = Math.max(0, s.player.c - 1);
          if (keysRef.current.right)
            s.player.c = Math.min(COLS - 1, s.player.c + 1);
          if (keysRef.current.up)
            s.player.r = Math.max(PLAYER_MIN_ROW, s.player.r - 1);
          if (keysRef.current.down)
            s.player.r = Math.min(ROWS - 1, s.player.r + 1);
        }
        s.fireTimer -= dt;
        if (s.fireTimer <= 0) {
          const level = GUN_LEVELS[s.gunLevel - 1];
          level.offsets.forEach((off) => {
            const c = s.player.c + off;
            if (c >= 0 && c < COLS) {
              s.bullets.push({ c, y: s.player.r * CELL });
            }
          });
          s.fireTimer = level.cooldown;
          AudioEngine.playSfx("select");
        }
        s.powerupTimer -= dt;
        if (s.powerupTimer <= 0) {
          s.powerupTimer = POWERUP_INTERVAL;
          if (s.gunLevel < MAX_GUN_LEVEL && !s.powerup) {
            s.powerup = { r: 0, c: Math.floor(Math.random() * COLS) };
            s.powerupFallTimer = POWERUP_FALL_MS;
          }
        }
        if (s.powerup) {
          s.powerupFallTimer -= dt;
          if (s.powerupFallTimer <= 0) {
            s.powerupFallTimer = POWERUP_FALL_MS;
            s.powerup.r += 1;
            if (s.powerup.r >= ROWS) s.powerup = null;
          }
        }
        s.bullets.forEach((b) => (b.y -= BULLET_SPEED));
        s.bullets = s.bullets.filter((b) => b.y > -CELL);
        s.wormTimer += dt;
        if (s.wormTimer >= wormMs) {
          s.wormTimer = 0;
          s.worms.forEach((worm) => {
            const lead =
              worm.dir === 1 ? Math.max(...worm.cols) : Math.min(...worm.cols);
            const nextLead = lead + worm.dir;
            const blocked =
              nextLead < 0 ||
              nextLead >= COLS ||
              s.mushrooms.has(worm.row + "," + nextLead);
            if (blocked) {
              worm.dir *= -1;
              worm.row += 1;
              if (worm.row > ROWS - 4) worm.row = 0;
            } else {
              worm.cols = worm.cols.map((c) => c + worm.dir);
            }
          });
        }
        s.bullets.forEach((b) => {
          const bc = b.c,
            br = Math.round(b.y / CELL);
          const key = br + "," + bc;
          if (s.mushrooms.has(key)) {
            s.mushrooms.delete(key);
            b.dead = true;
            s.score += 5;
            setScore(s.score);
            spawnBurst(
              s.particles,
              bc * CELL + CELL / 2,
              br * CELL + CELL / 2,
              "#8dd1ff",
              6,
              null,
            );
          }
        });
        const newWorms = [];
        for (const worm of s.worms) {
          let hitCol = null;
          for (const b of s.bullets) {
            if (b.dead) continue;
            const br = Math.round(b.y / CELL);
            if (br === worm.row && worm.cols.includes(b.c)) {
              hitCol = b.c;
              b.dead = true;
              break;
            }
          }
          if (hitCol === null) {
            newWorms.push(worm);
            continue;
          }
          s.score += 20;
          setScore(s.score);
          s.mushrooms.add(worm.row + "," + hitCol);
          spawnBurst(
            s.particles,
            hitCol * CELL + CELL / 2,
            worm.row * CELL + CELL / 2,
            "#ffdc80",
            10,
            "score",
          );
          const remaining = worm.cols.filter((c) => c !== hitCol);
          if (remaining.length) {
            const sorted = [...remaining].sort((a, b2) => a - b2);
            const groups = [];
            let cur = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i] === sorted[i - 1] + 1) cur.push(sorted[i]);
              else {
                groups.push(cur);
                cur = [sorted[i]];
              }
            }
            groups.push(cur);
            groups.forEach((g) =>
              newWorms.push({ row: worm.row, cols: g, dir: worm.dir }),
            );
          }
        }
        s.worms = newWorms;
        s.bullets = s.bullets.filter((b) => !b.dead);
        if (s.worms.length === 0) {
          s.worms = [freshWorm(0)];
          s.mushrooms = freshMushrooms();
        }
        const pr = s.player;
        s.worms.forEach((worm) => {
          if (worm.row === pr.r && worm.cols.includes(pr.c)) hit(s);
        });
        if (s.powerup && s.powerup.r === pr.r && s.powerup.c === pr.c) {
          s.gunLevel = Math.min(MAX_GUN_LEVEL, s.gunLevel + 1);
          setGunLevel(s.gunLevel);
          spawnBurst(
            s.particles,
            pr.c * CELL + CELL / 2,
            pr.r * CELL + CELL / 2,
            "#ffdc80",
            16,
            "score",
          );
          AudioEngine.playSfx("win");
          s.powerup = null;
        }
      }
      const ctx = canvasRef.current.getContext("2d");
      const s2 = stateRef.current;
      ctx.fillStyle = "#101f14";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(180,235,148,0.08)";
      ctx.fillRect(0, PLAYER_MIN_ROW * CELL, W, H - PLAYER_MIN_ROW * CELL);
      ctx.fillStyle = "#8dd1ff";
      s2.mushrooms.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        ctx.fillRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6);
      });
      ctx.fillStyle = "#ff9696";
      s2.worms.forEach((worm) => {
        worm.cols.forEach((c) => {
          ctx.beginPath();
          ctx.arc(
            c * CELL + CELL / 2,
            worm.row * CELL + CELL / 2,
            CELL / 2 - 2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });
      });
      ctx.fillStyle = "#ffdc80";
      s2.bullets.forEach((b) => ctx.fillRect(b.c * CELL + CELL / 2 - 2, b.y, 4, 8));
      if (s2.powerup) {
        ctx.fillStyle = "#ffdc80";
        ctx.beginPath();
        ctx.arc(
          s2.powerup.c * CELL + CELL / 2,
          s2.powerup.r * CELL + CELL / 2,
          CELL / 2 - 3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#101f14";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "P",
          s2.powerup.c * CELL + CELL / 2,
          s2.powerup.r * CELL + CELL / 2 + 3,
        );
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#78efd9";
      ctx.fillRect(
        s2.player.c * CELL + 3,
        s2.player.r * CELL + 3,
        CELL - 6,
        CELL - 6,
      );
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const map = {
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
      ArrowUp: "up",
      w: "up",
      ArrowDown: "down",
      s: "down",
    };
    function onKeyDown(e) {
      if (map[e.key]) {
        keysRef.current[map[e.key]] = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (map[e.key]) keysRef.current[map[e.key]] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Gun Lv.{gunLevel}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-canvas-wrap ${shake ? "ga-shake" : ""}`}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🐛"
          title="Swarmed!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad">
        <button
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
          onMouseLeave={() => press("up", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("up", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("up", false);
          }}
        >
          ↑
        </button>
        <div>
          <button
            onMouseDown={() => press("left", true)}
            onMouseUp={() => press("left", false)}
            onMouseLeave={() => press("left", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("left", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("left", false);
            }}
          >
            ←
          </button>
          <button
            onMouseDown={() => press("down", true)}
            onMouseUp={() => press("down", false)}
            onMouseLeave={() => press("down", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("down", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("down", false);
            }}
          >
            ↓
          </button>
          <button
            onMouseDown={() => press("right", true)}
            onMouseUp={() => press("right", false)}
            onMouseLeave={() => press("right", false)}
            onTouchStart={(e) => {
              e.preventDefault();
              press("right", true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              press("right", false);
            }}
          >
            →
          </button>
        </div>
      </div>
      <p className="ga-hint">
        Move within your zone — your gun fires automatically upward. Grab the
        gold pickups to power it up. Clear the segmented swarm through the
        mushroom field.
      </p>
    </div>
  );
}
/* --------------------------- challenge: bubble pop (bust-a-move style) --------------------------- */

const BUBBLE_COLORS = ["#ff9696", "#ffdc80", "#8dd1ff", "#bea9ff"];

function BubblePopGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { initialRows, loseRow } = {
    easy: { initialRows: 3, loseRow: 10 },
    medium: { initialRows: 4, loseRow: 9 },
    hard: { initialRows: 5, loseRow: 8 },
  }[difficulty];
  const COLS = 8,
    ROWS = 12,
    CELL = 24;
  const W = COLS * CELL,
    H = ROWS * CELL + 40;

  function freshGrid() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push(
          r < initialRows ? Math.floor(Math.random() * BUBBLE_COLORS.length) : null,
        );
      }
      grid.push(row);
    }
    return grid;
  }
  function randColor() {
    return Math.floor(Math.random() * BUBBLE_COLORS.length);
  }

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(null);
  const [nextColor, setNextColor] = useState(0);
  const [column, setColumn] = useState(Math.floor(COLS / 2));

  function freshState() {
    return {
      grid: freshGrid(),
      column: Math.floor(COLS / 2),
      nextColor: randColor(),
      particles: [],
      score: 0,
      ended: false,
    };
  }
  function reset() {
    const s = freshState();
    stateRef.current = s;
    setScore(0);
    setOver(null);
    setNextColor(s.nextColor);
    setColumn(s.column);
  }
  function moveCol(dir) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    s.column = Math.max(0, Math.min(COLS - 1, s.column + dir));
    setColumn(s.column);
  }
  function popGroup(s, r, c, color) {
    const seen = new Set();
    const stack = [[r, c]];
    const group = [];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const key = cr + "," + cc;
      if (seen.has(key)) continue;
      if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) continue;
      if (s.grid[cr][cc] !== color) continue;
      seen.add(key);
      group.push([cr, cc]);
      stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
    }
    return group;
  }
  function dropFloating(s) {
    const reachable = new Set();
    const stack = [];
    for (let c = 0; c < COLS; c++) {
      if (s.grid[0][c] !== null) stack.push([0, c]);
    }
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = r + "," + c;
      if (reachable.has(key)) continue;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (s.grid[r][c] === null) continue;
      reachable.add(key);
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
    let dropped = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (s.grid[r][c] !== null && !reachable.has(r + "," + c)) {
          s.grid[r][c] = null;
          dropped += 1;
          spawnBurst(
            s.particles,
            c * CELL + CELL / 2,
            r * CELL + CELL / 2,
            "#f5f3ff",
            6,
            null,
          );
        }
      }
    }
    return dropped;
  }
  function fire() {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const c = s.column;
    let targetRow = 0;
    for (let r = 0; r < ROWS; r++) {
      if (s.grid[r][c] !== null) targetRow = r + 1;
    }
    if (targetRow >= ROWS) return;
    if (targetRow >= loseRow) {
      s.ended = true;
      setOver("lose");
      return;
    }
    const color = s.nextColor;
    s.grid[targetRow][c] = color;
    AudioEngine.playSfx("select");
    const group = popGroup(s, targetRow, c, color);
    if (group.length >= 3) {
      group.forEach(([r, cc]) => {
        s.grid[r][cc] = null;
        spawnBurst(
          s.particles,
          cc * CELL + CELL / 2,
          r * CELL + CELL / 2,
          BUBBLE_COLORS[color],
          6,
          "score",
        );
      });
      s.score += group.length * 10;
      const dropped = dropFloating(s);
      s.score += dropped * 5;
      setScore(s.score);
      AudioEngine.playSfx("score");
    }
    const anyLeft = s.grid.some((row) => row.some((v) => v !== null));
    if (!anyLeft) {
      s.ended = true;
      setOver("win");
    } else {
      s.nextColor = randColor();
      setNextColor(s.nextColor);
    }
  }

  useEffect(() => {
    reset();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "#181430";
      ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = s.grid[r][c];
          if (v !== null) {
            ctx.fillStyle = BUBBLE_COLORS[v];
            ctx.beginPath();
            ctx.arc(
              c * CELL + CELL / 2,
              r * CELL + CELL / 2,
              CELL / 2 - 2,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, loseRow * CELL);
      ctx.lineTo(W, loseRow * CELL);
      ctx.stroke();
      ctx.fillStyle = BUBBLE_COLORS[s.nextColor];
      ctx.beginPath();
      ctx.arc(s.column * CELL + CELL / 2, ROWS * CELL + 18, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      updateAndDrawParticles(ctx, s.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        moveCol(-1);
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        moveCol(1);
        e.preventDefault();
      }
      if (e.key === " " || e.key === "ArrowUp") {
        fire();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🎈" : "😵"}
          title={over === "win" ? "Board cleared!" : "Stack too high"}
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-dpad-row">
        <button onClick={() => moveCol(-1)}>←</button>
        <button onClick={fire}>🔵 Shoot</button>
        <button onClick={() => moveCol(1)}>→</button>
      </div>
      <p className="ga-hint">
        Pick a column, shoot to attach a bubble. Match 3+ of the same color to
        pop them.
      </p>
    </div>
  );
}
/* --------------------------- challenge: ten pin alley (bowling) --------------------------- */

function TenPinAlleyGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { wobble } = {
    easy: { wobble: 4 },
    medium: { wobble: 8 },
    hard: { wobble: 14 },
  }[difficulty];
  const W = 200,
    H = 320;
  const PIN_Y = 46;
  const LANE_CENTER = W / 2;
  const PIN_POSITIONS = (() => {
    const rows = [4, 3, 2, 1];
    const out = [];
    let y = PIN_Y;
    rows.forEach((count) => {
      const startX = LANE_CENTER - (count - 1) * 11;
      for (let i = 0; i < count; i++) {
        out.push({ x: startX + i * 22, y });
      }
      y -= 18;
    });
    return out;
  })();

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [frame, setFrame] = useState(1);
  const [roll, setRoll] = useState(1);
  const [total, setTotal] = useState(0);
  const [charging, setCharging] = useState(false);
  const [over, setOver] = useState(false);

  function freshPins() {
    return PIN_POSITIONS.map((p) => ({ ...p, standing: true }));
  }
  function freshState() {
    return {
      aimX: 0,
      pins: freshPins(),
      ball: null,
      frame: 1,
      roll: 1,
      total: 0,
      power: 0,
      powerDir: 1,
      charging: false,
      particles: [],
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setFrame(1);
    setRoll(1);
    setTotal(0);
    setCharging(false);
    setOver(false);
  }
  function aim(dir) {
    const s = stateRef.current;
    if (!s || s.ball || s.ended) return;
    s.aimX = Math.max(-60, Math.min(60, s.aimX + dir * 4));
  }
  function startCharge() {
    const s = stateRef.current;
    if (!s || s.ball || s.ended) return;
    s.charging = true;
    s.power = 0;
    s.powerDir = 1;
    setCharging(true);
  }
  function releaseCharge() {
    const s = stateRef.current;
    if (!s || !s.charging) return;
    s.charging = false;
    setCharging(false);
    const drift = (Math.random() - 0.5) * wobble;
    s.ball = {
      x: LANE_CENTER,
      y: H - 30,
      targetX: LANE_CENTER + s.aimX + drift,
      progress: 0,
      power: 0.4 + s.power * 0.6,
    };
    AudioEngine.playSfx("select");
  }
  function resolveRoll(s) {
    const ball = s.ball;
    let knockedNow = 0;
    s.pins.forEach((p) => {
      if (p.standing && Math.abs(p.x - ball.x) < 13) {
        p.standing = false;
        knockedNow += 1;
        spawnBurst(s.particles, p.x, p.y, "#ffdc80", 6, null);
      }
    });
    s.total += knockedNow;
    setTotal(s.total);
    s.ball = null;
    const standingLeft = s.pins.filter((p) => p.standing).length;
    if (knockedNow > 0) AudioEngine.playSfx("hit");
    if (standingLeft === 0 || s.roll === 2) {
      s.frame += 1;
      s.roll = 1;
      s.pins = freshPins();
      if (s.frame > 10) {
        s.ended = true;
        setOver(true);
        return;
      }
    } else {
      s.roll += 1;
    }
    setFrame(s.frame);
    setRoll(s.roll);
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        if (s.charging) {
          s.power += 0.03 * s.powerDir;
          if (s.power >= 1) {
            s.power = 1;
            s.powerDir = -1;
          }
          if (s.power <= 0) {
            s.power = 0;
            s.powerDir = 1;
          }
        }
        if (s.ball) {
          s.ball.progress += 0.02 * s.ball.power * 3;
          const t = Math.min(1, s.ball.progress);
          s.ball.x = LANE_CENTER + (s.ball.targetX - LANE_CENTER) * t;
          s.ball.y = H - 30 - (H - 30 - PIN_Y) * t;
          if (t >= 1) resolveRoll(s);
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d2f22";
      ctx.fillRect(LANE_CENTER - 55, 10, 110, H - 20);
      ctx.fillStyle = "#f5f3ff";
      s2.pins.forEach((p) => {
        if (!p.standing) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!s2.ball && !s2.ended) {
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.moveTo(LANE_CENTER, H - 30);
        ctx.lineTo(LANE_CENTER + s2.aimX, PIN_Y + 10);
        ctx.stroke();
      }
      if (s2.ball) {
        ctx.fillStyle = "#78efd9";
        ctx.beginPath();
        ctx.arc(s2.ball.x, s2.ball.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s2.charging) {
        ctx.fillStyle = "#242643";
        ctx.fillRect(10, H - 14, 80, 8);
        ctx.fillStyle = "#ffdc80";
        ctx.fillRect(10, H - 14, 80 * s2.power, 8);
      }
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        aim(-1);
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        aim(1);
        e.preventDefault();
      }
      if (e.key === " " && stateRef.current && !stateRef.current.charging) {
        startCharge();
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (e.key === " ") {
        releaseCharge();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(total);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Frame: {Math.min(frame, 10)}/10</span>
        <span>Roll: {roll}</span>
        <span>Pins: {total}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🎳"
          title="Game complete!"
          statLines={[`Total pins: ${total}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad-row">
        <button onClick={() => aim(-1)}>←</button>
        <button
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onTouchStart={(e) => {
            e.preventDefault();
            startCharge();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseCharge();
          }}
        >
          🎳 Bowl
        </button>
        <button onClick={() => aim(1)}>→</button>
      </div>
      <p className="ga-hint">
        Aim left/right, hold Bowl to charge power, release to roll. 10
        frames, knock 'em all down.
      </p>
    </div>
  );
}
/* --------------------------- challenge: connect four --------------------------- */

function ConnectFourGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const COLS = 7,
    ROWS = 6;
  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState("P");
  const [result, setResult] = useState(null);
  const [wins, setWins] = useState(0);

  function cloneBoard(b) {
    return b.map((row) => [...row]);
  }
  function dropAt(b, col, mark) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!b[r][col]) {
        b[r][col] = mark;
        return r;
      }
    }
    return -1;
  }
  function checkWinner(b) {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const mark = b[r][c];
        if (!mark) continue;
        for (const [dr, dc] of dirs) {
          let count = 1;
          for (let k = 1; k < 4; k++) {
            const nr = r + dr * k,
              nc = c + dc * k;
            if (
              nr < 0 ||
              nr >= ROWS ||
              nc < 0 ||
              nc >= COLS ||
              b[nr][nc] !== mark
            )
              break;
            count += 1;
          }
          if (count >= 4) return mark;
        }
      }
    }
    return null;
  }
  function validCols(b) {
    const out = [];
    for (let c = 0; c < COLS; c++) if (!b[0][c]) out.push(c);
    return out;
  }
  function cpuMove(b) {
    const avail = validCols(b);
    for (const c of avail) {
      const t = cloneBoard(b);
      dropAt(t, c, "C");
      if (checkWinner(t) === "C") return c;
    }
    for (const c of avail) {
      const t = cloneBoard(b);
      dropAt(t, c, "P");
      if (checkWinner(t) === "P") return c;
    }
    if (difficulty !== "easy") {
      const center = Math.floor(COLS / 2);
      const ordered = [...avail].sort(
        (a, b2) => Math.abs(a - center) - Math.abs(b2 - center),
      );
      return ordered[0];
    }
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function play(col) {
    if (result || turn !== "P") return;
    const b1 = cloneBoard(board);
    if (dropAt(b1, col, "P") === -1) return;
    AudioEngine.playSfx("click");
    setBoard(b1);
    const w1 = checkWinner(b1);
    if (w1 === "P") {
      setResult("win");
      return;
    }
    if (validCols(b1).length === 0) {
      setResult("draw");
      return;
    }
    setTurn("C");
    setTimeout(() => {
      const b2 = cloneBoard(b1);
      const col2 = cpuMove(b2);
      dropAt(b2, col2, "C");
      AudioEngine.playSfx("click");
      setBoard(b2);
      const w2 = checkWinner(b2);
      if (w2 === "C") setResult("lose");
      else if (validCols(b2).length === 0) setResult("draw");
      else setTurn("P");
    }, 450);
  }
  function reset() {
    setBoard(emptyBoard());
    setTurn("P");
    setResult(null);
  }

  useEffect(() => {
    if (result === "win")
      setWins((w) => {
        const nw = w + 1;
        onFinish(nw);
        return nw;
      });
    // eslint-disable-next-line
  }, [result]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Round wins: {wins}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-c4-grid">
        {board.map((row, r) =>
          row.map((v, c) => (
            <button
              key={r + "-" + c}
              className="ga-c4-cell"
              onClick={() => play(c)}
              disabled={!!result}
            >
              {v && (
                <span
                  className="ga-c4-disc"
                  style={{ background: v === "P" ? "#78efd9" : "#ff9696" }}
                />
              )}
            </button>
          )),
        )}
      </div>
      {result && (
        <Overlay
          emoji={result === "win" ? "🏆" : result === "lose" ? "🤖" : "🤝"}
          title={
            result === "win" ? "You win!" : result === "lose" ? "CPU wins" : "Draw"
          }
          statLines={[`Round wins this session: ${wins}`]}
          onRestart={reset}
          onExit={goHome}
          sound={
            result === "win" ? "win" : result === "lose" ? "lose" : "neutral"
          }
        />
      )}
      <p className="ga-hint">
        Tap a column to drop your disc. Connect four in a row before the CPU
        does.
      </p>
    </div>
  );
}
/* --------------------------- challenge: battleship --------------------------- */

function BattleshipGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const SIZE = 8;
  const SHIP_SIZES = {
    easy: [4, 3, 2],
    medium: [5, 4, 3, 2],
    hard: [5, 4, 3, 3, 2],
  }[difficulty];

  function placeShips() {
    const cells = Array.from({ length: SIZE * SIZE }, () => null);
    let shipId = 0;
    for (const size of SHIP_SIZES) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 300) {
        attempts += 1;
        const horizontal = Math.random() < 0.5;
        const r = Math.floor(Math.random() * SIZE);
        const c = Math.floor(Math.random() * SIZE);
        const coords = [];
        for (let i = 0; i < size; i++) {
          const rr = horizontal ? r : r + i;
          const cc = horizontal ? c + i : c;
          if (rr >= SIZE || cc >= SIZE) {
            coords.length = 0;
            break;
          }
          coords.push(rr * SIZE + cc);
        }
        if (
          coords.length === size &&
          coords.every((idx) => cells[idx] === null)
        ) {
          coords.forEach((idx) => (cells[idx] = shipId));
          placed = true;
          shipId += 1;
        }
      }
    }
    return { cells, cellsPerShip: SHIP_SIZES };
  }
  function freshGame() {
    return {
      ...placeShips(),
      shots: Array(SIZE * SIZE).fill(null),
      shotCount: 0,
      hitsPerShip: {},
    };
  }

  const [game, setGame] = useState(freshGame);
  const [over, setOver] = useState(null);

  function reset() {
    setGame(freshGame());
    setOver(null);
  }

  function fireAt(idx) {
    if (over || game.shots[idx] !== null) return;
    const isHit = game.cells[idx] !== null;
    const shots = [...game.shots];
    shots[idx] = isHit ? "hit" : "miss";
    const shotCount = game.shotCount + 1;
    const hitsPerShip = { ...game.hitsPerShip };
    if (isHit) {
      const sid = game.cells[idx];
      hitsPerShip[sid] = (hitsPerShip[sid] || 0) + 1;
      AudioEngine.playSfx("hit");
    } else {
      AudioEngine.playSfx("click");
    }
    setGame({ ...game, shots, shotCount, hitsPerShip });
    const totalShipCells = SHIP_SIZES.reduce((a, b) => a + b, 0);
    const totalHits = Object.values(hitsPerShip).reduce((a, b) => a + b, 0);
    if (totalHits >= totalShipCells) {
      setOver("win");
    }
  }

  useEffect(() => {
    if (over === "win") onFinish(game.shotCount);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Shots: {game.shotCount}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-battle-grid">
        {game.shots.map((s, idx) => (
          <button
            key={idx}
            className={`ga-battle-cell ${
              s === "hit" ? "is-hit" : s === "miss" ? "is-miss" : ""
            }`}
            onClick={() => fireAt(idx)}
            disabled={!!over || s !== null}
          >
            {s === "hit" ? "🔥" : s === "miss" ? "•" : ""}
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🚢"
          title="Fleet sunk!"
          statLines={[`Shots taken: ${game.shotCount}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <p className="ga-hint">
        Tap a cell to fire. Sink the whole hidden fleet in as few shots as you
        can.
      </p>
    </div>
  );
}
/* --------------------------- challenge: checkers --------------------------- */

function CheckersGame({ onFinish, best, goHome }) {
  const SIZE = 8;
  function idx(r, c) {
    return r * SIZE + c;
  }
  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }
  function freshBoard() {
    const b = Array(64).fill(null);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < SIZE; c++)
        if ((r + c) % 2 === 1) b[idx(r, c)] = { owner: "C", king: false };
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < SIZE; c++)
        if ((r + c) % 2 === 1) b[idx(r, c)] = { owner: "P", king: false };
    return b;
  }
  function dirsFor(piece) {
    if (piece.king)
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    return piece.owner === "P"
      ? [
          [-1, -1],
          [-1, 1],
        ]
      : [
          [1, -1],
          [1, 1],
        ];
  }
  function movesFor(board, r, c) {
    const piece = board[idx(r, c)];
    if (!piece) return { simple: [], capture: [] };
    const simple = [],
      capture = [];
    dirsFor(piece).forEach(([dr, dc]) => {
      const nr = r + dr,
        nc = c + dc;
      if (inBounds(nr, nc) && !board[idx(nr, nc)]) simple.push({ r: nr, c: nc });
      const jr = r + dr * 2,
        jc = c + dc * 2;
      if (
        inBounds(nr, nc) &&
        inBounds(jr, jc) &&
        board[idx(nr, nc)] &&
        board[idx(nr, nc)].owner !== piece.owner &&
        !board[idx(jr, jc)]
      ) {
        capture.push({ r: jr, c: jc, capR: nr, capC: nc });
      }
    });
    return { simple, capture };
  }
  function allMoves(board, owner) {
    let anyCapture = false;
    const pieces = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[idx(r, c)];
        if (p && p.owner === owner) {
          const m = movesFor(board, r, c);
          if (m.capture.length) anyCapture = true;
          pieces.push({ r, c, ...m });
        }
      }
    }
    if (anyCapture) {
      return pieces
        .filter((p) => p.capture.length)
        .map((p) => ({ r: p.r, c: p.c, moves: p.capture, isCapture: true }));
    }
    return pieces
      .filter((p) => p.simple.length)
      .map((p) => ({ r: p.r, c: p.c, moves: p.simple, isCapture: false }));
  }

  const [board, setBoard] = useState(freshBoard);
  const [turn, setTurn] = useState("P");
  const [selected, setSelected] = useState(null);
  const [mustContinue, setMustContinue] = useState(null);
  const [result, setResult] = useState(null);
  const [wins, setWins] = useState(0);

  function countPieces(b, owner) {
    return b.filter((p) => p && p.owner === owner).length;
  }
  function applyMove(b, from, move, isCapture) {
    const nb = b.map((p) => (p ? { ...p } : null));
    const piece = nb[idx(from.r, from.c)];
    nb[idx(from.r, from.c)] = null;
    if (isCapture) nb[idx(move.capR, move.capC)] = null;
    const king = piece.king || move.r === 0 || move.r === SIZE - 1;
    nb[idx(move.r, move.c)] = { ...piece, king };
    return nb;
  }
  function cpuTurn(startBoard) {
    let b = startBoard;
    let continuing = null;
    for (let guard = 0; guard < 8; guard++) {
      const options = continuing
        ? [
            {
              r: continuing.r,
              c: continuing.c,
              moves: movesFor(b, continuing.r, continuing.c).capture,
              isCapture: true,
            },
          ]
        : allMoves(b, "C");
      const valid = options.filter((o) => o.moves.length);
      if (!valid.length) break;
      const piece = valid[Math.floor(Math.random() * valid.length)];
      const move = piece.moves[Math.floor(Math.random() * piece.moves.length)];
      b = applyMove(b, { r: piece.r, c: piece.c }, move, piece.isCapture);
      AudioEngine.playSfx("click");
      if (piece.isCapture) {
        const again = movesFor(b, move.r, move.c).capture;
        if (again.length) {
          continuing = { r: move.r, c: move.c };
          continue;
        }
      }
      break;
    }
    setBoard(b);
    if (countPieces(b, "P") === 0) {
      setResult("lose");
    } else {
      setTurn("P");
    }
  }
  function select(r, c) {
    if (result || turn !== "P") return;
    const piece = board[idx(r, c)];
    const forced = mustContinue;
    if (forced) {
      const m = movesFor(board, forced.r, forced.c);
      const target = m.capture.find((mv) => mv.r === r && mv.c === c);
      if (target) doPlayerMove(forced, target, true);
      return;
    }
    if (selected) {
      const m = movesFor(board, selected.r, selected.c);
      const legalSet = m.capture.length ? m.capture : m.simple;
      const target = legalSet.find((mv) => mv.r === r && mv.c === c);
      if (target) {
        doPlayerMove(selected, target, m.capture.length > 0);
        return;
      }
    }
    if (piece && piece.owner === "P") {
      const opts = allMoves(board, "P");
      const allowed = opts.find((o) => o.r === r && o.c === c);
      if (allowed) {
        setSelected({ r, c });
        AudioEngine.playSfx("select");
      }
    }
  }
  function doPlayerMove(from, move, isCapture) {
    const nb = applyMove(board, from, move, isCapture);
    setBoard(nb);
    setSelected(null);
    AudioEngine.playSfx("click");
    if (countPieces(nb, "C") === 0) {
      setResult("win");
      return;
    }
    if (isCapture) {
      const again = movesFor(nb, move.r, move.c).capture;
      if (again.length) {
        setMustContinue({ r: move.r, c: move.c });
        return;
      }
    }
    setMustContinue(null);
    setTurn("C");
    setTimeout(() => cpuTurn(nb), 500);
  }
  function reset() {
    setBoard(freshBoard());
    setTurn("P");
    setSelected(null);
    setMustContinue(null);
    setResult(null);
  }

  useEffect(() => {
    if (result === "win")
      setWins((w) => {
        const nw = w + 1;
        onFinish(nw);
        return nw;
      });
    // eslint-disable-next-line
  }, [result]);

  const legalTargets = (() => {
    const active = mustContinue || selected;
    if (!active) return [];
    const m = movesFor(board, active.r, active.c);
    return m.capture.length ? m.capture : m.simple;
  })();

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Round wins: {wins}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-checkers-grid">
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / SIZE),
            c = i % SIZE;
          const dark = (r + c) % 2 === 1;
          const piece = board[i];
          const active = mustContinue || selected;
          const isSelected = active && active.r === r && active.c === c;
          const isTarget = legalTargets.some((t) => t.r === r && t.c === c);
          return (
            <button
              key={i}
              className={`ga-checkers-cell ${dark ? "is-dark" : ""} ${
                isSelected ? "is-selected" : ""
              } ${isTarget ? "is-target" : ""}`}
              onClick={() => dark && select(r, c)}
              disabled={!!result || !dark}
            >
              {piece && (
                <span
                  className="ga-checkers-piece"
                  style={{ background: piece.owner === "P" ? "#78efd9" : "#ff9696" }}
                >
                  {piece.king ? "♛" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {result && (
        <Overlay
          emoji={result === "win" ? "🏆" : "🤖"}
          title={result === "win" ? "You win!" : "CPU wins"}
          statLines={[`Round wins this session: ${wins}`]}
          onRestart={reset}
          onExit={goHome}
          sound={result === "win" ? "win" : "lose"}
        />
      )}
      <p className="ga-hint">
        Tap a piece then a highlighted square. Captures are mandatory when
        available.
      </p>
    </div>
  );
}
/* --------------------------- challenge: solitaire (klondike) --------------------------- */

const SOL_SUITS = ["S", "H", "D", "C"];
const SOL_SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SOL_RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };

function SolitaireGame({ onFinish, best, goHome }) {
  function freshDeck() {
    const deck = [];
    let id = 0;
    for (const suit of SOL_SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: id++, suit, rank, faceUp: false });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  function isRed(suit) {
    return suit === "H" || suit === "D";
  }
  function freshState() {
    const deck = freshDeck();
    const tableau = [];
    let p = 0;
    for (let col = 0; col < 7; col++) {
      const pile = [];
      for (let i = 0; i <= col; i++) {
        const card = deck[p++];
        card.faceUp = i === col;
        pile.push(card);
      }
      tableau.push(pile);
    }
    const stock = deck.slice(p).map((c) => ({ ...c, faceUp: false }));
    return {
      tableau,
      stock,
      waste: [],
      foundations: { S: [], H: [], D: [], C: [] },
      selected: null,
    };
  }

  const [game, setGame] = useState(freshState);
  const [over, setOver] = useState(false);
  const [moves, setMoves] = useState(0);

  function reset() {
    setGame(freshState());
    setOver(false);
    setMoves(0);
  }
  function drawStock() {
    setGame((g) => {
      const ng = {
        ...g,
        tableau: g.tableau.map((p) => [...p]),
        waste: [...g.waste],
        stock: [...g.stock],
        foundations: { ...g.foundations },
      };
      if (ng.stock.length === 0) {
        ng.stock = ng.waste.reverse().map((c) => ({ ...c, faceUp: false }));
        ng.waste = [];
      } else {
        const card = { ...ng.stock.pop(), faceUp: true };
        ng.waste.push(card);
      }
      return ng;
    });
    AudioEngine.playSfx("click");
  }
  function canStack(target, card) {
    if (!target) return card.rank === 13;
    return isRed(target.suit) !== isRed(card.suit) && target.rank === card.rank + 1;
  }
  function canFoundation(foundationPile, card) {
    if (foundationPile.length === 0) return card.rank === 1;
    return foundationPile[foundationPile.length - 1].rank === card.rank - 1;
  }
  function selectSource(source) {
    setGame((g) => ({ ...g, selected: source }));
    AudioEngine.playSfx("select");
  }
  function tryMoveTo(dest) {
    setGame((g) => {
      const sel = g.selected;
      if (!sel) return g;
      let card;
      if (sel.type === "waste") {
        if (!g.waste.length) return { ...g, selected: null };
        card = g.waste[g.waste.length - 1];
      } else if (sel.type === "tableau") {
        const pile = g.tableau[sel.col];
        card = pile[pile.length - 1];
      } else {
        return { ...g, selected: null };
      }
      const ng = {
        ...g,
        tableau: g.tableau.map((p) => [...p]),
        waste: [...g.waste],
        foundations: {
          ...g.foundations,
          [card.suit]: [...g.foundations[card.suit]],
        },
      };
      let moved = false;
      if (dest.type === "foundation") {
        if (canFoundation(ng.foundations[card.suit], card)) {
          ng.foundations[card.suit].push(card);
          moved = true;
        }
      } else if (dest.type === "tableau") {
        const targetPile = ng.tableau[dest.col];
        const targetTop = targetPile[targetPile.length - 1];
        if (canStack(targetTop, card)) {
          targetPile.push(card);
          moved = true;
        }
      }
      if (!moved) return { ...g, selected: null };
      if (sel.type === "waste") {
        ng.waste.pop();
      } else {
        const pile = ng.tableau[sel.col];
        pile.pop();
        if (pile.length && !pile[pile.length - 1].faceUp)
          pile[pile.length - 1].faceUp = true;
      }
      AudioEngine.playSfx("click");
      setMoves((m) => m + 1);
      return { ...ng, selected: null };
    });
  }
  function clickTableau(col) {
    const pile = game.tableau[col];
    const top = pile[pile.length - 1];
    if (game.selected) {
      tryMoveTo({ type: "tableau", col });
      return;
    }
    if (top && top.faceUp) selectSource({ type: "tableau", col });
  }
  function clickWaste() {
    if (game.selected) return;
    if (game.waste.length) selectSource({ type: "waste" });
  }
  function clickFoundation(suit) {
    if (game.selected) tryMoveTo({ type: "foundation", suit });
  }

  useEffect(() => {
    const total = Object.values(game.foundations).reduce((a, p) => a + p.length, 0);
    if (total === 52 && !over) {
      setOver(true);
      onFinish(moves);
    }
    // eslint-disable-next-line
  }, [game]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Moves: {moves}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-solitaire-top">
        <button className="ga-card-slot" onClick={drawStock}>
          {game.stock.length ? (
            <span className="ga-card back" />
          ) : (
            <span className="ga-card empty">↺</span>
          )}
        </button>
        <button className="ga-card-slot" onClick={clickWaste}>
          {game.waste.length ? (
            <span
              className={`ga-card ${
                isRed(game.waste[game.waste.length - 1].suit) ? "red" : "black"
              } ${game.selected && game.selected.type === "waste" ? "is-selected" : ""}`}
            >
              {SOL_RANK_LABEL[game.waste[game.waste.length - 1].rank] ||
                game.waste[game.waste.length - 1].rank}
              {SOL_SUIT_SYMBOL[game.waste[game.waste.length - 1].suit]}
            </span>
          ) : (
            <span className="ga-card empty" />
          )}
        </button>
        <div className="ga-solitaire-foundations">
          {SOL_SUITS.map((suit) => {
            const pile = game.foundations[suit];
            const top = pile[pile.length - 1];
            return (
              <button
                key={suit}
                className="ga-card-slot"
                onClick={() => clickFoundation(suit)}
              >
                {top ? (
                  <span className={`ga-card ${isRed(suit) ? "red" : "black"}`}>
                    {SOL_RANK_LABEL[top.rank] || top.rank}
                    {SOL_SUIT_SYMBOL[suit]}
                  </span>
                ) : (
                  <span className="ga-card empty">{SOL_SUIT_SYMBOL[suit]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ga-solitaire-tableau">
        {game.tableau.map((pile, col) => (
          <div key={col} className="ga-solitaire-col" onClick={() => clickTableau(col)}>
            {pile.map((card, i) => (
              <span
                key={card.id}
                className={`ga-card ${
                  card.faceUp ? (isRed(card.suit) ? "red" : "black") : "back"
                } ${
                  game.selected &&
                  game.selected.type === "tableau" &&
                  game.selected.col === col &&
                  i === pile.length - 1
                    ? "is-selected"
                    : ""
                }`}
                style={{ marginTop: i === 0 ? 0 : -34 }}
              >
                {card.faceUp
                  ? `${SOL_RANK_LABEL[card.rank] || card.rank}${SOL_SUIT_SYMBOL[card.suit]}`
                  : ""}
              </span>
            ))}
          </div>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🃏"
          title="Solved!"
          statLines={[`Moves used: ${moves}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <p className="ga-hint">
        Tap the stock to draw, tap a card then a pile to move it. Build
        foundations Ace to King.
      </p>
    </div>
  );
}
/* --------------------------- challenge: dice reckoning (yahtzee style) --------------------------- */

const YZ_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];
const YZ_LABELS = {
  ones: "Ones",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeKind: "3 of a Kind",
  fourKind: "4 of a Kind",
  fullHouse: "Full House",
  smallStraight: "Sm. Straight",
  largeStraight: "Lg. Straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

function scoreYzCategory(cat, dice) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((d) => (counts[d] += 1));
  const sum = dice.reduce((a, b) => a + b, 0);
  const numberCats = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
  if (numberCats[cat]) return counts[numberCats[cat]] * numberCats[cat];
  if (cat === "threeKind") return counts.some((c) => c >= 3) ? sum : 0;
  if (cat === "fourKind") return counts.some((c) => c >= 4) ? sum : 0;
  if (cat === "fullHouse") return counts.includes(3) && counts.includes(2) ? 25 : 0;
  if (cat === "smallStraight") {
    const has = (arr) => arr.every((n) => counts[n] > 0);
    return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
  }
  if (cat === "largeStraight") {
    const has = (arr) => arr.every((n) => counts[n] > 0);
    return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
  }
  if (cat === "yahtzee") return counts.some((c) => c === 5) ? 50 : 0;
  if (cat === "chance") return sum;
  return 0;
}

function YahtzeeGame({ onFinish, best, goHome }) {
  function freshState() {
    return {
      dice: [1, 1, 1, 1, 1],
      held: [false, false, false, false, false],
      rollsLeft: 3,
      scores: {},
      round: 1,
    };
  }
  const [game, setGame] = useState(freshState);
  const [over, setOver] = useState(false);
  const [total, setTotal] = useState(0);

  function reset() {
    setGame(freshState());
    setOver(false);
    setTotal(0);
  }
  function roll() {
    if (game.rollsLeft <= 0) return;
    AudioEngine.playSfx("select");
    setGame((g) => ({
      ...g,
      dice: g.dice.map((d, i) => (g.held[i] ? d : 1 + Math.floor(Math.random() * 6))),
      rollsLeft: g.rollsLeft - 1,
    }));
  }
  function toggleHold(i) {
    if (game.rollsLeft === 3) return;
    setGame((g) => {
      const held = [...g.held];
      held[i] = !held[i];
      return { ...g, held };
    });
  }
  function pickCategory(cat) {
    if (game.scores[cat] !== undefined || game.rollsLeft === 3) return;
    const val = scoreYzCategory(cat, game.dice);
    AudioEngine.playSfx("score");
    setGame((g) => {
      const scores = { ...g.scores, [cat]: val };
      const round = g.round + 1;
      if (round > 13) {
        const upperSum = ["ones", "twos", "threes", "fours", "fives", "sixes"].reduce(
          (a, c) => a + (scores[c] || 0),
          0,
        );
        const bonus = upperSum >= 63 ? 35 : 0;
        const finalTotal = Object.values(scores).reduce((a, b) => a + b, 0) + bonus;
        setTotal(finalTotal);
        setOver(true);
        onFinish(finalTotal);
        return { ...g, scores };
      }
      return {
        ...g,
        scores,
        round,
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollsLeft: 3,
      };
    });
  }

  const canPick = game.rollsLeft < 3;

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Round: {Math.min(game.round, 13)}/13</span>
        <span>Rolls left: {game.rollsLeft}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-yz-dice">
        {game.dice.map((d, i) => (
          <button
            key={i}
            className={`ga-yz-die ${game.held[i] ? "is-held" : ""}`}
            onClick={() => toggleHold(i)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="ga-dpad-row">
        <button onClick={roll} disabled={game.rollsLeft <= 0 || over}>
          🎲 Roll ({game.rollsLeft})
        </button>
      </div>
      <div className="ga-yz-categories">
        {YZ_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className="ga-yz-cat"
            onClick={() => pickCategory(cat)}
            disabled={!canPick || game.scores[cat] !== undefined || over}
          >
            <span>{YZ_LABELS[cat]}</span>
            <span>
              {game.scores[cat] !== undefined
                ? game.scores[cat]
                : canPick
                  ? scoreYzCategory(cat, game.dice)
                  : "-"}
            </span>
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🎲"
          title="Scorecard complete!"
          statLines={[`Final score: ${total}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <p className="ga-hint">
        Roll up to 3 times, tap dice to hold them, then lock in a category.
        Fill all 13 rounds.
      </p>
    </div>
  );
}

/* --------------------------- challenge: rally sprint (car racing) --------------------------- */

function RallySprintGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { maxSpeed, turnRate } = {
    easy: { maxSpeed: 3.2, turnRate: 0.05 },
    medium: { maxSpeed: 3.8, turnRate: 0.055 },
    hard: { maxSpeed: 4.4, turnRate: 0.06 },
  }[difficulty];
  const W = 280,
    H = 280;
  const CX = W / 2,
    CY = H / 2;
  const RX = 116,
    RY = 96,
    TRACK_W = 40;
  const INNER_RX = RX - TRACK_W,
    INNER_RY = RY - TRACK_W;
  const THRUST = 0.14,
    DRAG = 0.965,
    OFFTRACK_DRAG = 0.9;
  const LAPS_TARGET = 3;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({
    left: false,
    right: false,
    thrust: false,
    brake: false,
  });
  const [laps, setLaps] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [over, setOver] = useState(false);

  function trackD(x, y) {
    return ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2;
  }
  function innerD(x, y) {
    return ((x - CX) / INNER_RX) ** 2 + ((y - CY) / INNER_RY) ** 2;
  }
  function freshState() {
    return {
      car: { x: CX, y: CY - RY + TRACK_W / 2, vx: 0, vy: 0, angle: 0 },
      particles: [],
      totalAngle: 0,
      lastAngle: null,
      laps: 0,
      elapsed: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setLaps(0);
    setTimeMs(0);
    setOver(false);
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        setTimeMs(s.elapsed);
        const c = s.car;
        if (keysRef.current.left) c.angle -= turnRate;
        if (keysRef.current.right) c.angle += turnRate;
        if (keysRef.current.thrust) {
          c.vx += Math.cos(c.angle) * THRUST;
          c.vy += Math.sin(c.angle) * THRUST;
        }
        if (keysRef.current.brake) {
          c.vx *= 0.9;
          c.vy *= 0.9;
        }
        const speed = Math.hypot(c.vx, c.vy);
        if (speed > maxSpeed) {
          c.vx = (c.vx / speed) * maxSpeed;
          c.vy = (c.vy / speed) * maxSpeed;
        }
        const d = trackD(c.x, c.y);
        const di = innerD(c.x, c.y);
        const onTrack = d <= 1 && di >= 1;
        c.vx *= onTrack ? DRAG : OFFTRACK_DRAG;
        c.vy *= onTrack ? DRAG : OFFTRACK_DRAG;
        c.x += c.vx;
        c.y += c.vy;
        const ang = Math.atan2(c.y - CY, c.x - CX);
        if (s.lastAngle !== null) {
          let delta = ang - s.lastAngle;
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          s.totalAngle += delta;
        }
        s.lastAngle = ang;
        const newLaps = Math.max(0, Math.floor(s.totalAngle / (Math.PI * 2)));
        if (newLaps !== s.laps) {
          s.laps = newLaps;
          setLaps(s.laps);
          AudioEngine.playSfx("score");
          if (s.laps >= LAPS_TARGET) {
            s.ended = true;
            setOver(true);
          }
        }
        if (onTrack && keysRef.current.thrust) {
          spawnBurst(
            s.particles,
            c.x - Math.cos(c.angle) * 8,
            c.y - Math.sin(c.angle) * 8,
            "#8dd1ff",
            1,
            null,
          );
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#1c3a24";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d3d3d";
      ctx.beginPath();
      ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c3a24";
      ctx.beginPath();
      ctx.ellipse(CX, CY, INNER_RX, INNER_RY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5f3ff";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(CX, CY - RY);
      ctx.lineTo(CX, CY - INNER_RY);
      ctx.stroke();
      ctx.setLineDash([]);
      const c2 = s2.car;
      ctx.save();
      ctx.translate(c2.x, c2.y);
      ctx.rotate(c2.angle);
      ctx.fillStyle = "#ff9696";
      ctx.fillRect(-7, -4, 14, 8);
      ctx.restore();
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
      if (["ArrowUp", "w", "W"].includes(e.key)) {
        keysRef.current.thrust = true;
        e.preventDefault();
      }
      if (["ArrowDown", "s", "S"].includes(e.key)) {
        keysRef.current.brake = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.thrust = false;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.brake = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(Math.round(timeMs / 1000));
    // eslint-disable-next-line
  }, [over]);

  function press(k, v) {
    keysRef.current[k] = v;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Lap: {Math.min(laps, LAPS_TARGET)}/{LAPS_TARGET}
        </span>
        <span>Time: {(timeMs / 1000).toFixed(1)}s</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🏁"
          title="Race complete!"
          statLines={[`Time: ${(timeMs / 1000).toFixed(1)}s`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ↺
        </button>
        <button
          onMouseDown={() => press("thrust", true)}
          onMouseUp={() => press("thrust", false)}
          onMouseLeave={() => press("thrust", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("thrust", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("thrust", false);
          }}
        >
          ▲
        </button>
        <button
          onMouseDown={() => press("brake", true)}
          onMouseUp={() => press("brake", false)}
          onMouseLeave={() => press("brake", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("brake", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("brake", false);
          }}
        >
          ▼
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          ↻
        </button>
      </div>
      <p className="ga-hint">
        Steer and accelerate around the loop. Stay on track — grass slows you
        down. Fastest 3-lap time wins.
      </p>
    </div>
  );
}
/* --------------------------- challenge: word guess (wordle style) --------------------------- */

const WG_WORDS = [
  "APPLE","BRAVE","CRANE","DELTA","EAGLE","FROST","GRAPE","HOUSE","IVORY","JOLLY",
  "KNIFE","LEMON","MANGO","NOBLE","OCEAN","PLANT","QUIET","RIVER","STONE","TIGER",
  "UNION","VIVID","WHEAT","XENON","YIELD","ZEBRA","AMBER","BLOOM","CLOUD","DRIFT",
  "EMBER","FLAME","GHOST","HONEY","INPUT","JUMBO","KARMA","LUNAR","MAPLE","NORTH",
  "OASIS","PEARL","QUEST","ROBIN","SOLAR","TRACE","URBAN","VOICE","WITTY","CHESS",
];
const WG_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function computeFeedback(guess, target) {
  const result = Array(5).fill("absent");
  const pool = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      pool[target[i]] = (pool[target[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    if (pool[guess[i]] > 0) {
      result[i] = "present";
      pool[guess[i]] -= 1;
    }
  }
  return result;
}

function WordGuessGame({ onFinish, best, goHome }) {
  function freshState() {
    return {
      target: WG_WORDS[Math.floor(Math.random() * WG_WORDS.length)],
      guesses: [],
      current: "",
      letterStatus: {},
    };
  }
  const [game, setGame] = useState(freshState);
  const [over, setOver] = useState(null);
  const [shake, setShake] = useState(false);

  function reset() {
    setGame(freshState());
    setOver(null);
    setShake(false);
  }
  function submitGuess() {
    setGame((g) => {
      if (g.current.length !== 5 || over) return g;
      const feedback = computeFeedback(g.current, g.target);
      const guesses = [...g.guesses, { letters: g.current.split(""), feedback }];
      const letterStatus = { ...g.letterStatus };
      g.current.split("").forEach((letter, i) => {
        const rank = { absent: 0, present: 1, correct: 2 };
        const cur = letterStatus[letter];
        if (!cur || rank[feedback[i]] > rank[cur]) letterStatus[letter] = feedback[i];
      });
      AudioEngine.playSfx("click");
      if (g.current === g.target) {
        setTimeout(() => {
          setOver("win");
          onFinish(guesses.length);
        }, 300);
      } else if (guesses.length >= 6) {
        setTimeout(() => setOver("lose"), 300);
      } else {
        setShake(false);
      }
      return { ...g, guesses, current: "", letterStatus };
    });
  }
  function pressKey(k) {
    if (over) return;
    setGame((g) => {
      if (k === "ENTER") {
        if (g.current.length !== 5) {
          setShake(true);
          setTimeout(() => setShake(false), 300);
          return g;
        }
        return g;
      }
      if (k === "BACK") return { ...g, current: g.current.slice(0, -1) };
      if (g.current.length < 5 && /^[A-Z]$/.test(k)) return { ...g, current: g.current + k };
      return g;
    });
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (over) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressKey("BACK");
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        pressKey(e.key.toUpperCase());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line
  }, [game, over]);

  const colorFor = { correct: "#78efd9", present: "#ffdc80", absent: "#3d3d5c" };

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Guesses: {game.guesses.length}/6</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className={`ga-wg-grid ${shake ? "ga-shake" : ""}`}>
        {Array.from({ length: 6 }, (_, r) => {
          const guess = game.guesses[r];
          const letters = guess
            ? guess.letters
            : r === game.guesses.length
              ? game.current.padEnd(5, " ").split("")
              : Array(5).fill(" ");
          return (
            <div key={r} className="ga-wg-row">
              {letters.map((letter, c) => (
                <span
                  key={c}
                  className="ga-wg-cell"
                  style={{
                    background: guess ? colorFor[guess.feedback[c]] : "transparent",
                    color: guess ? "#1c1c2e" : "#f5f3ff",
                  }}
                >
                  {letter.trim()}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {over && (
        <Overlay
          emoji={over === "win" ? "🟩" : "🟥"}
          title={over === "win" ? "Solved it!" : `The word was ${game.target}`}
          statLines={[
            over === "win" ? `Guesses used: ${game.guesses.length}` : "Better luck next time",
          ]}
          onRestart={reset}
          onExit={goHome}
          sound={over === "win" ? "win" : "lose"}
        />
      )}
      <div className="ga-wg-keyboard">
        {WG_ROWS.map((row, i) => (
          <div key={i} className="ga-wg-krow">
            {i === 2 && (
              <button className="ga-wg-key ga-wg-wide" onClick={submitGuess}>
                Enter
              </button>
            )}
            {row.split("").map((k) => (
              <button
                key={k}
                className="ga-wg-key"
                style={{
                  background: game.letterStatus[k] ? colorFor[game.letterStatus[k]] : undefined,
                }}
                onClick={() => pressKey(k)}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button
                className="ga-wg-key ga-wg-wide"
                onClick={() => pressKey("BACK")}
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="ga-hint">
        Guess the 5-letter word in 6 tries. Green = right spot, yellow = wrong
        spot, gray = not in the word.
      </p>
    </div>
  );
}
/* --------------------------- challenge: slide fifteen (15-puzzle) --------------------------- */

function SlideFifteenGame({ onFinish, best, goHome }) {
  const SIZE = 4;
  function solved() {
    const arr = Array.from({ length: 15 }, (_, i) => i + 1);
    arr.push(0);
    return arr;
  }
  function neighbors(idx) {
    const r = Math.floor(idx / SIZE),
      c = idx % SIZE;
    const out = [];
    if (r > 0) out.push(idx - SIZE);
    if (r < SIZE - 1) out.push(idx + SIZE);
    if (c > 0) out.push(idx - 1);
    if (c < SIZE - 1) out.push(idx + 1);
    return out;
  }
  function shuffled() {
    const arr = solved();
    let blank = 15;
    for (let i = 0; i < 250; i++) {
      const opts = neighbors(blank);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      [arr[blank], arr[pick]] = [arr[pick], arr[blank]];
      blank = pick;
    }
    return arr;
  }

  const [board, setBoard] = useState(shuffled);
  const [moves, setMoves] = useState(0);
  const [over, setOver] = useState(false);

  function reset() {
    setBoard(shuffled());
    setMoves(0);
    setOver(false);
  }
  function tap(idx) {
    if (over) return;
    const blank = board.indexOf(0);
    if (neighbors(blank).includes(idx)) {
      const nb = [...board];
      [nb[blank], nb[idx]] = [nb[idx], nb[blank]];
      setBoard(nb);
      AudioEngine.playSfx("click");
      const nm = moves + 1;
      setMoves(nm);
      if (nb.every((v, i) => v === solved()[i])) {
        setOver(true);
        onFinish(nm);
      }
    }
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Moves: {moves}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-slide-grid">
        {board.map((v, i) => (
          <button
            key={i}
            className={`ga-slide-cell ${v === 0 ? "is-blank" : ""}`}
            onClick={() => tap(i)}
            disabled={v === 0 || !!over}
          >
            {v !== 0 ? v : ""}
          </button>
        ))}
      </div>
      {over && (
        <Overlay
          emoji="🧩"
          title="Solved!"
          statLines={[`Moves used: ${moves}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <p className="ga-hint">
        Tap a tile next to the blank space to slide it. Arrange 1 through 15
        in order.
      </p>
    </div>
  );
}
/* --------------------------- endless: fruit slice --------------------------- */

function FruitSliceGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { startLives, spawnMs, bombChance } = {
    easy: { startLives: 4, spawnMs: 1000, bombChance: 0.1 },
    medium: { startLives: 3, spawnMs: 800, bombChance: 0.16 },
    hard: { startLives: 2, spawnMs: 600, bombChance: 0.22 },
  }[difficulty];
  const W = 280,
    H = 380;
  const GRAVITY = 0.14;
  const COLORS = ["#ff9696", "#ffdc80", "#8dd1ff", "#bea9ff", "#78efd9"];

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [over, setOver] = useState(false);

  function spawnItem() {
    const isBomb = Math.random() < bombChance;
    return {
      x: 30 + Math.random() * (W - 60),
      y: H + 14,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -(6.5 + Math.random() * 1.8),
      r: 15,
      bomb: isBomb,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      sliced: false,
    };
  }
  function freshState() {
    return {
      items: [],
      particles: [],
      lives: startLives,
      score: 0,
      spawnTimer: 400,
      elapsed: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setLives(startLives);
    setOver(false);
  }
  function loseLife(s) {
    s.lives -= 1;
    setLives(s.lives);
    if (s.lives <= 0) {
      s.ended = true;
      setOver(true);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const ramp = 1 + Math.min(1, s.elapsed / 40000);
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / ramp;
          s.items.push(spawnItem());
        }
        s.items.forEach((it) => {
          it.vy += GRAVITY;
          it.x += it.vx;
          it.y += it.vy;
        });
        s.items.forEach((it) => {
          if (!it.sliced && it.y > H + 30 && !it.bomb) {
            it.dead = true;
            loseLife(s);
          } else if (it.y > H + 30) {
            it.dead = true;
          }
        });
        s.items = s.items.filter((it) => !it.dead);
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#1c1730";
      ctx.fillRect(0, 0, W, H);
      s2.items.forEach((it) => {
        if (it.sliced) return;
        ctx.fillStyle = it.bomb ? "#242643" : it.color;
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        ctx.fill();
        if (it.bomb) {
          ctx.fillStyle = "#ff9696";
          ctx.fillRect(it.x - 1, it.y - it.r - 6, 2, 6);
        }
      });
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  function onPointer(e) {
    e.preventDefault();
    const s = stateRef.current;
    if (!s || s.ended) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touches = e.touches ? Array.from(e.touches) : [e];
    touches.forEach((t) => {
      const x = ((t.clientX - rect.left) / rect.width) * W;
      const y = ((t.clientY - rect.top) / rect.height) * H;
      s.items.forEach((it) => {
        if (it.sliced || it.dead) return;
        if (Math.hypot(it.x - x, it.y - y) < it.r + 10) {
          it.sliced = true;
          it.dead = true;
          if (it.bomb) {
            spawnBurst(s.particles, it.x, it.y, "#ff9696", 20, "hit");
            AudioEngine.playSfx("hit");
            s.ended = true;
            setOver(true);
          } else {
            spawnBurst(s.particles, it.x, it.y, it.color, 12, "score");
            AudioEngine.playSfx("score");
            s.score += 1;
            setScore(s.score);
          }
        }
      });
    });
  }

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Lives: {"♥".repeat(Math.max(0, lives))}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="ga-canvas"
          onMouseDown={onPointer}
          onTouchStart={onPointer}
        />
      </div>
      {over && (
        <Overlay
          emoji="💣"
          title="Sliced a bomb!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap or click the fruit to slice it. Avoid the bombs, don't let fruit
        fall past you.
      </p>
    </div>
  );
}
/* --------------------------- endless: tower stack --------------------------- */

function TowerStackGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { speedMul } = {
    easy: { speedMul: 0.8 },
    medium: { speedMul: 1 },
    hard: { speedMul: 1.25 },
  }[difficulty];
  const W = 240,
    H = 380;
  const BLOCK_H = 24;
  const START_W = 130;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  function freshState() {
    return {
      stack: [{ x: W / 2 - START_W / 2, w: START_W, color: "#78efd9" }],
      moving: { x: 0, w: START_W, dir: 1, speed: 1.6 * speedMul },
      camY: 0,
      particles: [],
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setOver(false);
  }
  const PALETTE = ["#78efd9", "#8dd1ff", "#bea9ff", "#ffdc80", "#ff9696"];

  function drop() {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const top = s.stack[s.stack.length - 1];
    const mv = s.moving;
    const left = Math.max(top.x, mv.x);
    const right = Math.min(top.x + top.w, mv.x + mv.w);
    const overlap = right - left;
    if (overlap <= 4) {
      s.ended = true;
      setOver(true);
      spawnBurst(s.particles, mv.x + mv.w / 2, H - 100, "#ff9696", 16, "hit");
      return;
    }
    s.stack.push({
      x: left,
      w: overlap,
      color: PALETTE[s.stack.length % PALETTE.length],
    });
    s.score += 1;
    setScore(s.score);
    AudioEngine.playSfx("click");
    spawnBurst(s.particles, left + overlap / 2, H - 100, "#ffdc80", 8, "score");
    s.moving = {
      x: Math.random() < 0.5 ? 0 : W - overlap,
      w: overlap,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: Math.min(4.5, 1.6 * speedMul + s.stack.length * 0.08),
    };
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        const mv = s.moving;
        mv.x += mv.dir * mv.speed;
        if (mv.x <= 0 || mv.x + mv.w >= W) mv.dir *= -1;
        mv.x = Math.max(0, Math.min(W - mv.w, mv.x));
        const targetCam = Math.max(0, (s.stack.length - 8) * BLOCK_H);
        s.camY += (targetCam - s.camY) * 0.1;
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#171a30";
      ctx.fillRect(0, 0, W, H);
      s2.stack.forEach((b, i) => {
        const y = H - 60 - (i + 1) * BLOCK_H + s2.camY;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, y, b.w, BLOCK_H - 2);
      });
      if (!s2.ended) {
        const y = H - 60 - (s2.stack.length + 1) * BLOCK_H + s2.camY;
        ctx.fillStyle = PALETTE[s2.stack.length % PALETTE.length];
        ctx.fillRect(s2.moving.x, y, s2.moving.w, BLOCK_H - 2);
      }
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        drop();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Height: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap" onMouseDown={drop} onTouchStart={(e) => { e.preventDefault(); drop(); }}>
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🏗️"
          title="Tower toppled!"
          statLines={[`Blocks stacked: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap, click, or press Space to drop the block. Line it up with the
        block below to keep the tower growing.
      </p>
    </div>
  );
}
/* --------------------------- challenge: sky hoops (basketball) --------------------------- */

function SkyHoopsGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { totalShots, hoopMoveRange } = {
    easy: { totalShots: 10, hoopMoveRange: 40 },
    medium: { totalShots: 10, hoopMoveRange: 70 },
    hard: { totalShots: 10, hoopMoveRange: 100 },
  }[difficulty];
  const W = 260,
    H = 320;
  const GRAVITY = 0.22;
  const BALL_R = 9;
  const RIM_W = 34;
  const START_X = W / 2,
    START_Y = H - 30;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [made, setMade] = useState(0);
  const [charging, setCharging] = useState(false);
  const [over, setOver] = useState(false);

  function randomHoop() {
    return {
      x: W / 2 + (Math.random() - 0.5) * hoopMoveRange * 2,
      y: 60 + Math.random() * 50,
    };
  }
  function freshState() {
    return {
      hoop: randomHoop(),
      ball: { x: START_X, y: START_Y, vx: 0, vy: 0, flying: false, scored: false },
      power: 0,
      powerDir: 1,
      charging: false,
      shotsTaken: 0,
      made: 0,
      particles: [],
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setShotsTaken(0);
    setMade(0);
    setCharging(false);
    setOver(false);
  }
  function startCharge() {
    const s = stateRef.current;
    if (!s || s.ball.flying || s.ended) return;
    s.charging = true;
    s.power = 0;
    s.powerDir = 1;
    setCharging(true);
  }
  function releaseCharge() {
    const s = stateRef.current;
    if (!s || !s.charging) return;
    s.charging = false;
    setCharging(false);
    const dx = s.hoop.x - START_X;
    const power = 0.55 + s.power * 0.5;
    s.ball.vx = dx * 0.02 * power * 2.2;
    s.ball.vy = -(9 + power * 3.5);
    s.ball.flying = true;
    s.ball.scored = false;
    AudioEngine.playSfx("select");
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        if (s.charging) {
          s.power += 0.03 * s.powerDir;
          if (s.power >= 1) {
            s.power = 1;
            s.powerDir = -1;
          }
          if (s.power <= 0) {
            s.power = 0;
            s.powerDir = 1;
          }
        }
        const b = s.ball;
        if (b.flying) {
          b.vy += GRAVITY;
          b.x += b.vx;
          b.y += b.vy;
          if (
            !b.scored &&
            b.vy > 0 &&
            Math.abs(b.x - s.hoop.x) < RIM_W / 2 - 4 &&
            b.y > s.hoop.y - 6 &&
            b.y < s.hoop.y + 10
          ) {
            b.scored = true;
            s.made += 1;
            setMade(s.made);
            spawnBurst(s.particles, s.hoop.x, s.hoop.y, "#ffdc80", 14, "score");
            AudioEngine.playSfx("score");
          }
          if (b.y > H + 20 || b.x < -20 || b.x > W + 20) {
            s.shotsTaken += 1;
            setShotsTaken(s.shotsTaken);
            if (s.shotsTaken >= totalShots) {
              s.ended = true;
              setOver(true);
            } else {
              s.hoop = randomHoop();
              s.ball = { x: START_X, y: START_Y, vx: 0, vy: 0, flying: false, scored: false };
            }
          }
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#241833";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#f5f3ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s2.hoop.x - RIM_W / 2, s2.hoop.y);
      ctx.lineTo(s2.hoop.x + RIM_W / 2, s2.hoop.y);
      ctx.stroke();
      ctx.fillStyle = "#ff9696";
      ctx.fillRect(s2.hoop.x + RIM_W / 2, s2.hoop.y - 24, 3, 24);
      ctx.lineWidth = 1;
      ctx.fillStyle = "#ffb381";
      ctx.beginPath();
      ctx.arc(s2.ball.x, s2.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      if (!s2.ball.flying && !s2.ended) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(START_X, START_Y);
        ctx.lineTo(s2.hoop.x, s2.hoop.y);
        ctx.stroke();
      }
      if (s2.charging) {
        ctx.fillStyle = "#242643";
        ctx.fillRect(10, H - 14, 80, 8);
        ctx.fillStyle = "#ffdc80";
        ctx.fillRect(10, H - 14, 80 * s2.power, 8);
      }
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (over) onFinish(made);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Shot: {Math.min(shotsTaken + 1, totalShots)}/{totalShots}
        </span>
        <span>Made: {made}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🏀"
          title="Round complete!"
          statLines={[`Baskets made: ${made}/${totalShots}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onTouchStart={(e) => {
            e.preventDefault();
            startCharge();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseCharge();
          }}
        >
          🏀 Hold to shoot
        </button>
      </div>
      <p className="ga-hint">
        Hold to charge your shot, release to shoot. The hoop moves after
        every attempt — {totalShots} shots total.
      </p>
    </div>
  );
}
/* --------------------------- challenge: dart throw --------------------------- */

function DartThrowGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { wobbleMax } = {
    easy: { wobbleMax: 26 },
    medium: { wobbleMax: 38 },
    hard: { wobbleMax: 50 },
  }[difficulty];
  const W = 240,
    H = 260;
  const CX = W / 2,
    CY = H / 2 - 6;
  const RINGS = [
    { r: 12, pts: 50, color: "#ff9696" },
    { r: 28, pts: 25, color: "#f5f3ff" },
    { r: 50, pts: 15, color: "#8dd1ff" },
    { r: 80, pts: 10, color: "#f5f3ff" },
  ];
  const TOTAL_THROWS = 10;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [throwsTaken, setThrowsTaken] = useState(0);
  const [total, setTotal] = useState(0);
  const [charging, setCharging] = useState(false);
  const [over, setOver] = useState(false);

  function freshState() {
    return {
      reticle: { x: CX, y: CY },
      darts: [],
      power: 0,
      powerDir: 1,
      charging: false,
      throwsTaken: 0,
      total: 0,
      particles: [],
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setThrowsTaken(0);
    setTotal(0);
    setCharging(false);
    setOver(false);
  }
  function moveReticle(dx, dy) {
    const s = stateRef.current;
    if (!s || s.ended || s.charging) return;
    s.reticle.x = Math.max(20, Math.min(W - 20, s.reticle.x + dx));
    s.reticle.y = Math.max(20, Math.min(H - 20, s.reticle.y + dy));
  }
  function startCharge() {
    const s = stateRef.current;
    if (!s || s.ended) return;
    s.charging = true;
    s.power = 0;
    s.powerDir = 1;
    setCharging(true);
  }
  function scoreFor(dist) {
    for (const ring of RINGS) if (dist <= ring.r) return ring.pts;
    return 0;
  }
  function releaseCharge() {
    const s = stateRef.current;
    if (!s || !s.charging) return;
    s.charging = false;
    setCharging(false);
    const accuracy = s.power;
    const wobble = wobbleMax * (1 - accuracy);
    const ang = Math.random() * Math.PI * 2;
    const off = Math.random() * wobble;
    const dx = s.reticle.x - CX + Math.cos(ang) * off;
    const dy = s.reticle.y - CY + Math.sin(ang) * off;
    const dist = Math.hypot(dx, dy);
    const pts = scoreFor(dist);
    s.total += pts;
    setTotal(s.total);
    s.darts.push({ x: CX + dx, y: CY + dy });
    spawnBurst(s.particles, CX + dx, CY + dy, pts > 0 ? "#ffdc80" : "#a8a6c8", 8, pts > 0 ? "score" : null);
    AudioEngine.playSfx(pts >= 25 ? "win" : "click");
    s.throwsTaken += 1;
    setThrowsTaken(s.throwsTaken);
    if (s.throwsTaken >= TOTAL_THROWS) {
      s.ended = true;
      setOver(true);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    function loop() {
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended && s.charging) {
        s.power += 0.025 * s.powerDir;
        if (s.power >= 1) {
          s.power = 1;
          s.powerDir = -1;
        }
        if (s.power <= 0) {
          s.power = 0;
          s.powerDir = 1;
        }
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#1c1730";
      ctx.fillRect(0, 0, W, H);
      [...RINGS].reverse().forEach((ring) => {
        ctx.fillStyle = ring.color;
        ctx.beginPath();
        ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#242643";
      ctx.beginPath();
      ctx.arc(CX, CY, 5, 0, Math.PI * 2);
      ctx.fill();
      s2.darts.forEach((d) => {
        ctx.fillStyle = "#242643";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!s2.ended) {
        ctx.strokeStyle = "#78efd9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s2.reticle.x - 6, s2.reticle.y);
        ctx.lineTo(s2.reticle.x + 6, s2.reticle.y);
        ctx.moveTo(s2.reticle.x, s2.reticle.y - 6);
        ctx.lineTo(s2.reticle.x, s2.reticle.y + 6);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (s2.charging) {
        ctx.fillStyle = "#242643";
        ctx.fillRect(10, H - 14, 80, 8);
        ctx.fillStyle = "#ffdc80";
        ctx.fillRect(10, H - 14, 80 * s2.power, 8);
      }
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        moveReticle(-4, 0);
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        moveReticle(4, 0);
        e.preventDefault();
      }
      if (["ArrowUp", "w", "W"].includes(e.key)) {
        moveReticle(0, -4);
        e.preventDefault();
      }
      if (["ArrowDown", "s", "S"].includes(e.key)) {
        moveReticle(0, 4);
        e.preventDefault();
      }
      if (e.key === " " && stateRef.current && !stateRef.current.charging) {
        startCharge();
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (e.key === " ") {
        releaseCharge();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(total);
    // eslint-disable-next-line
  }, [over]);

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Throw: {Math.min(throwsTaken + 1, TOTAL_THROWS)}/{TOTAL_THROWS}
        </span>
        <span>Score: {total}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="🎯"
          title="Round complete!"
          statLines={[`Total score: ${total}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => moveReticle(0, -8)}>↑</button>
        <div>
          <button onClick={() => moveReticle(-8, 0)}>←</button>
          <button onClick={() => moveReticle(0, 8)}>↓</button>
          <button onClick={() => moveReticle(8, 0)}>→</button>
        </div>
      </div>
      <div className="ga-dpad-row">
        <button
          onMouseDown={startCharge}
          onMouseUp={releaseCharge}
          onTouchStart={(e) => {
            e.preventDefault();
            startCharge();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseCharge();
          }}
        >
          🎯 Hold to throw
        </button>
      </div>
      <p className="ga-hint">
        Move the reticle, hold to charge steadiness, release near full for
        the most accurate throw. {TOTAL_THROWS} darts total.
      </p>
    </div>
  );
}
/* --------------------------- endless: slalom ski --------------------------- */

function SlalomSkiGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { spawnMs, speedMul } = {
    easy: { spawnMs: 1100, speedMul: 0.85 },
    medium: { spawnMs: 900, speedMul: 1 },
    hard: { spawnMs: 700, speedMul: 1.25 },
  }[difficulty];
  const W = 220,
    H = 360;
  const SKIER_Y = H - 70;
  const SKIER_W = 16,
    SKIER_H = 26;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({ left: false, right: false });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  function spawnObstacle() {
    const isGate = Math.random() < 0.7;
    if (isGate) {
      const gapX = 40 + Math.random() * (W - 80);
      const gapW = 60;
      return { type: "gate", y: -20, gapX, gapW, passed: false };
    }
    return { type: "tree", y: -20, x: 20 + Math.random() * (W - 40) };
  }
  function freshState() {
    return {
      skierX: W / 2,
      obstacles: [],
      particles: [],
      spawnTimer: 600,
      elapsed: 0,
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setOver(false);
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const ramp = speedMul * (1 + Math.min(1.2, s.elapsed / 35000));
        if (keysRef.current.left) s.skierX = Math.max(14, s.skierX - 3.2);
        if (keysRef.current.right) s.skierX = Math.min(W - 14, s.skierX + 3.2);
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / ramp;
          s.obstacles.push(spawnObstacle());
        }
        s.obstacles.forEach((o) => (o.y += 2.6 * ramp));
        s.obstacles.forEach((o) => {
          if (o.type === "gate" && !o.passed && o.y > SKIER_Y) {
            o.passed = true;
            const inGap = s.skierX > o.gapX && s.skierX < o.gapX + o.gapW;
            if (inGap) {
              s.score += 1;
              setScore(s.score);
              AudioEngine.playSfx("score");
            } else {
              spawnBurst(s.particles, s.skierX, SKIER_Y, "#ff9696", 10, "hit");
            }
          }
          if (
            o.type === "tree" &&
            Math.abs(o.y - SKIER_Y) < 14 &&
            Math.abs(o.x - s.skierX) < 14
          ) {
            s.ended = true;
            setOver(true);
            spawnBurst(s.particles, s.skierX, SKIER_Y, "#ff9696", 16, "hit");
          }
        });
        s.obstacles = s.obstacles.filter((o) => o.y < H + 30);
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#eef3f7";
      ctx.fillRect(0, 0, W, H);
      s2.obstacles.forEach((o) => {
        if (o.type === "gate") {
          ctx.fillStyle = "#ff9696";
          ctx.fillRect(o.gapX - 6, o.y, 6, 20);
          ctx.fillStyle = "#8dd1ff";
          ctx.fillRect(o.gapX + o.gapW, o.y, 6, 20);
        } else {
          ctx.fillStyle = "#2c6b3f";
          ctx.beginPath();
          ctx.moveTo(o.x, o.y - 10);
          ctx.lineTo(o.x + 10, o.y + 10);
          ctx.lineTo(o.x - 10, o.y + 10);
          ctx.closePath();
          ctx.fill();
        }
      });
      ctx.fillStyle = "#242643";
      ctx.fillRect(s2.skierX - SKIER_W / 2, SKIER_Y - SKIER_H / 2, SKIER_W, SKIER_H);
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) {
        keysRef.current.left = true;
        e.preventDefault();
      }
      if (["ArrowRight", "d", "D"].includes(e.key)) {
        keysRef.current.right = true;
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function press(dir, isDown) {
    if (dir === "left") keysRef.current.left = isDown;
    if (dir === "right") keysRef.current.right = isDown;
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Gates: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="ga-canvas" />
      </div>
      {over && (
        <Overlay
          emoji="⛷️"
          title="Wiped out!"
          statLines={[`Gates passed: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <div className="ga-dpad-row">
        <button
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
          onMouseLeave={() => press("left", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("left", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("left", false);
          }}
        >
          ←
        </button>
        <button
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
          onMouseLeave={() => press("right", false)}
          onTouchStart={(e) => {
            e.preventDefault();
            press("right", true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            press("right", false);
          }}
        >
          →
        </button>
      </div>
      <p className="ga-hint">
        Arrows to steer. Ski between the flag gates, dodge the trees.
      </p>
    </div>
  );
}
/* --------------------------- endless: tile tap (piano tiles style) --------------------------- */

function TileTapGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { fallSpeedMul, spawnMs } = {
    easy: { fallSpeedMul: 0.85, spawnMs: 620 },
    medium: { fallSpeedMul: 1, spawnMs: 520 },
    hard: { fallSpeedMul: 1.2, spawnMs: 420 },
  }[difficulty];
  const LANES = 4;
  const LANE_W = 60;
  const W = LANES * LANE_W,
    H = 380;
  const TAP_ZONE_Y = H - 70;
  const TILE_H = 66;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  function freshState() {
    return {
      tiles: [],
      particles: [],
      spawnTimer: 300,
      elapsed: 0,
      score: 0,
      ended: false,
    };
  }
  function reset() {
    stateRef.current = freshState();
    setScore(0);
    setOver(false);
  }
  function fail(s) {
    s.ended = true;
    setOver(true);
    AudioEngine.playSfx("hit");
  }
  function tapLane(lane) {
    const s = stateRef.current;
    if (!s || s.ended) return;
    const candidate = s.tiles.find(
      (t) => t.lane === lane && !t.hit && t.y + TILE_H > TAP_ZONE_Y - 30 && t.y < TAP_ZONE_Y + 40,
    );
    if (candidate) {
      candidate.hit = true;
      s.score += 1;
      setScore(s.score);
      AudioEngine.playSfx("click");
      spawnBurst(
        s.particles,
        lane * LANE_W + LANE_W / 2,
        TAP_ZONE_Y,
        "#78efd9",
        8,
        "score",
      );
    } else {
      fail(s);
    }
  }

  useEffect(() => {
    stateRef.current = freshState();
    let last = performance.now();
    function loop(now) {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      const ctx = canvasRef.current.getContext("2d");
      if (!s.ended) {
        s.elapsed += dt;
        const ramp = fallSpeedMul * (1 + Math.min(1.3, s.elapsed / 30000));
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = spawnMs / ramp;
          s.tiles.push({
            lane: Math.floor(Math.random() * LANES),
            y: -TILE_H,
            hit: false,
          });
        }
        s.tiles.forEach((t) => (t.y += 3.4 * ramp));
        s.tiles.forEach((t) => {
          if (!t.hit && t.y > TAP_ZONE_Y + 40) {
            fail(s);
          }
        });
        s.tiles = s.tiles.filter((t) => t.y < H + TILE_H && !t.hit);
      }
      const s2 = stateRef.current;
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, W, H);
      for (let i = 1; i < LANES; i++) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(i * LANE_W, 0);
        ctx.lineTo(i * LANE_W, H);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(120,239,217,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, TAP_ZONE_Y + 30);
      ctx.lineTo(W, TAP_ZONE_Y + 30);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#f5f3ff";
      s2.tiles.forEach((t) => {
        ctx.fillRect(t.lane * LANE_W + 3, t.y, LANE_W - 6, TILE_H - 4);
      });
      updateAndDrawParticles(ctx, s2.particles);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const map = { a: 0, s: 1, k: 2, l: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
      if (map[e.key] !== undefined) {
        e.preventDefault();
        tapLane(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (over) onFinish(score);
    // eslint-disable-next-line
  }, [over]);

  function onCanvasClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touches = e.touches ? Array.from(e.touches) : [e];
    touches.forEach((t) => {
      const x = ((t.clientX - rect.left) / rect.width) * W;
      const lane = Math.min(LANES - 1, Math.max(0, Math.floor(x / LANE_W)));
      tapLane(lane);
    });
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Score: {score}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="ga-canvas"
          onMouseDown={onCanvasClick}
          onTouchStart={(e) => {
            e.preventDefault();
            onCanvasClick(e);
          }}
        />
      </div>
      {over && (
        <Overlay
          emoji="🎹"
          title="Missed a tile!"
          statLines={[`Score: ${score}`]}
          onRestart={reset}
          onExit={goHome}
          sound="lose"
        />
      )}
      <p className="ga-hint">
        Tap the lane as its tile crosses the line — A/S/K/L or 1-4 also work.
        Miss one and it's over.
      </p>
    </div>
  );
}
/* --------------------------- challenge: sokoban --------------------------- */

const SOKOBAN_LEVELS = [
  [
    "#######",
    "#.....#",
    "#.B.O.#",
    "#..P..#",
    "#.....#",
    "#######",
  ],
  [
    "########",
    "#..#...#",
    "#.O.B..#",
    "#..B.O.#",
    "#...P..#",
    "#..#...#",
    "########",
  ],
  [
    "#########",
    "#O..#...#",
    "#.B.#.B.#",
    "#...P...#",
    "#.B...O.#",
    "#...#..O#",
    "#########",
  ],
];

function parseSokobanLevel(rows) {
  const walls = new Set();
  const targets = new Set();
  const boxes = new Set();
  let player = { r: 0, c: 0 };
  rows.forEach((row, r) => {
    row.split("").forEach((ch, c) => {
      const key = r + "," + c;
      if (ch === "#") walls.add(key);
      if (ch === "O") targets.add(key);
      if (ch === "B") boxes.add(key);
      if (ch === "P") player = { r, c };
    });
  });
  return { walls, targets, boxes, player, rows };
}

function SokobanGame({ onFinish, best, goHome }) {
  function freshLevel(idx) {
    return parseSokobanLevel(SOKOBAN_LEVELS[idx]);
  }
  const [levelIdx, setLevelIdx] = useState(0);
  const [level, setLevel] = useState(() => freshLevel(0));
  const [moves, setMoves] = useState(0);
  const [over, setOver] = useState(false);

  function reset() {
    setLevelIdx(0);
    setLevel(freshLevel(0));
    setMoves(0);
    setOver(false);
  }
  function isSolved(lv) {
    return [...lv.targets].every((t) => lv.boxes.has(t));
  }
  function move(dir) {
    if (over) return;
    const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
    setLevel((lv) => {
      const nr = lv.player.r + d[0],
        nc = lv.player.c + d[1];
      const key = nr + "," + nc;
      if (lv.walls.has(key)) return lv;
      let boxes = lv.boxes;
      if (lv.boxes.has(key)) {
        const br = nr + d[0],
          bc = nc + d[1];
        const bkey = br + "," + bc;
        if (lv.walls.has(bkey) || lv.boxes.has(bkey)) return lv;
        boxes = new Set(lv.boxes);
        boxes.delete(key);
        boxes.add(bkey);
      }
      const nl = { ...lv, boxes, player: { r: nr, c: nc } };
      setMoves((m) => m + 1);
      AudioEngine.playSfx("click");
      if (isSolved(nl)) {
        if (levelIdx + 1 >= SOKOBAN_LEVELS.length) {
          setOver(true);
          onFinish(moves + 1);
        } else {
          AudioEngine.playSfx("score");
          setTimeout(() => {
            setLevelIdx((i) => i + 1);
            setLevel(freshLevel(levelIdx + 1));
          }, 500);
        }
      }
      return nl;
    });
  }

  useEffect(() => {
    function onKeyDown(e) {
      const map = {
        ArrowUp: "up",
        w: "up",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
        ArrowRight: "right",
        d: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line
  }, [level, over, levelIdx]);

  const rows = level.rows.length;
  const cols = level.rows[0].length;

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>
          Level: {levelIdx + 1}/{SOKOBAN_LEVELS.length}
        </span>
        <span>Moves: {moves}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div
        className="ga-sokoban-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 26px)` }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols),
            c = i % cols;
          const key = r + "," + c;
          const isWall = level.walls.has(key);
          const isTarget = level.targets.has(key);
          const isBox = level.boxes.has(key);
          const isPlayer = level.player.r === r && level.player.c === c;
          return (
            <div
              key={i}
              className={`ga-sokoban-cell ${isWall ? "is-wall" : ""} ${
                isTarget ? "is-target" : ""
              }`}
            >
              {isBox && (
                <span
                  className={`ga-sokoban-box ${isTarget ? "is-placed" : ""}`}
                />
              )}
              {isPlayer && <span className="ga-sokoban-player" />}
            </div>
          );
        })}
      </div>
      {over && (
        <Overlay
          emoji="📦"
          title="All levels cleared!"
          statLines={[`Total moves: ${moves}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad">
        <button onClick={() => move("up")}>↑</button>
        <div>
          <button onClick={() => move("left")}>←</button>
          <button onClick={() => move("down")}>↓</button>
          <button onClick={() => move("right")}>→</button>
        </div>
      </div>
      <p className="ga-hint">
        Push every box onto a marked target. You can only push, never pull.
      </p>
    </div>
  );
}
/* --------------------------- challenge: sudoku mini (6x6) --------------------------- */

function SudokuMiniGame({ onFinish, best, goHome, difficulty = "medium" }) {
  const { blanks } = {
    easy: { blanks: 14 },
    medium: { blanks: 18 },
    hard: { blanks: 22 },
  }[difficulty];
  const SIZE = 6;

  function boxOf(r, c) {
    const br = Math.floor(r / 2) * 2;
    const bc = Math.floor(c / 3) * 3;
    return { br, bc };
  }
  function valid(grid, r, c, val) {
    for (let i = 0; i < SIZE; i++) {
      if (grid[r][i] === val) return false;
      if (grid[i][c] === val) return false;
    }
    const { br, bc } = boxOf(r, c);
    for (let dr = 0; dr < 2; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (grid[br + dr][bc + dc] === val) return false;
    return true;
  }
  function generateSolution() {
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    function fill(pos) {
      if (pos === SIZE * SIZE) return true;
      const r = Math.floor(pos / SIZE),
        c = pos % SIZE;
      const nums = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
      for (const n of nums) {
        if (valid(grid, r, c, n)) {
          grid[r][c] = n;
          if (fill(pos + 1)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
    fill(0);
    return grid;
  }
  function freshState() {
    const solution = generateSolution();
    const puzzle = solution.map((row) => [...row]);
    let removed = 0;
    while (removed < blanks) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (puzzle[r][c] !== 0) {
        puzzle[r][c] = 0;
        removed += 1;
      }
    }
    return { solution, puzzle, fixed: puzzle.map((row) => row.map((v) => v !== 0)) };
  }

  const [state, setState] = useState(freshState);
  const [selected, setSelected] = useState(null);
  const [mistakes, setMistakes] = useState(0);
  const [over, setOver] = useState(false);

  function reset() {
    setState(freshState());
    setSelected(null);
    setMistakes(0);
    setOver(false);
  }
  function pickNumber(n) {
    if (over || !selected) return;
    const { r, c } = selected;
    if (state.fixed[r][c]) return;
    if (state.solution[r][c] === n) {
      const puzzle = state.puzzle.map((row) => [...row]);
      puzzle[r][c] = n;
      setState({ ...state, puzzle });
      AudioEngine.playSfx("click");
      const solved = puzzle.every((row, ri) => row.every((v, ci) => v === state.solution[ri][ci]));
      if (solved) {
        setOver(true);
        onFinish(mistakes);
      }
    } else {
      setMistakes((m) => m + 1);
      AudioEngine.playSfx("hit");
    }
  }

  return (
    <div className="ga-game-col">
      <div className="ga-hud">
        <span>Mistakes: {mistakes}</span>
        <span>Best: {best ?? 0}</span>
      </div>
      <div className="ga-sudoku-grid">
        {state.puzzle.map((row, r) =>
          row.map((v, c) => (
            <button
              key={r + "-" + c}
              className={`ga-sudoku-cell ${state.fixed[r][c] ? "is-fixed" : ""} ${
                selected && selected.r === r && selected.c === c ? "is-selected" : ""
              } ${c % 3 === 2 && c !== SIZE - 1 ? "border-right" : ""} ${
                r % 2 === 1 && r !== SIZE - 1 ? "border-bottom" : ""
              }`}
              onClick={() => !state.fixed[r][c] && !over && setSelected({ r, c })}
              disabled={state.fixed[r][c] || over}
            >
              {v !== 0 ? v : ""}
            </button>
          )),
        )}
      </div>
      {over && (
        <Overlay
          emoji="🔢"
          title="Solved!"
          statLines={[`Mistakes made: ${mistakes}`]}
          onRestart={reset}
          onExit={goHome}
          sound="win"
        />
      )}
      <div className="ga-dpad-row">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} onClick={() => pickNumber(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="ga-hint">
        Tap a cell, then a number. Fill so every row, column, and 2×3 box has
        1 through 6 with no repeats.
      </p>
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
  2048: TwentyFortyEightGame,
  quiz: QuizGame,
  rps: RPSGame,
  pong: PongGame,
  platformer: PlatformerGame,
  roadhopper: RoadHopperGame,
  simon: SimonGame,
  pinball: PinballGame,
  brickbreaker: BrickBreakerGame,
  minesweeper: MinesweeperGame,
  blockblast: BlockBlastGame,
  mazemuncher: MazeMuncherGame,
  skybarrage: SkyBarrageGame,
  byteraider: ByteRaiderGame,
  barrelclimb: BarrelClimbGame,
  bubbletrap: BubbleTrapGame,
  duelring: DuelRingGame,
  peakclimber: PeakClimberGame,
  ninehole: NineHoleGame,
  lanerace: LaneRacerGame,
  asteroid: AsteroidBlitzGame,
  bomberquest: BomberQuestGame,
  airhockey: AirHockeyGame,
  missile: MissileDefenseGame,
  centipede: CentipedeSwarmGame,
  bubblepop: BubblePopGame,
  tenpinalley: TenPinAlleyGame,
  connectfour: ConnectFourGame,
  battleship: BattleshipGame,
  checkers: CheckersGame,
  solitaire: SolitaireGame,
  yahtzee: YahtzeeGame,
  rallysprint: RallySprintGame,
  wordguess: WordGuessGame,
  slidefifteen: SlideFifteenGame,
  fruitslice: FruitSliceGame,
  towerstack: TowerStackGame,
  skyhoops: SkyHoopsGame,
  dartthrow: DartThrowGame,
  slalomski: SlalomSkiGame,
  tiletap: TileTapGame,
  sokoban: SokobanGame,
  sudokumini: SudokuMiniGame,
};

const GAMES = [
  {
    id: "snake",
    name: "Serpent Loop",
    category: "endless",
    tagline: "Eat, grow, don't double back.",
    difficulty: "Easy",
    icon: Zap,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "flappy",
    name: "Flap Cadet",
    category: "endless",
    tagline: "Thread the gaps forever.",
    difficulty: "Medium",
    icon: Wind,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "reflex",
    name: "Reflex Reactor",
    category: "endless",
    tagline: "Catch the falling sparks.",
    difficulty: "Medium",
    icon: Target,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "whack",
    name: "Whack Rush",
    category: "endless",
    tagline: "Bonk critters before they duck.",
    difficulty: "Easy",
    icon: Hand,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "huechase",
    name: "Hue Chase",
    category: "endless",
    tagline: "Tap the named color, fast.",
    difficulty: "Hard",
    icon: Palette,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "tictactoe",
    name: "Tri-Line Duel",
    category: "challenge",
    tagline: "Beat the CPU in 3x3.",
    difficulty: "Easy",
    icon: Grid3x3,
    scoreLabel: "wins",
    lowerIsBetter: false,
  },
  {
    id: "memory",
    name: "Mirror Match",
    category: "challenge",
    tagline: "Clear the board in fewest flips.",
    difficulty: "Easy",
    icon: Layers,
    scoreLabel: "moves",
    lowerIsBetter: true,
  },
  {
    id: "2048",
    name: "Merge to 2048",
    category: "challenge",
    tagline: "Slide tiles to the target.",
    difficulty: "Medium",
    icon: Puzzle,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "quiz",
    name: "Brain Sprint",
    category: "challenge",
    tagline: "10 questions, one final score.",
    difficulty: "Medium",
    icon: Brain,
    scoreLabel: "/10",
    lowerIsBetter: false,
  },
  {
    id: "rps",
    name: "Best of Five",
    category: "challenge",
    tagline: "First to 3 round-wins.",
    difficulty: "Easy",
    icon: Sparkles,
    scoreLabel: "streak",
    lowerIsBetter: false,
  },
  {
    id: "pong",
    name: "Paddle Duel",
    category: "challenge",
    tagline: "First to 7 points wins.",
    difficulty: "Medium",
    icon: Circle,
    scoreLabel: "streak",
    lowerIsBetter: false,
  },
  {
    id: "platformer",
    name: "Byte Hopper",
    category: "challenge",
    tagline: "Stomp bugs, grab bytes, reach the server.",
    difficulty: "Hard",
    icon: Mountain,
    scoreLabel: "bytes",
    lowerIsBetter: false,
  },
  {
    id: "roadhopper",
    name: "Road Hopper",
    category: "endless",
    tagline: "Dodge traffic, ride the logs.",
    difficulty: "Medium",
    icon: ChevronsUp,
    scoreLabel: "crossings",
    lowerIsBetter: false,
  },
  {
    id: "simon",
    name: "Echo Sequence",
    category: "endless",
    tagline: "Watch the pattern, repeat it back.",
    difficulty: "Medium",
    icon: Repeat,
    scoreLabel: "streak",
    lowerIsBetter: false,
  },
  {
    id: "pinball",
    name: "Steel Bounce",
    category: "endless",
    tagline: "Pull the plunger, flip the paddles, chase the score.",
    difficulty: "Medium",
    icon: Disc,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "brickbreaker",
    name: "Wall Smasher",
    category: "challenge",
    tagline: "Clear every brick before you run out of balls.",
    difficulty: "Medium",
    icon: LayoutGrid,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "minesweeper",
    name: "Grid Sweeper",
    category: "challenge",
    tagline: "Clear the board without hitting a mine.",
    difficulty: "Hard",
    icon: Bomb,
    scoreLabel: "wins",
    lowerIsBetter: false,
  },
  {
    id: "blockblast",
    name: "Block Blast",
    category: "endless",
    tagline: "Drop the blocks, clear the lines.",
    difficulty: "Medium",
    icon: Blocks,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "mazemuncher",
    name: "Dot Muncher",
    category: "challenge",
    tagline: "Eat every dot, dodge the ghosts.",
    difficulty: "Medium",
    icon: Ghost,
    scoreLabel: "dots",
    lowerIsBetter: false,
  },
  {
    id: "skybarrage",
    name: "Sky Barrage",
    category: "endless",
    tagline: "Hold the line against endless waves.",
    difficulty: "Medium",
    icon: Rocket,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "byteraider",
    name: "Byte Raider",
    category: "endless",
    tagline: "Run, gun, survive the swarm.",
    difficulty: "Hard",
    icon: Crosshair,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "barrelclimb",
    name: "Barrel Climb",
    category: "challenge",
    tagline: "Dodge the barrels, reach the top.",
    difficulty: "Medium",
    icon: TrendingUp,
    scoreLabel: "climbs",
    lowerIsBetter: false,
  },
  {
    id: "bubbletrap",
    name: "Bubble Trap",
    category: "challenge",
    tagline: "Pop every foe to clear the level.",
    difficulty: "Medium",
    icon: Waves,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "duelring",
    name: "Duel Ring",
    category: "challenge",
    tagline: "Best of 3 rounds wins the match.",
    difficulty: "Medium",
    icon: Swords,
    scoreLabel: "rounds",
    lowerIsBetter: false,
  },
  {
    id: "peakclimber",
    name: "Peak Climber",
    category: "endless",
    tagline: "Bounce skyward, dodge the ice.",
    difficulty: "Medium",
    icon: Snowflake,
    scoreLabel: "m",
    lowerIsBetter: false,
  },
  {
    id: "ninehole",
    name: "Fairway Putt",
    category: "challenge",
    tagline: "3 holes, fewest strokes wins.",
    difficulty: "Easy",
    icon: Flag,
    scoreLabel: "strokes",
    lowerIsBetter: true,
  },
  {
    id: "lanerace",
    name: "Lane Racer",
    category: "endless",
    tagline: "Dodge oncoming traffic, survive the road.",
    difficulty: "Medium",
    icon: Car,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "asteroid",
    name: "Asteroid Blitz",
    category: "endless",
    tagline: "Rotate, thrust, blast the drifting rocks.",
    difficulty: "Medium",
    icon: Orbit,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "bomberquest",
    name: "Bomber Quest",
    category: "challenge",
    tagline: "Place bombs, clear the arena.",
    difficulty: "Medium",
    icon: Flame,
    scoreLabel: "kills",
    lowerIsBetter: false,
  },
  {
    id: "airhockey",
    name: "Air Hockey",
    category: "challenge",
    tagline: "First to 7 goals wins the match.",
    difficulty: "Medium",
    icon: Goal,
    scoreLabel: "goals",
    lowerIsBetter: false,
  },
  {
    id: "missile",
    name: "Missile Defense",
    category: "challenge",
    tagline: "Intercept the barrage, protect your cities.",
    difficulty: "Medium",
    icon: ShieldAlert,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "centipede",
    name: "Centipede Swarm",
    category: "endless",
    tagline: "Shoot the segmented bug through the mushrooms.",
    difficulty: "Hard",
    icon: Bug,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "bubblepop",
    name: "Bubble Pop",
    category: "challenge",
    tagline: "Match 3+ bubbles to clear the board.",
    difficulty: "Medium",
    icon: CircleDot,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "tenpinalley",
    name: "Ten Pin Alley",
    category: "challenge",
    tagline: "10 frames, knock down every pin.",
    difficulty: "Easy",
    icon: Pin,
    scoreLabel: "pins",
    lowerIsBetter: false,
  },
  {
    id: "connectfour",
    name: "Connect Four",
    category: "challenge",
    tagline: "Line up four before the CPU does.",
    difficulty: "Medium",
    icon: Coins,
    scoreLabel: "wins",
    lowerIsBetter: false,
  },
  {
    id: "battleship",
    name: "Battleship",
    category: "challenge",
    tagline: "Sink the hidden fleet in as few shots as you can.",
    difficulty: "Medium",
    icon: Ship,
    scoreLabel: "shots",
    lowerIsBetter: true,
  },
  {
    id: "checkers",
    name: "Checkers",
    category: "challenge",
    tagline: "Classic board strategy vs the CPU.",
    difficulty: "Medium",
    icon: Grid2x2,
    scoreLabel: "wins",
    lowerIsBetter: false,
  },
  {
    id: "solitaire",
    name: "Solitaire",
    category: "challenge",
    tagline: "Klondike — build the foundations Ace to King.",
    difficulty: "Easy",
    icon: Spade,
    scoreLabel: "moves",
    lowerIsBetter: true,
  },
  {
    id: "yahtzee",
    name: "Dice Reckoning",
    category: "challenge",
    tagline: "Fill all 13 categories for the highest score.",
    difficulty: "Easy",
    icon: Dices,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "rallysprint",
    name: "Rally Sprint",
    category: "challenge",
    tagline: "Fastest 3-lap time around the loop wins.",
    difficulty: "Medium",
    icon: Gauge,
    scoreLabel: "sec",
    lowerIsBetter: true,
  },
  {
    id: "wordguess",
    name: "Word Guess",
    category: "challenge",
    tagline: "Guess the 5-letter word in 6 tries.",
    difficulty: "Medium",
    icon: Keyboard,
    scoreLabel: "guesses",
    lowerIsBetter: true,
  },
  {
    id: "slidefifteen",
    name: "Slide Fifteen",
    category: "challenge",
    tagline: "Slide tiles into order in the fewest moves.",
    difficulty: "Easy",
    icon: Shuffle,
    scoreLabel: "moves",
    lowerIsBetter: true,
  },
  {
    id: "fruitslice",
    name: "Fruit Slice",
    category: "endless",
    tagline: "Slice the fruit, dodge the bombs.",
    difficulty: "Medium",
    icon: Apple,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "towerstack",
    name: "Tower Stack",
    category: "endless",
    tagline: "Drop each block, keep the tower aligned.",
    difficulty: "Medium",
    icon: Boxes,
    scoreLabel: "blocks",
    lowerIsBetter: false,
  },
  {
    id: "skyhoops",
    name: "Sky Hoops",
    category: "challenge",
    tagline: "10 shots, sink as many baskets as you can.",
    difficulty: "Medium",
    icon: Dribbble,
    scoreLabel: "made",
    lowerIsBetter: false,
  },
  {
    id: "dartthrow",
    name: "Dart Throw",
    category: "challenge",
    tagline: "10 darts, highest total score wins.",
    difficulty: "Medium",
    icon: LocateFixed,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "slalomski",
    name: "Slalom Ski",
    category: "endless",
    tagline: "Weave through the gates, dodge the trees.",
    difficulty: "Medium",
    icon: TreePine,
    scoreLabel: "gates",
    lowerIsBetter: false,
  },
  {
    id: "tiletap",
    name: "Tile Tap",
    category: "endless",
    tagline: "Tap each tile as it crosses the line.",
    difficulty: "Hard",
    icon: Music2,
    scoreLabel: "pts",
    lowerIsBetter: false,
  },
  {
    id: "sokoban",
    name: "Sokoban",
    category: "challenge",
    tagline: "Push every box onto its target.",
    difficulty: "Medium",
    icon: Box,
    scoreLabel: "moves",
    lowerIsBetter: true,
  },
  {
    id: "sudokumini",
    name: "Sudoku Mini",
    category: "challenge",
    tagline: "6x6 sudoku — fewest mistakes wins.",
    difficulty: "Medium",
    icon: Hash,
    scoreLabel: "mistakes",
    lowerIsBetter: true,
  },
];

/* --------------------------------- hub ----------------------------------- */

function GameArt({ id, accent }) {
  let shapes = null;
  switch (id) {
    case "snake":
      shapes = (
        <>
          <path
            d="M10 46 H22 V34 H34 V22 H46 V14"
            stroke="#78efd9"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="14" r="4" fill="#ffdc80" />
        </>
      );
      break;
    case "flappy":
      shapes = (
        <>
          <rect x="12" y="2" width="9" height="22" fill="#78efd9" />
          <rect x="12" y="36" width="9" height="26" fill="#78efd9" />
          <rect x="42" y="0" width="9" height="28" fill="#78efd9" />
          <rect x="42" y="44" width="9" height="20" fill="#78efd9" />
          <circle cx="30" cy="34" r="6" fill="#ffdc80" />
        </>
      );
      break;
    case "reflex":
      shapes = (
        <>
          <circle
            cx="32"
            cy="46"
            r="11"
            fill="none"
            stroke="#ff9696"
            strokeWidth="3"
          />
          <circle cx="32" cy="46" r="4" fill="#ff9696" />
          <path
            d="M20 8 L23 16 L31 17 L25 23 L27 31 L20 27 L13 31 L15 23 L9 17 L17 16 Z"
            fill="#ffdc80"
          />
        </>
      );
      break;
    case "whack":
      shapes = (
        <>
          <ellipse cx="32" cy="48" rx="18" ry="7" fill="#242643" />
          <path d="M17 48 a15 16 0 0 1 30 0 Z" fill="#ff9696" />
          <circle cx="26" cy="41" r="2.2" fill="#242643" />
          <circle cx="38" cy="41" r="2.2" fill="#242643" />
        </>
      );
      break;
    case "huechase":
      shapes = (
        <>
          <rect x="10" y="10" width="18" height="18" rx="4" fill="#ff9696" />
          <rect x="36" y="10" width="18" height="18" rx="4" fill="#78efd9" />
          <rect x="10" y="36" width="18" height="18" rx="4" fill="#ffdc80" />
          <rect x="36" y="36" width="18" height="18" rx="4" fill="#bea9ff" />
        </>
      );
      break;
    case "tictactoe":
      shapes = (
        <>
          <line
            x1="24"
            y1="8"
            x2="24"
            y2="56"
            stroke="#a8a6c8"
            strokeWidth="3"
          />
          <line
            x1="40"
            y1="8"
            x2="40"
            y2="56"
            stroke="#a8a6c8"
            strokeWidth="3"
          />
          <line
            x1="8"
            y1="24"
            x2="56"
            y2="24"
            stroke="#a8a6c8"
            strokeWidth="3"
          />
          <line
            x1="8"
            y1="40"
            x2="56"
            y2="40"
            stroke="#a8a6c8"
            strokeWidth="3"
          />
          <path
            d="M12 12 L20 20 M20 12 L12 20"
            stroke="#ffdc80"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx="48"
            cy="48"
            r="6"
            fill="none"
            stroke="#ff9696"
            strokeWidth="3"
          />
        </>
      );
      break;
    case "memory":
      shapes = (
        <>
          <rect
            x="9"
            y="16"
            width="22"
            height="30"
            rx="4"
            fill="#47497d"
            transform="rotate(-8 20 31)"
          />
          <rect
            x="31"
            y="16"
            width="22"
            height="30"
            rx="4"
            fill="#78efd9"
            transform="rotate(7 42 31)"
          />
          <path
            d="M30 10 L32 16 L38 17 L33 21 L35 27 L30 23 L25 27 L27 21 L22 17 L28 16 Z"
            fill="#ffdc80"
          />
        </>
      );
      break;
    case "2048":
      shapes = (
        <>
          <rect x="8" y="36" width="14" height="14" rx="2" fill="#47497d" />
          <rect x="25" y="28" width="17" height="22" rx="2" fill="#b382bb" />
          <rect x="45" y="16" width="14" height="34" rx="2" fill="#ffdc80" />
        </>
      );
      break;
    case "quiz":
      shapes = (
        <>
          <path
            d="M10 14 h44 a4 4 0 0 1 4 4 v18 a4 4 0 0 1 -4 4 h-26 l-8 8 v-8 h-10 a4 4 0 0 1 -4 -4 v-18 a4 4 0 0 1 4 -4 Z"
            fill="#47497d"
          />
          <text
            x="32"
            y="34"
            fontSize="20"
            fontWeight="700"
            fill="#ffdc80"
            textAnchor="middle"
          >
            ?
          </text>
        </>
      );
      break;
    case "rps":
      shapes = (
        <>
          <circle cx="20" cy="24" r="9" fill="#a8a6c8" />
          <rect x="36" y="14" width="18" height="18" rx="3" fill="#f5f3ff" />
          <path
            d="M14 44 L24 54 M24 44 L14 54"
            stroke="#ff9696"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "pong":
      shapes = (
        <>
          <line
            x1="32"
            y1="6"
            x2="32"
            y2="58"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
            strokeDasharray="4 5"
          />
          <rect x="8" y="24" width="5" height="18" fill="#78efd9" />
          <rect x="51" y="22" width="5" height="18" fill="#ff9696" />
          <circle cx="32" cy="32" r="4" fill="#ffdc80" />
        </>
      );
      break;
    case "platformer":
      shapes = (
        <>
          <path d="M4 54 H20 V44 H34 V34 H50 V54 Z" fill="#47497d" />
          <rect x="38" y="20" width="10" height="10" fill="#78efd9" />
          <path
            d="M52 14 V30 M52 14 L60 18 L52 22"
            stroke="#ff9696"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    case "roadhopper":
      shapes = (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 15 + 5}
              y="30"
              width="9"
              height="4"
              fill="rgba(255,255,255,0.4)"
            />
          ))}
          <rect x="10" y="14" width="20" height="10" rx="2" fill="#ff9696" />
          <circle cx="46" cy="46" r="8" fill="#6bbd97" />
        </>
      );
      break;
    case "simon":
      shapes = (
        <>
          <path d="M32 32 L32 8 A24 24 0 0 1 56 32 Z" fill="#78efd9" />
          <path d="M32 32 L56 32 A24 24 0 0 1 32 56 Z" fill="#ff9696" />
          <path d="M32 32 L32 56 A24 24 0 0 1 8 32 Z" fill="#ffdc80" />
          <path d="M32 32 L8 32 A24 24 0 0 1 32 8 Z" fill="#bea9ff" />
          <circle cx="32" cy="32" r="7" fill="#2a2c4e" />
        </>
      );
      break;
    case "pinball":
      shapes = (
        <>
          <rect
            x="20"
            y="4"
            width="24"
            height="52"
            rx="8"
            fill="none"
            stroke="#47497d"
            strokeWidth="3"
          />
          <circle cx="32" cy="18" r="5" fill="#ff9696" />
          <circle cx="32" cy="38" r="4" fill="#ffdc80" />
          <rect
            x="21"
            y="48"
            width="10"
            height="4"
            rx="2"
            fill="#78efd9"
            transform="rotate(-12 26 50)"
          />
          <rect
            x="33"
            y="48"
            width="10"
            height="4"
            rx="2"
            fill="#78efd9"
            transform="rotate(12 38 50)"
          />
        </>
      );
      break;
    case "brickbreaker":
      shapes = (
        <>
          {[0, 1, 2, 3].map((c) => (
            <rect
              key={"a" + c}
              x={8 + c * 12}
              y="12"
              width="10"
              height="7"
              fill="#ff9696"
            />
          ))}
          {[0, 1, 2, 3].map((c) => (
            <rect
              key={"b" + c}
              x={8 + c * 12}
              y="21"
              width="10"
              height="7"
              fill="#ffdc80"
            />
          ))}
          <rect x="22" y="48" width="20" height="5" rx="2" fill="#78efd9" />
          <circle cx="32" cy="40" r="4" fill="#f5f3ff" />
        </>
      );
      break;
    case "minesweeper":
      shapes = (
        <>
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={r + "-" + c}
                x={12 + c * 14}
                y={12 + r * 14}
                width="12"
                height="12"
                rx="2"
                fill="#47497d"
              />
            )),
          )}
          <path d="M39 15 v10 l7 -5 Z" fill="#ff9696" />
          <text
            x="19"
            y="41"
            fontSize="10"
            fontWeight="700"
            fill="#8dd1ff"
            textAnchor="middle"
          >
            2
          </text>
        </>
      );
      break;
    case "blockblast":
      shapes = (
        <>
          <rect x="8" y="10" width="12" height="12" rx="2" fill="#ff5fa2" />
          <rect x="22" y="10" width="12" height="12" rx="2" fill="#ffd93d" />
          <rect x="22" y="24" width="12" height="12" rx="2" fill="#ffd93d" />
          <rect x="36" y="24" width="12" height="12" rx="2" fill="#4fa8ff" />
          <rect x="36" y="38" width="12" height="12" rx="2" fill="#4fa8ff" />
          <rect x="8" y="38" width="12" height="12" rx="2" fill="#4ecb71" />
        </>
      );
      break;
    case "mazemuncher":
      shapes = (
        <>
          <path
            d="M32 32 L54 22 A22 22 0 1 1 54 42 Z"
            fill="#ffe066"
          />
          <circle cx="14" cy="40" r="8" fill="#ff9696" />
          <rect x="8" y="46" width="12" height="4" fill="#ff9696" />
        </>
      );
      break;
    case "skybarrage":
      shapes = (
        <>
          <path d="M32 8 L44 44 L32 36 L20 44 Z" fill="#78efd9" />
          <circle cx="20" cy="16" r="2" fill="#ffdc80" />
          <circle cx="46" cy="24" r="2" fill="#ffdc80" />
          <circle cx="12" cy="30" r="2" fill="#ffdc80" />
        </>
      );
      break;
    case "byteraider":
      shapes = (
        <>
          <rect x="10" y="26" width="16" height="18" rx="2" fill="#78efd9" />
          <rect x="26" y="32" width="16" height="4" fill="#ffdc80" />
          <rect x="42" y="18" width="12" height="12" fill="#ff9696" />
        </>
      );
      break;
    case "barrelclimb":
      shapes = (
        <>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x="14"
              y={12 + i * 14}
              width="16"
              height="3"
              fill="#8dd1ff"
            />
          ))}
          <line x1="16" y1="10" x2="16" y2="44" stroke="#8dd1ff" strokeWidth="2" />
          <line x1="28" y1="10" x2="28" y2="44" stroke="#8dd1ff" strokeWidth="2" />
          <circle cx="44" cy="40" r="8" fill="#ff9696" />
        </>
      );
      break;
    case "bubbletrap":
      shapes = (
        <>
          <circle cx="22" cy="24" r="10" fill="none" stroke="#8dd1ff" strokeWidth="3" />
          <circle cx="42" cy="38" r="7" fill="none" stroke="#8dd1ff" strokeWidth="3" />
          <circle cx="44" cy="16" r="5" fill="none" stroke="#8dd1ff" strokeWidth="3" />
        </>
      );
      break;
    case "duelring":
      shapes = (
        <>
          <rect x="12" y="20" width="12" height="28" rx="3" fill="#78efd9" />
          <rect x="40" y="20" width="12" height="28" rx="3" fill="#ff9696" />
          <path d="M24 30 L40 30" stroke="#ffdc80" strokeWidth="4" strokeLinecap="round" />
        </>
      );
      break;
    case "peakclimber":
      shapes = (
        <>
          <path d="M8 50 L26 18 L38 36 L48 22 L58 50 Z" fill="#8dd1ff" />
          <circle cx="26" cy="12" r="5" fill="#f5f3ff" />
        </>
      );
      break;
    case "ninehole":
      shapes = (
        <>
          <circle cx="20" cy="48" r="6" fill="#242643" />
          <line x1="40" y1="12" x2="40" y2="46" stroke="#f5f3ff" strokeWidth="2" />
          <path d="M40 12 L54 18 L40 24 Z" fill="#ff9696" />
          <circle cx="18" cy="20" r="5" fill="#f5f3ff" />
        </>
      );
      break;
    case "lanerace":
      shapes = (
        <>
          <rect x="26" y="10" width="12" height="44" rx="3" fill="#78efd9" />
          <rect x="12" y="8" width="10" height="20" rx="2" fill="#ff9696" />
          <rect x="42" y="30" width="10" height="20" rx="2" fill="#ffdc80" />
        </>
      );
      break;
    case "asteroid":
      shapes = (
        <>
          <circle cx="32" cy="32" r="16" fill="none" stroke="#bea9ff" strokeWidth="3" />
          <path d="M32 20 L40 32 L32 28 L24 32 Z" fill="#78efd9" />
        </>
      );
      break;
    case "bomberquest":
      shapes = (
        <>
          <circle cx="26" cy="38" r="12" fill="#242643" />
          <rect x="24" y="16" width="4" height="12" fill="#ffb381" />
          <circle cx="26" cy="14" r="4" fill="#ff9696" />
        </>
      );
      break;
    case "airhockey":
      shapes = (
        <>
          <circle cx="32" cy="14" r="8" fill="#ff9696" />
          <circle cx="32" cy="50" r="8" fill="#78efd9" />
          <circle cx="32" cy="32" r="5" fill="#f5f3ff" />
        </>
      );
      break;
    case "missile":
      shapes = (
        <>
          <rect x="12" y="46" width="12" height="10" fill="#78efd9" />
          <rect x="40" y="46" width="12" height="10" fill="#78efd9" />
          <path d="M32 12 L36 40 L28 40 Z" fill="#ff9696" />
        </>
      );
      break;
    case "centipede":
      shapes = (
        <>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={16 + i * 11} cy="32" r="6" fill="#ff9696" />
          ))}
          <rect x="44" y="14" width="8" height="8" fill="#8dd1ff" />
        </>
      );
      break;
    case "bubblepop":
      shapes = (
        <>
          <circle cx="22" cy="24" r="9" fill="#ff9696" />
          <circle cx="40" cy="20" r="7" fill="#ffdc80" />
          <circle cx="32" cy="42" r="9" fill="#8dd1ff" />
        </>
      );
      break;
    case "tenpinalley":
      shapes = (
        <>
          {[[26, 40], [38, 40], [32, 26], [32, 14]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill="#f5f3ff" />
          ))}
        </>
      );
      break;
    case "connectfour":
      shapes = (
        <>
          <rect x="12" y="14" width="40" height="36" rx="4" fill="#3c3f7d" />
          <circle cx="22" cy="24" r="5" fill="#78efd9" />
          <circle cx="34" cy="24" r="5" fill="#ff9696" />
          <circle cx="22" cy="38" r="5" fill="#ff9696" />
          <circle cx="34" cy="38" r="5" fill="#78efd9" />
        </>
      );
      break;
    case "battleship":
      shapes = (
        <>
          <path d="M14 40 L50 40 L44 50 L20 50 Z" fill="#8dd1ff" />
          <rect x="26" y="18" width="4" height="22" fill="#f5f3ff" />
          <path d="M30 18 L42 26 L30 30 Z" fill="#ff9696" />
        </>
      );
      break;
    case "checkers":
      shapes = (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={12 + (i % 2) * 20}
              y={12 + Math.floor(i / 2) * 20}
              width="20"
              height="20"
              fill="#3c3f7d"
            />
          ))}
          <circle cx="22" cy="22" r="7" fill="#78efd9" />
          <circle cx="42" cy="42" r="7" fill="#ff9696" />
        </>
      );
      break;
    case "solitaire":
      shapes = (
        <>
          <rect x="14" y="14" width="18" height="26" rx="3" fill="#f5f3ff" />
          <rect x="32" y="20" width="18" height="26" rx="3" fill="#3c3f7d" />
          <text x="19" y="32" fontSize="12" fill="#ff9696">
            ♦
          </text>
        </>
      );
      break;
    case "yahtzee":
      shapes = (
        <>
          <rect x="14" y="14" width="16" height="16" rx="3" fill="#f5f3ff" />
          <rect x="34" y="34" width="16" height="16" rx="3" fill="#f5f3ff" />
          <circle cx="22" cy="22" r="2" fill="#242643" />
          <circle cx="42" cy="42" r="2" fill="#242643" />
          <circle cx="38" cy="46" r="2" fill="#242643" />
        </>
      );
      break;
    case "rallysprint":
      shapes = (
        <>
          <ellipse cx="32" cy="32" rx="24" ry="18" fill="none" stroke="#3d3d3d" strokeWidth="10" />
          <rect x="26" y="12" width="8" height="6" fill="#f5f3ff" />
        </>
      );
      break;
    case "wordguess":
      shapes = (
        <>
          {["A", "B", "C"].map((l, i) => (
            <rect key={i} x={12 + i * 15} y="24" width="12" height="16" rx="2" fill={i === 1 ? "#78efd9" : "#3c3f7d"} />
          ))}
        </>
      );
      break;
    case "slidefifteen":
      shapes = (
        <>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={12 + (i % 2) * 22} y={12 + Math.floor(i / 2) * 22} width="18" height="18" rx="3" fill="#8dd1ff" />
          ))}
        </>
      );
      break;
    case "fruitslice":
      shapes = (
        <>
          <circle cx="24" cy="28" r="12" fill="#ff9696" />
          <circle cx="42" cy="20" r="8" fill="#ffdc80" />
          <path d="M14 44 L50 44" stroke="#f5f3ff" strokeWidth="2" />
        </>
      );
      break;
    case "towerstack":
      shapes = (
        <>
          <rect x="18" y="38" width="28" height="10" fill="#78efd9" />
          <rect x="22" y="26" width="20" height="10" fill="#8dd1ff" />
          <rect x="26" y="14" width="12" height="10" fill="#ffdc80" />
        </>
      );
      break;
    case "skyhoops":
      shapes = (
        <>
          <line x1="16" y1="20" x2="48" y2="20" stroke="#f5f3ff" strokeWidth="3" />
          <rect x="46" y="10" width="3" height="12" fill="#ff9696" />
          <circle cx="26" cy="42" r="9" fill="#ffb381" />
        </>
      );
      break;
    case "dartthrow":
      shapes = (
        <>
          <circle cx="32" cy="32" r="18" fill="#f5f3ff" />
          <circle cx="32" cy="32" r="11" fill="#8dd1ff" />
          <circle cx="32" cy="32" r="4" fill="#ff9696" />
        </>
      );
      break;
    case "slalomski":
      shapes = (
        <>
          <path d="M20 10 L28 44 L20 44 Z" fill="#2c6b3f" />
          <path d="M44 20 L50 44 L38 44 Z" fill="#2c6b3f" />
          <rect x="30" y="16" width="4" height="30" fill="#242643" />
        </>
      );
      break;
    case "tiletap":
      shapes = (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={10 + i * 11} y={i % 2 === 0 ? 14 : 30} width="8" height="20" fill="#f5f3ff" />
          ))}
        </>
      );
      break;
    case "sokoban":
      shapes = (
        <>
          <rect x="16" y="16" width="16" height="16" rx="2" fill="#ffb381" />
          <rect x="36" y="36" width="14" height="14" rx="2" fill="none" stroke="#78efd9" strokeWidth="3" />
        </>
      );
      break;
    case "sudokumini":
      shapes = (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={12 + (i % 3) * 14}
              y={14 + Math.floor(i / 3) * 18}
              width="12"
              height="16"
              fill="none"
              stroke="#8dd1ff"
              strokeWidth="2"
            />
          ))}
        </>
      );
      break;
    default:
      shapes = <circle cx="32" cy="32" r="10" fill={accent} />;
  }
  return (
    <svg viewBox="0 0 64 64" className="ga-cabinet-art-svg">
      <rect width="64" height="64" rx="12" fill="#2a2c4e" />
      <rect width="64" height="64" rx="12" fill={accent} opacity="0.1" />
      {shapes}
    </svg>
  );
}

function Cabinet({ game, best, onPlay }) {
  const isEndless = game.category === "endless";
  const accent = isEndless ? "#78efd9" : "#ff9696";
  const bestLabel =
    best != null
      ? game.scoreLabel === "moves"
        ? `Best ${best} moves`
        : game.scoreLabel === "/10"
          ? `Best ${best}/10`
          : `Best ${best} ${game.scoreLabel}`
      : "No score yet";
  return (
    <button
      className={`ga-cabinet ${isEndless ? "ga-cabinet-endless" : "ga-cabinet-challenge"}`}
      onClick={() => {
        AudioEngine.playSfx("select");
        onPlay(game.id);
      }}
    >
      <div className="ga-cabinet-art">
        <GameArt id={game.id} accent={accent} />
      </div>
      <div className="ga-cabinet-top">
        <span
          className={`ga-cabinet-cat ${isEndless ? "is-endless" : "is-challenge"}`}
        >
          {isEndless ? (
            <>
              <InfinityIcon size={12} /> Endless
            </>
          ) : (
            <>
              <Flag size={12} /> Challenge
            </>
          )}
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

function Hub({ best, onPlay, difficulty, onChangeDifficulty }) {
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
  function handleDifficultyChange(e) {
    AudioEngine.playSfx("select");
    onChangeDifficulty(e.target.value);
  }

  const endlessGames = GAMES.filter((g) => g.category === "endless");
  const challengeGames = GAMES.filter((g) => g.category === "challenge");
  const scoreEntries = Object.entries(best)
    .map(([id, val]) => {
      const g = GAMES.find((x) => x.id === id);
      if (!g) return null;
      const suffix =
        g.scoreLabel === "moves"
          ? " moves"
          : g.scoreLabel === "/10"
            ? "/10"
            : " " + g.scoreLabel;
      return `${g.name} — ${val}${suffix}`;
    })
    .filter(Boolean);
  const tickerItems = scoreEntries.length
    ? [...scoreEntries, ...scoreEntries]
    : [
        "No high scores yet — be the first arcade legend.",
        "No high scores yet — be the first arcade legend.",
      ];

  return (
    <div className="ga-hub">
      <header className="ga-marquee">
        <div className="ga-marquee-bulbs">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
          ))}
        </div>
        <div className="">
          <img src="/logo.png" alt="Game Center" className="ga-logo " style={{ width: "100px", height: "auto",background: "transparent" }} />
        </div>
        <p className="ga-marquee-sub">
          One arcade, two wings: chase a high score forever, or beat the game
          outright.
        </p>
        <div className="ga-audio-controls">
          <button className="ga-audio-btn" onClick={toggleSfx}>
            {sfxOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound{" "}
            {sfxOn ? "on" : "off"}
          </button>
          <button className="ga-audio-btn" onClick={toggleMusic}>
            <Music size={14} /> Music {musicOn ? "on" : "off"}
          </button>
          <label className="ga-difficulty-select">
            Difficulty
            <select value={difficulty} onChange={handleDifficultyChange}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Difficult</option>
            </select>
          </label>
        </div>
      </header>
      <div className="ga-ticker-wrap">
        <div className="ga-ticker-track">
          {tickerItems.map((t, i) => (
            <span key={i} className="ga-ticker-item">
              {t}
            </span>
          ))}
        </div>
      </div>

      <section className="ga-section">
        <div className="ga-section-title is-endless">
          <InfinityIcon size={20} />
          <h2>Endless Wing</h2>
          <span className="ga-section-count">{endlessGames.length} live</span>
        </div>
        <p className="ga-section-desc">
          No finish line. Play until you slip, then chase your own high score.
        </p>
        <div className="ga-grid">
          {endlessGames.map((g) => (
            <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={onPlay} />
          ))}
        </div>
      </section>

      <section className="ga-section">
        <div className="ga-section-title is-challenge">
          <Flag size={20} />
          <h2>Challenge Room</h2>
          <span className="ga-section-count">{challengeGames.length} live</span>
        </div>
        <p className="ga-section-desc">
          Every game here has a real ending — win, lose, or clear the board.
        </p>
        <div className="ga-grid">
          {challengeGames.map((g) => (
            <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={onPlay} />
          ))}
        </div>
      </section>

      <footer className="ga-footer">
        All {GAMES.length} planned cabinets are live across both wings.
      </footer>
    </div>
  );
}

const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Difficult" };

function GameShell({ game, best, difficulty, onFinish, goHome }) {
  const Comp = GAME_COMPONENTS[game.id];
  const Icon = game.icon;
  return (
    <div className="ga-shell">
      <div className="ga-shell-header">
        <button
          className="ga-back-btn"
          onClick={() => {
            AudioEngine.playSfx("click");
            goHome();
          }}
        >
          <ArrowLeft size={16} /> Arcade
        </button>
        <div className="ga-shell-title">
          <img src="/logo.png" alt="" className="ga-shell-logo" />
          <span className="ga-cabinet-icon small">
            <Icon size={16} />
          </span>
          {game.name}
        </div>
        <div className="ga-shell-best">
          <span className="ga-shell-difficulty">
            {DIFFICULTY_LABEL[difficulty] ?? "Medium"}
          </span>
          <span> · Best: {best != null ? `${best}` : "—"}</span>
        </div>
      </div>
      <div className="ga-cabinet-frame">
        <Comp
          onFinish={(v) => onFinish(game, v)}
          best={best}
          goHome={goHome}
          difficulty={difficulty}
        />
      </div>
    </div>
  );
}

/* -------------------------------- styles ---------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      .ga-root {
        --bg: #fff8ec;
        --bg-deep: #2b1055;
        --surface: #fffdf8;
        --surface-2: #fff1da;
        --ink: #3b2260;
        --ink-dim: #7a6a9c;
        --yellow: #ffd93d;
        --teal: #22d3c0;
        --coral: #ff5d8f;
        --pink: #ff5fa2;
        --orange: #ff9f43;
        --green: #4ecb71;
        --blue: #4fa8ff;
        --purple: #a66bff;
        --radius: 20px;
        font-family: 'Nunito', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
        background: linear-gradient(120deg, #ff9fd0, #ffcf8f, #fff59d, #a4f5c9, #9fd8ff, #c6a8ff, #ff9fd0);
        background-size: 400% 400%;
        animation: ga-rainbow-shift 22s ease infinite;
        color: var(--ink);
        min-height: 100vh;
        padding: 28px 16px calc(60px + env(safe-area-inset-bottom));
        box-sizing: border-box;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        overflow-x: hidden;
      }
      @keyframes ga-rainbow-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .ga-root * { box-sizing: border-box; }
      .ga-hub { max-width: 980px; margin: 0 auto; }

      .ga-marquee-title-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
      .ga-logo { width: clamp(120px, 30vw, 180px); height: auto; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.18)); }
      .ga-shell-logo { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }

      .ga-marquee { text-align: center; margin-bottom: 18px; }
      .ga-marquee-bulbs { display: flex; justify-content: center; gap: 7px; margin-bottom: 10px; }
      .ga-marquee-bulbs span { width: 9px; height: 9px; border-radius: 50%; background: var(--pink); box-shadow: 0 0 5px currentColor; display: inline-block; animation: ga-bulb 1.8s ease-in-out infinite; }
      .ga-marquee-bulbs span:nth-child(6n+1) { background: var(--pink); color: var(--pink); }
      .ga-marquee-bulbs span:nth-child(6n+2) { background: var(--orange); color: var(--orange); }
      .ga-marquee-bulbs span:nth-child(6n+3) { background: var(--yellow); color: var(--yellow); }
      .ga-marquee-bulbs span:nth-child(6n+4) { background: var(--green); color: var(--green); }
      .ga-marquee-bulbs span:nth-child(6n+5) { background: var(--blue); color: var(--blue); }
      .ga-marquee-bulbs span:nth-child(6n+6) { background: var(--purple); color: var(--purple); }
      @keyframes ga-bulb { 0%, 100% { opacity: .5; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }

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
        font-family: 'Baloo 2', 'Trebuchet MS', sans-serif;
        font-size: clamp(30px, 6vw, 46px);
        font-weight: 800;
        letter-spacing: 1px;
        margin: 0 0 8px;
        background: linear-gradient(90deg, var(--pink), var(--orange), var(--yellow), var(--green), var(--blue), var(--purple));
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: ga-rainbow-shift 6s linear infinite;
        text-shadow: 0 3px 0 rgba(255,255,255,0.6);
      }
      .ga-marquee-sub { color: #6b4f8f; margin: 0; font-size: 14px; font-weight: 700; }
      .ga-audio-controls { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
      .ga-audio-btn { display: flex; align-items: center; gap: 5px; background: #fff; border: 2px solid var(--blue); color: var(--ink); padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,0.08); }
      .ga-audio-btn:hover { transform: translateY(-1px); border-color: var(--pink); color: var(--pink); }
      .ga-difficulty-select { display: flex; align-items: center; gap: 6px; background: #fff; border: 2px solid var(--purple); color: var(--ink); padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,0.08); }
      .ga-difficulty-select select { background: transparent; color: var(--purple); border: none; font-size: 12px; font-weight: 800; cursor: pointer; outline: none; }
      .ga-difficulty-select select option { background: #fff; color: var(--ink); }

      .ga-ticker-wrap { overflow: hidden; background: #fff; border: 3px solid var(--yellow); border-radius: 999px; padding: 10px 0; margin-bottom: 30px; box-shadow: 0 4px 0 rgba(0,0,0,0.08); }
      .ga-ticker-track { display: flex; gap: 40px; width: max-content; animation: ga-scroll 22s linear infinite; }
      @keyframes ga-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .ga-ticker-item { color: var(--pink); font-size: 13px; white-space: nowrap; font-weight: 800; }

      .ga-section { margin-bottom: 34px; }
      .ga-section-title { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
      .ga-section-title h2 { margin: 0; font-size: 22px; font-family: 'Baloo 2', sans-serif; font-weight: 800; }
      .ga-section-title.is-endless { color: var(--blue); }
      .ga-section-title.is-challenge { color: var(--coral); }
      .ga-section-count { margin-left: auto; font-size: 12px; font-weight: 800; color: #fff; background: var(--purple); padding: 4px 12px; border-radius: 999px; }
      .ga-section-desc { color: #6b4f8f; font-size: 13px; margin: 4px 0 16px; font-weight: 700; }

      .ga-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }

      .ga-cabinet { text-align: left; background: var(--surface); border: 3px solid #ffe3b0; border-radius: var(--radius); padding: 16px; cursor: pointer; color: var(--ink); display: flex; flex-direction: column; gap: 8px; box-shadow: 0 5px 0 rgba(0,0,0,0.08); transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
      .ga-cabinet:hover { transform: translateY(-3px) rotate(-0.6deg); }
      .ga-cabinet-endless:hover { border-color: var(--blue); box-shadow: 0 8px 0 rgba(79,168,255,0.25); }
      .ga-cabinet-challenge:hover { border-color: var(--coral); box-shadow: 0 8px 0 rgba(255,93,143,0.25); }
      .ga-cabinet-top { display: flex; align-items: center; justify-content: flex-start; }
      .ga-cabinet-art { border-radius: 12px; overflow: hidden; margin-bottom: 2px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06); }
      .ga-cabinet-art-svg { display: block; width: 100%; height: 64px; transition: transform .2s ease; }
      .ga-cabinet:hover .ga-cabinet-art-svg { transform: scale(1.08) rotate(2deg); }
      .ga-cabinet-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: var(--surface-2); }
      .ga-cabinet-icon.small { width: 24px; height: 24px; border-radius: 7px; }
      .ga-cabinet-cat { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
      .ga-cabinet-cat.is-endless { color: #fff; background: var(--blue); }
      .ga-cabinet-cat.is-challenge { color: #fff; background: var(--coral); }
      .ga-cabinet-name { margin: 0; font-size: 16px; font-family: 'Baloo 2', sans-serif; font-weight: 700; }
      .ga-cabinet-tagline { margin: 0; font-size: 12.5px; color: var(--ink-dim); flex-grow: 1; font-weight: 700; }
      .ga-cabinet-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
      .ga-badge { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; background: var(--yellow); color: #6b4500; }
      .ga-cabinet-best { font-size: 11px; color: var(--ink-dim); font-weight: 700; }

      .ga-footer { text-align: center; color: #6b4f8f; font-size: 12px; font-weight: 700; margin-top: 20px; }

      .ga-shell { max-width: 460px; margin: 0 auto; }
      .ga-shell-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
      .ga-shell-title { display: flex; align-items: center; gap: 8px; font-weight: 800; font-family: 'Baloo 2', sans-serif; flex-grow: 1; justify-content: center; color: var(--ink); }
      .ga-shell-best { font-size: 12px; color: #6b4f8f; font-weight: 700; }
      .ga-shell-difficulty { color: var(--pink); font-weight: 800; }
      .ga-back-btn { display: flex; align-items: center; gap: 6px; background: #fff; border: 2px solid var(--pink); color: var(--pink); padding: 7px 14px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,0.08); }
      .ga-back-btn:hover { background: var(--pink); color: #fff; }

      .ga-cabinet-frame { position: relative; background: var(--bg-deep); border: 6px solid var(--yellow); border-radius: 22px; padding: 18px; box-shadow: inset 0 0 16px rgba(0,0,0,0.28), 0 6px 0 rgba(0,0,0,0.12); max-width: 100%; overflow-x: auto; }
      .ga-cabinet-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 16px;
        pointer-events: none;
        background: repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.06) 3px);
        mix-blend-mode: multiply;
      }
      .ga-game-col { display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .ga-hud { display: flex; gap: 16px; font-size: 13px; font-weight: 700; color: #f3ecff; flex-wrap: wrap; justify-content: center; }
      .ga-hint { font-size: 11.5px; color: #cdbdf0; text-align: center; margin: 0; }

      .ga-canvas-wrap { position: relative; border-radius: 10px; overflow: hidden; line-height: 0; border: 2px solid rgba(255,255,255,0.25); }
      .ga-canvas { display: block; border-radius: 10px; max-width: 100%; height: auto; }

      .ga-overlay { position: absolute; inset: 0; background: rgba(75,20,120,0.88); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; border-radius: 16px; }
      .ga-overlay-card { text-align: center; padding: 18px; animation: ga-overlay-in 0.22s ease; color: #fff; }
      .ga-overlay-emoji { font-size: 34px; }
      .ga-overlay-card h3 { margin: 6px 0; font-family: 'Baloo 2', sans-serif; }
      .ga-overlay-stat { color: #e4d6ff; font-size: 13px; }
      .ga-overlay-actions { display: flex; gap: 8px; margin-top: 14px; justify-content: center; flex-wrap: wrap; }
      .ga-btn { display: flex; align-items: center; gap: 6px; background: #fff; color: var(--ink); border: none; padding: 9px 16px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,0.15); }
      .ga-btn-primary { background: var(--teal); color: #06392f; font-weight: 800; }

      .ga-falling-target { position: absolute; border-radius: 50%; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.15); font-size: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }

      .ga-whack-grid { display: grid; grid-template-columns: repeat(3, 74px); gap: 10px; border: 3px solid var(--yellow); border-radius: 16px; padding: 12px; }
      .ga-hole { width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #333562, #242643); border: 1px solid rgba(255,255,255,0.1); font-size: 28px; cursor: pointer; }
      .ga-hole-active { box-shadow: 0 0 0 3px var(--yellow) inset; }

      .ga-hue-target { font-size: 15px; }
      .ga-timebar-track { width: 240px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
      .ga-timebar-fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--yellow)); }
      .ga-hue-grid { display: grid; grid-template-columns: repeat(3, 62px); gap: 10px; border: 3px solid var(--blue); border-radius: 16px; padding: 12px; }
      .ga-hue-swatch { width: 62px; height: 62px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.15); cursor: pointer; }

      .ga-ttt-board { display: grid; grid-template-columns: repeat(3, 78px); gap: 6px; border: 3px solid var(--coral); border-radius: 16px; padding: 10px; }
      .ga-ttt-cell { width: 78px; height: 78px; font-size: 30px; font-weight: 800; background: var(--surface-2); border: 1px solid rgba(0,0,0,0.06); border-radius: 10px; color: var(--coral); cursor: pointer; }
      .ga-ttt-cell:disabled { cursor: default; }

      .ga-memory-grid { display: grid; grid-template-columns: repeat(4, 58px); gap: 8px; border: 3px solid var(--green); border-radius: 16px; padding: 10px; }
      .ga-memory-card { position: relative; width: 58px; height: 58px; border-radius: 10px; background: transparent; border: none; padding: 0; cursor: pointer; font-size: 22px; perspective: 600px; }
      .ga-memory-inner { position: relative; width: 100%; height: 100%; transition: transform .4s ease; transform-style: preserve-3d; }
      .ga-memory-inner.is-flipped { transform: rotateY(180deg); }
      .ga-memory-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: var(--ink-dim); }
      .ga-memory-back { transform: rotateY(180deg); color: var(--ink); }
      .ga-memory-card.is-matched .ga-memory-face { opacity: 0.5; }

      .ga-2048-grid { display: grid; grid-template-columns: repeat(4, 60px); gap: 8px; background: var(--surface); padding: 8px; border-radius: 12px; border: 3px solid var(--orange); }
      .ga-2048-tile { width: 60px; height: 60px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: #fff; }
      .ga-dpad { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .ga-dpad button { width: 40px; height: 34px; border-radius: 10px; background: var(--blue); color: #fff; border: none; cursor: pointer; font-size: 16px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,0.2); }
      .ga-dpad > div { display: flex; gap: 6px; }
      .ga-dpad-row { display: flex; flex-direction: row; gap: 10px; }
      .ga-dpad-row button { width: 52px; height: 42px; border-radius: 12px; background: var(--purple); color: #fff; border: none; cursor: pointer; font-size: 18px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,0.2); }

      .ga-pinball-backbox { background: #1e1f2c; border: 3px solid #3f4169; border-radius: 12px; padding: 10px 16px 12px; width: 100%; max-width: 320px; }
      .ga-pinball-score { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #ffb381; text-align: center; text-shadow: 0 0 3px rgba(255,179,129,0.5), 0 0 8px rgba(255,179,129,0.25); }
      .ga-pinball-score-small { font-family: 'Courier New', monospace; font-size: 14px; color: #ffdc80; letter-spacing: 2px; text-shadow: 0 0 3px rgba(255,220,128,0.4); }
      .ga-pinball-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--ink-dim); letter-spacing: 1px; margin-top: 5px; }
      .ga-pinball-label { font-weight: 700; }
      .ga-pinball-lights { display: flex; gap: 4px; }
      .ga-pinball-light { width: 9px; height: 9px; border-radius: 50%; background: #383a5c; border: 1px solid #47497d; }
      .ga-pinball-light.is-lit { background: #ffdc80; box-shadow: 0 0 3px #ffdc80; border-color: #ffdc80; }
      .ga-pinball-tilt { font-size: 10px; }
      .ga-pinball-gameover { margin-top: 8px; text-align: center; font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 3px; color: #ff9696; animation: ga-blink 0.9s steps(1) infinite; }
      .ga-pinball-match { margin-top: 4px; text-align: center; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 2px; color: #a8a6c8; }
      .ga-pinball-match.is-match { color: #78efd9; text-shadow: 0 0 3px rgba(120,239,217,0.5); animation: ga-blink 0.8s steps(1) infinite; }
      @keyframes ga-blink { 50% { opacity: 0.4; } }

      .ga-quiz-q { font-size: 16px; font-weight: 700; text-align: center; max-width: 300px; }
      .ga-quiz-options { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 300px; }
      .ga-quiz-opt { padding: 10px 14px; border-radius: 10px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); color: var(--ink); text-align: left; cursor: pointer; font-size: 14px; }
      .ga-quiz-opt.is-correct { border-color: var(--teal); background: rgba(120,239,217,0.15); animation: ga-pulse 0.4s ease; }
      .ga-quiz-opt.is-wrong { border-color: var(--coral); background: rgba(255,150,150,0.15); animation: ga-shake-x 0.35s ease; }

      .ga-rps-arena { display: flex; align-items: center; gap: 20px; border: 3px solid var(--pink); border-radius: 16px; padding: 16px 22px; }
      .ga-rps-side { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: var(--ink-dim); }
      .ga-rps-emoji { font-size: 40px; }
      .ga-rps-vs { font-size: 12px; color: var(--ink-dim); }
      .ga-rps-choices { display: flex; gap: 10px; }
      .ga-rps-btn { width: 56px; height: 56px; border-radius: 50%; font-size: 26px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
      .ga-rps-btn:disabled { opacity: 0.4; }

      .ga-simon-grid { display: grid; grid-template-columns: repeat(2, 90px); grid-template-rows: repeat(2, 90px); gap: 10px; border: 3px solid var(--purple); border-radius: 18px; padding: 12px; }
      .ga-simon-pad { border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: opacity .1s ease, transform .1s ease, box-shadow .1s ease; }
      .ga-simon-pad.is-active { transform: scale(0.94); box-shadow: 0 0 12px rgba(255,255,255,0.25); }
      .ga-simon-pad:disabled { cursor: default; }

      .ga-mine-grid { display: grid; grid-template-columns: repeat(8, 32px); gap: 3px; border: 3px solid var(--teal); border-radius: 10px; padding: 8px; }
      .ga-mine-cell { width: 32px; height: 32px; border-radius: 4px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--ink); padding: 0; }
      .ga-mine-cell.is-revealed { background: rgba(255,255,255,0.05); cursor: default; }
      .ga-c4-grid { display: grid; grid-template-columns: repeat(7, 30px); gap: 4px; border: 3px solid var(--coral); border-radius: 12px; padding: 8px; }
      .ga-c4-cell { width: 30px; height: 30px; border-radius: 50%; background: var(--surface-2); border: none; padding: 0; cursor: pointer; }
      .ga-c4-cell:disabled { cursor: default; }
      .ga-c4-disc { display: block; width: 100%; height: 100%; border-radius: 50%; }
      .ga-battle-grid { display: grid; grid-template-columns: repeat(8, 30px); gap: 3px; border: 3px solid var(--teal); border-radius: 10px; padding: 8px; }
      .ga-battle-cell { width: 30px; height: 30px; border-radius: 4px; background: var(--surface-2); border: 1px solid rgba(255,255,255,0.1); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
      .ga-battle-cell.is-hit { background: rgba(255,150,150,0.35); }
      .ga-battle-cell.is-miss { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); }
      .ga-battle-cell:disabled { cursor: default; }
      .ga-checkers-grid { display: grid; grid-template-columns: repeat(8, 30px); gap: 1px; border: 3px solid var(--coral); border-radius: 8px; padding: 4px; background: rgba(255,255,255,0.03); }
      .ga-checkers-cell { width: 30px; height: 30px; background: var(--surface-2); border: none; padding: 0; cursor: default; display: flex; align-items: center; justify-content: center; }
      .ga-checkers-cell.is-dark { background: #3d2f4a; cursor: pointer; }
      .ga-checkers-cell.is-selected { outline: 2px solid var(--teal); outline-offset: -2px; }
      .ga-checkers-cell.is-target { box-shadow: inset 0 0 0 3px var(--yellow, #ffdc80); }
      .ga-checkers-piece { display: flex; align-items: center; justify-content: center; width: 78%; height: 78%; border-radius: 50%; font-size: 13px; color: #1c1c2e; }
      .ga-solitaire-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; width: 100%; max-width: 320px; }
      .ga-solitaire-foundations { display: flex; gap: 4px; margin-left: auto; }
      .ga-card-slot { border: none; background: none; padding: 0; cursor: pointer; }
      .ga-card { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 48px; border-radius: 5px; font-size: 12px; font-weight: 700; background: #f5f3ff; color: #1c1c2e; }
      .ga-card.red { color: #d1435b; }
      .ga-card.black { color: #1c1c2e; }
      .ga-card.back { background: #3d2f63; }
      .ga-card.empty { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
      .ga-card.is-selected { outline: 2px solid var(--teal); }
      .ga-solitaire-tableau { display: flex; gap: 6px; }
      .ga-solitaire-col { display: flex; flex-direction: column; min-width: 34px; min-height: 48px; cursor: pointer; }
      .ga-yz-dice { display: flex; gap: 8px; }
      .ga-yz-die { width: 40px; height: 40px; font-size: 18px; font-weight: 800; border-radius: 8px; background: var(--surface-2); border: 2px solid transparent; cursor: pointer; }
      .ga-yz-die.is-held { border-color: var(--teal); background: rgba(120,239,217,0.15); }
      .ga-yz-categories { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%; max-width: 320px; }
      .ga-yz-cat { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--surface-2); border-radius: 8px; font-size: 12px; border: none; cursor: pointer; }
      .ga-yz-cat:disabled { opacity: 0.55; cursor: default; }
      .ga-wg-grid { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
      .ga-wg-row { display: flex; gap: 5px; }
      .ga-wg-cell { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 18px; font-weight: 800; text-transform: uppercase; }
      .ga-wg-keyboard { display: flex; flex-direction: column; gap: 5px; width: 100%; max-width: 340px; }
      .ga-wg-krow { display: flex; justify-content: center; gap: 4px; }
      .ga-wg-key { min-width: 26px; height: 38px; border-radius: 6px; background: var(--surface-2); border: none; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0 6px; }
      .ga-wg-key.ga-wg-wide { min-width: 44px; font-size: 10px; }
      .ga-slide-grid { display: grid; grid-template-columns: repeat(4, 56px); gap: 4px; border: 3px solid var(--coral); border-radius: 10px; padding: 6px; }
      .ga-slide-cell { width: 56px; height: 56px; border-radius: 6px; background: var(--surface-2); border: none; font-size: 18px; font-weight: 800; cursor: pointer; }
      .ga-slide-cell.is-blank { background: transparent; cursor: default; }
      .ga-slide-cell:disabled { cursor: default; }
      .ga-sokoban-grid { display: grid; gap: 1px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px; }
      .ga-sokoban-cell { width: 26px; height: 26px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .ga-sokoban-cell.is-wall { background: #4a3b63; }
      .ga-sokoban-cell.is-target { background: rgba(255,220,128,0.15); }
      .ga-sokoban-box { width: 18px; height: 18px; background: #ffb381; border-radius: 3px; }
      .ga-sokoban-box.is-placed { background: #78efd9; }
      .ga-sokoban-player { width: 14px; height: 14px; border-radius: 50%; background: #8dd1ff; }
      .ga-sudoku-grid { display: grid; grid-template-columns: repeat(6, 40px); gap: 1px; border: 3px solid var(--teal); border-radius: 8px; padding: 4px; background: rgba(255,255,255,0.05); }
      .ga-sudoku-cell { width: 40px; height: 40px; background: var(--surface-2); border: none; font-size: 15px; font-weight: 700; cursor: pointer; }
      .ga-sudoku-cell.is-fixed { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.5); cursor: default; }
      .ga-sudoku-cell.is-selected { outline: 2px solid var(--teal); outline-offset: -2px; }
      .ga-sudoku-cell.border-right { border-right: 2px solid var(--teal); }
      .ga-sudoku-cell.border-bottom { border-bottom: 2px solid var(--teal); }

      .ga-blockblast-board { display: grid; grid-template-columns: repeat(8, 32px); grid-auto-rows: 32px; gap: 3px; border: 3px solid var(--teal); border-radius: 12px; padding: 8px; background: rgba(0,0,0,0.18); }
      .ga-blockblast-cell { width: 32px; height: 32px; border-radius: 6px; background: rgba(255,255,255,0.1); border: none; padding: 0; cursor: pointer; }
      .ga-blockblast-cell.is-filled { cursor: default; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.18); }
      .ga-blockblast-cell.is-preview-valid { background: rgba(78,203,113,0.6); }
      .ga-blockblast-cell.is-preview-invalid { background: rgba(255,93,143,0.6); }
      .ga-blockblast-tray { display: flex; gap: 10px; }
      .ga-blockblast-slot { width: 76px; height: 76px; border-radius: 14px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 8px; }
      .ga-blockblast-slot.is-selected { border-color: var(--yellow); box-shadow: 0 0 0 3px rgba(255,217,61,0.35); }
      .ga-blockblast-slot.is-empty { opacity: 0.25; cursor: default; }
      .ga-blockblast-piece { display: grid; gap: 2px; width: 100%; height: 100%; }
      .ga-blockblast-piece-cell { border-radius: 3px; }

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
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch (e) {
    return null;
  }
}
function storageSet(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch (e) {}
}
function storageListKeys(prefix) {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(STORAGE_PREFIX + prefix) === 0)
        keys.push(k.slice(STORAGE_PREFIX.length));
    }
    return keys;
  } catch (e) {
    return [];
  }
}

const DIFFICULTIES = ["easy", "medium", "hard"];

export default function GameArcadeApp() {
  const [view, setView] = useState("hub");
  const [best, setBest] = useState({});
  const [difficulty, setDifficulty] = useState(() => {
    const stored = storageGet("difficulty");
    return DIFFICULTIES.includes(stored) ? stored : "medium";
  });

  function changeDifficulty(next) {
    if (!DIFFICULTIES.includes(next)) return;
    setDifficulty(next);
    storageSet("difficulty", next);
  }

  useEffect(() => {
    try {
      const keys = storageListKeys("score:");
      const map = {};
      keys.forEach((k) => {
        const raw = storageGet(k);
        if (raw != null) {
          try {
            map[k.replace("score:", "")] = JSON.parse(raw);
          } catch (e) {}
        }
      });
      setBest(map);
    } catch (e) {}
  }, []);

  function handleFinish(game, value) {
    setBest((prev) => {
      const prevVal = prev[game.id];
      const better =
        prevVal == null ||
        (game.lowerIsBetter ? value < prevVal : value > prevVal);
      if (!better) return prev;
      storageSet("score:" + game.id, JSON.stringify(value));
      return { ...prev, [game.id]: value };
    });
  }

  const currentGame = view !== "hub" ? GAMES.find((g) => g.id === view) : null;

  return (
    <div className="ga-root">
      <GlobalStyle />
      {currentGame ? (
        <GameShell
          game={currentGame}
          best={best[currentGame.id]}
          difficulty={difficulty}
          onFinish={handleFinish}
          goHome={() => setView("hub")}
        />
      ) : (
        <Hub
          best={best}
          onPlay={setView}
          difficulty={difficulty}
          onChangeDifficulty={changeDifficulty}
        />
      )}
    </div>
  );
}