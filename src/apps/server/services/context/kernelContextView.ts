/**
 * 内核上下文策略只读视图（alpha.19：M60 检索供给 / M61 语义召回 / M63+M65 上下文策略）。
 *
 * ## 为什么单独建读模型
 *
 * 同一份「内核上下文现在怎么配的、实际生效没有」既被健康桥的 context 分区消费，也被
 * 上下文工作室的 `context.studio` 快照消费。两处各写一遍解析必然漂移（尤其
 * `semanticRecall` 的「显式 mode 优先、段缺省才认环境别名」口径），故收敛到这个读模型。
 *
 * ## 诚实边界
 *
 * - 配置项如实透传（未配置的枚举报内核默认 `off`，不猜测用户意图）；
 * - `active` 取运行时嵌入端口的实际在位性；`requested && !active` 标记为 `degraded`
 *   （BM25 降档），UI 必须显示为降级而不是正常；
 * - 不改任何运行时状态，纯读。
 */

import type { ResolvedConfig } from '../../../../host/kernel/contracts.ts';
import type { RuntimeHealthProbe } from '../kernelHealthBridge.ts';

/** 检索供给视图（`retrievalContext` 段的有效值）。 */
export interface KernelRetrievalView {
  /** off = 关闭；bm25 = 每步按预算注入会话历史片段。 */
  readonly mode: 'off' | 'bm25';
  /** 查询改写器：model = 经模型改写；off = 关闭。 */
  readonly rewriter: 'off' | 'model';
  /** 精排器：model = 经模型语义精排；off = 关闭。 */
  readonly rerank: 'off' | 'model';
  /** 单步注入条数（未配置时为 undefined，内核按出厂默认）。 */
  readonly maxSnippets: number | undefined;
  /** 单步注入 token 上限（未配置时为 undefined，内核按出厂默认）。 */
  readonly maxTokens: number | undefined;
}

/** 语义召回视图。 */
export interface KernelSemanticRecallView {
  /** 配置/环境是否请求语义召回。 */
  readonly requested: boolean;
  /** 嵌入端口是否实际在位。 */
  readonly active: boolean;
  /** 请求了但嵌入不在位（BM25 降档）——不是正常态。 */
  readonly degraded: boolean;
}

/** 上下文工程策略视图（降档阶梯 + 缓存守卫）。 */
export interface KernelContextPolicyView {
  /** 降档第 2 级：旧轮激进裁剪。 */
  readonly shapersAggressive: boolean;
  /** 降档第 3 级：强制压缩。 */
  readonly compactionForce: boolean;
  /** prompt cache 命中率下限（undefined = 不告警）。 */
  readonly cacheGuardFloor: number | undefined;
}

/** 内核上下文策略快照（`context.studio` 的 `kernel` 字段）。 */
export interface KernelContextView {
  readonly retrievalContext: KernelRetrievalView;
  readonly semanticRecall: KernelSemanticRecallView;
  readonly contextPolicy: KernelContextPolicyView;
}

/** 读模型依赖（全部为实时取值器）。 */
export interface KernelContextViewDeps {
  /** 当前解析配置。 */
  readonly config: () => ResolvedConfig;
  /** 运行时探针（未装配返回 undefined）。 */
  readonly probe: () => RuntimeHealthProbe | undefined;
}

/**
 * 语义召回是否被请求：显式 `mode` 优先；段缺省时认环境别名（与内核 M61 口径一致）。
 * @param config 已解析配置
 * @returns 是否请求语义召回
 */
export function semanticRecallRequested(config: ResolvedConfig): boolean {
  const mode = config.semanticRecall?.mode;
  if (mode !== undefined) return mode === 'on';
  return process.env['OMNI_SEMANTIC_RECALL'] === '1';
}

/** 全关闭视图（服务端未接线时的诚实默认；不伪造任何开启态）。 */
export function kernelContextOff(): KernelContextView {
  return {
    retrievalContext: {
      mode: 'off',
      rewriter: 'off',
      rerank: 'off',
      maxSnippets: undefined,
      maxTokens: undefined,
    },
    semanticRecall: { requested: false, active: false, degraded: false },
    contextPolicy: {
      shapersAggressive: false,
      compactionForce: false,
      cacheGuardFloor: undefined,
    },
  };
}

/**
 * 内核上下文读模型：把配置段与运行时探针合成一份 UI 可渲染的视图。
 *
 * 纯读：不构造 Agent、不改配置；运行时未装配时嵌入端口按「不在位」处理（如实）。
 */
export class KernelContextViewBuilder {
  /** 依赖（配置与运行时探针）。 */
  private readonly deps: KernelContextViewDeps;

  /**
   * @param deps 配置与运行时探针取值器
   */
  public constructor(deps: KernelContextViewDeps) {
    this.deps = deps;
  }

  /**
   * 生成当前视图。
   * @returns 内核上下文策略快照
   */
  public build(): KernelContextView {
    const config = this.deps.config();
    const retrieval = config.retrievalContext;
    const requested = semanticRecallRequested(config);
    const active = this.deps.probe()?.semanticRecallActive === true;
    const policy = config.contextPolicy;
    return {
      retrievalContext: {
        mode: retrieval?.mode ?? 'off',
        rewriter: retrieval?.rewriter ?? 'off',
        rerank: retrieval?.rerank ?? 'off',
        maxSnippets: retrieval?.maxSnippets,
        maxTokens: retrieval?.maxTokens,
      },
      semanticRecall: { requested, active, degraded: requested && !active },
      contextPolicy: {
        shapersAggressive: policy?.degradeLadder?.shapersAggressive === true,
        compactionForce: policy?.degradeLadder?.compactionForce === true,
        cacheGuardFloor: policy?.cacheGuard?.hitRateFloor,
      },
    };
  }
}
