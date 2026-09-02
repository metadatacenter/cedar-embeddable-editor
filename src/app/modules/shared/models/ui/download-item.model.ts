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
 * The descriptor is what keeps that a list rather than seven near-identical
 * blocks. An eighth download costs an entry here and a case in `downloadContentFor`.
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
  | 'instanceYamlCompact'
  | 'templateSource'
  | 'templateYaml'
  | 'templateYamlCompact'
  | 'dataQuality';

const JSON_TYPE = 'application/json';
const YAML_TYPE = 'application/yaml';

/**
 * Every supported download.
 *
 * This is the capability registry, not the visible menu order.
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
    id: 'instanceYamlCompact',
    labelKey: 'Extra.Yaml.InstanceCompact',
    icon: 'description',
    suffix: 'instance-compact',
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

/**
 * What the download menu offers, in reading order. The YAML views come first, full before compact;
 * JSON Schema follows them immediately before the JSON-LD instance, and the report comes last.
 */
const DOWNLOAD_MENU_ORDER: readonly DownloadItemId[] = [
  'templateYaml',
  'templateYamlCompact',
  'instanceYaml',
  'instanceYamlCompact',
  'templateSource',
  'instance',
  'dataQuality',
];

export const DOWNLOAD_MENU_ITEMS: readonly DownloadItemDescriptor[] = DOWNLOAD_MENU_ORDER.map((id) => {
  const item = DOWNLOAD_ITEMS.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Unknown download menu item: ${id}`);
  }
  return item;
});

const INSTANCE_ONLY_DOWNLOAD_IDS: ReadonlySet<DownloadItemId> = new Set([
  'instanceYaml',
  'instanceYamlCompact',
  'instance',
  'dataQuality',
]);

/** Template exports shown when read-only CEE has no instance to download or assess. */
export const TEMPLATE_ONLY_DOWNLOAD_MENU_ITEMS: readonly DownloadItemDescriptor[] = DOWNLOAD_MENU_ITEMS.filter(
  (item) => !INSTANCE_ONLY_DOWNLOAD_IDS.has(item.id),
);
