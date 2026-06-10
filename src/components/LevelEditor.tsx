import React, { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BlockType, CellType, Direction, EditorTool, Level, Position } from '../engine/types';
import { createEmptyGrid, validateLevel } from '../engine/GameEngine';
import { BLOCK_CONFIGS } from '../engine/blocks';
import { saveCustomLevel, downloadLevel, shareLevel, importLevelFromJson } from '../engine/storage';
import { positionEquals } from '../engine/GameEngine';

interface LevelEditorProps {
  onBack: () => void;
  onPlayLevel: (level: Level) => void;
  editLevel?: Level;
}

const TOOLS: { tool: EditorTool; label: string; icon: string; color: string }[] = [
  { tool: 'select', label: '选择', icon: '👆', color: 'bg-gray-400' },
  { tool: 'wall', label: '墙壁', icon: '🧱', color: 'bg-gray-700' },
  { tool: 'start', label: '起点', icon: '🚩', color: 'bg-blue-500' },
  { tool: 'goal', label: '终点', icon: '🏁', color: 'bg-green-500' },
  { tool: 'star', label: '星星', icon: '⭐', color: 'bg-yellow-400' },
  { tool: 'pit', label: '陷阱', icon: '🕳️', color: 'bg-red-600' },
  { tool: 'erase', label: '擦除', icon: '🧹', color: 'bg-pink-400' },
];

const DIRECTIONS: { dir: Direction; label: string; icon: string }[] = [
  { dir: 0, label: '上', icon: '⬆️' },
  { dir: 1, label: '右', icon: '➡️' },
  { dir: 2, label: '下', icon: '⬇️' },
  { dir: 3, label: '左', icon: '⬅️' },
];

const ALL_BLOCK_TYPES: BlockType[] = [
  'move',
  'turnLeft',
  'turnRight',
  'loop',
  'ifWall',
  'ifStar',
  'ifEmpty',
  'function',
  'callFunction',
];

export const LevelEditor: React.FC<LevelEditorProps> = ({ onBack, onPlayLevel, editLevel }) => {
  const [name, setName] = useState(editLevel?.name || '我的关卡');
  const [description, setDescription] = useState(editLevel?.description || '');
  const [difficulty, setDifficulty] = useState(editLevel?.difficulty || 3);
  const [width, setWidth] = useState(editLevel?.width || 8);
  const [height, setHeight] = useState(editLevel?.height || 8);
  const [grid, setGrid] = useState<CellType[][]>(
    editLevel?.grid || createEmptyGrid(width, height)
  );
  const [start, setStart] = useState<Position>(editLevel?.start || { x: 0, y: 0 });
  const [startDirection, setStartDirection] = useState<Direction>(editLevel?.startDirection || 1);
  const [goal, setGoal] = useState<Position>(editLevel?.goal || { x: 7, y: 7 });
  const [stars, setStars] = useState<Position[]>(editLevel?.stars || []);
  const [allowedBlocks, setAllowedBlocks] = useState<BlockType[]>(
    editLevel?.allowedBlocks || ALL_BLOCK_TYPES
  );
  const [tool, setTool] = useState<EditorTool>('wall');
  const [errors, setErrors] = useState<string[]>([]);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [hint, setHint] = useState(editLevel?.hint || '');

  const resizeGrid = useCallback((newWidth: number, newHeight: number) => {
    const newGrid = createEmptyGrid(newWidth, newHeight);
    for (let y = 0; y < Math.min(height, newHeight); y++) {
      for (let x = 0; x < Math.min(width, newWidth); x++) {
        newGrid[y][x] = grid[y][x];
      }
    }
    setGrid(newGrid);
    setWidth(newWidth);
    setHeight(newHeight);

    if (start.x >= newWidth) start.x = newWidth - 1;
    if (start.y >= newHeight) start.y = newHeight - 1;
    if (goal.x >= newWidth) goal.x = newWidth - 1;
    if (goal.y >= newHeight) goal.y = newHeight - 1;
    setStars(stars.filter((s) => s.x < newWidth && s.y < newHeight));
  }, [width, height, grid, start, goal, stars]);

  const handleCellClick = (x: number, y: number) => {
    const pos = { x, y };

    switch (tool) {
      case 'wall':
        if (positionEquals(pos, start) || positionEquals(pos, goal)) return;
        setStars(stars.filter((s) => !positionEquals(s, pos)));
        const newGrid = grid.map((row, ry) =>
          row.map((cell, rx) => {
            if (rx === x && ry === y) {
              return cell === 'wall' ? 'empty' : 'wall';
            }
            if (rx === x && ry === y && cell === 'pit') return 'wall';
            return cell;
          })
        );
        newGrid[y][x] = newGrid[y][x] === 'wall' ? 'empty' : 'wall';
        if (newGrid[y][x] === 'wall') newGrid[y][x] = 'wall';
        else newGrid[y][x] = 'empty';
        setGrid(newGrid);
        break;

      case 'pit':
        if (positionEquals(pos, start) || positionEquals(pos, goal)) return;
        setStars(stars.filter((s) => !positionEquals(s, pos)));
        setGrid(
          grid.map((row, ry) =>
            row.map((cell, rx) => {
              if (rx === x && ry === y) {
                if (cell === 'pit') return 'empty';
                if (cell === 'wall') return 'pit';
                return 'pit';
              }
              return cell;
            })
          )
        );
        break;

      case 'start':
        if (grid[y][x] === 'wall' || positionEquals(pos, goal)) return;
        setStars(stars.filter((s) => !positionEquals(s, pos)));
        setStart(pos);
        break;

      case 'goal':
        if (grid[y][x] === 'wall' || positionEquals(pos, start)) return;
        setStars(stars.filter((s) => !positionEquals(s, pos)));
        setGoal(pos);
        break;

      case 'star':
        if (grid[y][x] === 'wall' || positionEquals(pos, start) || positionEquals(pos, goal)) return;
        if (stars.some((s) => positionEquals(s, pos))) {
          setStars(stars.filter((s) => !positionEquals(s, pos)));
        } else {
          setStars([...stars, pos]);
        }
        break;

      case 'erase':
        setStars(stars.filter((s) => !positionEquals(s, pos)));
        setGrid(
          grid.map((row, ry) =>
            row.map((cell, rx) => {
              if (rx === x && ry === y) return 'empty';
              return cell;
            })
          )
        );
        break;

      default:
        break;
    }
  };

  const level: Level = useMemo(() => ({
    id: editLevel?.id || `custom-${uuidv4().slice(0, 8)}`,
    name,
    description,
    difficulty,
    width,
    height,
    grid,
    start,
    startDirection,
    goal,
    stars,
    allowedBlocks,
    hint: hint || undefined,
  }), [editLevel, name, description, difficulty, width, height, grid, start, startDirection, goal, stars, allowedBlocks, hint]);

  const handleSave = () => {
    const validationErrors = validateLevel(level);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    saveCustomLevel(level);
    alert('关卡已保存！');
    onBack();
  };

  const handleExport = () => {
    const validationErrors = validateLevel(level);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    downloadLevel(level);
  };

  const handleShare = async () => {
    const validationErrors = validateLevel(level);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    const success = await shareLevel(level);
    if (success) {
      alert('关卡JSON已复制到剪贴板！');
    } else {
      downloadLevel(level);
    }
  };

  const handleTest = () => {
    const validationErrors = validateLevel(level);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onPlayLevel({ ...level, id: `test-${Date.now()}` });
  };

  const handleImport = () => {
    const imported = importLevelFromJson(importText);
    if (imported) {
      setName(imported.name);
      setDescription(imported.description);
      setDifficulty(imported.difficulty);
      setWidth(imported.width);
      setHeight(imported.height);
      setGrid(imported.grid);
      setStart(imported.start);
      setStartDirection(imported.startDirection);
      setGoal(imported.goal);
      setStars(imported.stars);
      setAllowedBlocks(imported.allowedBlocks);
      setHint(imported.hint || '');
      setShowImport(false);
      setImportText('');
      alert('关卡导入成功！');
    } else {
      alert('导入失败，请检查JSON格式是否正确。');
    }
  };

  const cellSize = Math.min(50, Math.floor(500 / Math.max(width, height)));

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="game-card p-6 mb-4">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="btn-secondary">
                ← 返回
              </button>
              <h1 className="text-2xl font-bold text-gray-800">🎨 关卡编辑器</h1>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setShowImport(true)} className="btn-secondary">
                📥 导入
              </button>
              <button onClick={handleTest} className="btn-primary">
                ▶️ 试玩
              </button>
              <button onClick={handleExport} className="btn-secondary">
                💾 导出
              </button>
              <button onClick={handleShare} className="btn-secondary">
                📤 分享
              </button>
              <button onClick={handleSave} className="btn-success">
                ✅ 保存
              </button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <h3 className="font-bold text-red-700 mb-2">⚠️ 请修正以下问题：</h3>
              <ul className="list-disc list-inside text-red-600 text-sm space-y-1">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">📋 基本信息</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">关卡名称</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="输入关卡名称"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">描述</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                      rows={2}
                      placeholder="描述关卡目标"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">提示（可选）</label>
                    <textarea
                      value={hint}
                      onChange={(e) => setHint(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                      rows={2}
                      placeholder="给玩家的提示"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">难度：{difficulty}</label>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={difficulty}
                      onChange={(e) => setDifficulty(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>简单</span>
                      <span>困难</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">📐 地图大小</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">宽度</label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={width}
                      onChange={(e) => resizeGrid(Math.max(3, Math.min(20, parseInt(e.target.value) || 3)), height)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">高度</label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={height}
                      onChange={(e) => resizeGrid(width, Math.max(3, Math.min(20, parseInt(e.target.value) || 3)))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">起始方向</label>
                  <div className="grid grid-cols-4 gap-1">
                    {DIRECTIONS.map(({ dir, label: _label, icon }) => (
                      <button
                        key={dir}
                        onClick={() => setStartDirection(dir)}
                        className={`p-2 rounded-lg text-lg transition-all
                          ${startDirection === dir ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 hover:border-primary-300'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">🧩 允许的指令块</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {ALL_BLOCK_TYPES.map((type) => {
                    const config = BLOCK_CONFIGS[type];
                    const checked = allowedBlocks.includes(type);
                    return (
                      <label
                        key={type}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
                          ${checked ? `${config.color} text-white` : 'bg-white hover:bg-gray-100'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedBlocks([...allowedBlocks, type]);
                            } else {
                              setAllowedBlocks(allowedBlocks.filter((b) => b !== type));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span>{config.icon}</span>
                        <span className="text-sm font-medium">{config.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setAllowedBlocks(ALL_BLOCK_TYPES)}
                    className="flex-1 text-xs py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => setAllowedBlocks([])}
                    className="flex-1 text-xs py-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    清空
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">🗺️ 地图编辑</h3>

                <div className="flex flex-wrap gap-2 mb-4">
                  {TOOLS.map(({ tool: t, label, icon }) => (
                    <button
                      key={t}
                      onClick={() => setTool(t)}
                      className={`px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all
                        ${tool === t
                          ? 'ring-2 ring-offset-2 ring-primary-500 scale-105'
                          : 'hover:scale-105'
                        }
                      `}
                      style={{
                        backgroundColor: tool === t ? undefined : '#f3f4f6',
                      }}
                    >
                      <span className={`px-2 py-0.5 rounded text-white text-xs ${
                        TOOLS.find(x => x.tool === t)?.color
                      }`}>
                        {icon}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center overflow-auto p-4 bg-white rounded-xl">
                  <div
                    className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-slate-100"
                    style={{
                      width: width * cellSize,
                      height: height * cellSize,
                    }}
                  >
                    {grid.map((row, y) =>
                      row.map((cell, x) => {
                        const isStart = positionEquals({ x, y }, start);
                        const isGoal = positionEquals({ x, y }, goal);
                        const hasStar = stars.some((s) => positionEquals(s, { x, y }));

                        return (
                          <div
                            key={`${x}-${y}`}
                            onClick={() => handleCellClick(x, y)}
                            className={`absolute border border-slate-300/50 cell-hover transition-colors
                              ${(x + y) % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}
                            `}
                            style={{
                              left: x * cellSize,
                              top: y * cellSize,
                              width: cellSize,
                              height: cellSize,
                            }}
                          >
                            {cell === 'wall' && (
                              <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                                <div className="w-3/4 h-3/4 bg-gradient-to-br from-gray-500 to-gray-700 rounded-sm" />
                              </div>
                            )}
                            {cell === 'pit' && (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-4/5 h-4/5 bg-gradient-to-br from-gray-900 to-black rounded-full border-2 border-gray-800 flex items-center justify-center text-red-400">
                                  ⚠
                                </div>
                              </div>
                            )}
                            {isStart && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4/5 h-4/5 rounded-lg border-2 border-dashed border-blue-500 bg-blue-100/80 flex items-center justify-center">
                                  <span className="text-blue-600 text-xs font-bold">起</span>
                                </div>
                              </div>
                            )}
                            {isGoal && (
                              <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                                <div className="w-4/5 h-4/5 rounded-lg bg-gradient-to-br from-green-300 to-emerald-500 flex items-center justify-center">
                                  <span className="text-xl">🏁</span>
                                </div>
                              </div>
                            )}
                            {hasStar && (
                              <div className="absolute inset-0 flex items-center justify-center animate-bounce-slow">
                                <span style={{ fontSize: cellSize * 0.5 }}>⭐</span>
                              </div>
                            )}
                            {isStart && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                style={{ transform: `rotate(${[0, -90, 180, 90][startDirection]}deg)` }}
                              >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-blue-500" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm text-gray-600">
                  <span>🚩 起点 ({start.x}, {start.y})</span>
                  <span>🏁 终点 ({goal.x}, {goal.y})</span>
                  <span>⭐ 星星 {stars.length}颗</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-gray-50 rounded-xl p-4 h-full">
                <h3 className="font-bold text-gray-700 mb-3">📖 使用说明</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>1. 选择工具：</strong>点击上方工具栏选择要放置的元素</p>
                  <p><strong>2. 点击格子：</strong>在地图上点击格子放置/移除元素</p>
                  <p><strong>3. 设置起点方向：</strong>选择机器人开始时的朝向</p>
                  <p><strong>4. 选指令块：</strong>勾选本关允许使用的指令类型</p>
                  <p><strong>5. 试玩测试：</strong>点击"试玩"测试关卡是否可解</p>
                </div>

                <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <strong>💡 提示：</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>确保起点和终点可达</li>
                    <li>星星必须放在可通行的位置</li>
                    <li>保存时会自动验证关卡有效性</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="game-card p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📥 导入关卡</h2>
            <p className="text-sm text-gray-500 mb-3">
              将关卡的 JSON 数据粘贴到下方：
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              placeholder='{"id":"...","name":"...",...}'
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowImport(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button onClick={handleImport} className="btn-primary">
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelEditor;
