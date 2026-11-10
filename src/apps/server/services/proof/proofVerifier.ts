import { AuditBundles } from '../../../../host/kernel/util.ts';
import type { AuditBundleVerdict } from '../../../../host/kernel/util.ts';

/** 导入包大小上限（2 MB；与导出上限一致）。 */
const BUNDLE_MAX_BYTES = 2 * 1024 * 1024;

/** 单会话摘要（供 UI 展示，不重新解释证书语义）。 */
export interface ProofVerifySession {
  readonly sessionId: string;
  readonly eventCount: number;
  readonly eventRoot: string;
}

/** 复核结果（`proof.verify` 成功返回体；`verdict.ok` 才是结构结论）。 */
export interface ProofVerifyView {
  readonly ok: true;
  readonly verdict: {
    readonly ok: boolean;
    readonly problems: readonly { readonly code: string; readonly detail: string }[];
    readonly signatureChecked: boolean;
    readonly commitmentChecked: boolean;
  };
  readonly summary: {
    readonly exportedAt: string;
    readonly sessions: readonly ProofVerifySession[];
    readonly eventCount: number;
  };
}

/** 复核失败（包无法解析 / 超过上限 / 复核器抛错）。 */
export interface ProofVerifyFailure {
  readonly ok: false;
  readonly code: 'bundle_invalid' | 'bundle_too_large';
  readonly message: string;
}

/** 复核结果联合。 */
export type ProofVerifyResult = ProofVerifyView | ProofVerifyFailure;

/**
 * 证据包离线复核器（`proof.verify` RPC 后端）。
 *
 * 只调用内核 `AuditBundles.verify`，不配置 trust store / anchor trust：
 * - 结构自洽通过时 `verdict.ok` 可为 true，但 `signatureChecked:false`——UI 不得显示“已验证”；
 * - 没有带外承诺时 `commitmentChecked:false`，`COMMITMENT_UNVERIFIED` 原样透传；
 * - 外部 JSON 先做大小与对象形状检查，复核器抛错收敛为 `bundle_invalid`，不打断面板。
 */
export class ProofVerifier {
  /**
   * 复核一份导入的 AuditBundle。
   * @param bundle 外部 JSON 解析后的值（未信任）。
   * @returns 复核视图或判别失败；不抛异常。
   */
  public verifyOf(bundle: unknown): ProofVerifyResult {
    const size = ProofVerifier.byteSizeOf(bundle);
    if (size === undefined) {
      return ProofVerifier.fail('bundle_invalid', '证据包不是可序列化的 JSON 对象。');
    }
    if (size > BUNDLE_MAX_BYTES) {
      return ProofVerifier.fail(
        'bundle_too_large',
        `证据包超过 ${String(Math.round(BUNDLE_MAX_BYTES / 1024))} KB（实测 ${String(size)} 字节）。`,
      );
    }
    if (!ProofVerifier.looksLikeBundle(bundle)) {
      return ProofVerifier.fail('bundle_invalid', '证据包缺少 version / sessions 结构。');
    }
    let verdict: AuditBundleVerdict;
    const inner = ProofVerifier.innerBundleOf(bundle);
    try {
      verdict = AuditBundles.verify(bundle as Parameters<typeof AuditBundles.verify>[0]);
    } catch (error) {
      return ProofVerifier.fail(
        'bundle_invalid',
        `证据包无法复核：${error instanceof Error ? error.message : String(error)}。`,
      );
    }
    const sessions = ProofVerifier.sessionsOf(inner);
    return {
      ok: true,
      verdict: {
        ok: verdict.ok,
        problems: verdict.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
        signatureChecked: verdict.signatureChecked === true,
        commitmentChecked: verdict.commitmentChecked === true,
      },
      summary: {
        exportedAt: ProofVerifier.exportedAtOf(inner),
        sessions,
        eventCount: sessions.reduce((sum, session) => sum + session.eventCount, 0),
      },
    };
  }

  /**
   * 估算 JSON 字节数；循环引用 / 不可序列化返回 undefined。
   * @param value 待测值。
   * @returns UTF-8 字节数或 undefined。
   */
  private static byteSizeOf(value: unknown): number | undefined {
    try {
      return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
    } catch {
      return undefined;
    }
  }

  /**
   * 最小形状守卫（复核器自身仍会做完整形状检查；这里先挡住明显非包对象）。
   * @param value 外部值。
   * @returns 是否像 AuditBundle。
   */
  private static looksLikeBundle(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const inner = ProofVerifier.innerBundleOf(value);
    if (typeof inner !== 'object' || inner === null) return false;
    const record = inner as { version?: unknown; sessions?: unknown };
    return record.version === 1 && Array.isArray(record.sessions);
  }

  /**
   * 取未签名包本体；已签名包是 `{ bundle, signature }`，复核仍交给内核。
   * @param value 外部值。
   * @returns 本体或原值。
   */
  private static innerBundleOf(value: unknown): unknown {
    if (typeof value !== 'object' || value === null) return value;
    const record = value as { bundle?: unknown };
    return typeof record.bundle === 'object' && record.bundle !== null ? record.bundle : value;
  }

  /**
   * 取导出时刻。
   * @param bundle 包本体。
   * @returns ISO 时间或空串。
   */
  private static exportedAtOf(bundle: unknown): string {
    if (typeof bundle !== 'object' || bundle === null) return '';
    const value = (bundle as { exportedAt?: unknown }).exportedAt;
    return typeof value === 'string' ? value : '';
  }

  /**
   * 提取包内会话摘要（只读；找不到的字段用空值，不重算证书）。
   * @param bundle 已通过形状检查的包。
   * @returns 会话摘要。
   */
  private static sessionsOf(bundle: unknown): readonly ProofVerifySession[] {
    if (typeof bundle !== 'object' || bundle === null) return [];
    const sessions = (bundle as { sessions?: unknown }).sessions;
    if (!Array.isArray(sessions)) return [];
    return sessions.flatMap((raw) => {
      if (typeof raw !== 'object' || raw === null) return [];
      const record = raw as { sessionId?: unknown; events?: unknown; certificate?: unknown };
      const certificate = record.certificate as { eventRoot?: unknown } | undefined;
      if (typeof record.sessionId !== 'string' || !Array.isArray(record.events)) return [];
      return [
        {
          sessionId: record.sessionId,
          eventCount: record.events.length,
          eventRoot: typeof certificate?.eventRoot === 'string' ? certificate.eventRoot : '',
        },
      ];
    });
  }

  /**
   * 构造失败结果。
   * @param code 错误码。
   * @param message 可读原因。
   * @returns 失败。
   */
  private static fail(code: ProofVerifyFailure['code'], message: string): ProofVerifyFailure {
    return { ok: false, code, message };
  }
}

/** 供测试/文档使用的大小上限。 */
export const PROOF_BUNDLE_MAX_BYTES = BUNDLE_MAX_BYTES;
