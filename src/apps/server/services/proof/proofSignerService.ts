import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  AuditBundles,
  ExecutionCertificates,
  JoseReceiptSigner,
  OmniHome,
} from '../../../../host/kernel/util.ts';
import type {
  AuditBundle,
  ExecutionCertificate,
  ReceiptSigner,
  SignedAuditBundle,
  SignedExecutionCertificate,
  TrustStore,
} from '../../../../host/kernel/util.ts';

/** 本机签名器端口（ProofService 只依赖这个窄接口）。 */
export interface ProofSignerPort {
  /** 密钥标识。 */
  readonly kid: string;
  /** 算法标识。 */
  readonly alg: 'EdDSA';
  /** 本机信任根（kid → SPKI PEM）。 */
  readonly trustStore: TrustStore;
  /** 签名执行证书。 */
  signCertificate(certificate: ExecutionCertificate): Promise<SignedExecutionCertificate>;
  /** 签名整包。 */
  signBundle(bundle: AuditBundle): Promise<SignedAuditBundle>;
}

/**
 * 本机回执签名器：Ed25519 私钥落在 `~/.omniharness/receipt-signing-key.pem`（首次生成 0600）。
 *
 * 诚实边界：
 * - 这是**本机自签**信任根，不是外部 CA；UI 必须写「已签名（本机信任根）」，不能写「可信/已验证」；
 * - 私钥文件权限在 Windows 上不受 POSIX mode 完全约束，仍应放在用户级 OmniHome 而非工作区；
 * - 导入他人的包时，未知 kid 会如实 `UNPROVEN_ORIGIN`，不会被本机信任根“洗白”。
 */
export class ProofSignerService implements ProofSignerPort {
  /** 密钥标识（SPKI 摘要前 16 hex）。 */
  public readonly kid: string;
  /** 算法。 */
  public readonly alg = 'EdDSA' as const;
  /** 本机信任根。 */
  public readonly trustStore: TrustStore;
  /** 私钥。 */
  private readonly privateKey: KeyObject;
  /** 延迟构造的 signer 实例。 */
  private signerPromise?: Promise<ReceiptSigner>;

  /**
   * 打开/生成本机签名密钥。
   * @throws Error 密钥文件损坏且无法解析时抛出（组合根应降级为未签名）。
   */
  public constructor() {
    const home = OmniHome.dir();
    const path = join(home, 'receipt-signing-key.pem');
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      const pair = generateKeyPairSync('ed25519');
      writeFileSync(path, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), {
        mode: 0o600,
      });
    }
    this.privateKey = createPrivateKey(readFileSync(path, 'utf8'));
    const spki = createPublicKey(this.privateKey).export({ type: 'spki', format: 'pem' }).toString();
    this.kid = createHash('sha256').update(spki).digest('hex').slice(0, 16);
    this.trustStore = { [this.kid]: spki };
  }

  /** @inheritdoc */
  public async signCertificate(certificate: ExecutionCertificate): Promise<SignedExecutionCertificate> {
    return ExecutionCertificates.sign(certificate, await this.signer());
  }

  /** @inheritdoc */
  public async signBundle(bundle: AuditBundle): Promise<SignedAuditBundle> {
    return AuditBundles.sign(bundle, await this.signer());
  }

  /**
   * 懒构造内核 signer（`JoseReceiptSigner.create` 是异步的）。
   * @returns 签名器
   */
  private signer(): Promise<ReceiptSigner> {
    this.signerPromise ??= JoseReceiptSigner.create({
      kid: this.kid,
      privateKey: this.privateKey,
    });
    return this.signerPromise;
  }
}
