import type { ServerModule } from '../core/serverModule.ts';

/**
 * 决策账本模块（2026-11-11）：`decision.*` 四个 RPC。
 *
 * 读：`decision.session` / `decision.detail` / `decision.export`（导出要求 confirm）。
 * 写：`decision.configure`（用户级审计开关 + 主体；只开/关未来回合，不补造历史）。
 *
 * 服务层保持纯数据，失败用判别联合返回，**不抛 JSON-RPC 错误打断面板**。
 */
export function decisionModule(): ServerModule {
  return {
    name: 'decision',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('decision.session', async (params) => {
        return s.decision.sessionOf(stringOf(params['threadId']));
      });
      ctx.rpc('decision.detail', async (params) => {
        return s.decision.detailOf(stringOf(params['threadId']), stringOf(params['recordId']));
      });
      ctx.rpc('decision.export', async (params) => {
        if (params['confirm'] !== true) {
          return {
            ok: false,
            code: 'confirm_required',
            message: '导出 AAT 会生成本地证据文件；必须显式确认。',
          };
        }
        return s.decision.exportOf(stringOf(params['threadId']));
      });
      ctx.rpc('decision.configure', async (params) => {
        if (params['confirm'] !== true) {
          return {
            ok: false,
            code: 'confirm_required',
            message: '变更决策审计设置需要显式确认。',
          };
        }
        try {
          const settings = s.decisionSettings.configure(
            params['enabled'] === true,
            stringOrUndefined(params['principal']),
          );
          return { ok: true, settings };
        } catch (error) {
          return {
            ok: false,
            code: 'config_write_failed',
            message: `保存失败：${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });
    },
  };
}

/**
 * 取字符串参数（缺省空串；服务层按「未选会话」处理）。
 * @param raw 原始参数值。
 * @returns 字符串。
 */
function stringOf(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

/**
 * 取可选字符串参数（空串归一为 undefined）。
 * @param raw 原始参数值。
 * @returns 字符串或 undefined。
 */
function stringOrUndefined(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return raw.trim() === '' ? undefined : raw;
}
