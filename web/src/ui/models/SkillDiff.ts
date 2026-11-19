// 技能改写差异模型（2026-11-20，Skill Lab v1）：行级 LCS diff（纯函数，node 直测）。
// 服务端 skills.diff 只做结构差异测试（fail-closed 判据），行级差异由本模型在 UI 侧计算——
// 单一 diff 实现，避免服务端/前端两份 LCS 漂移。

/** 一行差异。 */
export interface SkillDiffLine {
  kind: 'same' | 'add' | 'del';
  text: string;
}

/**
 * 行级 LCS diff：原文/改文按行对齐，删除在前、新增在后（相邻成对）。
 * @param original 原文
 * @param patched 改文
 * @returns 差异行序列（same/add/del）
 */
export function diffLines(original: string, patched: string): readonly SkillDiffLine[] {
  const a = original === '' ? [] : original.split('\n');
  const b = patched === '' ? [] : patched.split('\n');
  // LCS 长度表（行数受技能正文预算约束，O(n*m) 可接受）。
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? (dp[i + 1][j + 1] ?? 0) + 1 : Math.max(dp[i + 1][j] ?? 0, dp[i][j + 1] ?? 0);
    }
  }
  const out: SkillDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] ?? '' });
      i++;
      j++;
      continue;
    }
    if ((dp[i + 1][j] ?? 0) >= (dp[i][j + 1] ?? 0)) {
      out.push({ kind: 'del', text: a[i] ?? '' });
      i++;
    } else {
      out.push({ kind: 'add', text: b[j] ?? '' });
      j++;
    }
  }
  while (i < a.length) {
    out.push({ kind: 'del', text: a[i] ?? '' });
    i++;
  }
  while (j < b.length) {
    out.push({ kind: 'add', text: b[j] ?? '' });
    j++;
  }
  return out;
}

/**
 * 差异统计（徽标用）：新增/删除行数。
 * @param lines diff 行序列
 * @returns {added, removed}
 */
export function diffStats(lines: readonly SkillDiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === 'add') added++;
    else if (line.kind === 'del') removed++;
  }
  return { added, removed };
}
