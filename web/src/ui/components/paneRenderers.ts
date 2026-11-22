// 面板渲染器表（W3 单源化，2026-11-21）：`paneOf` 的 22 分支 switch 与 20 个 lazy 声明、
// 空闲预取表在此收口为**一张以 PaneKey 为键的渲染器表**。
//
// ## 单源闭环
//
//   PanelRegistry.PANELS（唯一事实源：key/标签/图标/说明）
//     ├─ Router 白名单：`new Set(PANELS.map(p => p.key))`（派生）
//     └─ 本文件 PANE_RENDERERS：`Record<PaneKey, Renderer>`——**编译期完整性**：
//        新增面板只改 PANELS + 本表两处，漏一处 tsc 直接红（旧 switch 会静默落到 default=tools）。
//
// ## 按需加载 + 空闲期预取（2026-10-18 起；2026-10-29 扩到全部面板）
//
// 第一版只做 `React.lazy`，实测首次点开会出现 200–300 ms 的「加载中…」——那比省下的
// 8.7 KB gzip 更伤体验，于是回退为「lazy + 空闲预取」两件事一起做：
//   ① lazy：入口不包含这些面板（首屏解析更小）；
//   ② 挂载后空闲期**异步预取**全部 chunk（不阻塞首屏）——用户真正点开时 chunk 已在缓存里，
//      打开零等待。预取失败也无妨：Suspense fallback 仍在，只是回到"首开等一下"。
// 2026-10-29（分块改造，看板 §179）把 Metrics/Changes/Plugins/Permission/Trace/Detail 与
// **ConsoleView 一并转 lazy**，这不只是为了入口瘦身：W4 面板迁移要给它们上 antd
// Table/Form/Descriptions——**静态面板会把面板级 antd 拖回首屏 entry**（vite.config 的
// 面板族 denylist 只对异步导入方生效）。控制台默认关闭（settingsOpen=false），与面板同级。
//
// 首屏真需要的两个面板保持静态（ToolsTab 在本表内静态 import；FileTab 在 App.ts——
// 它是右栏文件视，永远挂载为 RightPanel 的 children，不属于本表）。
import * as React from 'react';
import type { ReactElement } from 'react';
import type { PaneKey } from '../models/PanelRegistry.ts';
import type { AppController, AppState } from '../controllers/AppController.ts';

const ConsoleView = React.lazy(() =>
  import('./console/ConsoleView.tsx').then((m) => ({ default: m.ConsoleView })),
);
const ControlTab = React.lazy(() =>
  import('./tabs/ControlTab.tsx').then((m) => ({ default: m.ControlTab })),
);
const GraphTab = React.lazy(() =>
  import('./tabs/GraphTab.tsx').then((m) => ({ default: m.GraphTab })),
);
const ActivityTab = React.lazy(() =>
  import('./tabs/ActivityTab.tsx').then((m) => ({ default: m.ActivityTab })),
);
const SkillsTab = React.lazy(() =>
  import('./tabs/SkillsTab.tsx').then((m) => ({ default: m.SkillsTab })),
);
const AutomationsTab = React.lazy(() =>
  import('./tabs/AutomationsTab.tsx').then((m) => ({ default: m.AutomationsTab })),
);
const MemoryTab = React.lazy(() =>
  import('./tabs/MemoryTab.tsx').then((m) => ({ default: m.MemoryTab })),
);
const ProfilesTab = React.lazy(() =>
  import('./tabs/ProfilesTab.tsx').then((m) => ({ default: m.ProfilesTab })),
);
const RollbackTab = React.lazy(() =>
  import('./tabs/RollbackTab.tsx').then((m) => ({ default: m.RollbackTab })),
);
const GovernanceTab = React.lazy(() =>
  import('./tabs/GovernanceTab.tsx').then((m) => ({ default: m.GovernanceTab })),
);
const DiagnosticsTab = React.lazy(() =>
  import('./tabs/DiagnosticsTab.tsx').then((m) => ({ default: m.DiagnosticsTab })),
);
const AuditTab = React.lazy(() =>
  import('./tabs/AuditTab.tsx').then((m) => ({ default: m.AuditTab })),
);
const DecisionTab = React.lazy(() =>
  import('./tabs/DecisionTab.tsx').then((m) => ({ default: m.DecisionTab })),
);
const VaultTab = React.lazy(() =>
  import('./tabs/VaultTab.tsx').then((m) => ({ default: m.VaultTab })),
);
const MetricsTab = React.lazy(() =>
  import('./tabs/MetricsTab.tsx').then((m) => ({ default: m.MetricsTab })),
);
const ChangesTab = React.lazy(() =>
  import('./tabs/ChangesTab.tsx').then((m) => ({ default: m.ChangesTab })),
);
const PluginsTab = React.lazy(() =>
  import('./tabs/PluginsTab.tsx').then((m) => ({ default: m.PluginsTab })),
);
const PermissionTab = React.lazy(() =>
  import('./tabs/PermissionTab.tsx').then((m) => ({ default: m.PermissionTab })),
);
const TraceTab = React.lazy(() =>
  import('./tabs/TraceTab.tsx').then((m) => ({ default: m.TraceTab })),
);
const DetailTab = React.lazy(() =>
  import('./tabs/DetailTab.tsx').then((m) => ({ default: m.DetailTab })),
);
import { ToolsTab } from './tabs/ToolsTab.tsx';
import { FileTab } from './tabs/FileTab.tsx';

/** 控制台视图（App.ts 的设置/面板页以它承载；与面板同级，默认关闭）。 */
export { ConsoleView };

/** 默认面板（首屏 / 非法 pane 回落）。 */
const DEFAULT_PANE: PaneKey = 'tools';

/** 一个面板的渲染器：拿组合根与根状态，产出该面板元素（props 各面板不同，故是函数不是组件）。 */
type PaneRenderer = (ctrl: AppController, s: AppState) => ReactElement;

/**
 * 面板渲染器表（`Record<PaneKey, …>` = 编译期完整性：PANELS 里的每个 key 都必须有渲染器）。
 * 各分支语义注释随迁移原样保留。
 */
const PANE_RENDERERS: Readonly<Record<PaneKey, PaneRenderer>> = {
  control: (ctrl, s) =>
    // 控制室（2026-11-10）：编队/上下文/凭证三模式 tab；view 从路由读（深链可恢复 tab）。
    React.createElement(ControlTab, {
      threadId: s.currentThreadId,
      view: ctrl.route().view,
      onNavigate: (view: string) => ctrl.navigateRoute({ pane: 'control', view }),
    }),
  activity: (ctrl, s) =>
    React.createElement(ActivityTab, {
      events: s.events,
      toolResults: s.toolResults,
      busy: s.busy,
      activeTool: s.activeTool,
      approval: s.approval,
      question: s.question,
      onOpenPane: (key: string) => ctrl.setActivePane(key),
    }),
  skills: () => React.createElement(SkillsTab, null),
  automations: () => React.createElement(AutomationsTab, null),
  metrics: () => React.createElement(MetricsTab, null),
  changes: () => React.createElement(ChangesTab, null),
  governance: () =>
    // (F2 治理台) 晋升台账逐行独立复核 + 回滚锚点；不依赖会话（治理数据按工作区取）。
    React.createElement(GovernanceTab, null),
  diagnostics: () =>
    // Web 交付：daemon 运行态 + doctor 报告（两个只读入口合成一屏）。
    React.createElement(DiagnosticsTab, null),
  audit: () =>
    // Web 交付：审计事件（哈希链）+ 只读 trace 自省。
    React.createElement(AuditTab, null),
  decision: (_ctrl, s) =>
    // 决策账本（2026-11-11）：执行前决策 + 双链 + 共形证据；会话级只读。
    React.createElement(DecisionTab, { threadId: s.currentThreadId }),
  trace: (_ctrl, s) => React.createElement(TraceTab, { sessionId: s.currentThreadId }),
  permission: () =>
    // Web 交付：参数级权限规则编辑器（写盘走 config.update，服务端严格校验）。
    React.createElement(PermissionTab, null),
  vault: () =>
    // Web 交付：凭据保险库（只列名字、写入即清空、服务端不提供回读）。
    React.createElement(VaultTab, null),
  rollback: (ctrl, s) =>
    React.createElement(RollbackTab, {
      sessionId: s.currentThreadId,
      onRolledBack: ctrl.sessions.loadThread,
    }),
  // 'settings' 已**不在此处**（2026-10-17）：设置从右栏面板改成独立页面；
  // 2026-10-26 起它与功能面板合并为 components/console/ConsoleView.tsx。
  // 若这里还出现 settings 键，说明有人把设置又塞回了面板列表——那会与控制台形成两个真相。
  plugins: () => React.createElement(PluginsTab, null),
  graph: (ctrl, s) =>
    React.createElement(GraphTab, {
      graphRuns: s.graphRuns,
      onRunStart: ctrl.graph.onRunStart,
      // 续跑实现只有一处（控制器），面板卡片与状态栏芯片共用。
      onResume: ctrl.graph.resumeRun,
    }),
  memory: (_ctrl, s) => React.createElement(MemoryTab, { reloadKey: s.memoryReloadKey }),
  profiles: (_ctrl, s) => React.createElement(ProfilesTab, { reloadKey: s.profilesReloadKey }),
  file: (_ctrl, s) => React.createElement(FileTab, { fileView: s.fileView }),
  detail: (_ctrl, s) => React.createElement(DetailTab, { detailEvent: s.detailEvent }),
  tools: (ctrl) =>
    React.createElement(ToolsTab, {
      toolItems: ctrl.sessions.getToolItems(),
      onShowTool: ctrl.sessions.onShowTool,
    }),
};

/**
 * 解析当前面板元素：表内直查，未知 pane（类型上不可能，运行期仍 fail-closed）回落默认面板。
 */
export function paneOf(ctrl: AppController, s: AppState): ReactElement {
  const render = PANE_RENDERERS[s.activePane as PaneKey];
  return (render ?? PANE_RENDERERS[DEFAULT_PANE]!)(ctrl, s);
}

/** 空闲期预取上面 20 个按需块（面板 + 控制台，与 lazy 的 import 一一对应）。 */
export function prefetchLazyPanes(): void {
  const loaders: (() => Promise<unknown>)[] = [
    () => import('./console/ConsoleView.tsx'),
    () => import('./tabs/ControlTab.tsx'),
    () => import('./tabs/ActivityTab.tsx'),
    () => import('./tabs/SkillsTab.tsx'),
    () => import('./tabs/AutomationsTab.tsx'),
    () => import('./tabs/GraphTab.tsx'),
    () => import('./tabs/MemoryTab.tsx'),
    () => import('./tabs/ProfilesTab.tsx'),
    () => import('./tabs/RollbackTab.tsx'),
    () => import('./tabs/GovernanceTab.tsx'),
    () => import('./tabs/DiagnosticsTab.tsx'),
    () => import('./tabs/AuditTab.tsx'),
    () => import('./tabs/DecisionTab.tsx'),
    () => import('./tabs/VaultTab.tsx'),
    () => import('./tabs/MetricsTab.tsx'),
    () => import('./tabs/ChangesTab.tsx'),
    () => import('./tabs/PluginsTab.tsx'),
    () => import('./tabs/PermissionTab.tsx'),
    () => import('./tabs/TraceTab.tsx'),
    () => import('./tabs/DetailTab.tsx'),
  ];
  for (const load of loaders) {
    // 失败静默：真正打开时 Suspense 会再试一次，且 fallback 可读。
    void load().catch(() => undefined);
  }
}
