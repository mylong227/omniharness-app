import type { MemoryFact } from '@omniharness/kernel/contracts/ports/memory/longTermMemory.js';

/** 单条共振命中：事实 + 共振度。 */
export interface ResonantHit {
  readonly fact: MemoryFact;
  readonly score: number;
}
