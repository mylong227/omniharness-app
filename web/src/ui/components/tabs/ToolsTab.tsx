// 工具面板：展示本次会话触发的工具调用清单（名称 + 状态点），点击定位到事件流中的对应卡片。
// 纯展示组件（函数组件范式）：列表数据由 props 注入，无内部状态、无副作用。
// 「状态 → 中文/语义色」的纯映射下沉为模块级函数（零 React 依赖，可单测）。
//
// 2026-11-11（W4 收尾）：行控件自写 div+onClick → antd `Button type="text"`（真按钮语义：
// Tab 可达、Enter/Space 触发），状态点 → antd `Badge`（语义色映射见 DOT_STATUS）。

import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import type { BadgeProps } from 'antd/es/badge';
import { emptyState } from '../../format.ts';
import { icon } from '../../models/Icon.ts';
import { toolVerb } from '../../textUtils.ts';
import type { ToolItem } from '../../shared.ts';
import { t } from '../../i18n/i18n.ts';

/** ToolsTab 组件的入参。 */
export interface ToolsTabProps {
  /** 本次会话已触发的工具调用清单。 */
  toolItems: ToolItem[];
  /** 点击某条工具调用时定位到事件流中对应卡片。 */
  onShowTool: (callId: string) => void;
}

/**
 * 工具状态中文映射：未知状态显示省略号（fail-closed 到中性展示）。
 * @param status 工具状态标识
 * @returns 中文状态文案
 */
function statusText(status: string): string {
  if (status === 'ok') return t('完成');
  if (status === 'err') return t('失败');
  return '…';
}

/** 工具状态 → antd Badge 语义色（与 layout.css 旧 `.tool-item.ok/.err` 点色一一对应）。 */
const DOT_STATUS: Record<string, BadgeProps['status']> = {
  ok: 'success',
  err: 'error',
};

/**
 * 工具状态点语义映射：已知状态走语义色，未知状态落到 warning（原 `--warn` 点色）。
 * @param status 工具状态标识
 * @returns Badge 的 status 取值
 */
function dotStatus(status: string): BadgeProps['status'] {
  return DOT_STATUS[status] ?? 'warning';
}

/**
 * 工具面板：渲染工具调用清单；列表为空时展示空状态指引。
 * @param props 组件入参
 * @returns 工具清单节点（空列表时为空状态节点）
 */
export function ToolsTab(props: ToolsTabProps): ReactElement {
  const { toolItems, onShowTool } = props;
  if (toolItems.length === 0) {
    return emptyState(
      icon('wrench', { size: 20 }),
      t('暂无工具调用'),
      t('模型执行读文件、运行命令、搜索等工具时，调用与结果会在此汇总。'),
    );
  }
  return (
    <div id="toolList">
      {toolItems.map((item) => (
        <Button
          key={item.callId}
          type="text"
          block
          className={'tool-item ' + item.status}
          onClick={() => onShowTool(item.callId)}
        >
          <Badge status={dotStatus(item.status)} />
          <span>{t(toolVerb(item.name))}</span>
          <span className="state">{statusText(item.status)}</span>
        </Button>
      ))}
    </div>
  );
}
