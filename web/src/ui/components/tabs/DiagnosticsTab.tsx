/**
 * 诊断面板（Web 交付项，2026-10-11；2026-11-15 增内核健康桥）：把 **daemon 运行态**、
 * **内核健康（哨兵桥）**与**环境诊断报告**放在同一屏。
 *
 * ## 为什么三件事一屏
 *
 * 它们都是"本机现在到底怎么样"的**只读**视图，且都在同一刻被排查者需要（daemon 起着但 doctor 报
 * 沙箱未强制，就是典型组合）。合成一屏也避免把只读状态拆成几个几乎同形的入口。
 *
 * ## 四条 UI 纪律（都对应"别把没有读成正常"）
 *
 * 1. **未接线就直说**：`doctor.report` 返回 `ok:false`（serve 组合根未注入实现）时显示**未接线 + 原因**，
 *    **绝不**渲染成"体检通过"——空报告冒充健康是本仓反复记录的"看着绿"形态；
 * 2. **不合格项逐条列出**：`issues` 不得折叠成"有问题"，也不得只显示条数；
 * 3. **安全边界照实说**：`isolationLevel` 与 `kernelEnforced` 是**能力自述**（L2 ＝ 无内核强制），
 *    面板必须原样呈现，不许用"已启用沙箱"这种更乐观的措辞；
 * 4. **健康分区 absent ≠ 正常**：内核健康桥的 `absent` 表示"本进程未装配该分区"，必须显示
 *    「未配置」+ 原因，不得显示成「正常」（把"没探测"读成"探测过"是本仓反复记录的形态）。
 *
 * @returns 诊断面板节点
 */
// 标准 React 项目写法：`import * as React from 'react'`（Vite 负责解析裸标识符）。
import * as React from 'react';
import { useApp } from '../../context.ts';
import { useSessionResource } from '../../hooks/useSessionResource.ts';
import { icon } from '../../kit/Icon.tsx';
import type { ReactElement } from 'react';
import type {
  DoctorReportLike,
  KernelHealthSectionLike,
  KernelHealthSnapshotLike,
} from '../../../types/models.ts';
import { t } from '../../i18n/i18n.ts';
// 面板级 antd 一律子路径导入（不走 'antd' 桶文件，理由见 vite.config.ts「分块改造」注释）。
import Button from 'antd/es/button';
import Descriptions from 'antd/es/descriptions';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';

/** `daemon.status` 的返回形状。 */
interface DaemonStatus {
  readonly running: boolean;
  readonly pid?: number;
}

/** `doctor.report` 的返回形状（判别联合：未接线与成功必须可区分）。 */
type DoctorResponse = { readonly ok: true; readonly report: DoctorReportLike } | {
  readonly ok: false;
  readonly reason: string;
};

/**
 * doctor 报告正文（环境 / 安全档 / 不合格项）。
 *
 * 2026-10-29（W4）：键值区 → antd `Descriptions`，不合格项 → antd `Table`（逐条列出，err 行）。
 * 三条纪律的**文本原样保留**（判据按文本断言）。
 * @param props 报告。
 * @returns 报告节点。
 */
function DoctorReport({ report }: { report: DoctorReportLike }): ReactElement {
  const issueRows = report.issues.map((issue, index) => ({
    key: `${String(index)}-${issue}`,
    no: index + 1,
    issue,
  }));
  const issueColumns: ColumnsType<{ key: string; no: number; issue: string }> = [
    { title: '#', dataIndex: 'no', key: 'no', width: 48 },
    { title: t('问题'), dataIndex: 'issue', key: 'issue' },
  ];
  return (
    <div>
      <Descriptions
        className="diagnostics-desc"
        size="small"
        column={1}
        colon={false}
        items={[
          {
            key: 'node',
            label: t('Node / 配置'),
            children: `${report.nodeVersion} · ${t('配置')} ${
              report.config.valid
                ? t('合法')
                : t('非法（{reason}）', { reason: report.config.error ?? t('未知原因') })
            }`,
          },
          {
            key: 'security',
            label: t('安全档'),
            children: `${t('隔离档 {level}', { level: report.security.isolationLevel })}${
              report.security.kernelEnforced ? t('（内核强制）') : t('（**无内核强制**）')
            } · ${t('沙箱档')} ${report.security.sandboxProfile}`,
          },
          {
            key: 'basis',
            label: t('判定依据'),
            children: <span className="hint">{report.security.isolationBasis}</span>,
          },
          {
            key: 'guards',
            label: t('守卫'),
            children: (
              <span className="hint">
                {t('shell 出网受守卫约束：')}
                {report.security.shellEgressGuarded ? t('是') : t('否')} · {t('插件目录可读：')}
                {report.pluginsDirReadable ? t('是') : t('否')} · {t('权限清单可读：')}
                {report.permissionsManifestReadable ? t('是') : t('否')}
              </span>
            ),
          },
        ]}
      />
      {report.issues.length === 0 ? (
        <p>{t('无不合格项。')}</p>
      ) : (
        <div>
          <div className="detail-h">{t('不合格项（{count}）', { count: report.issues.length })}</div>
          <Table
            className="diagnostics-issues"
            size="small"
            bordered={false}
            pagination={false}
            columns={issueColumns}
            dataSource={issueRows}
            rowKey="key"
            rowClassName={() => 'row err'}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * 健康分区状态的人读标签（与内核哨兵词表一一对应；`absent` 必须读作「未配置」而非「正常」）。
 * @param status 分区状态
 * @returns 标签
 */
function statusLabel(status: KernelHealthSectionLike['status']): string {
  if (status === 'degraded') return t('降级');
  if (status === 'absent') return t('未配置');
  return t('正常');
}

/**
 * 分区明细的一行可读文本：问题码优先，其次服务端给的 absent 原因，最后占位。
 * @param section 分区
 * @returns 明细文本
 */
function sectionSummary(section: KernelHealthSectionLike): string {
  if (section.problems.length > 0) return section.problems.map((problem) => problem.code).join(' · ');
  const reason = section.detail?.['reason'];
  return typeof reason === 'string' ? reason : '—';
}

/** 诊断面板：daemon 运行态 + 内核健康（哨兵桥） + 环境诊断报告。 */
export function DiagnosticsTab(): ReactElement {
  const { api } = useApp();
  // 三项只读状态一并取数（收编进 useSessionResource，2026-11-17）：seq 守卫 + 失败保留旧数据。
  // 体检是全局状态，不跟随 sessionTick 陪跑。
  const { data, error, loading, refresh } = useSessionResource<
    readonly [DaemonStatus, DoctorResponse, KernelHealthSnapshotLike]
  >({
    enabled: true,
    followTick: false,
    load: React.useCallback(async () => {
      return Promise.all([api.observability.daemonStatus(), api.observability.doctorReport(), api.observability.kernelHealth()] as const);
    }, [api]),
  });
  const daemon = data?.[0] ?? null;
  const doctor = data?.[1] ?? null;
  const health = data?.[2] ?? null;

  if (loading) return <div className="diagnostics-tab">{t('正在体检…')}</div>;
  if (data === null && error !== null) {
    return (
      <div className="diagnostics-tab">
        <p className="err">{t('读取诊断数据失败：{msg}', { msg: error })}</p>
        <Button onClick={refresh}>
          {t('重试')}
        </Button>
      </div>
    );
  }

  // 健康分区表：status 词表与内核一致（ok/degraded/absent），absent 不得渲染成"正常"。
  const healthRows = Array.isArray(health?.sections)
    ? health.sections.map((section) => ({
        key: section.name,
        name: section.name,
        status: statusLabel(section.status),
        summary: sectionSummary(section),
        degraded: section.status === 'degraded',
      }))
    : [];
  const healthColumns: ColumnsType<(typeof healthRows)[number]> = [
    { title: t('分区'), dataIndex: 'name', key: 'name', width: 120 },
    { title: t('状态'), dataIndex: 'status', key: 'status', width: 96 },
    { title: t('明细'), dataIndex: 'summary', key: 'summary' },
  ];

  return (
    <div className="diagnostics-tab">
      <div className="detail-section">
        <div className="detail-h">{t('后台服务（daemon）')}</div>
        {daemon === null || !daemon.running ? (
          // 未运行是**合法状态**，不是错误：如实说"未运行"，不显示成故障也不显示成正常。
          <p className="hint">{t('未运行（`omniharness daemon start` 可后台常驻）。')}</p>
        ) : (
          // `I18nParams` 的取值类型是 `string | number`，而 `daemon.pid` 是
          // `number | undefined`（类型上未运行时就可能缺失）⇒ 必须显式窄化（原为 TS2322）。
          // 用 `?? '—'` 而不是裸传：真走到这里时 daemon.running 为 true、pid 通常在，
          // 但给一个占位符总比渲染出字符串 "undefined" 好。
          <p>{t('运行中 · PID {pid}', { pid: daemon.pid ?? '—' })}</p>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-h">{t('内核健康（哨兵桥）')}</div>
        <p className="hint">
          {t(
            '应用侧聚合：只报告本进程可观测的分区；未装配的分区显示「未配置」，不是故障。',
          )}
        </p>
        {health === null || !Array.isArray(health.sections) ? (
          <p className="err">{t('未读到健康报告。')}</p>
        ) : (
          <>
            <p className="hint">{t('健康摘要：{summary}', { summary: health.summary })}</p>
            <Table
              className="kernel-health"
              size="small"
              bordered={false}
              pagination={false}
              columns={healthColumns}
              dataSource={healthRows}
              rowKey="key"
              rowClassName={(row) => (row.degraded ? 'row err' : '')}
              scroll={{ x: 'max-content' }}
            />
          </>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-h">{t('环境诊断（doctor）')}</div>
        {doctor !== null && !doctor.ok ? (
          // 纪律①：未接线必须直说——**不得**退化成"体检通过"。
          <p className="err">{t('未接线：{reason}', { reason: doctor.reason })}</p>
        ) : doctor !== null && doctor.ok ? (
          <DoctorReport report={doctor.report} />
        ) : (
          <p className="hint">{t('暂无诊断数据。')}</p>
        )}
        <Button onClick={() => void refresh()}>
          {t('重新体检')}
        </Button>
      </div>
      <div className="diagnostics-foot">
        {icon('ruler', { size: 14 })} {t('只读视图（不修改任何配置）')}
      </div>
    </div>
  );
}
