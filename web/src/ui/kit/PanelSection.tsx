// PanelSection：面板内统一的「标题 + 说明 + 内容」卡（kit 骨架，W1）。
// Card 的 headerBg/投影已由 antdTheme 的组件 token 钉成纸与墨口径，这里不再写样式。

import * as React from 'react';
// 子路径导入（不走 barrel，理由见 vite.config.ts「分块改造」注释）。
import Card from 'antd/es/card';
import Typography from 'antd/es/typography';

/** PanelSection 入参。 */
export interface PanelSectionProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** 卡片头部右侧的动作区。 */
  extra?: React.ReactNode;
  testId?: string;
}

/**
 * 面板分区卡：控制台/设置页的内容组织单元。
 *
 * 语义（2026-11-12 补回）：antd Card 的头部标题是纯 div，会丢掉迁移前
 * `<section aria-label>` + `<h3>` 的地标/标题结构；这里用 role="region" + aria-label
 * 命名卡根，标题以真 `<h3>` 渲染（字号/行高继承卡头，视觉不变）。
 * @param props PanelSectionProps
 * @returns 卡片节点
 */
export function PanelSection(props: PanelSectionProps): React.ReactElement {
  return (
    <Card
      size="small"
      title={
        <Typography.Title
          level={3}
          style={{ margin: 0, fontSize: 'inherit', lineHeight: 'inherit' }}
        >
          {props.title}
        </Typography.Title>
      }
      extra={props.extra}
      role="region"
      aria-label={props.title}
      data-testid={props.testId}
      className="kit-panel-section"
    >
      {props.description !== undefined && props.description !== '' && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {props.description}
        </Typography.Paragraph>
      )}
      {props.children}
    </Card>
  );
}
