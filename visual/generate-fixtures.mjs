/**
 * Emit the template fixtures the visual baseline renders.
 *
 * Deliberately a small, hand-picked set rather than the harness's exhaustive
 * cross-product. Screenshot diffs are for catching *rendering* regressions —
 * Material 15's MDC rewrite changes DOM structure and CSS class names — and
 * five templates that each exercise a distinct layout mechanism catch that just
 * as well as five hundred, while staying reviewable when a diff fires.
 *
 * Uses only the CEDAR Model TypeScript Library, so it shares no machinery with
 * `harness/` and needs none of its Vite aliasing.
 *
 * Run: node generate-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The library's dist is CommonJS, so plain Node ESM cannot destructure named
// exports at parse time. (`harness/` gets away with named imports only because
// Vite performs CJS interop for it.) Default-import and destructure instead.
import cedar from 'cedar-model-typescript-library';

const {
  CedarBuilders,
  CedarWriters,
  ControlledTermOntologyBuilder,
  Iri,
  NumberType,
  TemporalGranularity,
  TemporalType,
} = cedar;

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'fixtures');

const FIXED_DATE = '2026-01-01T00:00:00-08:00';
const USER = 'https://metadatacenter.org/users/00000000-0000-0000-0000-000000000001';

const id = (seed) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}00000000`.slice(0, 36);
};

const opt = (b, m, ...a) => (typeof b?.[m] === 'function' ? b[m](...a) : b);

const common = (b, name, kind) =>
  b
    .withAtId(`https://repo.metadatacenter.org/${kind}/${id(name)}`)
    .withTitle(`${name} title`)
    .withDescription(`${name} description`)
    .withSchemaName(name)
    .withCreatedOn(FIXED_DATE)
    .withCreatedBy(USER)
    .withLastUpdatedOn(FIXED_DATE)
    .withModifiedBy(USER);

const deploy = (artifact, name, { multi, minItems, maxItems, required } = {}) => {
  const prop = `_${name}`;
  let db = artifact.createDeploymentBuilder(prop);
  db = opt(db, 'withIri', `https://schema.metadatacenter.org/properties/${id(prop)}`);
  db = opt(db, 'withLabel', name);
  db = opt(db, 'withDescription', `${name} property description`);
  if (multi) {
    db = opt(db, 'withMultiInstance', true);
    db = opt(db, 'withMinItems', minItems ?? 1);
    db = opt(db, 'withMaxItems', maxItems ?? 5);
  }
  if (required) db = opt(db, 'withRequiredValue', true);
  return db.build();
};

const field = (name, make, configure) => {
  let b = common(make(), name, 'template-fields');
  if (configure) b = configure(b);
  return b.build();
};

const write = (name, template) => {
  mkdirSync(OUT, { recursive: true });
  const json = CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template);
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(json, null, 2));
  console.log(`wrote fixtures/${name}.json`);
};

// 1. Every simple input type on one page — the widest single-screen surface.
{
  const kinds = [
    ['text', () => CedarBuilders.textFieldBuilder()],
    ['textarea', () => CedarBuilders.textAreaBuilder()],
    ['numeric', () => CedarBuilders.numericFieldBuilder(), (b) => b.withNumberType(NumberType.INT)],
    ['email', () => CedarBuilders.emailFieldBuilder()],
    ['phone', () => CedarBuilders.phoneNumberFieldBuilder()],
    ['link', () => CedarBuilders.linkFieldBuilder()],
    [
      'date',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => b.withTemporalType(TemporalType.DATETIME).withTemporalGranularity(TemporalGranularity.MINUTE),
    ],
  ];
  let tb = common(CedarBuilders.templateBuilder(), 'AllInputTypes', 'templates').withSchemaDescription(
    'Every simple input type',
  );
  for (const [name, make, configure] of kinds) {
    const f = field(name, make, configure);
    tb = tb.addChild(f, deploy(f, name, { required: name === 'text' }));
  }
  write('01-input-types', tb.build());
}

// 2. Choice widgets — radio, checkbox, single- and multi-select lists.
{
  const opts = (m, labels) => (b) => labels.reduce((acc, [l, s]) => acc[m](l, s), b);
  const kinds = [
    [
      'radio',
      () => CedarBuilders.radioFieldBuilder(),
      opts('addRadioOption', [
        ['Alpha', false],
        ['Beta', true],
        ['Gamma', false],
      ]),
    ],
    [
      'checkbox',
      () => CedarBuilders.checkboxFieldBuilder(),
      opts('addCheckboxOption', [
        ['One', true],
        ['Two', false],
      ]),
    ],
    [
      'single_list',
      () => CedarBuilders.singleChoiceListFieldBuilder(),
      opts('addListOption', [
        ['Red', false],
        ['Green', true],
        ['Blue', false],
      ]),
    ],
    [
      'multi_list',
      () => CedarBuilders.multipleChoiceListFieldBuilder(),
      opts('addListOption', [
        ['North', false],
        ['South', false],
      ]),
    ],
  ];
  let tb = common(CedarBuilders.templateBuilder(), 'ChoiceWidgets', 'templates').withSchemaDescription(
    'Radio, checkbox and list widgets',
  );
  for (const [name, make, configure] of kinds) {
    const f = field(name, make, configure);
    tb = tb.addChild(f, deploy(f, name));
  }
  write('02-choices', tb.build());
}

// 3. Nested elements and multi-instance pagers — the chip pager and the
//    expansion-panel nesting are the most Material-dependent layout in CEE.
{
  const name = field('name', () => CedarBuilders.textFieldBuilder());
  const email = field('email', () => CedarBuilders.emailFieldBuilder());
  let inner = common(CedarBuilders.templateElementBuilder(), 'affiliation', 'template-elements');
  inner = inner.addChild(name, deploy(name, 'name', { required: true }));
  const affiliation = inner.build();

  let outer = common(CedarBuilders.templateElementBuilder(), 'author', 'template-elements');
  outer = outer.addChild(name, deploy(name, 'name', { required: true }));
  outer = outer.addChild(email, deploy(email, 'email'));
  outer = outer.addChild(affiliation, deploy(affiliation, 'affiliation', { multi: true, minItems: 2 }));
  const author = outer.build();

  let tb = common(CedarBuilders.templateBuilder(), 'NestedMultiInstance', 'templates').withSchemaDescription(
    'Multi-instance elements nested two deep',
  );
  tb = tb.addChild(author, deploy(author, 'author', { multi: true, minItems: 3 }));
  write('03-nested-multi', tb.build());
}

// 4. Controlled terms — the autocomplete widget with all four constraint kinds.
{
  const term = field('organism', () => CedarBuilders.controlledTermFieldBuilder(), (b) =>
    b.addOntology(
      new ControlledTermOntologyBuilder()
        .withAcronym('NCBITAXON')
        .withName('NCBI Taxonomy')
        .withNumTerms(1000000)
        .withUri(new Iri('https://data.bioontology.org/ontologies/NCBITAXON'))
        .build(),
    ),
  );
  const orcid = field('contributor', () => CedarBuilders.extOrcidFieldBuilder());
  const ror = field('institution', () => CedarBuilders.extRorFieldBuilder());

  let tb = common(CedarBuilders.templateBuilder(), 'ControlledTerms', 'templates').withSchemaDescription(
    'Controlled term and external authority widgets',
  );
  tb = tb.addChild(term, deploy(term, 'organism', { required: true }));
  tb = tb.addChild(orcid, deploy(orcid, 'contributor'));
  tb = tb.addChild(ror, deploy(ror, 'institution', { multi: true, minItems: 2 }));
  write('04-controlled-terms', tb.build());
}

// 5. Static content and page breaks — section headers, rich text, pagination.
{
  const section = field('section', () => CedarBuilders.sectionBreakFieldBuilder(), (b) =>
    opt(b, 'withContent', 'Section One'),
  );
  const rich = field('note', () => CedarBuilders.richTextFieldBuilder(), (b) =>
    opt(b, 'withContent', '<p>Some <strong>rich</strong> guidance text.</p>'),
  );
  const pb = field('pb', () => CedarBuilders.pageBreakFieldBuilder());
  const a = field('first', () => CedarBuilders.textFieldBuilder());
  const b2 = field('second', () => CedarBuilders.textFieldBuilder());

  let tb = common(CedarBuilders.templateBuilder(), 'StaticAndPaged', 'templates').withSchemaDescription(
    'Static content and page breaks',
  );
  tb = tb.addChild(section, deploy(section, 'section'));
  tb = tb.addChild(rich, deploy(rich, 'note'));
  tb = tb.addChild(a, deploy(a, 'first'));
  tb = tb.addChild(pb, deploy(pb, 'pb'));
  tb = tb.addChild(b2, deploy(b2, 'second'));
  write('05-static-paged', tb.build());
}

// 6. Validation states — the mat-form-field subscript area.
//    `mat-error` is the single most-used Material element in CEE (30 template
//    occurrences) and appeared in no baseline: errors only render once a
//    control is touched, which no default-state screenshot reaches. Material
//    15's MDC rewrite substantially restructures the form-field subscript
//    wrapper, so this is prime regression territory.
{
  const kinds = [
    ['required_text', () => CedarBuilders.textFieldBuilder(), undefined, true],
    ['short_text', () => CedarBuilders.textFieldBuilder(), (b) => b.withMinLength(8), true],
    ['an_email', () => CedarBuilders.emailFieldBuilder(), undefined, true],
    ['a_link', () => CedarBuilders.linkFieldBuilder(), undefined, true],
    ['a_phone', () => CedarBuilders.phoneNumberFieldBuilder(), undefined, true],
  ];
  let tb = common(CedarBuilders.templateBuilder(), 'ValidationStates', 'templates').withSchemaDescription(
    'Fields that can show validation errors',
  );
  for (const [name, make, configure, required] of kinds) {
    const f = field(name, make, configure);
    tb = tb.addChild(f, deploy(f, name, { required }));
  }
  write('06-validation', tb.build());
}

// 7. Timezone picker — the only `ng-select` in the application, reachable only
//    when a temporal field sets timezoneEnabled.
{
  const dt = field(
    'sampled_at',
    () => CedarBuilders.temporalFieldBuilder(),
    (b) =>
      b
        .withTemporalType(TemporalType.DATETIME)
        .withTemporalGranularity(TemporalGranularity.MINUTE)
        .withTimezoneEnabled(true),
  );
  let tb = common(CedarBuilders.templateBuilder(), 'TimezonePicker', 'templates').withSchemaDescription(
    'Temporal field with the timezone picker enabled',
  );
  tb = tb.addChild(dt, deploy(dt, 'sampled_at'));
  write('07-timezone', tb.build());
}
