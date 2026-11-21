// --reasoning 旗标行为判据（2026-11-21 P7 三通道补齐）：
// 独立生效（不带 --model）/ 与 --model 并用 / 非法档位 fail-closed / argv 后出现者生效。
// 前提：parseArgs 仅旗标无 prompt 返回 undefined（设计语义）——用例都带一个位置 prompt。
// 背景：reasoning 此前只有文件 + env 两通道（cliArgs.ts 自注「无 CLI 旗标」），旗标是三通道补齐。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ArgParser } from '../src/apps/cli/argParser.ts';

test('--reasoning：独立生效（不带 --model 也要落到 CliArgs）', () => {
  const a = ArgParser.parseArgs(['--reasoning', 'high', '跑个任务']);
  assert.ok(a !== undefined);
  assert.equal(a?.reasoning, 'high');
  assert.equal(a?.prompt, '跑个任务');
});

test('--reasoning：与 --model 并用各自生效；argv 后出现者覆盖前者', () => {
  const a = ArgParser.parseArgs(['--model', 'gpt-x', '--reasoning', 'low', '任务']);
  assert.ok(a !== undefined);
  assert.equal(a?.model, 'gpt-x');
  assert.equal(a?.reasoning, 'low');
  const b = ArgParser.parseArgs(['--reasoning', 'low', '--reasoning', 'high', '任务']);
  assert.equal(b?.reasoning, 'high', 'argv 后出现者生效（同 --model 惯例）');
});

test('--reasoning：非法档位 fail-closed', () => {
  assert.throws(() => ArgParser.parseArgs(['--reasoning', 'ultra', '任务']), /reasoning/u);
});
