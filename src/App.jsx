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
        18 of 50 planned cabinets are live. More get added to both wings over
        time.
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
