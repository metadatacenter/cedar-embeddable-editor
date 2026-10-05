/**
 * The key of a counted message's form for `count`: the message's own key for any number but one,
 * and that key with `One` appended for one. Every counted message in CEE is chosen here, so "1 chars"
 * cannot come back at one site while the others say "1 char". Hungarian keeps a noun singular after
 * any number, so its two texts read alike; English needs both.
 */
export function countKey<K extends string>(key: K, count: number): K | `${K}One` {
  return count === 1 ? `${key}One` : key;
}
