import { AppText } from '../../i18n/AppText.ts';
/**
 * 内核健康桥（2026-11-15）：把「本进程实际可观测的运行态」聚合成一份机读健康报告，
 * 供控制台诊断面板与运维探针消费。
 *
 * ## 为什么是「桥」而不是直接用内核哨兵
 *
 * 内核 `KernelSentinel`（M55）的构造输入是 `OmniKernel`——而本应用是 `Runtime` + 直接
 * `new Agent` 的多会话宿主（每个工作区一份运行时），并不持有 `OmniKernel`。直接实例化
 * 哨兵需要伪造内核外观；那会把「没探测」谎报成「探测过」。所以这里做**诚实桥接**：
 *
 *  - 分区名与状态词表沿用内核报告（`ok` / `degraded` / `absent`，`absent ≠ degraded`）；
 *  - 本进程没有装配的分区如实报 `absent` 并给出原因（如全局回执链、遥测链）；
 *  - 每个分区 fail-soft：子探测抛错 ⇒ 该分区 `degraded` + `HEALTH_SECTION_FAILED`，
 *    绝不静默，也绝不拖垮其它分区。
 *
 * ## 形状为什么是本仓自有
 *
 * 内核 `contracts/ports/composition/kernelHealth` 不在 vendored 包的公开导出子路径里
 * （`package.json#exports` 未列），应用侧无法 import；本仓按同一语义保留一份最小形状
 * （字段是报告渲染真正消费的那些）。上游一旦承诺导出，此文件应改为直接复用其类型。
 */

import type { ResolvedConfig } from '../../../host/kernel/contracts.ts';
import { semanticRecallRequested } from './context/kernelContextView.ts';

/** 单分区健康状态（与内核哨兵同词表）。 */
type KernelHealthStatus = 'ok' | 'degraded' | 'absent';

/** 单条问题（机读码 + 已脱敏细节）。 */
interface KernelHealthProblem {
  /** 机读问题码（如 `BUDGET_EXCEEDED` / `SEMANTIC_RECALL_DEGRADED`）。 */
  readonly code: string;
  /** 人读细节（不含密钥/正文）。 */
  readonly detail: string;
}

/** 单分区报告。 */
export interface KernelHealthSection {
  /** 分区名（`receipts` / `telemetry` / `budget` / `sessions` / `plugins` / `sandbox` / `context`）。 */
  readonly name: string;
  /** 状态。 */
  readonly status: KernelHealthStatus;
  /** 问题清单（ok/absent 时为空）。 */
  readonly problems: readonly KernelHealthProblem[];
  /** 分区明细（机读；形状随分区）。 */
  readonly detail?: Readonly<Record<string, unknown>> | undefined;
}

/** 健康报告快照（`kernel.health` RPC 的返回体）。 */
export interface KernelHealthSnapshot {
  /** 生成时刻（ISO 8601）。 */
  readonly generatedAt: string;
  /** 服务端进程存活时长（毫秒；桥创建时刻起算）。 */
  readonly uptimeMs: number;
  /** 分区（固定序）。 */
  readonly sections: readonly KernelHealthSection[];
  /** 一行人读摘要（`ok` / `degraded(分区:码,…)`）。 */
  readonly summary: string;
}

/**
 * 运行时探针（由 `AgentRuntimeHost` 提供）：只读、已装配才应答。
 *
 * 未装配（首个回合前）时返回 undefined——沙箱/语义召回的真实值此时不可知，
 * 桥据实报 `absent`，而不是拿配置值冒充运行时值。
 */
export interface RuntimeHealthProbe {
  /** 运行时沙箱名的实值（`SandboxPort.name`）。 */
  readonly sandboxName: string;
  /** 嵌入端口是否在位（语义召回实际生效的依据）。 */
  readonly semanticRecallActive: boolean;
  /** 已花费金额（USD；预算未配置/未计量时为 undefined）。 */
  readonly spentUsd: number | undefined;
  /** 硬预算上限（USD；未配置为 undefined）。 */
  readonly limitUsd: number | undefined;
}

/** 桥依赖（全部为实时取值器，构造注入）。 */
export interface KernelHealthDeps {
  /** 当前解析配置（读预算上限与语义召回开关）。 */
  readonly config: () => ResolvedConfig;
  /** 运行时探针（未装配返回 undefined）。 */
  readonly probe: () => RuntimeHealthProbe | undefined;
  /** 在跑会话 id（当前 Agent ∪ 退役 Agent；只读）。 */
  readonly runningSessions: () => readonly string[];
  /** 已加载插件名（插件栈未装配时为空数组）。 */
  readonly pluginNames: () => readonly string[];
}

/** 单分区探测结论（内部形状）。 */
interface SectionResult {
  readonly status: KernelHealthStatus;
  readonly problems: readonly KernelHealthProblem[];
  readonly detail?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * 内核健康桥：一次 `report()` 产出七分区只读快照。
 *
 * 参照内核哨兵的七分区（M55 六区 + M61 context 区），但只报告**本进程真实拥有**的事实：
 * receipts / telemetry 未装配 ⇒ absent；sandbox / context / budget / sessions / plugins
 * 取运行时与插件栈的实值。
 */
export class KernelHealthBridge {
  /** 进程起点（uptimeMs 基准；桥随 ServerServices 构造一次）。 */
  private readonly startedAt: number = Date.now();
  /** 依赖（配置 / 运行时探针 / 会话与插件读取器）。 */
  private readonly deps: KernelHealthDeps;

  /**
   * @param deps 全部为实时取值器（配置热切换后立即生效）
   */
  public constructor(deps: KernelHealthDeps) {
    this.deps = deps;
  }

  /**
   * 产出健康报告（固定分区序；任何分区异常不阻断其它分区）。
   * @returns 机读报告（含人读 summary）
   */
  public report(): KernelHealthSnapshot {
    const sections: KernelHealthSection[] = [
      this.sectionOf('receipts', () => this.receiptsSection()),
      this.sectionOf('telemetry', () => this.telemetrySection()),
      this.sectionOf('budget', () => this.budgetSection()),
      this.sectionOf('sessions', () => this.sessionsSection()),
      this.sectionOf('plugins', () => this.pluginsSection()),
      this.sectionOf('sandbox', () => this.sandboxSection()),
      this.sectionOf('context', () => this.contextSection()),
    ];
    return {
      generatedAt: new Date().toISOString(),
      uptimeMs: Date.now() - this.startedAt,
      sections,
      summary: KernelHealthBridge.summarize(sections),
    };
  }

  /**
   * 单分区 fail-soft 包装：探测抛错 ⇒ degraded + 机读码（诊断器不能成为第二个故障源，
   * 但也绝不吞错）。
   * @param name 分区名
   * @param probe 探测函数
   * @returns 分区报告
   */
  private sectionOf(name: string, probe: () => SectionResult): KernelHealthSection {
    try {
      const result = probe();
      return {
        name,
        status: result.status,
        problems: result.problems,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      };
    } catch (error) {
      return {
        name,
        status: 'degraded',
        problems: [
          {
            code: 'HEALTH_SECTION_FAILED',
            detail: `${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  /** 回执链分区：本应用按回合签名回执（proof.*），没有内核全局链 ⇒ absent。 */
  private receiptsSection(): SectionResult {
    return {
      status: 'absent',
      problems: [],
      detail: { reason: AppText.t('按回合签名回执由 proof.* 提供，本进程无内核全局回执链') },
    };
  }

  /** 遥测链分区：serve 未装配内核 RuntimeTelemetry ⇒ absent。 */
  private telemetrySection(): SectionResult {
    return {
      status: 'absent',
      problems: [],
      detail: { reason: AppText.t('未装配内核遥测链（RuntimeTelemetry）') },
    };
  }

  /**
   * 预算分区：未配置硬预算且未计量 ⇒ absent；越限 ⇒ degraded。
   *
   * 已花费取运行时 `budgetDegrade.spentUsd`（内核 M57 信封的权威读数），不另算一份。
   */
  private budgetSection(): SectionResult {
    const limitUsd = this.deps.probe()?.limitUsd ?? this.deps.config().costBudgetUsd;
    const spentUsd = this.deps.probe()?.spentUsd;
    if (limitUsd === undefined && spentUsd === undefined) {
      return { status: 'absent', problems: [] };
    }
    const exceeded =
      limitUsd !== undefined && spentUsd !== undefined ? spentUsd >= limitUsd : undefined;
    const detail = {
      limitUsd,
      spentUsd,
      remainingUsd:
        limitUsd !== undefined && spentUsd !== undefined ? limitUsd - spentUsd : undefined,
      exceeded,
    };
    if (exceeded === true) {
      return {
        status: 'degraded',
        problems: [{ code: 'BUDGET_EXCEEDED', detail: `limit=${String(limitUsd)}` }],
        detail,
      };
    }
    return { status: 'ok', problems: [], detail };
  }

  /** 会话分区：在跑会话清单（只读观测，不取消）。 */
  private sessionsSection(): SectionResult {
    const running = [...this.deps.runningSessions()];
    return { status: 'ok', problems: [], detail: { running } };
  }

  /** 插件分区：插件栈恒装配（可空）⇒ 计数即事实。 */
  private pluginsSection(): SectionResult {
    const count = this.deps.pluginNames().length;
    return { status: 'ok', problems: [], detail: { count } };
  }

  /** 沙箱分区：只报运行时实值；运行时未装配 ⇒ absent（不拿配置值冒充）。 */
  private sandboxSection(): SectionResult {
    const probe = this.deps.probe();
    if (probe === undefined) {
      return {
        status: 'absent',
        problems: [],
        detail: { reason: AppText.t('运行时尚未装配（首个回合后可见）') },
      };
    }
    return { status: 'ok', problems: [], detail: { name: probe.sandboxName } };
  }

  /**
   * 上下文分区：语义召回的「请求 / 生效」诚实标记（requested && !active ⇒ degraded），
   * 外加最近一次 prompt cache 读数（未观测不是病）。
   */
  private contextSection(): SectionResult {
    const requested = semanticRecallRequested(this.deps.config());
    const active = this.deps.probe()?.semanticRecallActive === true;
    const detail = { semanticRecall: { requested, active } };
    if (requested && !active) {
      return {
        status: 'degraded',
        problems: [
          {
            code: 'SEMANTIC_RECALL_DEGRADED',
            detail: 'semanticRecall requested=on but embedding port absent (BM25-only fallback)',
          },
        ],
        detail,
      };
    }
    if (!requested && !active) {
      return { status: 'absent', problems: [], detail };
    }
    return { status: 'ok', problems: [], detail };
  }

  /**
   * 一行摘要：全 ok ⇒ `ok`；否则 `degraded(分区:码,…)`（absent 不进摘要——不是病）。
   * @param sections 分区清单
   * @returns 人读摘要
   */
  private static summarize(sections: readonly KernelHealthSection[]): string {
    const degraded = sections.flatMap((section) =>
      section.problems.map((problem) => `${section.name}:${problem.code}`),
    );
    return degraded.length === 0 ? 'ok' : `degraded(${degraded.join(',')})`;
  }
}