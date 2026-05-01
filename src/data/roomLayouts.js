import { M } from './gameData.js';
import {
  CANONICAL_WORLD_W,
  CANONICAL_WORLD_H,
  ROOM_LAYOUT_GRID_SIZE,
  ROOM_LAYOUT_WALL_CUBE_SIZE,
} from './constants.js';
import { isEntityOverlappingObstacle } from '../systems/obstacles.js';

function pushRectCells(cells, colStart, colEnd, rowStart, rowEnd) {
  for(let row = rowStart; row <= rowEnd; row++) {
    for(let col = colStart; col <= colEnd; col++) {
      cells.push({ col, row });
    }
  }
}

function pushCell(cells, col, row) {
  cells.push({ col, row });
}

function uniqueCells(cells) {
  const seen = new Set();
  const unique = [];
  for(const cell of cells) {
    const key = `${cell.col}:${cell.row}`;
    if(seen.has(key)) continue;
    seen.add(key);
    unique.push(cell);
  }
  return unique;
}

function cellsToObstacles(cells, {
  worldWidth = CANONICAL_WORLD_W,
  worldHeight = CANONICAL_WORLD_H,
  margin = M,
  gridSize = ROOM_LAYOUT_GRID_SIZE,
  wallCubeSize = ROOM_LAYOUT_WALL_CUBE_SIZE,
} = {}) {
  const arenaWidth = Math.max(0, worldWidth - 2 * margin);
  const arenaHeight = Math.max(0, worldHeight - 2 * margin);
  const cols = Math.max(1, Math.floor(arenaWidth / gridSize));
  const rows = Math.max(1, Math.floor(arenaHeight / gridSize));
  const inset = (gridSize - wallCubeSize) * 0.5;

  return uniqueCells(cells)
    .filter((cell) => cell.col >= 0 && cell.col < cols && cell.row >= 0 && cell.row < rows)
    .map(({ col, row }) => ({
      x: margin + col * gridSize + inset,
      y: margin + row * gridSize + inset,
      w: wallCubeSize,
      h: wallCubeSize,
    }));
}

function buildGenericSpawnCandidates(worldWidth, worldHeight, margin, playerRadius) {
  const minX = margin + playerRadius;
  const maxX = worldWidth - margin - playerRadius;
  const minY = margin + playerRadius;
  const maxY = worldHeight - margin - playerRadius;
  const midX = worldWidth * 0.5;
  const midY = worldHeight * 0.5;
  return [
    { x: midX, y: midY },
    { x: midX, y: minY + (worldHeight * 0.18) },
    { x: midX, y: maxY - (worldHeight * 0.18) },
    { x: minX + (worldWidth * 0.18), y: midY },
    { x: maxX - (worldWidth * 0.18), y: midY },
    { x: minX + (worldWidth * 0.2), y: minY + (worldHeight * 0.18) },
    { x: maxX - (worldWidth * 0.2), y: minY + (worldHeight * 0.18) },
    { x: minX + (worldWidth * 0.2), y: maxY - (worldHeight * 0.2) },
    { x: maxX - (worldWidth * 0.2), y: maxY - (worldHeight * 0.2) },
  ].map(({ x, y }) => ({
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  }));
}

function buildFallbackGrid(worldWidth, worldHeight, margin, playerRadius, step = 16) {
  const minX = margin + playerRadius;
  const maxX = worldWidth - margin - playerRadius;
  const minY = margin + playerRadius;
  const maxY = worldHeight - margin - playerRadius;
  const points = [];
  for(let y = minY; y <= maxY; y += step) {
    for(let x = minX; x <= maxX; x += step) {
      points.push({ x, y });
    }
  }
  const centerX = worldWidth * 0.5;
  const centerY = worldHeight * 0.5;
  points.sort((a, b) => (
    (Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY))
    || (a.y - b.y)
    || (a.x - b.x)
  ));
  return points;
}

function buildLayout(id, name, cells) {
  return Object.freeze({
    id,
    name,
    cells: uniqueCells(cells),
  });
}

function buildClassicGateCells() {
  const cells = [];
  const cols = 12;
  const rows = 22;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const leftCol = Math.max(1, Math.min(cols - 2, cx - 3));
  const rightCol = Math.max(1, Math.min(cols - 2, cx + 2));
  const topRow = Math.max(1, cy - 2);
  const bottomRow = Math.min(rows - 2, cy + 1);
  for(let row = topRow; row <= bottomRow; row++) {
    pushCell(cells, leftCol, row);
    pushCell(cells, rightCol, row);
  }
  return cells;
}

const ROOM_LAYOUTS = [
  buildLayout('classic_gate', 'Classic Gate', buildClassicGateCells()),
  buildLayout('open_split', 'Open Split', [
    ...(() => {
      const cells = [];
      pushRectCells(cells, 2, 2, 5, 7);
      pushRectCells(cells, 2, 2, 14, 16);
      pushRectCells(cells, 9, 9, 5, 7);
      pushRectCells(cells, 9, 9, 14, 16);
      return cells;
    })(),
  ]),
  buildLayout('center_choke', 'Center Choke', [
    ...(() => {
      const cells = [];
      pushRectCells(cells, 4, 4, 4, 8);
      pushRectCells(cells, 4, 4, 14, 18);
      pushRectCells(cells, 7, 7, 4, 8);
      pushRectCells(cells, 7, 7, 14, 18);
      pushRectCells(cells, 5, 6, 11, 11);
      pushRectCells(cells, 5, 6, 13, 13);
      return cells;
    })(),
  ]),
  buildLayout('corner_pockets', 'Corner Pockets', [
    ...(() => {
      const cells = [];
      pushRectCells(cells, 2, 3, 3, 4);
      pushRectCells(cells, 8, 9, 3, 4);
      pushRectCells(cells, 2, 3, 17, 18);
      pushRectCells(cells, 8, 9, 17, 18);
      pushRectCells(cells, 5, 6, 9, 9);
      pushRectCells(cells, 5, 6, 12, 12);
      return cells;
    })(),
  ]),
  buildLayout('offset_lanes', 'Offset Lanes', [
    ...(() => {
      const cells = [];
      pushRectCells(cells, 2, 3, 4, 14);
      pushRectCells(cells, 8, 8, 7, 17);
      pushRectCells(cells, 5, 6, 10, 11);
      pushRectCells(cells, 5, 6, 14, 15);
      return cells;
    })(),
  ]),
  buildLayout('broken_ring', 'Broken Ring', [
    ...(() => {
      const cells = [];
      pushRectCells(cells, 4, 7, 6, 6);
      pushRectCells(cells, 4, 7, 15, 15);
      pushRectCells(cells, 4, 4, 7, 14);
      pushRectCells(cells, 7, 7, 7, 14);
      pushRectCells(cells, 5, 6, 10, 11);
      return cells;
    })(),
  ]),
];

function getRoomLayout(roomIndex = 0, options = {}) {
  const layout = ROOM_LAYOUTS[Math.abs(roomIndex) % ROOM_LAYOUTS.length] || ROOM_LAYOUTS[0];
  return {
    id: layout.id,
    name: layout.name,
    cells: layout.cells,
    obstacles: cellsToObstacles(layout.cells, options),
    layoutIndex: Math.abs(roomIndex) % ROOM_LAYOUTS.length,
    layoutCount: ROOM_LAYOUTS.length,
  };
}

function resolveSafePlayerSpawn({
  layout,
  playerRadius,
  worldWidth = CANONICAL_WORLD_W,
  worldHeight = CANONICAL_WORLD_H,
  margin = M,
  obstacles = layout?.obstacles || [],
  preferred = null,
} = {}) {
  const r = Math.max(1, Number.isFinite(playerRadius) ? playerRadius : 9);
  const minX = margin + r;
  const maxX = worldWidth - margin - r;
  const minY = margin + r;
  const maxY = worldHeight - margin - r;
  const fits = (x, y) => (
    x >= minX && x <= maxX && y >= minY && y <= maxY
    && !isEntityOverlappingObstacle({ x, y, r }, obstacles)
  );

  const candidates = [];
  if (preferred && Number.isFinite(preferred.x) && Number.isFinite(preferred.y)) {
    candidates.push({ x: preferred.x, y: preferred.y, reason: 'preferred' });
  }
  for (const candidate of buildGenericSpawnCandidates(worldWidth, worldHeight, margin, r)) {
    candidates.push({ x: candidate.x, y: candidate.y, reason: 'anchor' });
  }
  for (const candidate of candidates) {
    if (fits(candidate.x, candidate.y)) {
      return {
        x: candidate.x,
        y: candidate.y,
        reason: candidate.reason,
        fallbackUsed: candidate.reason !== 'preferred',
      };
    }
  }

  for (const candidate of buildFallbackGrid(worldWidth, worldHeight, margin, r)) {
    if (fits(candidate.x, candidate.y)) {
      return {
        x: candidate.x,
        y: candidate.y,
        reason: 'grid',
        fallbackUsed: true,
      };
    }
  }

  return {
    x: Math.max(minX, Math.min(maxX, worldWidth * 0.5)),
    y: Math.max(minY, Math.min(maxY, worldHeight * 0.5)),
    reason: 'clamped',
    fallbackUsed: true,
  };
}

export {
  CANONICAL_WORLD_W,
  CANONICAL_WORLD_H,
  ROOM_LAYOUT_GRID_SIZE,
  ROOM_LAYOUT_WALL_CUBE_SIZE,
  ROOM_LAYOUTS,
  getRoomLayout,
  resolveSafePlayerSpawn,
};
