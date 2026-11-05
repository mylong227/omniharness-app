import type { AppPluginPermission } from './permission.ts';
import { OmniError, ErrorCode } from '../../../kernel/platform.ts';

export class PermissionDeniedError extends OmniError {
  public constructor(
    public readonly pluginName: string,
    public readonly missing: readonly AppPluginPermission[],
  ) {
    super(
      ErrorCode.PERMISSION_DENIED,
      `插件 "${pluginName}" 权限未在白名单内，已拒绝: ${missing.join(', ')}`,
    );
  }
}
