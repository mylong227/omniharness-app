import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { configFile, providerPresets } from '../../host/kernel/config.ts';
import type { FileConfig, ProviderPreset } from '../../host/kernel/config.ts';
import { OmniHome } from '../../host/kernel/util.ts';
import { CliArgReader } from './cliArgReader.ts';

/** init 子命令：一键初始化（选厂商 → 填 Key → 写用户级配置），3 处引导提示的唯一兑现。 */
export class InitCommand {
  /** @returns 进程退出码（0 成功 / 2 用法错误）。 */
  public async run(args: readonly string[]): Promise<number> {
    const reader = new CliArgReader(args);
    if (args.includes('--help') || args.includes('-h')) {
      process.stdout.write(InitCommand.USAGE);
      return 0;
    }
    const printOnly = args.includes('--print');
    const force = args.includes('--force');
    const providerArg = reader.value('--provider');
    const keyArg = reader.value('--api-key');
    const modelArg = reader.value('--model');
    const workspaceArg = reader.value('--workspace');
    const interactive = process.stdin.isTTY === true && providerArg === undefined;

    // ── 选厂商 ─────────────────────────────────────────────────────────────────
    const presets = providerPresets.builtin;
    let preset: ProviderPreset | undefined;
    if (providerArg !== undefined) {
      preset = presets.find((p) => p.id === providerArg);
      if (preset === undefined) {
        process.stderr.write(
          `未知厂商: ${providerArg}（可用: ${presets.map((p) => p.id).join(', ')}）\n`,
        );
        return 2;
      }
    } else if (interactive) {
      const picked = await this.pickProvider(presets);
      if (picked === undefined) return 2;
      preset = picked;
    } else {
      process.stdout.write(InitCommand.USAGE);
      process.stdout.write(`\n可用厂商: ${presets.map((p) => p.id).join(', ')}\n`);
      return 2;
    }

    // ── 凭据 ──────────────────────────────────────────────────────────────────
    let apiKey = keyArg;
    if (apiKey === undefined && preset.needsKey) {
      if (!interactive) {
        process.stderr.write(`厂商 ${preset.id} 需要 --api-key（或 TTY 下交互输入）\n`);
        return 2;
      }
      apiKey = (await this.ask(`请输入 ${preset.label} 的 API Key: `)).trim();
      if (apiKey === '') {
        process.stderr.write('未输入 Key，已放弃（配置未改动）\n');
        return 2;
      }
    }

    // ── 合并进用户级配置（只填空缺；--force 才覆盖） ────────────────────────────
    const userConfigPath = join(OmniHome.dir(), configFile.FILE_NAME);
    const existing: FileConfig = existsSync(userConfigPath) ? configFile.load(userConfigPath) : {};
    const providerKeys = { ...(existing.providerKeys ?? {}) };
    if (apiKey !== undefined) providerKeys[preset.id] = apiKey;
    const next: FileConfig = {
      ...existing,
      modelAdapter: force || existing.modelAdapter === undefined ? preset.adapter : existing.modelAdapter,
      baseUrl: force || existing.baseUrl === undefined ? preset.baseUrl : existing.baseUrl,
      model:
        modelArg ??
        (force || existing.model === undefined ? preset.defaultModel : existing.model),
      providerKeys,
      ...(workspaceArg !== undefined ? { workspace: workspaceArg } : {}),
    };
    if (printOnly) {
      process.stdout.write(`将写入 ${userConfigPath}：\n${JSON.stringify(redact(next), null, 2)}\n`);
      return 0;
    }
    // configFile.save：归一化严格校验 + 自动建目录 + pretty JSON（与 config.update 同一条落盘路径）。
    configFile.save(userConfigPath, next);
    process.stdout.write(`✔ 已写入 ${userConfigPath}\n`);
    process.stdout.write(`  厂商 ${preset.label}（${preset.id}）· 模型 ${String(next.model)}\n`);
    if (apiKey !== undefined) {
      process.stdout.write(
        `  Key 已存入 providerKeys.${preset.id}（落盘自动经系统级加密；本机文件勿提交仓库）\n`,
      );
    }
    process.stdout.write('\n下一步：\n  omniharness serve        起工作台\n  omniharness "任务描述"    跑一次任务\n');
    return 0;
  }

  /** TTY 交互选厂商（编号列表 + 数字/ID 输入）。 */
  private async pickProvider(presets: readonly ProviderPreset[]): Promise<ProviderPreset | undefined> {
    process.stdout.write('选择模型厂商（输入编号或 ID，回车=1）：\n');
    presets.forEach((p, i) => {
      process.stdout.write(`  ${String(i + 1).padStart(2)}. ${p.id.padEnd(12)} ${p.label}\n`);
    });
    const answer = (await this.ask('> ')).trim().toLowerCase();
    if (answer === '') return presets[0];
    const byIndex = Number(answer);
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= presets.length) {
      return presets[byIndex - 1];
    }
    return presets.find((p) => p.id === answer);
  }

  /** readline 单行提问。 */
  private ask(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  /** 用法文本。 */
  private static readonly USAGE = `用法: omniharness init [选项]

一键初始化：选厂商 → 填 Key → 写入用户级 ~/.omniharness/omniharness.json（合并，不覆盖其它字段）。
TTY 下不带参数运行即交互式；脚本/CI 用旗标直达。

选项:
  --provider <id>   模型厂商（deepseek / moonshot / zhipu / dashscope / openai / anthropic ...）
  --api-key <key>   API Key（needsKey 的厂商必填；存入 providerKeys，本机文件不回显）
  --model <name>    模型名（缺省用厂商默认模型）
  --workspace <p>   顺带写入默认工作区根
  --force           覆盖已有的 modelAdapter/baseUrl/model（缺省只填空缺）
  --print           只打印将写入的内容（Key 打码），不落盘
  -h, --help        本帮助
`;
}

/** 打码视图（--print 用）：Key 只露前 3 后 4。 */
function redact(cfg: FileConfig): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>;
  const keys = raw['providerKeys'];
  if (keys !== null && typeof keys === 'object') {
    for (const [id, value] of Object.entries(keys as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      (keys as Record<string, unknown>)[id] =
        value.length <= 8 ? '****' : `${value.slice(0, 3)}****${value.slice(-4)}`;
    }
  }
  if (typeof raw['apiKey'] === 'string') {
    const key = raw['apiKey'] as string;
    raw['apiKey'] = key.length <= 8 ? '****' : `${key.slice(0, 3)}****${key.slice(-4)}`;
  }
  return raw;
}

