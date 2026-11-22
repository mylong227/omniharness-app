// 路径字段的「选择…」控件（2026-11-14 用户口径：路径不要让用户手输粘贴，一律提供
// 项目内资源目录选择器的点击选择入口）。
//
// 形态：antd Input + 后缀「选择…」按钮。点击弹起统一资源选择面板：
//   · browse 'dir'  → FolderPicker（目录，可新建文件夹）；
//   · browse 'file' → FilePicker（文件，工作区整树 + 「文件系统…」全盘懒加载）。
// 面板确认后**直接落盘**（saveField）——从选择器回来的值等同用户确认过，不需要再过
// 一遍「草稿 + 失焦提交」；手输通道保留（高级用户粘贴路径仍然可用，两通道写同一落盘）。

import * as React from 'react';
import Input from 'antd/es/input';
import Button from 'antd/es/button';
import { useApp } from '../../context.ts';
import { FolderPicker } from '../FolderPicker.tsx';
import { FilePicker } from '../FilePicker.tsx';
import { t } from '../../i18n/i18n.ts';

/** PathBrowseControl 的入参。 */
export interface PathBrowseControlProps {
  /** 选择形态：目录 / 文件。 */
  browse: 'dir' | 'file';
  /** 当前值（受控；来自设置模型）。 */
  value: string;
  /** 占位提示。 */
  placeholder?: string;
  /** 无障碍名（行标签）。 */
  ariaLabel: string;
  /** 面板标题（FilePicker 语义化标题用；目录面板自带标题）。 */
  pickerTitle?: string;
  /** 确认：回传选中的绝对路径（调用方负责落盘）。 */
  onCommit: (path: string) => void;
  /** 草稿变更（手输通道）。 */
  onDraft: (value: string) => void;
  /** 提交（手输通道失焦/回车）。 */
  onCommitDraft: () => void;
}

/**
 * 路径输入 + 「选择…」按钮（统一资源选择器入口）。
 * @param props 组件入参
 * @returns 控件节点
 */
export function PathBrowseControl(props: PathBrowseControlProps): ReactElement {
  const { browse, value, placeholder, ariaLabel, pickerTitle, onCommit, onDraft, onCommitDraft } = props;
  const { api } = useApp();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onDraft(e.target.value)}
        onBlur={onCommitDraft}
        onPressEnter={onCommitDraft}
        suffix={
          <Button
            type="text"
            size="small"
            className="path-browse-btn"
            aria-label={t('{name} 选择…', { name: ariaLabel })}
            onClick={() => setOpen(true)}
          >
            {t('选择…')}
          </Button>
        }
      />
      {open && browse === 'dir' ? (
        <FolderPicker
          api={api}
          onCancel={() => setOpen(false)}
          onPick={(path) => {
            setOpen(false);
            onCommit(path);
          }}
        />
      ) : null}
      {open && browse === 'file' ? (
        <FilePicker
          api={api}
          {...(pickerTitle !== undefined ? { title: pickerTitle } : {})}
          onCancel={() => setOpen(false)}
          onPick={(paths) => {
            setOpen(false);
            if (paths[0] !== undefined) onCommit(paths[0]);
          }}
        />
      ) : null}
    </>
  );
}
