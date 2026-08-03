/**
 * The summary line the pager draws above a multi-instance field.
 *
 * `getMultiInstanceDataValueInfo` builds "All values: 1 alpha 2 beta" from the
 * instance, and to do it it asks what each occurrence holds — which is the
 * question `InstanceValueNode` exists to answer once. This site was missed when
 * the other four were converted, so it still ran its own ladder: `@value`, then
 * `@id` if the field is a link, then `rdfs:label`.
 *
 * That ladder carries the same defect that was fixed in the quality report: an
 * ORCID or ROR occurrence holds its value in `@id`, but only `link` was allowed
 * to read `@id`, so every external-authority occurrence fell through to
 * `rdfs:label`, found nothing, and drew "null" over a field that was filled in.
 *
 * Characterised here first, then converted.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { CedarMultiPagerComponent } from '@cee/components/cedar-multi-pager/cedar-multi-pager.component';
import { ActiveComponentRegistryService } from '@cee/service/active-component-registry.service';
import { UserPreferencesService } from '@cee/service/user-preferences.service';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const kind = (key: string, inputType: string, make: () => unknown, sample: string, extra: Partial<FieldKind> = {}): FieldKind =>
  ({ key, inputType, make, isStatic: false, write: 'value', sample, ...extra }) as FieldKind;

const TEXT = kind('text', 'textfield', () => CedarBuilders.textFieldBuilder(), 'some text');
const LINK = kind('link', 'link', () => CedarBuilders.linkFieldBuilder(), 'https://example.org/thing');
const ORCID = kind('orcid', 'ext-orcid', () => CedarBuilders.extOrcidFieldBuilder(), 'https://orcid.org/0000-0002-1825-0097');
const ROR = kind('ror', 'ext-ror', () => CedarBuilders.extRorFieldBuilder(), 'https://ror.org/00f54p054');
const NUMERIC = kind('numeric', 'numeric', () => CedarBuilders.numericFieldBuilder(), '0');
const CONTROLLED = kind('controlled', 'controlled', () => CedarBuilders.controlledTermFieldBuilder(), 'Homo sapiens', {
  write: 'controlled',
  configure: (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addOntology(
      new ControlledTermOntologyBuilder()
        .withAcronym('MESH')
        .withName('Medical Subject Headings')
        .withUri(new Iri('https://data.bioontology.org/ontologies/MESH'))
        .build(),
    ),
});

/** `instant` is the only thing the pager asks of it. */
const FAKE_TRANSLATE = { instant: (key: string) => key } as never;

const pagedTemplate = (fieldKind: FieldKind) =>
  buildTemplate({
    name: `pl_${fieldKind.key}`,
    children: [{ kind: fieldKind, name: 'f', cardinality: 'multi', minItems: 1, maxItems: 9 }],
  });

/**
 * Drive the real component against the real instance tree.
 *
 * Nothing here is a stand-in for CEE's logic: the driver builds the instance
 * through the production path and the pager reads it through
 * `handlerContext.getDataObjectNodeByPath`, exactly as it does on screen.
 */
const labelFor = (fieldKind: FieldKind, values: unknown[]): string => {
  const driver = new CeeDriver(pagedTemplate(fieldKind));
  const component = driver.findOrThrow(['_f']);

  // One occurrence per value, then the value written into it.
  values.forEach((value, index) => {
    if (index > 0) {
      driver.handlerContext.addMultiInstance(component);
    }
    driver.handlerContext.setCurrentIndex(component, index);
    if (value !== null) {
      driver.setValue(['_f'], fieldKind, value as string);
    }
  });

  const pager = new CedarMultiPagerComponent(
    new ActiveComponentRegistryService(),
    FAKE_TRANSLATE,
    driver.messages,
    new UserPreferencesService(),
  );
  pager.componentToRender = component;
  pager.handlerContext = driver.handlerContext;
  // Set by ngOnInit in the app; the label reads it to mark the current page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pager as any).setCurrentMultiInfo();

  return pager.getMultiInstanceDataValueInfo();
};

/** The label with the index markup stripped, which is all these tests care about. */
const values = (label: string): string[] =>
  label
    .replace(/^.*?<\/b>\s*/, '')
    .split(/<span class="multiinfo-index[^"]*">\d+<\/span>\s*/)
    .slice(1);

describe('what the pager shows for each kind of occurrence', () => {
  it('a literal reads as its text', () => {
    expect(values(labelFor(TEXT, ['alpha', 'beta']))).toEqual(['alpha', 'beta']);
  });

  it('a link reads as its IRI', () => {
    expect(values(labelFor(LINK, ['https://example.org/a']))).toEqual(['https://example.org/a']);
  });

  it('a controlled term reads as its label, not its IRI', () => {
    expect(values(labelFor(CONTROLLED, ['Homo sapiens']))).toEqual(['Homo sapiens']);
  });

  /**
   * REGRESSION: an ORCID occurrence stores its value in `@id`, like a link. The
   * pager only let `link` read `@id`, so this fell to the `rdfs:label` branch,
   * found nothing, and drew "null" over a field the user had filled in. The
   * same defect in `extractPlainValue` made a required ORCID field impossible
   * to satisfy; this is the display half of it, at the site that was missed.
   */
  it('an ORCID reads as its IRI rather than as null', () => {
    expect(values(labelFor(ORCID, ['https://orcid.org/0000-0002-1825-0097']))).toEqual([
      'https://orcid.org/0000-0002-1825-0097',
    ]);
  });

  it('a ROR reads as its IRI rather than as null', () => {
    expect(values(labelFor(ROR, ['https://ror.org/00f54p054']))).toEqual(['https://ror.org/00f54p054']);
  });

  it('an unfilled occurrence reads as null', () => {
    expect(values(labelFor(TEXT, [null]))).toEqual(['null']);
  });

  /**
   * `shortValue(...) || 'null'` treats a falsy value as absent, which would
   * draw "null" over a numeric zero. It does not, because CEE stores every
   * literal as a string and `'0'` is truthy. Pinned because the conversion
   * below changes what reaches that expression, and a plain `0` arriving there
   * would start displaying as "null" with nothing else to catch it.
   */
  it('a zero reads as zero, not as null', () => {
    expect(values(labelFor(NUMERIC, ['0']))).toEqual(['0']);
  });

  it('marks the occurrence the user is looking at', () => {
    const label = labelFor(TEXT, ['alpha', 'beta']);
    expect(label).toContain('current-multiinfo-index');
    expect(label).toContain('Generic.AllValues');
  });

  it('says nothing at all for a field with no occurrences', () => {
    const driver = new CeeDriver(
      buildTemplate({ name: 'pl_empty', children: [{ kind: TEXT, name: 'f', cardinality: 'multi', minItems: 0, maxItems: 9 }] }),
    );
    const component = driver.findOrThrow(['_f']);
    driver.handlerContext.deleteMultiInstance(component);

    const pager = new CedarMultiPagerComponent(
      new ActiveComponentRegistryService(),
      FAKE_TRANSLATE,
      driver.messages,
      new UserPreferencesService(),
    );
    pager.componentToRender = component;
    pager.handlerContext = driver.handlerContext;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pager as any).setCurrentMultiInfo();

    expect(pager.getMultiInstanceDataValueInfo()).toBe('');
  });
});

describe('a long literal is cut at a word boundary', () => {
  /**
   * The one piece of the label that is not classification, kept because the
   * conversion runs through the same `shortValue` and a mistake there would be
   * invisible in the tests above — every sample is short.
   */
  it('truncates past 30 characters and marks it', () => {
    const long = 'the quick brown fox jumps over the lazy dog';
    const shown = values(labelFor(TEXT, [long]))[0];
    expect(shown.endsWith('...')).toBe(true);
    expect(shown.length).toBeLessThan(long.length);
    expect(long.startsWith(shown.replace('...', ''))).toBe(true);
  });

  it('leaves a short literal alone', () => {
    expect(values(labelFor(TEXT, ['short']))).toEqual(['short']);
  });

  /** Only free text is truncated; an IRI stays whole however long it is. */
  it('does not truncate a link', () => {
    const long = `https://example.org/${'a'.repeat(60)}`;
    expect(values(labelFor(LINK, [long]))).toEqual([long]);
  });
});
