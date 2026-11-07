import type { MemoryFact } from '../../../../../kernel/contracts.ts';

/** 单条共振命中：事实 + 共振度。 */
export interface ResonantHit {
  readonly fact: MemoryFact;
  readonly score: number;
}
