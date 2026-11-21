// skills 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** skills 域的 RPC 面。 */
export class SkillsApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listSkills(): Promise<{ skills: import('../../types/models.ts').SkillListRow[] }> {
    return this.rpc('skills.list', {});
  }
  /** 单条完整技能（skills.get：含 instructions）。 */
  public getSkill(name: string): Promise<import('../../types/models.ts').SkillGetView> {
    return this.rpc('skills.get', { name });
  }
  /** 改写预览（skills.diff：结构差异测试 dry-run，fail-closed 不落盘）。 */
  public diffSkill(draft: { name: string; description: string; instructions: string; tags?: string[] }): Promise<import('../../types/models.ts').SkillEditReport> {
    return this.rpc('skills.diff', draft);
  }
  /** 应用改写（skills.apply：差异测试通过才落 config.skills 整段；生效 = 下一会话）。 */
  public applySkill(draft: { name: string; description: string; instructions: string; tags?: string[] }): Promise<import('../../types/models.ts').SkillEditReport> {
    return this.rpc('skills.apply', draft);
  }
  /** 删除技能（skills.delete：仅 config 内联可删）。 */
  public deleteSkill(name: string): Promise<import('../../types/models.ts').SkillEditReport> {
    return this.rpc('skills.delete', { name });
  }

  /**
   * 自动化任务列表。
   * @returns 任务列表
   */
}
