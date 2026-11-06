import type { ServerModule } from '../core/serverModule.ts';

/**
 * 会话存档模块：`sessions.*`（列表/改名/删除/分叉/归档/排序）。
 * 归入项目（`sessions.setWorkspace`）在 surface 模块——它属于「工作台界面」域。
 */
export function sessionsModule(): ServerModule {
  return {
    name: 'sessions',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('sessions.list', async (params) => {
        const includeArchived = params['includeArchived'] !== false;
        // mock/演示会话默认不列出（本机 152 个里 144 个是 mock）；调试时显式传 includeMock:true。
        const includeMock = params['includeMock'] === true;
        // 工作区收敛（2026-10-06 第六十二轮真机 UI 跑测）：作用域解析收在 `SessionArchive.list` 里
        // （缺省 = 当前工作区；`'*'` = 全部），此处**只透传** params。
        const r = (await s.sessionArchive.list(
          includeArchived,
          params['workspace'],
          includeMock,
        )) as {
          dir: string;
          sessions: { sessionId: string; running?: boolean }[];
        };
        // 真实运行态：runTurn 进入/退出维护 activeTurns，前端不再靠 mtime 猜测。
        return {
          dir: r.dir,
          sessions: r.sessions.map((session) => ({
            ...session,
            running: s.activeTurns.has(session.sessionId),
          })),
        };
      });
      ctx.rpc('sessions.rename', async (params) =>
        s.sessionArchive.rename(String(params['sessionId'] ?? ''), String(params['title'] ?? '')),
      );
      ctx.rpc('sessions.delete', async (params) => {
        const id = String(params['sessionId'] ?? '');
        if (s.activeTurns.has(id)) return { ok: false, error: 'session_running' };
        return s.sessionArchive.delete(id);
      });
      ctx.rpc('sessions.fork', async (params) =>
        s.sessionArchive.fork(String(params['sessionId'] ?? '')),
      );
      // 归档 / 取消归档（只写侧车，不动事件流）：归档会话在 UI 里折叠到「已归档」组。
      ctx.rpc('sessions.archive', async (params) =>
        s.sessionArchive.setArchived(
          String(params['sessionId'] ?? ''),
          params['archived'] !== false,
        ),
      );
      // 置顶 / 取消置顶（2026-11-06 实用性打磨；只写侧车）：置顶会话浮到列表「置顶」组，
      // 侧车随存档目录走 ⇒ 跨设备共享同一份置顶（UI 偏好里唯一需要跟会话走的字段）。
      ctx.rpc('sessions.setPinned', async (params) =>
        s.sessionArchive.setPinned(
          String(params['sessionId'] ?? ''),
          params['pinned'] === true,
        ),
      );
      // 保存左栏拖拽排序（用户指定顺序；未登记的会话仍按 mtime 倒序排在其后）。
      ctx.rpc('sessions.reorder', async (params) => {
        const raw = params['ids'];
        const ids = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
        return s.sessionArchive.reorder(ids);
      });
    },
  };
}
