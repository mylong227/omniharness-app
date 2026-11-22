// 设置字段 · model/permission 域（W2 拆分）：模型与权限两栏共 6 行（行数小、同居一文件）。
import type { SettingsField } from './settingsTypes.ts';

/** model + permission 两栏的字段清单（顺序 = 栏内渲染顺序）。 */
export const SETTINGS_FIELDS_PRIMARY: readonly SettingsField[] = [
  {
    key: 'model',
    tab: 'model',
    label: '默认模型',
    kind: 'text',
    placeholder: '如 gpt-4o / deepseek-v4-flash',
    hint: '留空则用厂商默认模型',
  },
  {
    key: 'reasoning',
    tab: 'model',
    label: '默认推理强度',
    kind: 'select',
    options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    hint: '新会话的默认档位；输入区「模型与推理强度」弹窗可按会话覆盖（按模型自适应档位）',
  },
  {
    key: 'baseUrl',
    tab: 'model',
    label: '自定义 Base URL',
    kind: 'text',
    placeholder: 'OpenAI 兼容端点（留空＝清除覆盖）',
    hint: '留空即回落厂商默认端点',
    clearWhenEmpty: true,
  },
  // ---- permission 域 ----
  {
    key: 'approval',
    tab: 'permission',
    label: '审批模式',
    kind: 'select',
    // 内核 ENUM_VALUES.approval 共 6 值（2026-11-14 补全漂移：deny/guardian/plan 此前漏了）。
    options: ['auto', 'deny', 'rules', 'guardian', 'ask', 'plan'],
    hint: 'auto 全自动 / rules 按规则 / ask 每次询问 / plan 只读规划（写类一律拒绝）/ guardian 守护裁决 / deny 全拒',
  },
  {
    key: 'escalation',
    tab: 'permission',
    label: '升级审批',
    kind: 'select',
    options: ['deny', 'ask', 'auto'],
    hint: '越权请求（提权/写盘等）的处理方式',
  },
  {
    key: 'autoApprove',
    tab: 'permission',
    label: '自动审批（免人工确认）',
    kind: 'switch',
    hint: '开启后不再弹出审批确认；危险操作仍受沙箱与规则约束',
  },
];
