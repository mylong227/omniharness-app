/**
 * server 自动化（M30 双定时器统一）：**唯一**自动化调度实现。
 *
 * ## 统一了什么
 *
 * 退役前的两套定时器——`AutomationStore` + `AutomationScheduler`（server/web，纯 interval）
 * 与 `RoutineScheduler`（CLI daemon，interval+cron+时区）——调度语义重叠、执行语义不同。
 * 本类把 server 自动化收敛到 `RoutineScheduler` 的调度核心（同一份 routines.json，
 * `scope: 'server'` 隔离驱动方），自身只保留两件产品事：
 *  1. **web RPC DTO 兼容**：`automations.*` 的形状（id/name/prompt/intervalMinutes/enabled/
 *    createdAt/lastRunAt）逐字不变——web 面零改动；
 *  2. **执行语义**：到期 → `createThread(prompt)`（与 `threads.create` 同一事实源）；
 *    先落 lastRun 再执行（崩溃不重复触发）、单条失败只记日志（2026-10-27 审计收口）、
 *    防重入。
 *
 * ## 一次性迁移
 *
 * 构造时发现旧 `automations.json` 即整表导入 routines.json（按 id 幂等；lastRunAt/createdAt
 * 映射为 lastRun，避免统一后首次启动全量立即触发），成功后旧文件改名 `.migrated` 留证。
 *
 * ## 模型适配器字段
 *
 * `Routine.modelAdapter` 对 server 自动化**不消费**（执行走 createThread 的当前活动厂商），
 * 恒填 `MODEL_ADAPTER_IDS[0]` 占位——字段是 Routine 契约的必填项，不是语义承诺。
 */
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MODEL_ADAPTER_IDS } from '../../../host/kernel/contracts.ts';
import type { ModelAdapterId } from '../../../host/kernel/contracts.ts';
import { RoutineScheduler } from '../../daemon/routineScheduler.ts';
import type { Routine } from '../../../host/extensions/contracts/ports/daemon/routine.ts';
import { log } from '../../../host/kernel/util.ts';

/** web RPC 面的自动化 DTO（与退役前 AutomationStore 的形状逐字一致）。 */
export interface Automation {
  /** 稳定 id。 */
  readonly id: string;
  /** 名称。 */
  readonly name: string;
  /** 触发时发送的提示词。 */
  readonly prompt: string;
  /** 间隔分钟（5–1440）。 */
  readonly intervalMinutes: number;
  /** 是否启用。 */
  enabled: boolean;
  /** 创建时间（ISO）。 */
  readonly createdAt: string;
  /** 上次触发时间（ISO；从未触发缺省）。 */
  lastRunAt?: string;
}

/** 旧 automations.json 的条目形状（迁移输入）。 */
interface LegacyAutomation {
  readonly id: string;
  readonly name: string;
  readonly prompt: string;
  readonly intervalMinutes: number;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly lastRunAt?: string;
}

/** server 自动化调度器：RoutineScheduler 之上的 web DTO 门面 + 执行语义。 */
export class ServerAutomations {
  /** 共享调度核心（routines.json；scope='server' 条目归本类驱动）。 */
  private readonly scheduler: RoutineScheduler;
  /** 旧存储文件路径（迁移输入；构造期一次性消费）。 */
  private readonly legacyFile: string | undefined;
  /** 时钟（测试注入）。 */
  private readonly now: () => number;
  /** 定时器句柄。 */
  private timer: ReturnType<typeof setInterval> | null = null;
  /** 是否正在跑一轮（防重入）。 */
  private running = false;

  /**
   * @param scheduler 共享调度核心（storePath 与 CLI daemon 同一份 routines.json）
   * @param legacyFile 旧 automations.json 路径（存在即惰性迁移；缺省跳过）
   * @param now 时钟（测试注入）
   */
  public constructor(
    scheduler: RoutineScheduler,
    legacyFile: string | undefined,
    now: () => number = Date.now,
  ) {
    this.scheduler = scheduler;
    this.legacyFile = legacyFile;
    this.now = now;
    this.migrateLegacyFile();
  }

  /**
   * 全部自动化任务（保持创建顺序；DTO 形状与退役前逐字一致）。
   * @returns 副本数组。
   */
  public list(): Automation[] {
    return this.serverRoutines().map((routine) => this.toDto(routine));
  }

  /**
   * 按 id 取任务。
   * @param id 任务 id。
   * @returns 任务或 undefined。
   */
  public get(id: string): Automation | undefined {
    const routine = this.routineOf(id);
    return routine === undefined ? undefined : this.toDto(routine);
  }

  /**
   * 创建任务（校验口径与退役前逐字一致）。
   * @param input 原始输入。
   * @returns 新任务。
   */
  public create(input: unknown): Automation {
    if (input === null || typeof input !== 'object') throw new Error('invalid automation');
    const raw = input as Record<string, unknown>;
    const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
    const prompt = typeof raw['prompt'] === 'string' ? raw['prompt'].trim() : '';
    const intervalMinutes = Number(raw['intervalMinutes']);
    if (name === '' || name.length > 80) throw new Error('自动化名称必须为 1–80 字符');
    if (prompt === '' || prompt.length > 8000) throw new Error('自动化提示词必须为 1–8000 字符');
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440) {
      throw new Error('自动化间隔必须为 5–1440 分钟');
    }
    const automation: Automation = {
      id: `auto_${randomUUID()}`,
      name,
      prompt,
      intervalMinutes,
      enabled: raw['enabled'] !== false,
      createdAt: new Date(this.now()).toISOString(),
    };
    this.scheduler.add(this.toRoutine(automation));
    return automation;
  }

  /**
   * 删除任务。
   * @param id 任务 id。
   * @returns 是否删除。
   */
  public delete(id: string): boolean {
    const routine = this.routineOf(id);
    if (routine === undefined) return false;
    return this.scheduler.remove(routine.name);
  }

  /**
   * 启停任务。
   * @param id 任务 id。
   * @param enabled 是否启用。
   * @returns 更新后的任务；不存在为 undefined。
   */
  public setEnabled(id: string, enabled: boolean): Automation | undefined {
    const routine = this.routineOf(id);
    if (routine === undefined) return undefined;
    // name 是匹配键：以「去掉再写回」实现字段更新（Routine 契约字段全 readonly）。
    this.scheduler.remove(routine.name);
    this.scheduler.add({ ...routine, enabled });
    return this.get(id);
  }

  /**
   * 标记已触发（lastRunAt DTO 口径）。
   * @param id 任务 id。
   * @returns 无返回值。
   */
  public markRun(id: string): void {
    const routine = this.routineOf(id);
    if (routine === undefined) return;
    this.scheduler.markRun(routine.name, this.now());
  }

  /**
   * 到期任务（启用 + 距上次触发 ≥ 间隔；语义与退役前 `AutomationStore.due` 逐字一致）。
   * @param nowMs 当前毫秒（测试注入）。
   * @returns 到期任务数组。
   */
  public due(nowMs: number = this.now()): Automation[] {
    return this.list().filter((item) => {
      if (!item.enabled) return false;
      const base = Date.parse(item.lastRunAt ?? item.createdAt);
      if (Number.isNaN(base)) return false;
      return nowMs - base >= item.intervalMinutes * 60_000;
    });
  }

  /**
   * 启动定时检查（unref，不阻止进程退出；语义与退役前 AutomationScheduler.start 一致）。
   * @param run 触发回调（server 传 createThread）。
   * @param tickMs 检查间隔（毫秒）。
   * @returns 无返回值。
   */
  public start(run: (automation: Automation) => Promise<void>, tickMs = 30_000): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => void this.tick(run), tickMs);
    this.timer.unref?.();
  }

  /** 停止调度。 @returns 无返回值。 */
  public stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * 立即检查一次到期任务；同一时刻只跑一轮，避免重叠。
   *
   * 执行语义与退役前 AutomationScheduler.tick 逐字一致：**先落 lastRun 再执行**
   * （崩溃不重复触发）、单条失败只记 warn 不打断其余任务。
   * @param run 触发回调。
   * @returns 无返回值。
   */
  public async tick(run: (automation: Automation) => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const automation of this.due()) {
        this.markRun(automation.id);
        try {
          await run(automation);
        } catch (error) {
          log.warn('automation.tick.failed', {
            id: automation.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** scope='server' 的全部 Routine（共享存储里只看自己的条目）。 */
  private serverRoutines(): Routine[] {
    return this.scheduler.list().filter((routine) => routine.scope === 'server');
  }

  /** web DTO → Routine（modelAdapter 为契约必填的占位字段，server 执行不消费）。 */
  private toRoutine(automation: Automation): Routine {
    return {
      id: automation.id,
      name: automation.name,
      prompt: automation.prompt,
      modelAdapter: MODEL_ADAPTER_IDS[0] as ModelAdapterId,
      schedule: { kind: 'interval', minutes: automation.intervalMinutes },
      enabled: automation.enabled,
      scope: 'server',
      createdAt: automation.createdAt,
      ...(automation.lastRunAt === undefined
        ? {}
        : { lastRun: Date.parse(automation.lastRunAt) }),
    };
  }

  /** 按 id 找 Routine。 */
  private routineOf(id: string): Routine | undefined {
    return this.serverRoutines().find((routine) => routine.id === id);
  }

  /** Routine → web DTO（lastRun ms → lastRunAt ISO）。 */
  private toDto(routine: Routine): Automation {
    if (routine.schedule.kind !== 'interval') {
      throw new Error(`自动化 ${routine.name} 调度形态非法（应为 interval）`);
    }
    return {
      id: routine.id as string,
      name: routine.name,
      prompt: routine.prompt,
      intervalMinutes: routine.schedule.minutes,
      enabled: routine.enabled !== false,
      createdAt: routine.createdAt as string,
      ...(routine.lastRun === undefined ? {} : { lastRunAt: new Date(routine.lastRun).toISOString() }),
    };
  }

  /**
   * 一次性迁移：旧 automations.json → routines.json（按 id 幂等；成功后旧文件改名留证）。
   * @returns 无返回值。
   */
  private migrateLegacyFile(): void {
    if (this.legacyFile === undefined || !existsSync(this.legacyFile)) return;
    let legacy: LegacyAutomation[] = [];
    try {
      const raw = JSON.parse(readFileSync(this.legacyFile, 'utf8').replace(/^\uFEFF/u, '')) as unknown;
      const items = (raw as { automations?: unknown }).automations;
      if (!Array.isArray(items)) {
        this.retireLegacyFile('非数组形状');
        return;
      }
      legacy = items.filter((item): item is LegacyAutomation => {
        if (item === null || typeof item !== 'object') return false;
        const r = item as Record<string, unknown>;
        return (
          typeof r['id'] === 'string' &&
          typeof r['name'] === 'string' &&
          typeof r['prompt'] === 'string' &&
          typeof r['intervalMinutes'] === 'number' &&
          typeof r['enabled'] === 'boolean' &&
          typeof r['createdAt'] === 'string'
        );
      });
    } catch {
      this.retireLegacyFile('解析失败');
      return;
    }
    const known = new Set(
      this.serverRoutines()
        .map((routine) => routine.id)
        .filter((id): id is string => id !== undefined),
    );
    for (const item of legacy) {
      if (known.has(item.id)) continue;
      const base = Date.parse(item.lastRunAt ?? item.createdAt);
      this.scheduler.add({
        id: item.id,
        name: item.name,
        prompt: item.prompt,
        modelAdapter: MODEL_ADAPTER_IDS[0] as ModelAdapterId,
        schedule: { kind: 'interval', minutes: item.intervalMinutes },
        enabled: item.enabled,
        scope: 'server',
        createdAt: item.createdAt,
        ...(Number.isNaN(base) ? {} : { lastRun: base }),
      });
    }
    this.retireLegacyFile(`已迁移 ${String(legacy.length)} 条`);
  }

  /** 旧文件退役留证：改名 `.migrated`（改名失败不阻断，下次按 id 幂等重扫）。 */
  private retireLegacyFile(reason: string): void {
    if (this.legacyFile === undefined || !existsSync(this.legacyFile)) return;
    try {
      renameSync(this.legacyFile, `${this.legacyFile}.migrated`);
    } catch (error) {
      log.warn('automation.legacy.rename_failed', {
        file: this.legacyFile,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    log.warn('automation.legacy.migrated', { reason });
  }
}
