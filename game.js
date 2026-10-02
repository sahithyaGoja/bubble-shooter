const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('score');
const bestLabel = document.getElementById('best');
const restartBtn = document.getElementById('restartBtn');

const BUBBLE_RADIUS = 18;
const GRID_COLS = 8;
const GRID_ROWS = 10;
const BOARD_X = 34;
const BOARD_Y = 48;
const SPACING = BUBBLE_RADIUS * 2;
const SHOOTER_X = canvas.width / 2;
const SHOOTER_Y = canvas.height - 38;
const COLORS = ['#ff6363', '#ffd93d', '#4ecdc4', '#5c7cfa', '#b197fc', '#ff9f1c'];
const AIM_SPEED = 0.08; // Speed of arrow key aiming

let board = [];
let currentColor = null;
let nextColor = null;
let activeBubble = null;
let aim = -Math.PI / 2;
let score = 0;
let best = Number(localStorage.getItem('bubbleShooterBest') || 0);
let gameOver = false;

// Keyboard state tracking
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false
};

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function setBestValue() {
  bestLabel.textContent = String(best);
}

function getCellCenter(row, col) {
  const x = BOARD_X + col * SPACING + (row % 2 === 1 ? SPACING / 2 : 0) + BUBBLE_RADIUS;
  const y = BOARD_Y + row * SPACING + BUBBLE_RADIUS;
  return { x, y };
}

function createBoard() {
  board = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (Math.random() < 0.88) {
        board[row][col] = randomColor();
      }
    }
  }
}

function resetGame() {
  score = 0;
  gameOver = false;
  scoreLabel.textContent = '0';
  currentColor = randomColor();
  nextColor = randomColor();
  activeBubble = null;
  aim = -Math.PI / 2;
  createBoard();
}

function getNeighbors(row, col) {
  const offsets = row % 2 === 0
    ? [
        [0, -1], [0, 1],
        [-1, -1], [-1, 0],
        [1, -1], [1, 0]
      ]
    : [
        [0, -1], [0, 1],
        [-1, 0], [-1, 1],
        [1, 0], [1, 1]
      ];

  return offsets
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([nr, nc]) => nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS);
}

function findGroup(startRow, startCol, color) {
  const queue = [[startRow, startCol]];
  const visited = new Set([`${startRow},${startCol}`]);
  const group = [];

  while (queue.length) {
    const [row, col] = queue.shift();
    group.push([row, col]);

    for (const [nr, nc] of getNeighbors(row, col)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && board[nr][nc] === color) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return group;
}

function markFloating() {
  const visited = new Set();
  const queue = [];

  for (let col = 0; col < GRID_COLS; col += 1) {
    if (board[0][col]) {
      const key = `0,${col}`;
      visited.add(key);
      queue.push([0, col]);
    }
  }

  while (queue.length) {
    const [row, col] = queue.shift();

    for (const [nr, nc] of getNeighbors(row, col)) {
      const key = `${nr},${nc}`;
      if (board[nr][nc] && !visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  let cleared = 0;

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const key = `${row},${col}`;
      if (board[row][col] && !visited.has(key)) {
        board[row][col] = null;
        cleared += 1;
      }
    }
  }

  return cleared;
}

function resolveBoard(row, col) {
  const color = board[row][col];
  const matched = findGroup(row, col, color);

  if (matched.length >= 3) {
    matched.forEach(([r, c]) => {
      board[r][c] = null;
    });

    score += matched.length * 10;
    scoreLabel.textContent = String(score);

    const floaters = markFloating();
    if (floaters > 0) {
      score += floaters * 15;
      scoreLabel.textContent = String(score);
    }

    if (score > best) {
      best = score;
      localStorage.setItem('bubbleShooterBest', String(best));
      setBestValue();
    }
  }
}

function placeBubbleOnBoard(bubble) {
  let bestTarget = null;

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }

      const center = getCellCenter(row, col);
      const distance = Math.hypot(bubble.x - center.x, bubble.y - center.y);

      if (!bestTarget || distance < bestTarget.distance) {
        bestTarget = { row, col, distance };
      }
    }
  }

  if (!bestTarget) {
    gameOver = true;
    return;
  }

  const { row, col } = bestTarget;
  board[row][col] = bubble.color;

  if (row <= 1) {
    score += 5;
    scoreLabel.textContent = String(score);
  }

  resolveBoard(row, col);

  if (board[GRID_ROWS - 1].some(Boolean)) {
    gameOver = true;
  }

  activeBubble = null;
}

function fireBubble() {
  if (gameOver || activeBubble) {
    return;
  }

  const speed = 7.2;
  activeBubble = {
    x: SHOOTER_X + Math.cos(aim) * 30,
    y: SHOOTER_Y + Math.sin(aim) * 30,
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    color: currentColor
  };

  currentColor = nextColor;
  nextColor = randomColor();
}

function updateAimFromPointer(x, y) {
  const dx = x - SHOOTER_X;
  const dy = y - SHOOTER_Y;
  aim = Math.atan2(dy, dx);

  if (aim < -Math.PI + 0.35) {
    aim = -Math.PI + 0.35;
  }

  if (aim > -0.35) {
    aim = -0.35;
  }
}

function updateAimFromKeys() {
  let aimChanged = false;

  // Arrow Up - rotate aim upward (decrease angle)
  if (keys.ArrowUp) {
    aim -= AIM_SPEED;
    aimChanged = true;
  }

  // Arrow Down - rotate aim downward (increase angle)
  if (keys.ArrowDown) {
    aim += AIM_SPEED;
    aimChanged = true;
  }

  // Arrow Left - rotate aim to the left
  if (keys.ArrowLeft) {
    aim -= AIM_SPEED * 1.5;
    aimChanged = true;
  }

  // Arrow Right - rotate aim to the right
  if (keys.ArrowRight) {
    aim += AIM_SPEED * 1.5;
    aimChanged = true;
  }

  // Clamp aim to valid range
  if (aimChanged) {
    if (aim < -Math.PI + 0.35) {
      aim = -Math.PI + 0.35;
    }
    if (aim > -0.35) {
      aim = -0.35;
    }
  }

  // Space to fire
  if (keys.Space) {
    if (!gameOver) {
      fireBubble();
    }
    keys.Space = false; // Reset after firing
  }
}

function drawBubble(x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - 6, y - 6, BUBBLE_RADIUS * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.stroke();
}

function drawBoard() {
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (!board[row][col]) {
        continue;
      }

      const { x, y } = getCellCenter(row, col);
      drawBubble(x, y, board[row][col]);
    }
  }
}

function drawShooter() {
  ctx.beginPath();
  ctx.moveTo(SHOOTER_X, SHOOTER_Y);
  ctx.lineTo(SHOOTER_X + Math.cos(aim) * 84, SHOOTER_Y + Math.sin(aim) * 84);
  ctx.strokeStyle = '#dfeafc';
  ctx.lineWidth = 5;
  ctx.stroke();

  drawBubble(SHOOTER_X + Math.cos(aim) * 32, SHOOTER_Y + Math.sin(aim) * 32, currentColor);

  const nextX = canvas.width - 72;
  const nextY = 70;
  drawBubble(nextX, nextY, nextColor);

  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#eef6ff';
  ctx.fillText('NEXT', canvas.width - 110, 36);
}

function drawControls() {
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#a6b6d4';
  ctx.textAlign = 'left';
  ctx.fillText('Controls: ← → ↑ ↓ Aim | Space Fire | Click Restart', 10, canvas.height - 8);
  ctx.textAlign = 'start';
}

function drawGameOver() {
  if (!gameOver) {
    return;
  }

  ctx.fillStyle = 'rgba(7, 13, 22, 0.6)';
  ctx.fillRect(40, 220, canvas.width - 80, 120);

  ctx.fillStyle = '#fdfdff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width / 2, 280);
  ctx.font = '20px Arial';
  ctx.fillText('Click Restart to play again', canvas.width / 2, 312);
  ctx.textAlign = 'start';
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#163864');
  gradient.addColorStop(1, '#091b2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 12; i += 1) {
    ctx.fillRect(18 + i * 30, 0, 2, canvas.height);
  }
}

function updateGame() {
  // Update aim from keyboard input
  updateAimFromKeys();

  if (activeBubble) {
    activeBubble.x += activeBubble.vx;
    activeBubble.y += activeBubble.vy;

    if (activeBubble.x <= BUBBLE_RADIUS || activeBubble.x >= canvas.width - BUBBLE_RADIUS) {
      activeBubble.vx *= -1;
      activeBubble.x = Math.min(Math.max(activeBubble.x, BUBBLE_RADIUS), canvas.width - BUBBLE_RADIUS);
    }

    if (activeBubble.y <= 24) {
      placeBubbleOnBoard(activeBubble);
      return;
    }

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        if (!board[row][col]) {
          continue;
        }

        const center = getCellCenter(row, col);
        const distance = Math.hypot(activeBubble.x - center.x, activeBubble.y - center.y);

        if (distance < BUBBLE_RADIUS * 2 - 2) {
          placeBubbleOnBoard(activeBubble);
          return;
        }
      }
    }

    if (activeBubble.y >= canvas.height - 28) {
      placeBubbleOnBoard(activeBubble);
    }
  }
}

function render() {
  drawBackground();
  drawBoard();

  if (activeBubble) {
    drawBubble(activeBubble.x, activeBubble.y, activeBubble.color);
  }

  drawShooter();
  drawControls();
  drawGameOver();
}

function loop() {
  updateGame();
  render();
  requestAnimationFrame(loop);
}

// Keyboard event listeners
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    keys[event.key] = true;
  }
  if (event.key === ' ') {
    event.preventDefault();
    keys.Space = true;
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    keys[event.key] = false;
  }
});

canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  updateAimFromPointer(x, y);
});

canvas.addEventListener('pointerdown', () => {
  if (!gameOver) {
    fireBubble();
  }
});

restartBtn.addEventListener('click', () => {
  resetGame();
  setBestValue();
});

setBestValue();
resetGame();
requestAnimationFrame(loop);
