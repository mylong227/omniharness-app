import type { RoutineModelAdapter } from './routineModelAdapter.ts';
import type { RoutineSchedule } from './routineSchedule.ts';

/**
 * @beta
 */
export interface Routine {
  /** 任务名（add/remove/markRun 的匹配键）。 */
  readonly name: string;
  /** 执行提示词。 */
  readonly prompt: string;
  /** 定时任务使用的模型适配器。 */
  readonly modelAdapter: RoutineModelAdapter;
  /** 调度策略（interval / cron）。 */
  readonly schedule: RoutineSchedule;
  /** 上次执行时间戳（ms）；未执行过为 undefined。 */
  readonly lastRun?: number | undefined;
  /**
   * 稳定 id（M30 双定时器统一）：server 自动化的对外标识（`auto_uuid`）——web RPC 面
   * 按 id 增删启停；CLI routine 可省略（name 即键）。缺省 undefined。
   */
  readonly id?: string | undefined;
  /** 是否启用（缺省 true）；false 时 runDue 跳过（不到期）。 */
  readonly enabled?: boolean | undefined;
  /**
   * 驱动方归属（缺省 `'daemon'`）：CLI daemon 与 app-server 共享同一份 routines.json，
   * 各自只消费自己 scope 的任务——server 自动化（createThread）不会被 daemon 当作
   * CLI agent run 误执行，反之亦然。既有 routines.json 条目无该字段 = daemon（行为不变）。
   */
  readonly scope?: 'daemon' | 'server' | undefined;
  /** 创建时间（ISO；server 自动化保留原始 createdAt 供 web 面展示）。 */
  readonly createdAt?: string | undefined;
}
