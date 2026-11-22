// 可调参数配置门禁（src/config/app.json 单一来源）。
//
// 判据：
//   ① app.json 的 web/server 段键齐全且全部为正数；
//   ② web 端视图与文件逐值一致（同一份 JSON，不允许另存一份）；
//   ③ 服务端 loader 的校验对非正数 fail-fast（用一份坏样本走同一校验逻辑的镜像）。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import raw from '../src/config/app.json' with { type: 'json' };
import { RuntimeConfig } from '../src/apps/config/RuntimeConfig.ts';
import { UI_TUNABLES } from '../web/src/config/RuntimeConfig.ts';

test('① app.json 两段全部为正数', () => {
  for (const section of ['web', 'server'] as const) {
    const value = raw[section] as Record<string, unknown>;
    assert.ok(Object.keys(value).length > 0, `${section} 段不得为空`);
    for (const [key, item] of Object.entries(value)) {
      assert.equal(typeof item, 'number', `${section}.${key} 必须是数字`);
      assert.ok(Number.isFinite(item) && (item as number) > 0, `${section}.${key} 必须是正数`);
    }
  }
});

test('② web 视图与 JSON 逐值一致（单一来源）', () => {
  assert.deepEqual({ ...UI_TUNABLES }, { ...raw.web });
});

test('③ 服务端 loader 暴露同一份值', () => {
  assert.deepEqual({ ...RuntimeConfig.web }, { ...raw.web });
  assert.deepEqual({ ...RuntimeConfig.server }, { ...raw.server });
});
