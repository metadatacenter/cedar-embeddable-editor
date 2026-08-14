/**
 * What each download actually contains.
 *
 * These assertions were made against rendered panels once, in the browser suite,
 * because that was the only place the content existed. It is a plain function now,
 * so the questions worth asking — is this a CEDAR document or CEE's working tree,
 * does the YAML come from the model library — are answered here without a browser
 * and against every shape the corpus has.
 *
 * The instance one is not academic. The panel this replaces once printed
 * `instanceExtractData` straight through the `json` pipe, which is a *model*, so a
 * developer was shown `_values` and `_iris` — CEE's internals offered as their
 * metadata.
 */
import { describe, expect, it } from 'vitest';
import { downloadContentFor, downloadFilenameFor } from '@cee/util/download-content';
import { DOWNLOAD_ITEMS } from '@cee/models/ui/download-item.model';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';

const TEXT = FIELD_KINDS.find((k) => k.inputType === 'textfield')!;

const driverWithValue = (name = 'dl'): CeeDriver => {
  const driver = new CeeDriver(buildTemplate({ name, children: [{ kind: TEXT, name: 'title' }] }));
  driver.setValue(['_title'], TEXT, 'a stored value');
  return driver;
};

describe('every download produces something', () => {
  it.each(DOWNLOAD_ITEMS.map((item) => item.id))('%s is a non-empty string', (id) => {
    const content = downloadContentFor(id, driverWithValue().dataContext);
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });
});

describe('the instance downloads', () => {
  it('are a CEDAR document, not CEE working tree', () => {
    const json = downloadContentFor('instance', driverWithValue().dataContext);

    expect(json).toContain('@context');
    expect(json).toContain('a stored value');
    expect(json, 'the model library container leaked into the download').not.toContain('dataContainer');
    expect(json, "CEE's own value model leaked into the download").not.toContain('_values');
    expect(json, "CEE's own IRI model leaked into the download").not.toContain('_iris');
  });

  it('read as YAML rather than as JSON when the YAML entry is chosen', () => {
    const yaml = downloadContentFor('instanceYaml', driverWithValue().dataContext);

    expect(yaml).toContain('a stored value');
    expect(yaml, 'a YAML download must not be a JSON object').not.toMatch(/^\s*\{/);
    expect(yaml).not.toContain('dataContainer');
  });
});

describe('the file name', () => {
  it('is built from the template name, so two forms do not collide', () => {
    expect(downloadFilenameFor('instanceYaml', driverWithValue().dataContext)).toBe('dl-instance.yaml');
    expect(downloadFilenameFor('templateSource', driverWithValue().dataContext)).toBe('dl-template.json');
  });

  /**
   * A template's name is authored text and becomes a file name here, so a name
   * carrying a slash or a quote must not shape the path a browser writes to.
   */
  it('reduces an authored name to safe characters', () => {
    const filename = downloadFilenameFor('instance', driverWithValue('a/b "c" ../etc').dataContext);

    expect(filename).not.toContain('/');
    expect(filename).not.toContain('"');
    expect(filename).not.toContain('..');
    expect(filename.endsWith('-instance.json')).toBe(true);
  });
});
