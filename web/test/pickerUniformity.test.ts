// 资源选择**统一口径**判据（2026-11-14 用户口径：全项目的文件/目录/资源选择一律走
// 项目自实现的资源选择弹窗面板，不得散落原生选择窗口）。
//
// 统一后的入口清单（全部复用 FilePicker / FolderPicker + PickerModal 纪律）：
//   · Composer「+」附件 / AddMenu「引用文件」   → FilePicker（多选，回传路径，attach.read）
//   · SessionPanel「+ 添加项目」                → FolderPicker（单选目录，可新建文件夹）
//   · ProofMode「选择证据包…」                  → FilePicker（回传路径，fs.read 取文本）
//   · FileTree / FileTab / AssistantCard 打开   → 工作区文件树（服务端 fs，非选择窗口）
//
// 唯一豁免：desktop 壳的 pickWorkspace（Electron 主进程 dialog.showOpenDialog，唯一
// 调用点 ipc.ts pickDirectory）——启动恢复 + 托盘/应用菜单「打开工作区」：这些时机
// Web 面板不在前台（启动期面板未加载、托盘/菜单是壳级操作），Web 面板无从替代；
// Web UI 内的工作区切换走 FolderPicker（SessionPanel「添加项目」）。
//
// ① 源码级扫描：web/src 出现 `type="file"` 即红（新增选择入口时必须接统一面板，
//    而不是顺手塞一个原生 input——那正是本次统一的成因）；
//    desktop/src 的 `showOpenDialog/showSaveDialog` 仅允许出现在 ipc.ts pickDirectory。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const DESKTOP = join(HERE, '..', '..', 'desktop', 'src');

/** 递归收集 .ts/.tsx 文件（node_modules 不在本目录内，无需排除）。 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test('web/src 无原生文件选择窗口入口（type="file"）——资源选择一律走统一面板', () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    if (/type\s*=\s*['"]file['"]/.test(src)) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    '发现原生文件选择入口：' + offenders.join(', ') + '（请接 FilePicker/FolderPicker 统一面板）',
  );
});

test('desktop/src 的原生目录/文件对话框仅限 pickDirectory 一处（壳级豁免不得扩散）', () => {
  const offenders: string[] = [];
  for (const file of walk(DESKTOP)) {
    const src = readFileSync(file, 'utf8');
    if (/showOpenDialog|showSaveDialog/.test(src) && !file.endsWith('ipc.ts')) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    'desktop 出现新的原生对话框调用：' + offenders.join(', ') + '（应收敛到统一面板或显式豁免）',
  );
});

