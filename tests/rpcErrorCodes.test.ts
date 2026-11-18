// JSON-RPC 错误码分类单一真源（core/rpcErrorCodes.ts）的判据：
// 码位是前端 failureHint 分类与嵌入调用方排查的协议面契约，形态变化必须过这里。
// 真实形态样本取自域模块既有 throw（「X 需要 Y」参数缺失 / 「未找到 X」资源不存在 /
// 「X 拒绝」校验拒绝 / RPC 超时 / 内部故障）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  INVALID_PARAMS_CODE,
  SERVER_ERROR_CODE,
  SERVER_WAIT_TIMEOUT_CODE,
  rpcErrorCodeFor,
} from '../src/apps/server/core/rpcErrorCodes.ts';

test('rpcErrorCodeFor：等待超时判 -32002（前缀形态与桥接 60s reject 一致）', () => {
  assert.equal(rpcErrorCodeFor('RPC 超时（60000ms）'), SERVER_WAIT_TIMEOUT_CODE);
  assert.equal(rpcErrorCodeFor('RPC 超时（1800000ms）'), SERVER_WAIT_TIMEOUT_CODE);
});

test('rpcErrorCodeFor：调用方参数问题判 -32602（域模块三类约定形态）', () => {
  // 「X 需要 Y」参数缺失
  assert.equal(rpcErrorCodeFor('graph.save 需要 def（含 name 与 steps）'), INVALID_PARAMS_CODE);
  assert.equal(rpcErrorCodeFor('modes.set 需要 threadId'), INVALID_PARAMS_CODE);
  // 「未找到 X」资源不存在
  assert.equal(rpcErrorCodeFor('未找到记忆:note-1'), INVALID_PARAMS_CODE);
  assert.equal(rpcErrorCodeFor('未找到图:plan-a'), INVALID_PARAMS_CODE);
  // 「X 拒绝」校验拒绝
  assert.equal(rpcErrorCodeFor('graph.run 拒绝空计划：steps 至少需要一步'), INVALID_PARAMS_CODE);
  // 标准码值就是 JSON-RPC Invalid params
  assert.equal(INVALID_PARAMS_CODE, -32602);
});

test('rpcErrorCodeFor：服务端内部故障与未知形态兜底 -32000', () => {
  assert.equal(rpcErrorCodeFor('内部异常'), SERVER_ERROR_CODE);
  assert.equal(rpcErrorCodeFor('ECONNREFUSED 127.0.0.1:8080'), SERVER_ERROR_CODE);
  // 保守性：「需要」不在前 80 字符内的长消息 / 无空格分隔的形态不误判（宁少分类不误分类）
  assert.equal(rpcErrorCodeFor('模型响应格式异常'), SERVER_ERROR_CODE);
  assert.equal(SERVER_ERROR_CODE, -32000);
});

test('rpcErrorCodeFor：真实组合——同一次会话里三类错误各自可区分', () => {
  const samples: Array<[string, number]> = [
    ['未找到图:nope', INVALID_PARAMS_CODE],
    ['RPC 超时（60000ms）', SERVER_WAIT_TIMEOUT_CODE],
    ['connect ECONNREFUSED', SERVER_ERROR_CODE],
  ];
  for (const [text, expected] of samples) {
    assert.equal(rpcErrorCodeFor(text), expected, text);
  }
});
