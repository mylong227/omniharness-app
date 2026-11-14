; OmniHarness 安装/卸载向导的外观定制（electron-builder `nsis.include` 钩子）。
;
; 边界：这里**只做表现层**——页面文案、品牌图、全新安装时去掉「为谁安装」页。
; 安装/升级/卸载的真实逻辑（解包、快捷方式、注册表、更新器回调）仍由 electron-builder
; 模板（installSection.nsh / uninstaller.nsh）承担，本文件不碰。
;
; 为什么用 include 而不是整份 `nsis.script`：整份脚本要自己重写解包与回滚，
; 升级 electron-builder 时必漂移；钩子宏是官方扩展点（见 app-builder-lib
; templates/nsis/assistedInstaller.nsh 的 custom* 调用）。
;
; 挂钩点与 MUI 依赖关系（实测 makensis 3.04）：
; - 本文件被拼在模板**之前**，所以宏体里的 MUI_PAGE_* 只能"用到时才展开"；
; - LangString 用数字语言 id（2052 简体 / 1033 英文），可在 MUI_LANGUAGE 之前定义；
; - 品牌 BMP/ICO 由 electron-builder 以 -D 传入（MUI_WELCOMEFINISHPAGE_BITMAP 等），
;   这里不要重复 !define，否则报「already defined」。

!include "LogicLib.nsh"

; ---------------------------------------------------------------------------
; 文案（2052 = 简体中文，1033 = 英文；installerLanguages 已裁到这两种）
; NSIS 会按系统 UI 语言自动选中，未命中时回落第一语言（en_US）。
; ---------------------------------------------------------------------------

; 欢迎页
LangString OMNI_WELCOME_TITLE 2052 "欢迎安装 OmniHarness"
LangString OMNI_WELCOME_TITLE 1033 "Welcome to OmniHarness"
LangString OMNI_WELCOME_TEXT 2052 "OmniHarness 是本地优先的 AI 编程工作台：会话、工具调用与审计都由这台电脑承担。$\r$\n$\r$\n安装只写入当前用户目录，无需管理员权限；桌面与开始菜单快捷方式会自动创建。$\r$\n$\r$\n点击「下一步」继续。"
LangString OMNI_WELCOME_TEXT 1033 "OmniHarness is a local-first AI workbench: sessions, tool calls and audit trails all run on this machine.$\r$\n$\r$\nThe app installs into your user folder, so no administrator rights are needed. Desktop and Start-menu shortcuts are created automatically.$\r$\n$\r$\nClick Next to continue."

; 完成页
LangString OMNI_FINISH_TITLE 2052 "OmniHarness 已安装完成"
LangString OMNI_FINISH_TITLE 1033 "OmniHarness is ready"
LangString OMNI_FINISH_TEXT 2052 "桌面与开始菜单快捷方式已创建。首次启动会在本地准备运行时（约十几秒）。"
LangString OMNI_FINISH_TEXT 1033 "Desktop and Start-menu shortcuts are in place. The first launch prepares the local runtime in a few seconds."
LangString OMNI_FINISH_RUN 2052 "立即启动 OmniHarness"
LangString OMNI_FINISH_RUN 1033 "Launch OmniHarness now"
LangString OMNI_FINISH_OPEN 2052 "打开安装目录"
LangString OMNI_FINISH_OPEN 1033 "Open the install folder"

; 卸载欢迎页
LangString OMNI_UNWELCOME_TITLE 2052 "卸载 OmniHarness"
LangString OMNI_UNWELCOME_TITLE 1033 "Remove OmniHarness"
LangString OMNI_UNWELCOME_TEXT 2052 "本向导会移除程序文件与快捷方式，并取消开机启动。$\r$\n$\r$\n你的会话记录与设置保留在用户数据目录中，不会随卸载删除；需要彻底清理时再手动删除该目录。$\r$\n$\r$\n点击「卸载」继续。"
LangString OMNI_UNWELCOME_TEXT 1033 "This removes the program files, shortcuts and the launch-at-login entry.$\r$\n$\r$\nYour sessions and settings stay in the user data folder and are not deleted; remove that folder by hand if you want a clean slate.$\r$\n$\r$\nClick Uninstall to continue."

; ---------------------------------------------------------------------------
; 页面定制
; ---------------------------------------------------------------------------

; 安装向导欢迎页：左侧品牌图（installerSidebar.bmp）由 electron-builder 传入。
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TITLE "$(OMNI_WELCOME_TITLE)"
  !define MUI_WELCOMEPAGE_TEXT "$(OMNI_WELCOME_TEXT)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

; 「为谁安装」页：本产品是单用户桌面应用（数据在 %APPDATA%，没有服务/驱动），
; 所以默认直接按当前用户安装，把这一页从流程里去掉——少一页、也少一次 UAC。
; 例外：机器上已有「所有用户」安装时保留该页，让老用户能原地升级而不是装出第二份。
!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    ${If} $hasPerMachineInstallation != "1"
      StrCpy $isForceCurrentInstall "1"
    ${EndIf}
  !endif
!macroend

; 完成页：品牌侧栏 + 「立即启动 / 打开安装目录」两个勾选项。
; 注意 ${isUpdated} / $launchLink 来自 electron-builder 模板（升级时传 --updated）。
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function OpenInstallFolder
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR" "open" ""
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "$(OMNI_FINISH_TITLE)"
  !define MUI_FINISHPAGE_TEXT "$(OMNI_FINISH_TEXT)"
  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "$(OMNI_FINISH_RUN)"
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "$(OMNI_FINISH_OPEN)"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "OpenInstallFolder"
  !insertmacro MUI_PAGE_FINISH
!macroend

; 卸载向导欢迎页：与安装页共用品牌侧栏，但用 uninstallerSidebar.bmp 与卸载文案。
!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TITLE "$(OMNI_UNWELCOME_TITLE)"
  !define MUI_WELCOMEPAGE_TEXT "$(OMNI_UNWELCOME_TEXT)"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; ---------------------------------------------------------------------------
; 全局开关（必须在页面插入前生效）
; ---------------------------------------------------------------------------

; 装到一半点「取消」时先确认，避免误触把半装状态丢在磁盘上。
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING
