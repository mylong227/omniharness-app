# `defaults/` —— 内建默认数据

## 数据流真相（2026-11-08 收敛）

内核的 `builtinDefaults.locatePackageRoot` 从**内核模块目录**向上找最近的「package.json + defaults/」
目录——即 `node_modules/@omniharness/kernel/defaults/`（随 vendored tarball 发布的那份）。
因此**运行时真正被读的是内核包内那份**（不做 cwd 推断；文件缺失/不可读/非法 JSON 一律抛错，
fail-closed——安全默认档读不到时静默退化等于「护栏看着还在、实际更松」）。

本仓曾长期维护 ssrf / providers / endpoints / limits / injection-snapshot 五份「文档性拷贝」，
2026-11-08 盘点后**全部删除**：它们运行时根本不被读，且实测已与内核包逐字节漂移——
「可 diff 自检」的声明本身成了假绿。要改默认值：改**内核仓**的 defaults → `npm run kernel:vendor`
重建钉版。数据形状字典随内核包走（`node_modules/@omniharness/kernel/defaults/` 与内核仓文档）。

## 本目录的活数据（仅两件）

| 文件                    | 内容                                 | 消费方                                  |
| ----------------------- | ------------------------------------ | --------------------------------------- |
| `cliHelp.json`          | `omniharness --help` 的文案          | `src/apps/cli/cliHelp.ts`（读本目录）   |
| `skills/harness-core.json` | 随包技能包                        | `cliSkillFlags`（读本目录）             |

另外 `../examples/catalog/registry.json` 是离线插件市场 catalog（`createRegistry` 消费，
打包 stage 会带上）——它不在本目录，一并在此登记。

> 发布要求：`package.json#files` 必须含 `defaults`，否则安装后启动即报错（这是刻意的响亮
> 失败，不是静默放宽）——`cliHelp.json` 与 `skills/` 仍需随包。

## `cliHelp.json`

`omniharness --help` 的文案。原先它是 `argParser.printUsage()` 里的一段字符串数组，于是帮助成了 CLI 表面的
**第三份副本**（旗标名/枚举取值在 `cliFlagTable`、`cliEnums` 各一份），并且**已经漂移**：
帮助写 `--storage-adapter memory|jsonl`，而解析期白名单是 `memory|jsonl|sqlite`。

```json
{
  "title": "OmniHarness exec",
  "usageLine": "用法: omniharness exec --prompt \"任务\" [选项]",
  "commands": [{ "usage": "omniharness server [选项]", "description": "启动 JSON-RPC stdio 服务" }],
  "optionsTitle": "选项:",
  "options": [
    { "spec": "--storage-adapter {{storageAdapters}}", "description": "存储端口（默认 jsonl…）" }
  ]
}
```

- **占位符**：`{{名字}}` 会在渲染时替换成 `src/apps/cli/cliHelp.ts` 里 `HELP_ENUM_SOURCES` 声明的枚举清单
  （值全部来自 `cliEnums` ⇒ 帮助里的取值不可能与校验白名单不一致）。引用未登记的名字**直接抛错**，
  绝不把 `{{x}}` 渲染给用户。可用的名字见 `HELP_ENUM_SOURCES`（`storageAdapters` / `approvals` /
  `sandboxProfiles` / `outputFormats` …）。
- **排版**：描述列固定第 36 列；spec 过长则留 3 空格（渲染器统一保证，不需要手工对齐）。
- **改文案**：直接改本文件的 `description` 即可；**新增旗标**要在这里补一条
  （`tests/cliFlagsDiscipline.test.ts` 钉住「帮助不许诺幽灵命令」双向核对，漏了会红）。

## 改完怎么验

```bash
npm run typecheck && npm run web:test   # 三端类型 + 全部判据（本仓判据在 web/test 与 tests/）
npm run build && npm run smoke          # 端到端冒烟（真起 serve 验默认数据生效）
npm run kernel:check                    # 内核边界门禁（8 条）
```
