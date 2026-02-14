import type { ConnectionType } from '../types'

/** Weighted roll: open 50%, closed 25%, trap/hazard/secret 12.3% each (proportions normalized to 100%) */
export function randomConnectionType(): ConnectionType {
  const roll = Math.floor(Math.random() * 1000)
  if (roll < 447) return 'open'       // 50/111.9 → 44.7%
  if (roll < 670) return 'closed'     // 25/111.9 → 22.3%
  if (roll < 780) return 'trapped'   // 12.3/111.9 → 11.0%
  if (roll < 890) return 'hazardous'  // 12.3/111.9 → 11.0%
  return 'secret'                     // 12.3/111.9 → 11.0%
}
