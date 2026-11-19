import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { CedarReaders, InstanceValidator, JsonNode } from 'cedar-model-typescript-library';

export interface ConformanceOutcome {
  count: number;
  detail: string;
  findingCodes?: string[];
  /** The save-blocking findings, each as `<code> at <RFC 6901 path>`. */
  structural?: string[];
}

/**
 * Validate through the TypeScript model's semantic instance validator.
 *
 * This catches CEDAR-level differences that are not conveniently expressed by
 * JSON Schema.  It deliberately remains independent of raw-schema validation:
 * parsing normalizes some legacy template shapes, so agreement here alone does
 * not prove that the resource server will accept the emitted document.
 *
 * The template document is passed as the stored template, as the server judges
 * an instance against it. Older templates state four facts differently from
 * what the model writes: the children a container requires, the further keys it
 * admits, the properties a field's value must carry, and each container's
 * property IRIs. The validator reads those from the stored document only, and
 * CEE's own save decision reads them there too.
 */
export const validateWithModel = (template: object, instance: object): ConformanceOutcome => {
  const parsedTemplate = CedarReaders.json()
    .getFebruary2024()
    .getTemplateReader()
    .readFromObject(template as JsonNode).template;
  const parsedInstance = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    .readFromObject(instance as JsonNode).instance;

  const result = InstanceValidator.validate(parsedInstance, parsedTemplate, template as JsonNode);
  return {
    count: result.getBlueprintComparisonErrorCount(),
    findingCodes: result.getValidationReport().findings.map((finding) => finding.code),
    structural: result
      .getValidationReport()
      .findings.filter((finding) => finding.category === 'structural')
      .map((finding) => `${finding.code} at ${finding.path}`),
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
