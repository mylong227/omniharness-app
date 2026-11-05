import type { ServerModule } from '../core/serverModule.ts';

/**
 * 凭据保险库模块（Web 交付项，2026-10-11）：`vault.list` / `vault.set` / `vault.delete`。
 *
 * 三条安全纪律（都写成判据）：
 * 1. **不回读**：本模块**故意不提供** `vault.get` 一类的读值方法。面板的用途是"管理 agent 用的凭据"
 *    （列出名字、写入、删除），把密文读回浏览器页面没有任何必要用途，只会多一条泄露面。
 * 2. **列名不带值**：`vault.list` 只回**名字数组**（`VaultPort.listSecrets` 的契约就是"不泄露值"）。
 * 3. **未接线如实报错**：三条都回 `{ok:false, reason}`，不装作"保险库是空的"
 *    （与 `doctor.report` / `audit.query` 同批处置同源）。
 */
export function vaultModule(): ServerModule {
  return {
    name: 'vault',
    register(ctx) {
      ctx.rpc('vault.list', async () => {
        const vault = ctx.services.options.vault;
        if (vault === undefined) {
          return { ok: false, reason: 'vault 未接线（serve 组合根未注入 vault）' };
        }
        return { ok: true, names: await vault.listSecrets() };
      });
      ctx.rpc('vault.set', async (params) => {
        const vault = ctx.services.options.vault;
        if (vault === undefined) {
          return { ok: false, reason: 'vault 未接线（serve 组合根未注入 vault）' };
        }
        const name = typeof params['name'] === 'string' ? params['name'].trim() : '';
        const secret = typeof params['secret'] === 'string' ? params['secret'] : '';
        // fail-closed：名字或值缺失一律拒绝（空名字会写出一个无法按名取用的孤儿条目）。
        if (name === '') {
          return { ok: false, reason: 'vault.set 需要非空 name' };
        }
        if (secret === '') {
          return { ok: false, reason: 'vault.set 需要非空 secret（要删除请用 vault.delete）' };
        }
        await vault.setSecret(name, secret);
        return { ok: true, name };
      });
      ctx.rpc('vault.delete', async (params) => {
        const vault = ctx.services.options.vault;
        if (vault === undefined) {
          return { ok: false, reason: 'vault 未接线（serve 组合根未注入 vault）' };
        }
        const name = typeof params['name'] === 'string' ? params['name'].trim() : '';
        if (name === '') {
          return { ok: false, reason: 'vault.delete 需要非空 name' };
        }
        const removed = await vault.deleteSecret(name);
        return { ok: true, name, removed };
      });
    },
  };
}
