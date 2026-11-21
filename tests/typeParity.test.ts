import { describe, expect, it } from 'vitest';
import type { ServerServices } from '../src/apps/server/core/serverServices.ts';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import type {
  DecisionDetailViewLike,
  DecisionResultLike,
  DecisionSessionViewLike,
  FleetSnapshotLike,
  ThreadEvent,
} from '../web/src/types/models.ts';

/**
 * 后端构造形状 ↔ 前端手维镜像类型的**编译期 round-trip 判据**（W1，2026-11-21）。
 *
 * ## 为什么需要
 *
 * `web/src/types/models.ts` 是后端 RPC 形体的**手维镜像**（126 条），此前只有方法名 parity
 * （apiClientParity / serverModulesParity），类型形状漂移只能靠「某条运行时判据恰好用到该类型」
 * 间接兜住——「改后端忘改前端」会静默变成真机 undefined 渲染。
 *
 * ## 机制
 *
 * 每条探针是一个**恒等函数的类型标注**：
 *
 * ```ts
 * const roundTrip: (s: 后端形状) => 前端镜像 = (s) => s;
 * ```
 *
 * 后端形状**不可赋给**前端镜像时，tsc 直接红（`typecheck:tests` 门，verify 链内）——
 * 把协议漂移从运行期 undefined 提前到 CI 编译期。前端镜像只许**加宽**（可选字段/放宽联合），
 * 不许收窄：这是镜像单向兼容的纪律（服务端新字段不破前端；前端缺字段才红）。
 *
 * 覆盖面（高漂移域优先，随域重构逐步扩）：
 *   · ThreadEvent（事件流载荷——UI 渲染的第一入口）；
 *   · Fleet 快照（fleetRegistry.snapshotOf）；
 *   · Decision 会话/详情视图（decisionLedgerService）。
 */

/** 编译期探针 1：内核事件（SessionEvent）→ 前端 ThreadEvent。
 *  payload 是 **UI 域的刻意收窄**（内核线格式 unknown → UI 按 Record 消费，EventFields 逐字段
 *  fail-soft 守卫），探针在此显式投影并留注释；id/type/timestamp 三字段仍是恒等 round-trip
 *  （'rollback'/'calibration_units' 缺失、timestamp string↔number 两处漂移即由本探针揪出）。 */
const threadEventRoundTrip: (e: SessionEvent) => ThreadEvent = (e) => ({
  id: e.id,
  type: e.type,
  timestamp: e.timestamp,
  payload: e.payload as Record<string, unknown>,
});

/** 编译期探针 2：fleet 快照必须可赋给前端 FleetSnapshotLike。 */
const fleetRoundTrip: (s: Awaited<ReturnType<ServerServices['fleet']['snapshotOf']>>) => FleetSnapshotLike = (
  s,
) => s;

/** 编译期探针 3：决策会话视图（含失败联合）必须可赋给前端镜像。 */
const decisionSessionRoundTrip: (
  s: Awaited<ReturnType<ServerServices['decision']['sessionOf']>>,
) => DecisionResultLike<DecisionSessionViewLike> = (s) => s;

/** 编译期探针 4：决策详情视图（含失败联合）必须可赋给前端镜像。 */
const decisionDetailRoundTrip: (
  s: Awaited<ReturnType<ServerServices['decision']['detailOf']>>,
) => DecisionResultLike<DecisionDetailViewLike> = (s) => s;

describe('后端形状 ↔ 前端镜像类型 round-trip（编译期，tsc 裁决）', () => {
  it('探针已接线（本文件的价值在编译期；运行期只防探针被静默删空）', () => {
    // 编译期探针是纯类型层——运行期断言只钉「探针本身还在」。
    expect(typeof threadEventRoundTrip).toBe('function');
    expect(typeof fleetRoundTrip).toBe('function');
    expect(typeof decisionSessionRoundTrip).toBe('function');
    expect(typeof decisionDetailRoundTrip).toBe('function');
  });
});
