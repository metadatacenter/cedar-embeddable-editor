import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { CedarReaders, InstanceValidator } from 'cedar-model-typescript-library';

export interface ConformanceOutcome {
  count: number;
  detail: string;
}

/**
 * Validate through the TypeScript model's semantic instance validator.
 *
 * This catches CEDAR-level differences that are not conveniently expressed by
 * JSON Schema.  It deliberately remains independent of raw-schema validation:
 * parsing normalizes some legacy template shapes, so agreement here alone does
 * not prove that the resource server will accept the emitted document.
 */
export const validateWithModel = (template: object, instance: object): ConformanceOutcome => {
  const parsedTemplate = CedarReaders.json()
    .getFebruary2024()
    .getTemplateReader()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .readFromObject(template as any).template;
  const parsedInstance = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .readFromObject(instance as any, undefined as never).instance;

  const result = InstanceValidator.validate(parsedInstance, parsedTemplate);
  return {
    count: result.getBlueprintComparisonErrorCount(),
    detail: result
      .getBlueprintComparisonErrors()
      .map((e) => `${e.errorType.getValue()} at ${JSON.stringify(e.errorPath)}`)
      .join('; '),
  };
};

/**
 * Validate the exact emitted JSON-LD against the exact Draft-04 template JSON
 * Schema, without first reading either through a CEDAR model library.
 *
 * This is the server-facing contract.  In particular it catches a template
 * whose normalized model says a multi-select field is an array while the raw
 * artifact still declares the child as an object.
 */
export const validateWithRawSchema = (template: object, instance: object): ConformanceOutcome => {
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(template);
    const valid = validate(instance);
    const errors = validate.errors ?? [];
    return {
      count: valid ? 0 : errors.length,
      detail: errors.map((e) => `${e.instancePath || '/'} ${e.message ?? 'failed'} (${e.schemaPath})`).join('; '),
    };
  } catch (error) {
    return {
      count: 1,
      detail: `template could not be compiled as Draft-04 JSON Schema: ${
        error instanceof Error ? error.message : error
      }`,
    };
  }
};
