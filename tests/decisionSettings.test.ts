import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { DecisionSettingsStore } from '../src/apps/server/services/decision/decisionSettingsStore.ts';
import { DecisionSettingsService } from '../src/apps/server/services/decision/decisionSettingsService.ts';

const dirs: string[] = [];

/** 建一个隔离的临时设置文件。 */
function tempStore(): { store: DecisionSettingsStore; file: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'omni-decision-'));
  dirs.push(dir);
  const file = join(dir, 'decision-ledger.json');
  return { store: new DecisionSettingsStore(file), file, dir };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('DecisionSettingsStore / Service', () => {
  it('默认关闭；保存后可读回；主体空白归一为 undefined', () => {
    const { store } = tempStore();
    expect(store.load()).toEqual({ enabled: false });
    let changed = 0;
    const service = new DecisionSettingsService(store, () => {
      changed += 1;
    });
    const saved = service.configure(true, '  local:test  ');
    expect(saved).toEqual({ enabled: true, principal: 'local:test' });
    expect(store.load()).toEqual({ enabled: true, principal: 'local:test' });
    expect(changed).toBe(1);
    service.configure(false, '   ');
    expect(store.load()).toEqual({ enabled: false });
    expect(changed).toBe(2);
  });

  it('损坏文件回退默认，不阻断面板', () => {
    const { store, file } = tempStore();
    writeFileSync(file, '{not json', 'utf8');
    expect(store.load()).toEqual({ enabled: false });
  });

  it('主体超长被拒绝，且不触发变更回调', () => {
    const { store } = tempStore();
    let changed = 0;
    const service = new DecisionSettingsService(store, () => {
      changed += 1;
    });
    expect(() => service.configure(true, 'x'.repeat(201))).toThrow();
    expect(changed).toBe(0);
  });
});
