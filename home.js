// ---------- Storage ----------
const STORAGE_KEY = 'pixel-color-projects';

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

// ---------- Project grid ----------
const grid = document.getElementById('project-grid');
const newBtn = document.getElementById('new-project-btn');
const selectToggleBtn = document.getElementById('select-toggle-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const selectAllBtn = document.getElementById('select-all-btn');

let selectMode = false;
const selectedIds = new Set();

function drawThumbnail(canvas, project) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const w = project.gridW || project.gridSize;
  const h = project.gridH || project.gridSize;
  const cell = canvas.width / Math.max(w, h);
  const offX = (canvas.width - w * cell) / 2;
  const offY = (canvas.height - h * cell) / 2;

  const numbered = project.mode === 'numbered';

  if (numbered && project.targetPixels) {
    for (const [key, color] of Object.entries(project.targetPixels)) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = color + '22';
      ctx.fillRect(offX + x * cell, offY + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }

  for (const [key, color] of Object.entries(project.pixels || {})) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(offX + x * cell, offY + y * cell, Math.ceil(cell), Math.ceil(cell));
  }
}

function renderGrid() {
  grid.querySelectorAll('.project-card[data-id]').forEach((el) => el.remove());

  const projects = Object.values(loadProjects())
    .sort((a, b) => b.updatedAt - a.updatedAt);

  for (const project of projects) {
    const card = document.createElement('button');
    card.className = 'project-card';
    card.dataset.id = project.id;

    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 150;
    thumb.className = 'thumb';
    drawThumbnail(thumb, project);

    const label = document.createElement('span');
    label.className = 'card-label';
    label.textContent = project.name;

    card.append(thumb, label);

    card.addEventListener('click', (e) => {
      if (card.dataset.longPressed === 'true') {
        card.dataset.longPressed = 'false';
        return; // swallow the click that follows a long-press
      }
      if (selectMode) {
        toggleSelect(card, project.id);
      } else {
        location.href = `sandbox.html?id=${project.id}`;
      }
    });
    attachCardPressHandlers(card, project);
    grid.appendChild(card);
  }
}

// Long-press a card to open its rename/delete overlay
function attachCardPressHandlers(card, project) {
  let timer = null;

  card.addEventListener('pointerdown', (e) => {
    card.setPointerCapture(e.pointerId);
    clearTimeout(timer);
    timer = setTimeout(() => {
      card.dataset.longPressed = 'true';
      if (!selectMode) openEditOverlay(project);
    }, 500);
  });
  card.addEventListener('pointerup', () => clearTimeout(timer));
  card.addEventListener('pointercancel', () => clearTimeout(timer));
  card.addEventListener('contextmenu', (e) => e.preventDefault());
}

function toggleSelect(card, id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    card.classList.remove('selected');
  } else {
    selectedIds.add(id);
    card.classList.add('selected');
  }
  updateDeleteSelectedBtn();
  updateSelectAllBtn();
}

// Trashcan + select-all only appear in selection mode
function updateDeleteSelectedBtn() {
  deleteSelectedBtn.classList.toggle('hidden', !selectMode);
  deleteSelectedBtn.innerHTML = `&#128465; ${selectedIds.size}`;
  deleteSelectedBtn.disabled = selectedIds.size === 0;
}

function updateSelectAllBtn() {
  selectAllBtn.classList.toggle('hidden', !selectMode);
  const total = grid.querySelectorAll('.project-card[data-id]').length;
  selectAllBtn.textContent = total > 0 && selectedIds.size === total
    ? 'Deselect all'
    : 'Select all';
}

selectAllBtn.addEventListener('click', () => {
  const cards = [...grid.querySelectorAll('.project-card[data-id]')];
  const allSelected = cards.length > 0 && selectedIds.size === cards.length;
  if (allSelected) {
    selectedIds.clear();
    cards.forEach((c) => c.classList.remove('selected'));
  } else {
    cards.forEach((c) => {
      selectedIds.add(c.dataset.id);
      c.classList.add('selected');
    });
  }
  updateDeleteSelectedBtn();
  updateSelectAllBtn();
});

selectToggleBtn.addEventListener('click', () => {
  selectMode = !selectMode;
  if (!selectMode) {
    selectedIds.clear();
    grid.querySelectorAll('.project-card.selected').forEach((c) => c.classList.remove('selected'));
  }
  selectToggleBtn.textContent = selectMode ? 'Cancel' : 'Select';
  selectToggleBtn.classList.toggle('active', selectMode);
  grid.classList.toggle('select-mode', selectMode);
  updateDeleteSelectedBtn();
  updateSelectAllBtn();
});

deleteSelectedBtn.addEventListener('click', () => {
  if (selectedIds.size === 0) return;
  const projects = loadProjects();
  selectedIds.forEach((id) => delete projects[id]);
  saveProjects(projects);
  selectedIds.clear();
  selectMode = false;
  selectToggleBtn.textContent = 'Select';
  selectToggleBtn.classList.remove('active');
  grid.classList.remove('select-mode');
  updateDeleteSelectedBtn();
  updateSelectAllBtn();
  renderGrid();
});

// ---------- Project rename / delete overlay ----------
const editOverlay = document.getElementById('project-edit-overlay');
const editNameInput = document.getElementById('edit-name-input');
const editSaveBtn = document.getElementById('edit-save-btn');
const editDeleteBtn = document.getElementById('edit-delete-btn');
const editCancelBtn = document.getElementById('edit-cancel-btn');
let editingId = null;

function openEditOverlay(project) {
  editingId = project.id;
  editNameInput.value = project.name;
  editOverlay.classList.remove('hidden');
}

function closeEditOverlay() {
  editOverlay.classList.add('hidden');
  editingId = null;
}

editSaveBtn.addEventListener('click', () => {
  const projects = loadProjects();
  const name = editNameInput.value.trim();
  if (projects[editingId] && name) {
    projects[editingId].name = name;
    projects[editingId].updatedAt = Date.now();
    saveProjects(projects);
    renderGrid();
  }
  closeEditOverlay();
});

editDeleteBtn.addEventListener('click', () => {
  const projects = loadProjects();
  delete projects[editingId];
  saveProjects(projects);
  renderGrid();
  closeEditOverlay();
});

editCancelBtn.addEventListener('click', closeEditOverlay);
editOverlay.addEventListener('click', (e) => {
  if (e.target === editOverlay) closeEditOverlay();
});

renderGrid();

// ---------- New sandbox overlay ----------
const overlay = document.getElementById('new-project-overlay');
const sizeChips = document.getElementById('size-chips');
const setupTray = document.getElementById('setup-tray');
const setupAddBtn = document.getElementById('setup-add-color');
const setupPicker = document.getElementById('setup-picker');
const cancelBtn = document.getElementById('cancel-new-project');
const createBtn = document.getElementById('create-project');
const newNameInput = document.getElementById('new-name-input');

newBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
cancelBtn.addEventListener('click', closeOverlay);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeOverlay();
});

function closeOverlay() {
  overlay.classList.add('hidden');
  newNameInput.value = '';
  setupTray.querySelectorAll('.color-circle:not(.add-circle)').forEach((c) => c.remove());
  sizeChips.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('selected', c.dataset.size === '24'));
}

sizeChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  sizeChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
});

setupAddBtn.addEventListener('click', () => setupPicker.click());

setupPicker.addEventListener('change', () => {
  const circle = document.createElement('button');
  circle.className = 'color-circle';
  circle.style.backgroundColor = setupPicker.value;
  circle.dataset.color = setupPicker.value;
  circle.title = `${setupPicker.value} — click to remove`;
  circle.addEventListener('click', () => circle.remove());
  setupTray.insertBefore(circle, setupAddBtn);
});

createBtn.addEventListener('click', () => {
  const projects = loadProjects();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const size = Number(sizeChips.querySelector('.chip.selected').dataset.size);
  const colors = [...setupTray.querySelectorAll('.color-circle:not(.add-circle)')]
    .map((c) => c.dataset.color);
  const name = newNameInput.value.trim() || `Untitled ${Object.keys(projects).length + 1}`;

  projects[id] = {
    id,
    name,
    gridSize: size,
    colors,
    pixels: {},
    updatedAt: Date.now(),
  };
  saveProjects(projects);
  location.href = `sandbox.html?id=${id}`;
});

function hex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// K-means over RGB triples to find `k` dominant colors
function extractColors(samples, k) {
  if (samples.length === 0) return [];

  const centroids = [samples[Math.floor(Math.random() * samples.length)]];
  while (centroids.length < k) {
    let farthest = samples[0];
    let farthestDist = -1;
    for (const p of samples) {
      const d = Math.min(...centroids.map((c) =>
        (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2));
      if (d > farthestDist) {
        farthestDist = d;
        farthest = p;
      }
    }
    centroids.push(farthest);
  }

  for (let iter = 0; iter < 10; iter++) {
    const groups = centroids.map(() => []);
    for (const p of samples) {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      groups[best].push(p);
    }
    groups.forEach((group, i) => {
      if (group.length === 0) return;
      const avg = [0, 1, 2].map((ch) =>
        Math.round(group.reduce((sum, p) => sum + p[ch], 0) / group.length));
      centroids[i] = avg;
    });
  }

  return [...new Set(centroids.map(([r, g, b]) => hex(r, g, b)))];
}

function nearestColor(palette, r, g, b) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const cr = parseInt(c.slice(1, 3), 16);
    const cg = parseInt(c.slice(3, 5), 16);
    const cb = parseInt(c.slice(5, 7), 16);
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// ---------- Upload picture ----------
const uploadBtn = document.getElementById('upload-project-btn');
const uploadOverlay = document.getElementById('upload-overlay');
const uploadDrop = document.getElementById('upload-drop');
const uploadInput = document.getElementById('upload-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadSizeChips = document.getElementById('upload-size-chips');
const colorCountSelect = document.getElementById('color-count-select');
const cancelUploadBtn = document.getElementById('cancel-upload');
const createUploadBtn = document.getElementById('create-upload');
const uploadNameInput = document.getElementById('upload-name-input');

for (let n = 5; n <= 50; n += 5) {
  const option = document.createElement('option');
  option.value = n;
  option.textContent = `${n} colors`;
  if (n === 10) option.selected = true;
  colorCountSelect.appendChild(option);
}

let uploadedImage = null;
let currentPalette = [];
let previewId = 0;

// Grid options preserving the image's aspect ratio, aiming for
// roughly 600-1000 total cells (e.g. 900 could be 30x30 or 20x45).
function gridOptions(imgW, imgH) {
  const ratio = imgW / imgH;
  const options = [];
  const seen = new Set();

  for (const target of [1200, 1000, 800, 600]) {
    let h = Math.round(Math.sqrt(target / ratio));
    let w = Math.round(h * ratio);
    if (w > 50) {
      const s = 50 / w;
      w = 50;
      h = Math.round(h * s);
    }
    if (h > 50) {
      const s = 50 / h;
      h = 50;
      w = Math.round(w * s);
    }
    const key = `${w}x${h}`;
    if (w >= 8 && h >= 8 && !seen.has(key)) {
      seen.add(key);
      options.push({ w, h, total: w * h });
    }
  }
  return options;
}

function renderSizeOptions() {
  const options = gridOptions(uploadedImage.naturalWidth, uploadedImage.naturalHeight);
  uploadSizeChips.innerHTML = '';
  options.forEach((opt) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.w = opt.w;
    chip.dataset.h = opt.h;
    chip.textContent = `${opt.w} × ${opt.h} · ${opt.total} px`;
    uploadSizeChips.appendChild(chip);
  });
  // Default to the second option (the ~1000 px range)
  const idx = options.length > 1 ? 1 : 0;
  uploadSizeChips.children[idx].classList.add('selected');
}

uploadBtn.addEventListener('click', () => uploadOverlay.classList.remove('hidden'));

function closeUploadOverlay() {
  uploadOverlay.classList.add('hidden');
  uploadedImage = null;
  currentPalette = [];
  uploadInput.value = '';
  uploadNameInput.value = '';
  uploadPreview.classList.add('hidden');
  uploadDrop.querySelector('p').classList.remove('hidden');
  createUploadBtn.disabled = true;
  colorCountSelect.value = '10';
}

cancelUploadBtn.addEventListener('click', closeUploadOverlay);
uploadOverlay.addEventListener('click', (e) => {
  if (e.target === uploadOverlay) closeUploadOverlay();
});

uploadDrop.addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', () => {
  const file = uploadInput.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    uploadedImage = img;
    uploadPreview.classList.remove('hidden');
    uploadDrop.querySelector('p').classList.add('hidden');
    renderSizeOptions();
    updatePreview();
  };
  img.src = URL.createObjectURL(file);
});

uploadSizeChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  uploadSizeChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
  updatePreview();
});

colorCountSelect.addEventListener('change', updatePreview);

// Pixelate onto the chosen grid (aspect preserved) and show a live preview
function updatePreview() {
  if (!uploadedImage) return;
  const runId = ++previewId;

  const chip = uploadSizeChips.querySelector('.chip.selected');
  if (!chip) return;
  const w = Number(chip.dataset.w);
  const h = Number(chip.dataset.h);
  const colorCount = Number(colorCountSelect.value);

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const workCtx = work.getContext('2d');
  workCtx.drawImage(uploadedImage, 0, 0, w, h);
  const data = workCtx.getImageData(0, 0, w, h).data;

  const samples = [];
  for (let i = 0; i < data.length; i += 4) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  setTimeout(() => {
    if (runId !== previewId) return; // superseded by a newer preview
    currentPalette = extractColors(samples, colorCount);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    const imgData = outCtx.createImageData(w, h);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        imgData.data[i + 3] = 0;
        continue;
      }
      const c = nearestColor(currentPalette, data[i], data[i + 1], data[i + 2]);
      imgData.data[i] = parseInt(c.slice(1, 3), 16);
      imgData.data[i + 1] = parseInt(c.slice(3, 5), 16);
      imgData.data[i + 2] = parseInt(c.slice(5, 7), 16);
      imgData.data[i + 3] = 255;
    }
    outCtx.putImageData(imgData, 0, 0);
    uploadPreview.src = out.toDataURL();
    createUploadBtn.disabled = false;
  }, 0);
}

// Build the color-by-numbers project: blank numbered cells, colors hidden
createUploadBtn.addEventListener('click', () => {
  if (!uploadedImage || currentPalette.length === 0) return;

  const chip = uploadSizeChips.querySelector('.chip.selected');
  const w = Number(chip.dataset.w);
  const h = Number(chip.dataset.h);

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const workCtx = work.getContext('2d');
  workCtx.drawImage(uploadedImage, 0, 0, w, h);
  const data = workCtx.getImageData(0, 0, w, h).data;

  const targetPixels = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      targetPixels[`${x},${y}`] = nearestColor(currentPalette, data[i], data[i + 1], data[i + 2]);
    }
  }

  const projects = loadProjects();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const name = uploadNameInput.value.trim() || `Untitled ${Object.keys(projects).length + 1}`;
  projects[id] = {
    id,
    name,
    gridW: w,
    gridH: h,
    colors: currentPalette,
    pixels: {},
    targetPixels,
    mode: 'numbered',
    updatedAt: Date.now(),
  };
  saveProjects(projects);
  location.href = `sandbox.html?id=${id}`;
});
