import { CedarWriters, Template } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { DOWNLOAD_ITEMS, DownloadItemId } from '../models/ui/download-item.model';
import { DataContext } from './data-context';
import { InstanceSerializer } from './instance-serializer';

/**
 * What each download contains, and what it is called.
 *
 * Plain functions over a `DataContext` rather than getters on a component,
 * because this is the part worth testing and none of it needs a framework: the
 * harness can ask what a download holds without rendering anything. That is what
 * kept the equivalent assertions honest when these were panels — one test proved
 * the instance download is a CEDAR document rather than CEE's working tree, and
 * it can still prove it here.
 */

/** The template as the library parsed it, or null before one has been set. */
const templateModel = (dataContext: DataContext): Template | null => {
  const representation = dataContext.templateRepresentation;
  return representation instanceof CedarTemplate ? representation.parsed : null;
};

/** Two-space JSON, matching what the panels printed through the `json` pipe. */
const asJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2);

/**
 * The bytes of one download.
 *
 * The instance is written by the model library rather than taken from CEE's
 * working tree. The panel this replaces once printed `instanceExtractData`
 * straight out, which is a *model*, so what a developer saw was `_values` and
 * `_iris` — CEE's internals offered as their metadata.
 */
export const downloadContentFor = (id: DownloadItemId, dataContext: DataContext): string => {
  const template = templateModel(dataContext);
  switch (id) {
    case 'instance':
      return asJson(InstanceSerializer.toJson(dataContext.instanceFullData, template));
    case 'instanceYaml':
      return InstanceSerializer.toYaml(dataContext.instanceFullData, template);
    case 'templateSource':
      return asJson(dataContext.templateInput);
    case 'templateYaml':
      return template === null ? '' : CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template);
    case 'templateYamlCompact':
      return template === null
        ? ''
        : CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template, true);
    case 'dataQuality':
      return asJson(dataContext.dataQualityReport);
  }
};

/**
 * A file name built from the artifact rather than fixed.
 *
 * `SampleLoaded-instance.yaml` tells a developer with several forms open which
 * one they just saved; `instance.yaml` does not, and a second download would land
 * as `instance (1).yaml`. Falls back to `cedar` when the template has no name,
 * which the model allows.
 */
export const downloadFilenameFor = (id: DownloadItemId, dataContext: DataContext): string => {
  const item = DOWNLOAD_ITEMS.find((candidate) => candidate.id === id);
  if (item === undefined) {
    return 'cedar.json';
  }
  const name = templateModel(dataContext)?.schema_name ?? null;
  const stem = typeof name === 'string' && name.trim() !== '' ? safeStem(name) : 'cedar';
  return `${stem}-${item.suffix}.${item.extension}`;
};

/**
 * A template's name is authored text, and it becomes a file name here.
 *
 * Anything that is not a letter, digit, dash or underscore becomes a dash, so a
 * name carrying a slash, a quote or a control character cannot shape the path a
 * browser writes to.
 */
const safeStem = (name: string): string =>
  name
    .trim()
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'cedar';
