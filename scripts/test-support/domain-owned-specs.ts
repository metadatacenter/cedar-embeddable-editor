/**
 * Specs under `src/` that the domain harness runs in place of the unit suite.
 *
 * They need no framework, and the harness's coverage floors count the serializer,
 * carried-answer and coordinator code they reach. Both Vitest configs read this list:
 * the unit config excludes these paths, and the harness config includes them. A spec
 * therefore cannot leave the unit suite without joining the harness, which a hand-kept
 * import in a harness file could not promise.
 */
export const DOMAIN_OWNED_SPECS = [
  'src/app/modules/shared/util/host-input-history.fuzz.spec.ts',
  'src/app/modules/shared/util/occurrence-history.fuzz.spec.ts',
  'src/app/modules/shared/util/carried-answers.spec.ts',
  'src/app/modules/shared/util/carried-answers.fuzz.spec.ts',
  'src/app/modules/shared/util/carried-answers.matrix.spec.ts',
];
