// 长期记忆管理：列出 / 检索 / 新增 / 编辑 / 删除事实记忆。reloadKey 变化（SSE memory.changed）时自动刷新。
//
// 函数组件范式：表单三个输入是非受控的（用 useRef 读写，与原实现一致）；
// 「挂载装载 + reloadKey 变化重载」合为一个依赖 reloadKey 的 effect（语义等价）；
// 星级渲染继续复用 ImportanceStars（零 React 依赖，可单测），行渲染下沉为模块级函数。

import * as React from 'react';
import { useApp } from '../../context.ts';
import { useSessionResource } from '../../hooks/useSessionResource.ts';
import { ImportanceStars } from '../../models/ImportanceStars.ts';
import { icon } from '../../models/Icon.ts';
import { emptyState } from '../../format.ts';
import type { MemoryFact, MemoryFactsResult, TemporalFactCard } from '../../../types/models.ts';
import { t } from '../../i18n/i18n.ts';
// 面板级 antd 一律子路径导入（不走 'antd' 桶文件，理由见 vite.config.ts「分块改造」注释）。
import Select from 'antd/es/select';
import Input from 'antd/es/input';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Button from 'antd/es/button';

/** MemoryTab 组件的入参。 */
export interface MemoryTabProps {
  /** 外部重载信号（SSE memory.changed 时自增，触发重新拉取）。 */
  reloadKey: number;
}

/** 行渲染所需的回调。 */
interface RowActions {
  /** 进入编辑态并回填表单。 */
  onEdit: (f: MemoryFact) => void;
  /** 删除该条记忆。 */
  onDelete: (id: string) => void;
}

/**
 * 已存记忆表（2026-10-29 W4：antd Table；表单区仍是非受控原生控件——编辑回填走 ref 直填，
 * antd Select 的受控语义与该模式相抵，保持原生待 §5.2 的表单专项）。
 * @param props 记忆数组与行动作。
 * @returns 表格节点。
 */
function MemoryTable(props: { facts: MemoryFact[] } & RowActions): ReactElement {
  const columns: ColumnsType<MemoryFact> = [
    { title: t('事实'), dataIndex: 'text', key: 'text' },
    {
      title: t('主题'),
      dataIndex: 'topic',
      key: 'topic',
      width: 120,
      render: (topic: string | undefined) =>
        topic ? <span className="badge">{topic}</span> : null,
    },
    {
      title: t('来源'),
      key: 'src',
      width: 80,
      render: (_, f) =>
        f.source === 'consolidated' ? (
          <span className="badge b-reasoning">{t('蒸馏')}</span>
        ) : (
          <span className="badge b-tool_call">{t('手动')}</span>
        ),
    },
    {
      title: t('重要度'),
      key: 'imp',
      width: 90,
      render: (_, f) => <span className="mem-imp">{ImportanceStars.render(f.importance || 0)}</span>,
    },
    {
      title: t('时间'),
      key: 'time',
      width: 100,
      render: (_, f) => <span className="mem-time">{(f.createdAt || '').slice(0, 10)}</span>,
    },
    {
      title: t('操作'),
      key: 'op',
      width: 130,
      render: (_, f) => (
        <>
          <Button size="small" onClick={() => props.onEdit(f)}>
            {t('编辑')}
          </Button>{' '}
          <Button size="small" onClick={() => props.onDelete(f.id)}>
            {t('删除')}
          </Button>
        </>
      ),
    },
  ];
  return (
    <Table<MemoryFact>
      className="memory-table"
      size="small"
      bordered={false}
      pagination={false}
      columns={columns}
      dataSource={[...props.facts]}
      rowKey="id"
      scroll={{ x: 'max-content' }}
    />
  );
}

/** 记忆表单的受控值（2026-11-11 迁 antd：不再往 DOM 写 value）。 */
interface MemoryFormValues {
  text: string;
  topic: string;
  imp: string;
}

/** 表单初值（重要度默认 3）。 */
const EMPTY_FORM: MemoryFormValues = { text: '', topic: '', imp: '3' };

/** useMemoryStore 的返回面（数据 + 数据操作）。 */
interface MemoryStore {
  facts: MemoryFact[];
  count: number;
  query: string;
  setQuery: (q: string) => void;
  load: () => Promise<void>;
  search: () => Promise<void>;
}

/**
 * 长期记忆数据源（2026-11-21 批次六 A1 收编 useSessionResource）：挂载与 reloadKey 变化时
 * 重载；检索词经 queryRef 在 load 闭包内消费（检索按钮 = refresh，空词回落全量）。
 * profile 数据不随回合推进变化——followTick:false（批次四已收窄，本迁移沿用）。
 * @param reloadKey 外部重载信号（SSE memory.changed 去抖后自增）
 * @returns facts 记忆列表；count 服务端计数；query/setQuery 检索词；load/refresh 重载
 */
function useMemoryStore(reloadKey: number): MemoryStore {
  const { api, toast } = useApp();
  const [query, setQuery] = React.useState<string>('');
  const queryRef = React.useRef('');
  queryRef.current = query;

  const load = React.useCallback(async (): Promise<{ count: number; facts: MemoryFact[] }> => {
    const q = queryRef.current.trim();
    try {
      if (q === '') {
        const r = await api.listMemory();
        // 服务端响应做形状归一（2026-10-19：桩/异常响应曾让 facts.map 抛错误边界）。
        return {
          count: typeof r.count === 'number' ? r.count : 0,
          facts: Array.isArray(r.facts) ? r.facts : [],
        };
      }
      const r = await api.searchMemory(q, 20);
      return {
        count: typeof r.count === 'number' ? r.count : 0,
        facts: Array.isArray(r.results) ? r.results : [],
      };
    } catch (e) {
      toast(t('加载失败：{msg}', { msg: (e as Error).message }), 'err');
      throw e;
    }
  }, [api, toast]);
  const { data, refresh } = useSessionResource({
    enabled: true,
    load,
    followTick: false,
    reloadTick: reloadKey,
  });

  return { facts: data?.facts ?? [], count: data?.count ?? 0, query, setQuery, load: refresh, search: refresh };
}

/**
 * 记忆时间图数据源（memory.facts，只读快照）：挂载与 reloadKey 变化时重拉。
 * 拉取失败如实降级为「无图」（时间图隐藏，不阻塞记忆面板其余功能）。
 * @param reloadKey 外部重载信号
 * @returns 快照；装载中为 null（不渲染）
 */
function useMemoryFacts(reloadKey: number): MemoryFactsResult | null {
  const { api } = useApp();
  const load = React.useCallback(async (): Promise<MemoryFactsResult> => {
    try {
      return await api.memoryFacts();
    } catch {
      // 拉取失败如实降级为「无图」：时间图隐藏，不阻塞记忆面板其余功能。
      return { supported: false, cards: [], total: 0, active: 0 };
    }
  }, [api]);
  const { data: snap } = useSessionResource({
    enabled: true,
    load,
    followTick: false,
    reloadTick: reloadKey,
  });
  return snap;
}

/**
 * 时间图事实卡行：三元组 + 生命状态（有效/已被取代/已过期）+ 起止日期。
 * @param props 卡与当前时刻
 * @returns 卡行节点
 */
function FactCardRow(props: { card: TemporalFactCard; now: number }): ReactElement {
  const { card, now } = props;
  const superseded = card.validTo !== undefined && card.validTo <= now;
  const expired = !superseded && card.expiresAt !== undefined && card.expiresAt <= now;
  const stale = superseded || expired;
  const status = superseded ? t('已被取代') : expired ? t('已过期') : t('有效');
  const fmt = (ms: number): string => new Date(ms).toLocaleString();
  return (
    <div className={'mt-card' + (stale ? ' mt-card--stale' : '')}>
      <div className="mt-card-line">
        <span className="mt-card-triple" title={card.text ?? undefined}>
          {card.subject} · {card.predicate} · {card.object}
        </span>
        <span className={stale ? 'mt-card-status mt-card-status--stale' : 'mt-card-status'}>
          {status}
        </span>
      </div>
      {card.text !== undefined && card.text !== card.object ? (
        <div className="mt-card-text">{card.text}</div>
      ) : null}
      <div className="mt-card-dates">
        {t('起 {d}', { d: fmt(card.validFrom) })}
        {card.validTo !== undefined ? (
          <span>
            {' · '}
            {t('止 {d}', { d: fmt(card.validTo) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 记忆时间图区（Memory Atlas v1，只读）：同主题+谓词的取代链按时间排布。
 * 有效卡在前、被取代卡在后（组内按 validFrom 降序），一眼看清「现在有效的是哪条」。
 * @param props 快照
 * @returns 区块节点；无图（supported=false）不渲染
 */
function MemoryAtlas(props: { snap: MemoryFactsResult }): ReactElement | null {
  const { snap } = props;
  if (!snap.supported) return null;
  const now = Date.now();
  const isActive = (card: TemporalFactCard): boolean =>
    (card.validTo === undefined || card.validTo > now) &&
    (card.expiresAt === undefined || card.expiresAt > now);
  const cards = [...snap.cards].sort(
    (a, b) => Number(isActive(b)) - Number(isActive(a)) || b.validFrom - a.validFrom,
  );
  return (
    <div className="pm-section" aria-label={t('记忆时间图')}>
      <div className="pm-title">
        {t('时间图')}
        <span className="mem-atlas-count">
          {t('{active}/{total} 有效', { active: snap.active, total: snap.total })}
        </span>
      </div>
      <p className="mem-atlas-hint">
        {t('同主题+谓词的新事实会取代旧事实（到点即失效）；此视图为只读时间线。')}
      </p>
      <div className="mem-atlas">
        {cards.map((card) => (
          <FactCardRow key={card.factId} card={card} now={now} />
        ))}
      </div>
    </div>
  );
}

/** useMemoryForm 的返回面（编辑态 + 表单操作）。 */
interface MemoryFormOps {
  editingId: string | null;
  startEdit: (f: MemoryFact) => void;
  reset: () => void;
  save: () => Promise<void>;
  del: (id: string) => Promise<void>;
}

/**
 * 记忆表单操作面：进入/退出编辑（ref 回填）、保存（按 editingId 决定新增或更新）、
 * 删除（先经 DialogService 确认，决策不静默产生）。
 * @param refs 表单三件套的 ref
 * @param reload 保存/删除成功后的数据重载（通常传 store.load）
 * @returns editingId 当前编辑的记忆 id（null=新增态）与四个操作
 */
function useMemoryForm(
  values: MemoryFormValues,
  setValues: React.Dispatch<React.SetStateAction<MemoryFormValues>>,
  reload: () => Promise<void>,
): MemoryFormOps {
  const { api, toast, dialog } = useApp();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  /**
   * 进入编辑态：把该条记忆回填到表单。
   * @param f 待编辑记忆
   */
  const startEdit = (f: MemoryFact): void => {
    setEditingId(f.id);
    setValues({ text: f.text, topic: f.topic || '', imp: String(f.importance || 3) });
  };

  /** 复位表单到新增态。 */
  const reset = (): void => {
    setEditingId(null);
    setValues(EMPTY_FORM);
  };

  /** 保存：按 editingId 决定新增或更新。 */
  const save = async (): Promise<void> => {
    const text = values.text.trim();
    if (!text) {
      toast(t('请填写事实'), 'err');
      return;
    }
    const topic = values.topic.trim() || undefined;
    const importance = parseInt(values.imp, 10) || 3;
    try {
      if (editingId) await api.updateMemory({ id: editingId, text, topic, importance });
      else await api.addMemory({ text, topic, importance });
      toast(editingId ? t('已更新记忆') : t('已保存记忆'), 'ok');
      reset();
      await reload();
    } catch (e) {
      toast(t('保存失败：{msg}', { msg: (e as Error).message }), 'err');
    }
  };

  /**
   * 删除（先经 DialogService 确认，决策不静默产生）。
   * @param id 记忆 id
   */
  const del = async (id: string): Promise<void> => {
    const ok = await dialog.confirm(t('确认删除这条记忆？'), {
      title: t('删除记忆'),
      confirmLabel: t('删除'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteMemory(id);
      toast(t('已删除'), 'ok');
      await reload();
    } catch (e) {
      toast(t('删除失败：{msg}', { msg: (e as Error).message }), 'err');
    }
  };

  return { editingId, startEdit, reset, save, del };
}

/**
 * 新增 / 编辑记忆表单（非受控三件套 + 动作按钮）。
 * @param props refs 表单三件套；editingId 编辑态；reset 取消编辑；save 保存
 * @returns 表单区块节点
 */
function MemoryForm(props: {
  values: MemoryFormValues;
  onChange: (patch: Partial<MemoryFormValues>) => void;
  editingId: string | null;
  reset: () => void;
  save: () => Promise<void>;
}): ReactElement {
  const { values, onChange, editingId, reset, save } = props;
  return (
    <div className="pm-section">
      <div className="pm-title">{t('新增 / 编辑记忆')}</div>
      <div className="form">
        <label>
          {t('事实')}
          <Input
            aria-label={t('事实')}
            placeholder={t('如：用户要求所有 TS 文件用 camelCase')}
            value={values.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
        <label>
          {t('主题')}
          <Input
            aria-label={t('主题')}
            placeholder={t('编码规范 / 项目约定 / 环境')}
            value={values.topic}
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </label>
        <label>
          {t('重要度')}
          <Select
            aria-label={t('重要度')}
            value={values.imp}
            onChange={(next: string) => onChange({ imp: next })}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5', label: '5' },
            ]}
          />
        </label>
        <div className="pane-actions">
          <span className="flex-spacer"></span>
          {editingId ? (
            <Button onClick={reset}>
              {t('取消编辑')}
            </Button>
          ) : null}
          <Button type="primary" onClick={() => void save()}>
            {editingId ? t('保存修改') : t('保存')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 长期记忆面板：检索、增删改事实记忆。
 * @param props 组件入参
 * @returns 记忆面板节点
 */
export function MemoryTab(props: MemoryTabProps): ReactElement {
  const { reloadKey } = props;
  const store = useMemoryStore(reloadKey);
  const atlas = useMemoryFacts(reloadKey);
  const [values, setValues] = React.useState<MemoryFormValues>(EMPTY_FORM);
  /** 合并式更新：三个字段各自改自己的，不互相覆盖。 */
  const patchValues = React.useCallback((patch: Partial<MemoryFormValues>): void => {
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);
  const form = useMemoryForm(values, setValues, store.load);

  return (
    <div>
      <div className="pm-head">
        <Input
          aria-label={t('检索长期记忆（自然语言）…')}
          placeholder={t('检索长期记忆（自然语言）…')}
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
        />
        <Button type="text" onClick={() => void store.search()}>
          {t('检索')}
        </Button>
        <Button type="text" onClick={() => void store.load()}>
          {t('刷新')}
        </Button>
      </div>
      <MemoryForm
        values={values}
        onChange={patchValues}
        editingId={form.editingId}
        reset={form.reset}
        save={form.save}
      />
      <div className="pm-section">
        <div className="pm-title">{t('已存记忆（{count}）', { count: store.count })}</div>
        {store.facts.length === 0 ? (
          emptyState(
            icon('brain', { size: 20 }),
            t('暂无记忆'),
            t('上方填入事实后点「保存」，或在会话中由模型自动沉淀。'),
          )
        ) : (
          <MemoryTable facts={store.facts} onEdit={form.startEdit} onDelete={(id) => void form.del(id)} />
        )}
      </div>
      {atlas === null ? null : <MemoryAtlas snap={atlas} />}
    </div>
  );
}
