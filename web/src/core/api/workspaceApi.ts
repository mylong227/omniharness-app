// workspace 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  FsNode,
  FsReadResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** workspace 域的 RPC 面。 */
export class WorkspaceApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listWorkspaces(): Promise<{ current: string; workspaces: string[] }> {
    return this.rpc('workspace.list', {});
  }
  /**
   * daemon 运行态（只读，2026-10-11 Web 交付）：与 `omniharness daemon status` **同一事实源**
   * （服务端用同一个 `DaemonController`、同一默认 pid 文件 `~/.omniharness/daemon.pid`）。
   * @returns `{running, pid?}`；未运行时 `running:false` 且无 pid。
   */
  public addWorkspace(path: string): Promise<{ current: string; workspaces: string[] }> {
    return this.rpc('workspace.add', { path });
  }

  /** 服务端目录浏览（+ 添加项目的文件夹选择器 / 附件文件选择器数据源）。
   *  includeFiles=true 时同时返回当前目录下的文件清单（附件 FilePicker 复用）。 */
  public browseFs(
    path?: string,
    includeFiles?: boolean,
  ): Promise<
    | { level: 'drives'; roots: string[]; home: string }
    | {
        level: 'dir';
        path: string;
        parent?: string;
        dirs: string[];
        files?: { name: string; size: number; mediaType: string }[];
      }
  > {
    return this.rpc('fs.browse', { path, includeFiles });
  }
  /** 新建文件夹（+ 新建项目）：在 parent 目录下创建 name，返回新目录绝对路径。 */
  public mkdirFs(parent: string, name: string): Promise<{ path: string }> {
    return this.rpc('fs.mkdir', { parent, name });
  }
  /** 附件读取（FilePicker 选完文件后批量读 base64）：不限工作区，类型/大小白名单。
   *  单文件失败不阻断整体，结果按 files/errors 分开返回。 */
  public attachRead(paths: string[]): Promise<{
    files: {
      name: string;
      mediaType: string;
      data: string;
      size: number;
      kind: 'image' | 'video' | 'audio' | 'file';
    }[];
    errors: { path: string; error: string }[];
  }> {
    return this.rpc('attach.read', { paths });
  }
  /** 切换项目：服务端重建运行时组件，下回合即在新工作区执行。 */
  public switchWorkspace(path: string): Promise<{ ok: boolean; workspace: string }> {
    return this.rpc('workspace.switch', { path });
  }
  /**
   * 把一条会话**归入指定项目**（侧栏右键「归入当前项目」）：服务端只改存档首行
   * `session_meta.payload.workspace`（归一值），历史事件逐字不动。
   * @param sessionId 会话 id
   * @param workspace 目标项目路径（服务端会校验目录存在）
   * @returns `{ ok, workspace }`：生效后的归一工作区路径
   */
  public listFs(depth = 3): Promise<{ tree: FsNode[] }> {
    return this.rpc('fs.list', { depth });
  }
  public readFs(path: string): Promise<FsReadResult> {
    return this.rpc('fs.read', { path });
  }

  /**
   * 判断工作区文件当前是否存在（只读，不读取正文）。
   *
   * 回合结果卡用它过滤「本轮写过、随后又被删除」的临时产物（写回执不能证明文件还在）。
   * @param path 工作区相对路径
   * @returns 存在的普通文件为 true；越界/目录/不存在为 false
   */
  public async fileExists(path: string): Promise<boolean> {
    const r = await this.rpc<{ exists?: boolean }>('fs.exists', { path });
    return r.exists === true;
  }

  // ---- 插件 / 技能 ----
}
