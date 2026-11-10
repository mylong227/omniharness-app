/**
 * unconfiguredModel.ts —— 「尚未配置模型凭据」的占位模型端口。
 *
 * ## 为什么需要（2026-11-08 用户报障）
 *
 * 桌面端侧车固定以 `serve` 启动；此前 `CliBuildConfig.buildModel` 在「配置了需要 Key 的厂商、
 * 但 Key 不存在」时**直接抛错**，侧车在就绪前退出 ⇒ 主进程弹「Harness 启动失败」并 `app.quit()`。
 * 用户连「设置 → 模型接入」都进不去，而配置 Key 恰恰只能在那里面做——启动被配置反向卡死。
 *
 * 现在 serve 路径改走本端口：**启动、开窗、进设置页全部照常**，只有真正发起一次生成时
 * 才抛出可行动错误（指向设置页）。用户在 UI 里填好 Key 并保存后，`ModelCatalogService`
 * 会在下一回合重建 Agent 时换回真适配器，无需重启应用。
 *
 * 刻意**不**静默回落到 mock：mock 会把「没配 Key」伪装成「模型回答了」，比报错更难排查。
 */
import { ConfigError } from '../../host/kernel/config.ts';
import type { ModelOutput, ModelPort, ModelRequest } from '../../host/kernel/contracts.ts';

/** 构造占位模型所需的描述信息（只用于生成人话错误）。 */
export interface UnconfiguredModelOptions {
  /** 适配器标识（如 `openai` / `anthropic`）。 */
  readonly adapter: string;
  /** 目标模型名（用于错误文案，说明用户本来要用的模型）。 */
  readonly model: string;
  /** 该适配器读取 Key 的环境变量名（可能没有）。 */
  readonly apiKeyEnv: string | undefined;
}

/**
 * 未配置凭据的模型端口：任何生成调用都抛出带「去哪儿配」指引的 {@link ConfigError}。
 *
 * 刻意**不实现** `ModelPort.stream`：内核在 `stream` 缺省时会退回 `generate`，两条路径最终
 * 都落到同一个错误方法，不必维护两份文案（也避免多 import 一个未进 `contracts.ts` 的类型）。
 */
export class UnconfiguredModel implements ModelPort {
  /** 端口名（内核日志/UI 里可识别的占位标识）。 */
  public readonly name: string;
  /** 适配器标识。 */
  private readonly adapter: string;
  /** 目标模型名。 */
  private readonly model: string;
  /** Key 的环境变量名。 */
  private readonly apiKeyEnv: string | undefined;

  /**
   * @param options 适配器 / 模型 / 环境变量名（用于错误文案）。
   */
  public constructor(options: UnconfiguredModelOptions) {
    this.adapter = options.adapter;
    this.model = options.model;
    this.apiKeyEnv = options.apiKeyEnv;
    this.name = `${options.adapter}:unconfigured`;
  }

  /**
   * 非流式生成：必定失败（本端口存在的意义就是把失败推迟到真正要花钱的那一刻）。
   * @param _request 模型请求（未使用：没有凭据，不发起任何网络调用）。
   * @returns 永不 resolve。
   * @throws ConfigError 恒抛出，文案指向设置页。
   */
  public async generate(_request: ModelRequest): Promise<ModelOutput> {
    throw this.missingCredentialError();
  }

  /**
   * 构造「缺凭据」的人话错误。
   * @returns 带下一步动作的配置错误。
   */
  private missingCredentialError(): ConfigError {
    const envHint =
      this.apiKeyEnv === undefined
        ? ''
        : `（也可设置环境变量 ${this.apiKeyEnv} 后重启）`;
    return new ConfigError(
      `尚未配置 ${this.adapter} 厂商的 API Key，模型 ${this.model} 暂不可用${envHint}。` +
        '应用已正常启动：请打开「设置 → 模型接入」填写 API Key 并保存，再重新发送即可（无需重启应用）。',
    );
  }
}
