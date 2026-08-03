/**
 * Does what CEE emits actually validate as a CEDAR instance?
 *
 * A CEDAR template *is* a JSON Schema for its own instances — that is how
 * `cedar-model-validation-library` checks one, by validating the instance
 * document against the template document. So the definitive question about
 * CEE's output is not whether it looks right, or whether it round-trips, but
 * whether it passes that check. This runs it, over every corpus template, using
 * the same draft-04 schemas the Java validator uses.
 *
 * It is worth being blunt about why this arrived late. The suite already had
 * 1,488 tests, including two that compare CEE's JSON output against its YAML
 * output and find them equivalent. Every one of them passed while **none** of
 * the 37 instances CEE produced validated against its own template: the tests
 * all agreed with each other, and none of them asked the model. A suite can
 * only check the properties someone thought to state, and "conforms to the
 * spec" is a property no amount of internal consistency implies.
 *
 * Three templates still fail, listed below with what is wrong. They are recorded
 * rather than skipped so the count cannot quietly grow, and each names a real
 * defect rather than a quirk of the fixture.
 */
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { corpusAvailable, corpusTemplates } from '../src/corpus';
import { CeeDriver } from '../src/driver';

/**
 * Templates whose instances CEE cannot yet produce validly, and why.
 *
 * - **001** is not CEE's fault: the template has no `@id` — its readme says it
 *   was never saved — so no instance of it can carry the `schema:isBasedOn` the
 *   schema requires. CEE reports the template when it reads it.
 * - **003** is malformed in its own right; its schema will not even compile.
 * - **029** writes `{'@value': …}` into a field whose schema allows only `@id`
 *   and `rdfs:label`, so CEE is not recognising it as IRI-valued.
 *
 * **025**, **028** and **034** used to be here, along with half of 029's problem.
 * A field marked `_ui.hidden` was dropped from the component tree, and a
 * choice field with no default selection threw away its own `minItems`
 * skeleton. See `hidden-fields.spec.ts` and `multi-minitems.spec.ts`.
 */
const KNOWN_NON_CONFORMANT: Record<string, string> = {
  '001': 'template has no @id, so no instance of it can name it',
  '003': 'template is malformed; its schema does not compile',
  '029': 'a controlled field is written as @value',
};

const templates = corpusAvailable() ? corpusTemplates() : [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeValidator = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv as any)({ strict: false, allErrors: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addFormats(ajv as any);
  return ajv;
};

interface Outcome {
  valid: boolean;
  errors: string[];
}

const validateAgainstOwnTemplate = (template: object): Outcome => {
  const ajv = makeValidator();
  let validate;
  try {
    validate = ajv.compile(template);
  } catch (e) {
    return { valid: false, errors: [`template schema does not compile: ${(e as Error).message}`] };
  }
  const emitted = InstanceSerializer.toJson(new CeeDriver(template).dataContext.instanceFullData);
  if (validate(emitted)) {
    return { valid: true, errors: [] };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { valid: false, errors: (validate.errors ?? []).map((e: any) => `${e.instancePath || '/'} ${e.message}`) };
};

describe.skipIf(!corpusAvailable())('an instance CEE builds validates against its own template', () => {
  it('there are templates to check', () => {
    expect(templates.length).toBeGreaterThan(30);
  });

  it.each(templates.map((t) => [t.id, t] as const))('template-%s', (id, artifact) => {
    const outcome = validateAgainstOwnTemplate(artifact.json);
    const known = KNOWN_NON_CONFORMANT[id];

    if (known) {
      expect(outcome.valid, `template-${id} now validates — remove it from KNOWN_NON_CONFORMANT (${known})`).toBe(
        false,
      );
      return;
    }
    expect(outcome.valid, `template-${id} does not validate:\n  ${outcome.errors.join('\n  ')}`).toBe(true);
  });

  /**
   * The count is the thing to watch. Three is not a target to live with, it is
   * a list of defects with a number attached, and the number should only go
   * down. It was six, and before that thirty-seven.
   */
  it('no more than the three known non-conformant templates', () => {
    const failing = templates.filter((t) => !validateAgainstOwnTemplate(t.json).valid).map((t) => t.id);
    expect(failing.sort()).toEqual(Object.keys(KNOWN_NON_CONFORMANT).sort());
  });
});

describe.skipIf(!corpusAvailable())('the envelope every instance must carry', () => {
  /**
   * The template's `required` list names all nine envelope keys. CEE emitted
   * none of them until recently, then emitted them all as null — which is
   * correct for `@id` and the provenance fields, whose schemas are
   * `["string", "null"]`, and wrong for `schema:name` and `schema:description`,
   * which are `string` and `string` with `minLength: 1`.
   *
   * Checked separately from the whole-document validation above because it is
   * the part CEE is wholly responsible for, and because a regression here would
   * break every template at once rather than one.
   */
  const conformant = templates.filter((t) => !KNOWN_NON_CONFORMANT[t.id]);

  it.each(conformant.map((t) => [t.id, t] as const))('template-%s: name is a non-empty string', (_id, artifact) => {
    const emitted = InstanceSerializer.toJson(new CeeDriver(artifact.json).dataContext.instanceFullData) as Record<
      string,
      unknown
    >;
    expect(typeof emitted['schema:name']).toBe('string');
    expect((emitted['schema:name'] as string).length).toBeGreaterThan(0);
  });

  it.each(conformant.map((t) => [t.id, t] as const))('template-%s: description is a string', (_id, artifact) => {
    const emitted = InstanceSerializer.toJson(new CeeDriver(artifact.json).dataContext.instanceFullData) as Record<
      string,
      unknown
    >;
    expect(typeof emitted['schema:description']).toBe('string');
  });

  it('names the instance after the template it came from', () => {
    const artifact = templates.find((t) => !KNOWN_NON_CONFORMANT[t.id]);
    const driver = new CeeDriver(artifact!.json);
    const emitted = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
    expect(emitted['schema:name']).toBe(`${driver.representation.labelInfo.label} metadata`);
  });
});
