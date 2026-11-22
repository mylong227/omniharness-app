// automations 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** automations 域的 RPC 面。 */
export class AutomationsApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listAutomations(): Promise<
    {
      id: string;
      name: string;
      prompt: string;
      intervalMinutes: number;
      enabled: boolean;
      createdAt: string;
      lastRunAt?: string;
    }[]
  > {
    return this.rpc('automations.list', {});
  }

  /**
   * 新建自动化任务。
   * @param input 名称/提示词/间隔
   * @returns 新任务
   */
  public createAutomation(input: {
    name: string;
    prompt: string;
    intervalMinutes: number;
  }): Promise<unknown> {
    return this.rpc('automations.create', input);
  }

  /**
   * 删除自动化任务。
   * @param id 任务 id
   * @returns 是否删除
   */
  public deleteAutomation(id: string): Promise<boolean> {
    return this.rpc('automations.delete', { id });
  }

  /**
   * 启停自动化任务。
   * @param id 任务 id
   * @param enabled 是否启用
   * @returns 更新后的任务
   */
  public setAutomationEnabled(id: string, enabled: boolean): Promise<unknown> {
    return this.rpc('automations.setEnabled', { id, enabled });
  }

  /**
   * 立即运行一次自动化。
   * @param id 任务 id
   * @returns 新会话结果
   */
  public runAutomation(id: string): Promise<unknown> {
    return this.rpc('automations.run', { id });
  }
}
