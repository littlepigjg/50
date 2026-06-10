import type { CellType, EditorTool, Level, Position } from './types';
import { positionEquals } from './GameEngine';
import { createEmptyGrid } from './GameEngine';

export type ObstacleType = 'wall' | 'pit';
export const OBSTACLE_TYPES: ObstacleType[] = ['wall', 'pit'];

export function isObstacle(type: CellType): boolean {
  return type === 'wall' || type === 'pit';
}

export function setCell(
  grid: CellType[][],
  pos: Position,
  type: CellType
): CellType[][] {
  return grid.map((row, ry) =>
    row.map((cell, rx) => {
      if (rx === pos.x && ry === pos.y) return type;
      return cell;
    })
  );
}

export function getCell(grid: CellType[][], pos: Position): CellType | null {
  if (pos.y < 0 || pos.y >= grid.length) return null;
  if (pos.x < 0 || pos.x >= grid[0].length) return null;
  return grid[pos.y][pos.x];
}

export function resizeEditorGrid(
  oldGrid: CellType[][],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): CellType[][] {
  const newGrid = createEmptyGrid(newWidth, newHeight);
  for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
    for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
      newGrid[y][x] = oldGrid[y][x];
    }
  }
  return newGrid;
}

export function clampPosition(pos: Position, width: number, height: number): Position {
  return {
    x: Math.max(0, Math.min(width - 1, pos.x)),
    y: Math.max(0, Math.min(height - 1, pos.y)),
  };
}

export function removeStarAt(stars: Position[], pos: Position): Position[] {
  return stars.filter((s) => !positionEquals(s, pos));
}

export function toggleStarAt(stars: Position[], pos: Position): Position[] {
  if (stars.some((s) => positionEquals(s, pos))) {
    return removeStarAt(stars, pos);
  }
  return [...stars, { ...pos }];
}

export interface ToggleObstacleResult {
  grid: CellType[][];
  changed: boolean;
  previousType: CellType;
  newType: CellType;
}

export function toggleObstacle(
  grid: CellType[][],
  pos: Position,
  obstacleType: ObstacleType
): ToggleObstacleResult {
  const current = getCell(grid, pos);
  if (current === null) {
    return { grid, changed: false, previousType: 'empty', newType: 'empty' };
  }

  let newType: CellType;
  if (current === obstacleType) {
    newType = 'empty';
  } else {
    newType = obstacleType;
  }

  return {
    grid: setCell(grid, pos, newType),
    changed: true,
    previousType: current,
    newType,
  };
}

export function isPositionBlockedForStartOrGoal(
  grid: CellType[][],
  pos: Position
): boolean {
  const cell = getCell(grid, pos);
  return cell === null || isObstacle(cell);
}

export function isPositionBlockedForStar(
  grid: CellType[][],
  pos: Position,
  start: Position,
  goal: Position
): boolean {
  const cell = getCell(grid, pos);
  if (cell === null) return true;
  if (isObstacle(cell)) return true;
  if (positionEquals(pos, start)) return true;
  if (positionEquals(pos, goal)) return true;
  return false;
}

export interface HandleEditorToolParams {
  tool: EditorTool;
  pos: Position;
  grid: CellType[][];
  start: Position;
  goal: Position;
  stars: Position[];
  width: number;
  height: number;
}

export interface EditorToolResult {
  grid?: CellType[][];
  start?: Position;
  goal?: Position;
  stars?: Position[];
  consumed: boolean;
}

export function handleEditorToolClick(params: HandleEditorToolParams): EditorToolResult {
  const { tool, pos, grid, start, goal, stars, width, height } = params;

  const clampedPos = clampPosition(pos, width, height);

  switch (tool) {
    case 'wall': {
      if (positionEquals(clampedPos, start) || positionEquals(clampedPos, goal)) {
        return { consumed: false };
      }
      const toggleResult = toggleObstacle(grid, clampedPos, 'wall');
      if (!toggleResult.changed) return { consumed: false };
      const newStars = removeStarAt(stars, clampedPos);
      return {
        grid: toggleResult.grid,
        stars: newStars,
        consumed: true,
      };
    }

    case 'pit': {
      if (positionEquals(clampedPos, start) || positionEquals(clampedPos, goal)) {
        return { consumed: false };
      }
      const toggleResult = toggleObstacle(grid, clampedPos, 'pit');
      if (!toggleResult.changed) return { consumed: false };
      const newStars = removeStarAt(stars, clampedPos);
      return {
        grid: toggleResult.grid,
        stars: newStars,
        consumed: true,
      };
    }

    case 'start': {
      if (isPositionBlockedForStartOrGoal(grid, clampedPos)) {
        return { consumed: false };
      }
      if (positionEquals(clampedPos, goal)) {
        return { consumed: false };
      }
      return {
        start: { ...clampedPos },
        stars: removeStarAt(stars, clampedPos),
        consumed: true,
      };
    }

    case 'goal': {
      if (isPositionBlockedForStartOrGoal(grid, clampedPos)) {
        return { consumed: false };
      }
      if (positionEquals(clampedPos, start)) {
        return { consumed: false };
      }
      return {
        goal: { ...clampedPos },
        stars: removeStarAt(stars, clampedPos),
        consumed: true,
      };
    }

    case 'star': {
      if (isPositionBlockedForStar(grid, clampedPos, start, goal)) {
        return { consumed: false };
      }
      return {
        stars: toggleStarAt(stars, clampedPos),
        consumed: true,
      };
    }

    case 'erase': {
      let newGrid = grid;
      const current = getCell(grid, clampedPos);
      if (current && current !== 'empty') {
        newGrid = setCell(grid, clampedPos, 'empty');
      }
      return {
        grid: newGrid,
        stars: removeStarAt(stars, clampedPos),
        consumed: true,
      };
    }

    case 'select':
    default:
      return { consumed: false };
  }
}

export function computeBlockedPositions(
  level: Pick<Level, 'grid' | 'start' | 'goal'>
): { walls: Set<string>; pits: Set<string> } {
  const walls = new Set<string>();
  const pits = new Set<string>();
  level.grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const key = `${x},${y}`;
      if (cell === 'wall') walls.add(key);
      if (cell === 'pit') pits.add(key);
    });
  });
  return { walls, pits };
}
