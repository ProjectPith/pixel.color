// ---------- Project loading ----------
const STORAGE_KEY = 'pixel-color-projects';
const projectId = new URLSearchParams(location.search).get('id');

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

const project = loadProjects()[projectId];
if (!project) {
  location.replace('index.html');
  throw new Error('Project not found');
}

document.getElementById('project-name').textContent = project.name;

// Numbered (color-by-numbers) mode: cells show their target color's number
// until painted with the matching color.
const numberedMode = project.mode === 'numbered';
const targetPixels = project.targetPixels || {};
const colorIndex = new Map((project.colors || []).map((c, i) => [c, i + 1]));

// ---------- Canvas sandbox ----------
const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

const GRID_W = project.gridW || project.gridSize;
const GRID_H = project.gridH || project.gridSize;
// Fixed internal resolution; CSS scales it down to fit the screen
const INTERNAL_SIZE = 960;
const CELL_SIZE = INTERNAL_SIZE / Math.max(GRID_W, GRID_H);
canvas.width = Math.round(GRID_W * CELL_SIZE);
canvas.height = Math.round(GRID_H * CELL_SIZE);

// Painted pixels: "x,y" -> color
const pixels = new Map(Object.entries(project.pixels || {}));

// Currently selected color (null until one is added/selected)
let activeColor = null;

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Painted cells
  for (const [key, color] of pixels) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  // Numbered mode: unfilled target cells stay white with their color's number;
  // cells belonging to the selected color get highlighted.
  if (numberedMode) {
    if (activeColor) {
      ctx.fillStyle = '#d4d4d4';
      for (const [key, color] of Object.entries(targetPixels)) {
        if (color !== activeColor || pixels.has(key)) continue;
        const [x, y] = key.split(',').map(Number);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    const fontSize = Math.max(6, Math.floor(CELL_SIZE * 0.5));
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [key, color] of Object.entries(targetPixels)) {
      if (pixels.has(key)) continue;
      const [x, y] = key.split(',').map(Number);
      const isActive = color === activeColor;
      ctx.fillStyle = isActive ? '#3d3d3d' : '#9a9a9a';
      ctx.fillText(String(colorIndex.get(color) || '?'),
        x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
    }
  }

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_W; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE + 0.5, 0);
    ctx.lineTo(i * CELL_SIZE + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= GRID_H; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE + 0.5);
    ctx.lineTo(canvas.width, i * CELL_SIZE + 0.5);
    ctx.stroke();
  }
}

// ---------- Persistence ----------
let projectDeleted = false;

function saveProject() {
  if (projectDeleted) return;
  project.colors = [...tray.querySelectorAll('.color-circle:not(.add-circle)')]
    .map((c) => c.dataset.color);
  project.pixels = Object.fromEntries(pixels);
  project.updatedAt = Date.now();

  const all = loadProjects();
  all[projectId] = project;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ---------- Painting ----------
let isPainting = false;

function paintFromEvent(e) {
  if (!activeColor) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
  const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;

  // Numbered mode: a cell only accepts its correct color
  if (numberedMode) {
    const key = `${x},${y}`;
    if (!(key in targetPixels) || targetPixels[key] !== activeColor) return;
    pixels.set(key, activeColor);
  } else {
    pixels.set(`${x},${y}`, activeColor);
  }
  drawCanvas();
}

// ---------- Zoom & pan ----------
const viewport = document.getElementById('canvas-viewport');
const panBtn = document.getElementById('pan-btn');
let zoom = 1;
let panX = 0;
let panY = 0;
let panMode = false;

function applyTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function zoomAt(cx, cy, next) {
  const prev = zoom;
  zoom = Math.min(8, Math.max(1, next));
  const ratio = zoom / prev;
  panX = cx - (cx - panX) * ratio;
  panY = cy - (cy - panY) * ratio;
  if (zoom === 1) {
    panX = 0;
    panY = 0;
  }
  applyTransform();
}

panBtn.addEventListener('click', () => {
  panMode = !panMode;
  panBtn.classList.toggle('active', panMode);
});

// Mouse wheel zoom (desktop)
viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
}, { passive: false });

// Track active pointers for pinch/pan
const activePointers = new Map();
let pinchDist = 0;

function pointersArr() {
  return [...activePointers.values()];
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

viewport.addEventListener('pointerdown', (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = pointersArr();
  if (pts.length === 2) {
    isPainting = false;
    pinchDist = dist(pts[0], pts[1]);
    viewport.setPointerCapture(e.pointerId);
  }
});

viewport.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) return;
  const prev = activePointers.get(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = pointersArr();

  if (pts.length === 2) {
    // Pinch to zoom + move with the midpoint
    const nd = dist(pts[0], pts[1]);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const prevMid = { x: mid.x - ((e.clientX - prev.x) / 2), y: mid.y - ((e.clientY - prev.y) / 2) };
    panX += mid.x - prevMid.x;
    panY += mid.y - prevMid.y;
    if (pinchDist > 0) zoomAt(mid.x, mid.y, zoom * (nd / pinchDist));
    else applyTransform();
    pinchDist = nd;
  } else if (panMode || zoom > 1) {
    // One finger / mouse drag to move around (when zoomed or pan mode on)
    panX += e.clientX - prev.x;
    panY += e.clientY - prev.y;
    applyTransform();
  }
});

function endViewportPointer(e) {
  activePointers.delete(e.pointerId);
  if (pointersArr().length < 2) pinchDist = 0;
}
viewport.addEventListener('pointerup', endViewportPointer);
viewport.addEventListener('pointercancel', endViewportPointer);

// Paint only with a single pointer while not panning
canvas.addEventListener('pointerdown', (e) => {
  if (panMode || activePointers.size > 1) return;
  e.preventDefault();
  isPainting = true;
  paintFromEvent(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (isPainting && !panMode && activePointers.size <= 1) paintFromEvent(e);
});
window.addEventListener('pointerup', () => {
  if (isPainting) {
    saveProject();
    refreshColorStates(true);
  }
  isPainting = false;
});
canvas.addEventListener('pointercancel', () => {
  isPainting = false;
});

// ---------- Color tray ----------
const tray = document.getElementById('color-tray');
const addBtn = document.getElementById('add-color-btn');

// ---------- Custom shade picker (no presets) ----------
const pickerOverlay = document.getElementById('shade-picker-overlay');
const pickerTitle = document.getElementById('picker-title');
const svArea = document.getElementById('sv-area');
const svCursor = document.getElementById('sv-cursor');
const hueSlider = document.getElementById('hue-slider');
const pickerPreview = document.getElementById('picker-preview');
const pickerHex = document.getElementById('picker-hex');
const pickerOk = document.getElementById('picker-ok');
const pickerCancel = document.getElementById('picker-cancel');

let pickerCallback = null;
let hsv = { h: 210, s: 0.72, v: 1 };

function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hexStr) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexStr.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function renderPicker() {
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const pureHue = hsvToHex(hsv.h, 1, 1);
  svArea.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`;
  svCursor.style.left = `${hsv.s * 100}%`;
  svCursor.style.top = `${(1 - hsv.v) * 100}%`;
  svCursor.style.background = hex;
  pickerPreview.style.backgroundColor = hex;
  if (document.activeElement !== pickerHex) pickerHex.value = hex;
}

function openShadePicker(title, initialHex, onDone) {
  pickerTitle.textContent = title;
  const parsed = hexToHsv(initialHex);
  hsv = parsed || { h: 210, s: 0.72, v: 1 };
  hueSlider.value = hsv.h;
  pickerCallback = onDone;
  renderPicker();
  pickerOverlay.classList.remove('hidden');
}

function closeShadePicker() {
  pickerOverlay.classList.add('hidden');
  pickerCallback = null;
}

// Saturation / value area (drag or tap)
function svFromEvent(e) {
  const rect = svArea.getBoundingClientRect();
  hsv.s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  hsv.v = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  renderPicker();
}

let svDragging = false;
svArea.addEventListener('pointerdown', (e) => {
  svDragging = true;
  svArea.setPointerCapture(e.pointerId);
  svFromEvent(e);
});
svArea.addEventListener('pointermove', (e) => {
  if (svDragging) svFromEvent(e);
});
svArea.addEventListener('pointerup', () => { svDragging = false; });
svArea.addEventListener('pointercancel', () => { svDragging = false; });

hueSlider.addEventListener('input', () => {
  hsv.h = Number(hueSlider.value);
  renderPicker();
});

pickerHex.addEventListener('input', () => {
  const parsed = hexToHsv(pickerHex.value);
  if (parsed) {
    hsv = parsed;
    hueSlider.value = hsv.h;
    renderPicker();
  }
});

pickerOk.addEventListener('click', () => {
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const cb = pickerCallback;
  closeShadePicker();
  if (cb) cb(hex);
});

pickerCancel.addEventListener('click', closeShadePicker);
pickerOverlay.addEventListener('click', (e) => {
  if (e.target === pickerOverlay) closeShadePicker();
});

// "+" opens the shade picker; the chosen color is added to the tray
addBtn.addEventListener('click', () => {
  openShadePicker('Add a color', '#3aa7ff', (hex) => {
    addColor(hex);
    saveProject();
  });
});

function addColor(color, select = true) {
  const circle = document.createElement('button');
  circle.className = 'color-circle';
  circle.style.backgroundColor = color;
  circle.title = color;
  circle.dataset.color = color;
  circle.setAttribute('aria-label', `Color ${color}`);
  if (numberedMode) {
    circle.textContent = colorIndex.get(color) || '';
    circle.classList.add('numbered');
  }
  attachPressHandlers(circle);

  tray.insertBefore(circle, addBtn);
  if (select) selectColor(circle);
}

function selectColor(circle) {
  if (numberedMode && circle.classList.contains('done')) return; // finished colors can't be selected
  tray.querySelectorAll('.color-circle.selected')
    .forEach((c) => c.classList.remove('selected'));
  circle.classList.add('selected');
  activeColor = circle.dataset.color;
  if (numberedMode) drawCanvas(); // refresh highlight for the new selection
}

// ---------- Color completion (numbered mode) ----------
function remainingCount(color) {
  let n = 0;
  for (const [key, c] of Object.entries(targetPixels)) {
    if (c === color && !pixels.has(key)) n++;
  }
  return n;
}

function isColorComplete(color) {
  return remainingCount(color) === 0;
}

function isProjectComplete() {
  return Object.keys(targetPixels).every((key) => pixels.has(key));
}

// Darken/disable finished colors and auto-advance to the next unfinished one.
// `fromPaint` is true only when called after a paint stroke, so the
// completion overlay only auto-opens from painting, never on page load.
function refreshColorStates(fromPaint = false) {
  if (!numberedMode) return;

  const circles = [...tray.querySelectorAll('.color-circle:not(.add-circle)')];
  circles.forEach((c) => c.classList.toggle('done', isColorComplete(c.dataset.color)));

  if (activeColor && isColorComplete(activeColor)) {
    const next = circles.find((c) => !c.classList.contains('done'));
    const cur = tray.querySelector(`.color-circle[data-color="${CSS.escape(activeColor)}"]`);
    if (cur) cur.classList.remove('selected');
    activeColor = null;
    if (next) selectColor(next);
  }

  drawCanvas();

  if (fromPaint && isProjectComplete()) {
    openCompleteOverlay(true);
  }
}

// Tap/click selects; holding the circle opens the options menu
const LONG_PRESS_MS = 500;

function attachPressHandlers(circle) {
  let timer = null;
  let longPressed = false;

  circle.addEventListener('pointerdown', (e) => {
    // Capture the pointer so a spurious pointerleave (from the hover
    // scale transform re-hit-testing) can't cancel the long-press.
    circle.setPointerCapture(e.pointerId);
    clearTimeout(timer); // clear any stale timer whose pointerup was lost
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      openColorMenu(circle);
    }, LONG_PRESS_MS);
  });

  circle.addEventListener('pointerup', () => {
    clearTimeout(timer);
    if (!longPressed) selectColor(circle);
  });

  circle.addEventListener('pointerleave', () => clearTimeout(timer));
  circle.addEventListener('pointercancel', () => clearTimeout(timer));
  circle.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Restore the project's saved colors
for (const color of project.colors || []) {
  addColor(color, false);
}
const firstCircle = tray.querySelector('.color-circle:not(.add-circle)');
if (firstCircle) selectColor(firstCircle);

if (numberedMode) refreshColorStates();
drawCanvas();

// ---------- Color options menu (long-press) ----------
const menuOverlay = document.getElementById('color-menu-overlay');
const menuSwatch = document.getElementById('menu-swatch');
const menuColorValue = document.getElementById('menu-color-value');
const changeBtn = document.getElementById('change-color-btn');
const deleteBtn = document.getElementById('delete-color-btn');
const closeMenuBtn = document.getElementById('close-color-menu');

let menuTarget = null;

function openColorMenu(circle) {
  menuTarget = circle;
  menuSwatch.style.backgroundColor = circle.dataset.color;
  menuColorValue.textContent = circle.dataset.color;
  menuOverlay.classList.remove('hidden');
}

function closeColorMenu() {
  menuOverlay.classList.add('hidden');
  menuTarget = null;
}

closeMenuBtn.addEventListener('click', closeColorMenu);
menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) closeColorMenu();
});

// Change: recolor the circle and every pixel using it
changeBtn.addEventListener('click', () => {
  if (numberedMode) return; // palette is fixed in numbered mode
  if (!menuTarget) return;
  const target = menuTarget;
  openShadePicker('Change color', target.dataset.color, (newColor) => {
    const oldColor = target.dataset.color;
    if (newColor === oldColor) return;

    for (const [key, value] of pixels) {
      if (value === oldColor) pixels.set(key, newColor);
    }

    // If the new color already has a circle, merge into it
    const existing = tray.querySelector(`.color-circle[data-color="${newColor}"]`);
    if (existing) {
      const wasSelected = target.classList.contains('selected');
      target.remove();
      if (wasSelected) selectColor(existing);
    } else {
      target.dataset.color = newColor;
      target.style.backgroundColor = newColor;
      target.title = newColor;
      target.setAttribute('aria-label', `Color ${newColor}`);
      if (activeColor === oldColor) activeColor = newColor;
    }

    drawCanvas();
    saveProject();
  });
  closeColorMenu();
});

// Delete: remove the circle and empty every pixel using it
deleteBtn.addEventListener('click', () => {
  if (numberedMode) return; // palette is fixed in numbered mode
  if (!menuTarget) return;

  const color = menuTarget.dataset.color;
  for (const [key, value] of pixels) {
    if (value === color) pixels.delete(key);
  }

  menuTarget.remove();
  if (activeColor === color) activeColor = null;

  drawCanvas();
  saveProject();
  closeColorMenu();
});

// ---------- Back button ----------
document.getElementById('back-btn').addEventListener('click', () => {
  saveProject();
  location.href = 'index.html';
});

window.addEventListener('beforeunload', saveProject);

// ---------- Completion: save as PNG or delete (both remove the project) ----------
const completeBtn = document.getElementById('complete-btn');
const completeOverlay = document.getElementById('complete-overlay');
const completeTitle = document.getElementById('complete-title');
const completeSaveBtn = document.getElementById('complete-save-btn');
const completeDeleteBtn = document.getElementById('complete-delete-btn');
const completeCancelBtn = document.getElementById('complete-cancel-btn');

// Numbered projects complete automatically — no manual Complete button
if (numberedMode) completeBtn.classList.add('hidden');

function renderExportPng() {
  const scale = 20;
  const out = document.createElement('canvas');
  out.width = GRID_W * scale;
  out.height = GRID_H * scale;
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, out.width, out.height);

  const source = numberedMode ? targetPixels : Object.fromEntries(pixels);
  for (const [key, color] of Object.entries(source)) {
    const [x, y] = key.split(',').map(Number);
    outCtx.fillStyle = color;
    outCtx.fillRect(x * scale, y * scale, scale, scale);
  }
  return out;
}

function openCompleteOverlay(auto) {
  completeTitle.textContent = auto ? 'All cells filled!' : 'Finish this project?';
  completeOverlay.classList.remove('hidden');
}

function closeCompleteOverlay() {
  completeOverlay.classList.add('hidden');
}

function deleteProject() {
  projectDeleted = true; // stop beforeunload/saveProject from resurrecting it
  const all = loadProjects();
  delete all[projectId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

completeBtn.addEventListener('click', () => openCompleteOverlay(false));

completeSaveBtn.addEventListener('click', () => {
  const png = renderExportPng();
  const link = document.createElement('a');
  link.download = `${project.name || 'pixel-art'}.png`;
  link.href = png.toDataURL('image/png');
  link.click();
  deleteProject();
  location.href = 'index.html';
});

completeDeleteBtn.addEventListener('click', () => {
  deleteProject();
  location.href = 'index.html';
});

completeCancelBtn.addEventListener('click', closeCompleteOverlay);
completeOverlay.addEventListener('click', (e) => {
  if (e.target === completeOverlay) closeCompleteOverlay();
});
-
