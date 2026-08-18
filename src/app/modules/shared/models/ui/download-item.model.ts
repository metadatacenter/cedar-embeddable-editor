/**
 * What CEE can hand a developer as a file, as data.
 *
 * These were eight panels once, each printing a dump under the form, and each
 * costing two configuration keys — one to show it and one to expand it. Sixteen
 * keys for a developer's convenience, two of them on by default, so an embedder
 * who configured nothing got a JSON Schema dump and a JSON-LD dump beneath every
 * form.
 *
 * They are downloads now, behind one menu and one key. An embedded component
 * handing you a file is a better answer than one painting JSON under someone
 * else's interface, and the content was already the right shape for it: every
 * panel resolved to exactly one string, which is what a download needs.
 *
 * The descriptor is what keeps that a list rather than six near-identical
 * blocks. A seventh download costs an entry here and a case in `downloadContentFor`.
 */
export interface DownloadItemDescriptor {
  /** Stable across renames of the label: the menu's key, and what a test names. */
  id: DownloadItemId;
  /** Translation key for the menu entry, resolved through `translate`. */
  labelKey: string;
  /** Material icon name shown beside the entry. */
  icon: string;
  /** Appended to the artifact's name to make the saved file's name. */
  suffix: string;
  /** File extension, without the dot. */
  extension: 'json' | 'yaml';
  /** What the blob is labelled as, which decides how a browser treats it. */
  mediaType: string;
}

export type DownloadItemId =
  | 'instance'
  | 'instanceYaml'
  | 'templateSource'
  | 'templateYaml'
  | 'templateYamlCompact'
  | 'dataQuality';

const JSON_TYPE = 'application/json';
const YAML_TYPE = 'application/yaml';

/**
 * Menu order.
 *
 * Instance before template, because a developer looking at a form is usually
 * asking what it produced rather than what defined it. Within each, JSON before
 * YAML. The data-quality report, which is neither artifact nor serialisation,
 * comes last.
 */
export const DOWNLOAD_ITEMS: readonly DownloadItemDescriptor[] = [
  {
    id: 'instance',
    labelKey: 'Extra.JsonLD.Instance',
    icon: 'device_hub',
    suffix: 'instance',
    extension: 'json',
    mediaType: JSON_TYPE,
  },
  {
    id: 'instanceYaml',
    labelKey: 'Extra.Yaml.Instance',
    icon: 'description',
    suffix: 'instance',
    extension: 'yaml',
    mediaType: YAML_TYPE,
  },
  {
    id: 'templateSource',
    labelKey: 'Extra.JsonSchemaTemplate',
    icon: 'view_module',
    suffix: 'template',
    extension: 'json',
    mediaType: JSON_TYPE,
  },
  {
    id: 'templateYaml',
    labelKey: 'Extra.Yaml.Template',
    icon: 'description',
    suffix: 'template',
    extension: 'yaml',
    mediaType: YAML_TYPE,
  },
  {
    id: 'templateYamlCompact',
    labelKey: 'Extra.Yaml.TemplateCompact',
    icon: 'description',
    suffix: 'template-compact',
    extension: 'yaml',
    mediaType: YAML_TYPE,
  },
  {
    id: 'dataQuality',
    labelKey: 'Extra.DataQualityReport',
    icon: 'list_alt',
    suffix: 'data-quality',
    extension: 'json',
    mediaType: JSON_TYPE,
  },
];
