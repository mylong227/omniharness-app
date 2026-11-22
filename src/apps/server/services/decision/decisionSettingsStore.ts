import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { JsonObjectFile, OmniHome } from '../../../../host/kernel/util.ts';
import type { DecisionSettings } from './decisionTypes.ts';

/**
 * 决策审计设置的用户级存储（app 自有，不进内核 `omniharness.json`）。
 *
 * 为什么单独一份：内核 `FileConfig` 没有 `auditRecords` / `auditPrincipal`（它们只在
 * `OmniHarnessConfig` 声明），`config.update` 的白名单无法承载；而审计开关属于本机运行态，
 * 放用户级 `~/.omniharness/decision-ledger.json` 既不随项目上传，也不污染内核配置契约。
 */
export class DecisionSettingsStore {
  /** 设置文件绝对路径。 */
  private readonly file: string;

  /**
   * @param file 覆盖设置文件路径（测试注入；缺省 `OmniHome/decision-ledger.json`）。
   */
  public constructor(file?: string) {
    this.file = file ?? join(OmniHome.dir(), 'decision-ledger.json');
  }

  /**
   * 读取设置；缺失 / 损坏 / 类型不符一律回退「关闭、无主体」。
   * @returns 当前设置。
   */
  public load(): DecisionSettings {
    const raw = JsonObjectFile.readRecord(this.file);
    const enabled = raw['enabled'] === true;
    const principal = typeof raw['principal'] === 'string' ? raw['principal'].trim() : '';
    return { enabled, ...(principal !== '' ? { principal } : {}) };
  }

  /**
   * 原子写设置（先写同目录临时文件，再 rename；0600 尽力而为）。
   * @param settings 目标设置。
   * @returns 无返回值；写盘失败抛错，由 RPC 层原样报给用户。
   */
  public save(settings: DecisionSettings): void {
    const dir = dirname(this.file);
    mkdirSync(dir, { recursive: true });
    const temp = `${this.file}.${String(process.pid)}.tmp`;
    const body = {
      enabled: settings.enabled,
      ...(settings.principal !== undefined ? { principal: settings.principal } : {}),
    };
    writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, this.file);
    try {
      chmodSync(this.file, 0o600);
    } catch {
      /* Windows 不支持 POSIX mode；写成功即返回。 */
    }
  }
}
