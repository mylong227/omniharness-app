import { join } from 'node:path';
import { HashChainPromotionLedger } from '../../../host/kernel/evolution.ts';
import { FeatureEntitlements } from '../../license/featureEntitlements.ts';
import { PromotionHistoryService } from '../../../host/kernel/platform.ts';
import type { PromotionHistoryView } from '../../../host/kernel/platform.ts';
import type { ServerModule } from '../core/serverModule.ts';

/** 默认台账目录（与 CLI / 组合根同一口径：`<workspace>/.omniharness/evolution`）。 */
const LEDGER_DIR = join('.omniharness', 'evolution');

/**
 * 进化治理台模块（**F2**）：把晋升台账的数据面暴露给工作台 UI
 * （`governance.history` / `governance.rollbackTargets`）。
 *
 * ## 与 F2 判据的关系（数据与证据同源）
 *
 * `governance.history` 直接返回 {@link PromotionHistoryService.view()} 的结果——UI 上**每一行**
 * 都带着该行**自己**的独立复核结论（自算哈希 + 链式连接），而不是把台账整链结论抄一遍。
 * UI 只是把它渲染出来；判据在数据面（`promotionHistoryService.test.ts`）已经钉死。
 *
 * ## 只读边界
 *
 * 本模块**不**提供"直接改台账"的方法：回滚入口 `governance.rollbackTargets` 只给**候选锚点**，
 * 真正回滚仍走 `evolution rollback --yes`（治理动作必须显式确认，不能在 UI 上一点就改历史）。
 */
export function governanceModule(): ServerModule {
  return {
    name: 'governance',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('governance.history', async () => governanceView(s));
      ctx.rpc('governance.rollbackTargets', async () => {
        const result = governanceView(s);
        // 不可用时同样返回 `available:false`：UI 据此显示"台账读不出来"，
        // 而不是收到一个空列表（空列表会被误读成"没有可回滚的快照"）。
        if (!result.available) return result;
        return { available: true, targets: result.view.rollbackTargets };
      });
    },
  };
}

/**
 * 读当前工作区的晋升台账并组装治理台视图。
 *
 * **坏台账也要能看**：台账构造失败（目录不可写 / 文件损坏）不抛给 UI——返回 `available:false`
 * 与可读原因。治理台的用途之一就是"看出问题"，让它自己先崩掉是最差的选择。
 * @returns 视图 + 可用性（`available:false` 时 `reason` 必填）
 */
function governanceView(
  s: import('../core/serverServices.ts').ServerServices,
):
  | { readonly available: true; readonly view: PromotionHistoryView }
  | {
      readonly available: false;
      readonly reason: string;
      readonly code?: string | undefined;
    } {
  // **F4 闸门（Pro）**：治理台是商业档能力（§6.1），无授权即不可用——但**拒因必须可读且可机读**，
  // 且**绝不**影响核心功能（台账本身照常写入；`audit verify` 等完整性工具永不上闸）。
  const entitlement = (s.options.entitlements ?? FeatureEntitlements.core()).demand(
    'governance-console',
  );
  if (!entitlement.allowed) {
    return { available: false, reason: entitlement.reason, code: entitlement.code };
  }
  const dir = join(s.configStore.workspace(), LEDGER_DIR);
  try {
    const ledger = new HashChainPromotionLedger({ dir });
    const view = new PromotionHistoryService(ledger, (entry) =>
      HashChainPromotionLedger.hashOf(entry),
    ).view();
    return { available: true, view };
  } catch (err) {
    return {
      available: false,
      reason: `晋升台账不可用（${dir}）：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
