// 设置分栏声明（W2 目录化拆分，2026-11-21）：顺序即控制台左导航顺序。
// 语义与"哪些键存在"的判据见 web/test/settingsPane.test.ts（内核差集机检）。
import type { SettingsTabDef } from './settingsTypes.ts';

/**
 * 分栏清单：顺序即设置类页面的默认顺序。
 *
 * 2026-10-26 控制台重构后，设置不再是独立模态的六个分栏，而是「工作台控制台」里的
 * 基础设置组；配置集（profiles）移出设置，回到它自己的完整管理面板（避免"设置里只能
 * 应用、面板里才能增删"的两套入口）。
 */
export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  {
    key: 'general',
    label: '常规',
    hint: '界面语言、聊天模式、主题与两栏宽度、工作区与会话范围',
    icon: 'sliders',
  },
  {
    key: 'model',
    label: '模型与厂商',
    hint: '厂商接入、API Key、默认模型与自定义端点',
    icon: 'package',
  },
  {
    key: 'runtime',
    label: '运行时',
    hint: '适配器、沙箱、存储、步数与成本预算、模型熔断、上下文与检索、缓存与防火墙、长期记忆、专家能力',
    icon: 'command',
  },
  {
    key: 'permission',
    label: '权限',
    hint: '审批模式、升级策略与参数级规则',
    icon: 'shield',
  },
  { key: 'desktop', label: '桌面', hint: '托盘、开机启动、更新与诊断', icon: 'monitor' },
  { key: 'shortcuts', label: '键盘快捷键', hint: '全局快捷键与输入框按键', icon: 'keyboard' },
];
