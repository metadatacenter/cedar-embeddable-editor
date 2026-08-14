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
  InstanceDataContainer,
  InstanceDataControlledAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
  Iri,
  NumberType,
  TemplateInstanceBuilder,
  TemporalGranularity,
  TemporalType,
  TimeFormat,
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

/**
 * An instance a host would inject, built from what it holds.
 *
 * The instances here were written out as CEDAR JSON — envelope, `@context`,
 * `@value` and `@type` on every field — which made this file the second place
 * that had to know how an instance is spelled, and left the fixtures saying
 * something no real host sends: an empty `@context`. The builder and the JSON
 * writer are the same pair CEE reads the result with, so a fixture now says
 * which template, what is in each field, and nothing about the serialization.
 *
 * `values` maps a field's property key to an atom, a container, or a list of
 * either. `literal` and `typed` below are how a caller names one.
 */
const instance = (templateName, { id: instanceId, name, description, values }) => {
  const builder = new TemplateInstanceBuilder()
    .withSchemaIsBasedOn(`https://repo.metadatacenter.org/templates/${id(templateName)}`)
    .withAtId(instanceId)
    .withSchemaName(name)
    .withSchemaDescription(description)
    .withCreatedOn(FIXED_DATE)
    .withCreatedBy(USER)
    .withLastUpdatedOn(FIXED_DATE)
    .withModifiedBy(USER);
  for (const [key, value] of Object.entries(values)) {
    builder.withDataValue(key, value);
  }
  return CedarWriters.json().getFebruary2024().getTemplateInstanceWriter().getAsJsonNode(builder.build());
};

/** A plain string value. */
const literal = (value) => new InstanceDataStringAtom(value);

/** A string value carrying the XSD type its field declares. */
const typed = (value, xsdType) => new InstanceDataTypedAtom(value, xsdType);

/**
 * A controlled term: an IRI and the label it resolves to.
 *
 * The IRI goes in as a plain string, not as the library's own `Iri`. Handed an
 * `Iri`, the atom keeps the wrapper and the JSON writer emits
 * `"@id": {"value": "http://…"}` — a document no reader accepts. Worth knowing
 * because the typed argument is the one that looks right.
 */
const controlled = (iri, label) => new InstanceDataControlledAtom(iri, label);

/** One occurrence of an element, holding its children. */
const occurrence = (children) => {
  const container = new InstanceDataContainer();
  for (const [key, value] of Object.entries(children)) {
    container.setValue(key, value);
  }
  return container;
};

/**
 * For a document that is not a template.
 *
 * `write` above runs the template writer, which is right for every template here
 * and wrong for an instance — it tries to read the document as a template and
 * fails. Instances are written verbatim.
 */
const writeRaw = (name, document) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(document, null, 2));
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
    // The same widget with a declared ceiling. Both cases are here on purpose:
    // the select shows a "select up to N" hint, and whether it shows one at all
    // turns on whether the template named a maximum. With only the unbounded
    // field recorded, a hint that rendered its own placeholder text for a field
    // with no maximum sat in the baseline as though it were the design.
    [
      'bounded_list',
      () => CedarBuilders.multipleChoiceListFieldBuilder(),
      opts('addListOption', [
        ['Up', false],
        ['Down', false],
        ['Sideways', false],
      ]),
    ],
  ];
  let tb = common(CedarBuilders.templateBuilder(), 'ChoiceWidgets', 'templates').withSchemaDescription(
    'Radio, checkbox and list widgets',
  );
  for (const [name, make, configure] of kinds) {
    const f = field(name, make, configure);
    tb = tb.addChild(
      f,
      name === 'bounded_list' ? deploy(f, name, { multi: true, minItems: 0, maxItems: 2 }) : deploy(f, name),
    );
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
  const term = field(
    'organism',
    () => CedarBuilders.controlledTermFieldBuilder(),
    (b) =>
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

  /*
   * The same template with a term already chosen, so a baseline can see how a
   * selected controlled term reads. Every other route to that state needs a live
   * terminology server, which the visual suite deliberately cannot reach — so
   * without this the display form was rendered by no test at all, and it had
   * drifted from the seven authority fields into `label - (iri)`.
   */
  writeRaw(
    '04-controlled-terms-instance',
    instance('ControlledTerms', {
      id: 'https://example.org/instances/controlled-terms-1',
      name: 'ControlledTerms instance',
      description: 'A term already selected, so its display form is rendered',
      values: { _organism: controlled('http://purl.obolibrary.org/obo/DOID_4', 'disease') },
    }),
  );
}

/**
 * 19. Template rich text carrying markup that would execute if it were trusted.
 *
 * Not in FIXTURES, so it records no baseline: its content is adversarial rather
 * than representative, and a screenshot of it would assert what a sanitizer's
 * output happens to look like rather than what it must not do.
 *
 * The formatting alongside it is the point. Half of this fixture exists to fail
 * loudly if someone "hardens" the rich-text field by routing it through Angular's
 * sanitizer, which strips `style` — every colour, size and table rule here would
 * vanish while all the security assertions still passed.
 */
{
  const dangerous = field(
    'note',
    () => CedarBuilders.richTextFieldBuilder(),
    (b) =>
      opt(
        b,
        'withContent',
        // An image that cannot load, so its handler is a genuinely reachable path —
        // `innerHTML` never runs a <script>, but it does run `onerror`.
        '<img src="./does-not-exist.png" onerror="window.__templateMarkupRan = true" alt="broken">' +
          '<a href="javascript:window.__templateMarkupRan = true">js link</a>' +
          // Inert in CEE, which is Angular; executable in the AngularJS Template
          // Designer that embeds it. Corpus template 009 carries exactly these.
          '<a href="https://example.org/ok" ng-click="dc.goToMyWorkspace()">ng link</a>' +
          '<iframe src="about:blank" title="frame"></iframe>' +
          '<script>window.__templateMarkupRan = true;</script>' +
          // Everything below must survive.
          '<p style="color: rgb(12, 34, 56); font-size: 18px;">styled text</p>' +
          '<table border="1"><tbody><tr><td colspan="2">cell</td></tr></tbody></table>' +
          '<ul><li>listed</li></ul>' +
          '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="inline">',
      ),
  );
  let tb = common(CedarBuilders.templateBuilder(), 'TemplateMarkup', 'templates').withSchemaDescription(
    'Static rich text carrying executable markup',
  );
  tb = tb.addChild(dangerous, deploy(dangerous, 'note'));
  write('19-template-markup', tb.build());
}

/**
 * 20. The template-authored strings that are not rich text.
 *
 * Rich text is the only one of these rendered as HTML, and 19 covers it. The rest
 * of what a template author writes reaches the page as interpolated text or as a
 * URL: a section break's label and help text, an image field's `src`, a video
 * field's link, and the messages the image and video resolvers produce when they
 * refuse one. Each is safe by a different mechanism — Angular's interpolation, a
 * scheme check, an embed URL built from a fixed origin around a validated video ID
 * — and each was an observation about the code rather than something a test held.
 *
 * So every string here is hostile, and the assertions are that the page shows them
 * and does nothing else with them. Not in FIXTURES, for the same reason as 19: a
 * screenshot would record what a refusal happens to look like.
 */
{
  // A payload that runs if any of these strings is ever treated as markup. The
  // `img` is what makes it reachable — `innerHTML` never runs a `<script>`, but a
  // failed image load does fire `onerror`.
  // `data-static-markup` is what an assertion counts: an element carrying it is one
  // of these strings that became markup, whatever else the editor's own DOM holds.
  const MARKUP =
    '<img data-static-markup src="./does-not-exist.png" onerror="window.__staticMarkupRan = true">' +
    '<b data-static-markup>bold</b>';

  const section = field(
    'section',
    () => CedarBuilders.sectionBreakFieldBuilder(),
    (b) => b.withSchemaName(`Heading ${MARKUP}`).withSchemaDescription(`Help ${MARKUP}`),
  );
  // The scheme check, and the case an author is most likely to have pasted.
  const scripted = field(
    'scripted',
    () => CedarBuilders.imageFieldBuilder(),
    (b) => opt(b, 'withContent', 'javascript:window.__staticMarkupRan = true'),
  );
  // A `data:` URL that declares something other than an image. Renders nothing in
  // any browser, and used to pass on the strength of its scheme alone.
  const inline = field(
    'inline',
    () => CedarBuilders.imageFieldBuilder(),
    (b) =>
      opt(
        b,
        'withContent',
        `data:text/html;base64,${Buffer.from('<script>window.__staticMarkupRan = true</script>').toString('base64')}`,
      ),
  );
  // A host that ends in the YouTube one rather than being it, carrying markup in
  // the query so the refusal message is rendered as well as produced.
  const video = field(
    'video',
    () => CedarBuilders.youtubeFieldBuilder(),
    (b) => opt(b, 'withVideoId', `https://youtube.com.evil.example/watch?v=${MARKUP}`),
  );

  let tb = common(CedarBuilders.templateBuilder(), 'StaticMarkup', 'templates').withSchemaDescription(
    'Static labels and URLs carrying executable markup',
  );
  tb = tb.addChild(section, deploy(section, 'section'));
  tb = tb.addChild(scripted, deploy(scripted, 'scripted'));
  tb = tb.addChild(inline, deploy(inline, 'inline'));
  tb = tb.addChild(video, deploy(video, 'video'));
  write('20-static-markup', tb.build());
}

// 5. Static content and page breaks — section headers, rich text, pagination.
{
  const section = field(
    'section',
    () => CedarBuilders.sectionBreakFieldBuilder(),
    (b) => opt(b, 'withContent', 'Section One'),
  );
  const rich = field(
    'note',
    () => CedarBuilders.richTextFieldBuilder(),
    (b) => opt(b, 'withContent', '<p>Some <strong>rich</strong> guidance text.</p>'),
  );
  const pb = field('pb', () => CedarBuilders.pageBreakFieldBuilder());
  const a = field('first', () => CedarBuilders.textFieldBuilder());
  const b2 = field('second', () => CedarBuilders.textFieldBuilder());

  /**
   * The image field, with the image carried inline.
   *
   * `cedar-static-image.component.html` renders `<img src="{{content}}">`
   * straight from the field's content, so a normal template would point at a
   * remote URL — and the visual suite must not reach the network for the same
   * reason it points the terminology server at a dead port: a baseline that
   * depends on someone else's uptime fails for reasons that have nothing to do
   * with CEE. A `data:` URI renders identically and offline.
   *
   * Rectangles on integer boundaries and no text, so there is nothing in the
   * image for font or anti-aliasing variance to move. Built here rather than
   * pasted as a blob so it stays readable.
   */
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='120'>" +
    "<rect width='240' height='120' fill='rgb(232,232,232)'/>" +
    "<rect x='20' y='20' width='80' height='80' fill='rgb(0,105,92)'/>" +
    "<rect x='130' y='20' width='40' height='80' fill='rgb(249,168,37)'/>" +
    "<rect x='185' y='45' width='35' height='30' fill='rgb(2,119,189)'/>" +
    '</svg>';
  const image = field(
    'diagram',
    () => CedarBuilders.imageFieldBuilder(),
    (b) => opt(b, 'withContent', `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`),
  );

  let tb = common(CedarBuilders.templateBuilder(), 'StaticAndPaged', 'templates').withSchemaDescription(
    'Static content and page breaks',
  );
  tb = tb.addChild(section, deploy(section, 'section'));
  tb = tb.addChild(rich, deploy(rich, 'note'));
  tb = tb.addChild(image, deploy(image, 'diagram'));
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

// 7. UTC-offset picker, reachable only when a temporal field sets
//    timezoneEnabled.
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

// 8. Every external authority type in one form.
//
//    These are search boxes: the control holds what the user is typing, never
//    the IRI. That distinction is the source of a class of bug — a validator
//    pointed at the control instead of the value put "not a valid RRID and has
//    been cleared" under the field on the first keystroke — and it could not be
//    reproduced against `04-controlled-terms`, which carries only ORCID and ROR.
//    The other five widgets are copies of those two and drift from them.
{
  const types = [
    ['contributor_orcid', () => CedarBuilders.extOrcidFieldBuilder()],
    ['institution_ror', () => CedarBuilders.extRorFieldBuilder()],
    ['chemical_pfas', () => CedarBuilders.extPfasFieldBuilder()],
    ['citation_pmid', () => CedarBuilders.extPubmedFieldBuilder()],
    ['resource_rrid', () => CedarBuilders.extRridFieldBuilder()],
    ['award_nih', () => CedarBuilders.extNihGrantIdFieldBuilder()],
    ['dataset_doi', () => CedarBuilders.extDoiFieldBuilder()],
  ];

  let tb = common(CedarBuilders.templateBuilder(), 'ExternalAuthority', 'templates').withSchemaDescription(
    'Every external authority widget',
  );
  for (const [name, make] of types) {
    const f = field(name, make);
    tb = tb.addChild(f, deploy(f, name));
  }
  write('08-authority', tb.build());
}

// 9. Temporal fields at every granularity CEDAR defines, and both time formats.
//
//    The reason this exists: CEE's time picker is its own, written because the
//    obvious third-party replacement supports no seconds — and second-precision
//    is the second most used granularity across both artifact corpora, after
//    `day`. Before this fixture the only temporal field under test was
//    minute-granularity, so the seconds boxes and the 12-hour face, which are the
//    entire reason for owning the component, were rendered by nothing.
{
  const temporal = (name, type, granularity, timeFormat) =>
    field(
      name,
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => {
        let out = b.withTemporalType(type).withTemporalGranularity(granularity);
        if (timeFormat) {
          out = opt(out, 'withInputTimeFormat', timeFormat);
        }
        return out;
      },
    );

  const fields = [
    temporal('year_only', TemporalType.DATE, TemporalGranularity.YEAR),
    temporal('day_only', TemporalType.DATE, TemporalGranularity.DAY),
    temporal('hour_only', TemporalType.TIME, TemporalGranularity.HOUR),
    temporal('to_the_minute', TemporalType.TIME, TemporalGranularity.MINUTE),
    temporal('to_the_second', TemporalType.TIME, TemporalGranularity.SECOND),
    temporal('decimal_seconds', TemporalType.DATETIME, TemporalGranularity.DECIMAL_SECOND),
    temporal('twelve_hour', TemporalType.TIME, TemporalGranularity.MINUTE, TimeFormat.H12),
    temporal('twelve_hour_seconds', TemporalType.TIME, TemporalGranularity.SECOND, TimeFormat.H12),
  ];

  let tb = common(CedarBuilders.templateBuilder(), 'TemporalGranularity', 'templates').withSchemaDescription(
    'Temporal fields at every granularity, in both time formats',
  );
  for (const f of fields) {
    tb = tb.addChild(f, deploy(f, f.schema_name ?? 'x'));
  }
  write('09-temporal', tb.build());
}

// 10. Attribute-value fields — the one dynamic field type that rendered in no
//     fixture at all, so no baseline covered it and no clipped screenshot could.
//
//     It is the odd one out among the field types: the *name* is user-supplied
//     rather than fixed by the template, so the widget is a name box beside a
//     value box, each with its own clear button. Two Material form fields on one
//     row, which is a layout no other widget in CEE uses — and `mat-form-field`
//     is exactly what Material 15's MDC rewrite restructures.
{
  const av = field('attribute', () => CedarBuilders.attributeValueFieldBuilder());
  const before = field('label', () => CedarBuilders.textFieldBuilder());

  let tb = common(CedarBuilders.templateBuilder(), 'AttributeValues', 'templates').withSchemaDescription(
    'Attribute-value fields, whose names come from the user rather than the template',
  );
  // A plain field above it, so the baseline also shows the attribute-value row
  // in context rather than alone at the top of the form.
  tb = tb.addChild(before, deploy(before, 'label'));
  /**
   * `minItems: 1`, deliberately.
   *
   * An attribute-value field is always an array — the user supplies the names, so
   * the template cannot know them — and built without an explicit `minItems` the
   * builder leaves it at 0. At 0 the field's header, its pager and its add button
   * all render correctly, but there is no occupied row, so
   * `app-cedar-input-attribute-value` itself is not on the page and a clipped
   * baseline of the widget would have nothing to photograph. Hence one row here.
   *
   * That is a fact about this fixture, not a complaint about the behaviour: a
   * 0..4 field showing an add control and no row is right.
   */
  tb = tb.addChild(av, deploy(av, 'attribute', { multi: true, minItems: 1, maxItems: 4 }));
  write('10-attribute-values', tb.build());

  /**
   * An instance that says nothing about the attribute-value field.
   *
   * A template declares the property; an instance need not carry a slot for it, and
   * one naming no attribute is what CEDAR produces for a field nobody has filled in.
   * Loading that used to leave the field inert: the pager reported the missing node
   * on every change-detection pass, and the add button had no list to add to and
   * refused. Assertion-only, so it records no baseline — what it covers is behaviour,
   * and the widget's appearance is already photographed from the template above.
   */
  writeRaw(
    '10-attribute-values-unfilled-instance',
    instance('AttributeValues', {
      id: 'https://example.org/instances/attribute-values-1',
      name: 'AttributeValues instance',
      description: 'The attribute-value field carries no slot at all',
      values: { _label: literal('a label') },
    }),
  );
}

// 11. A default-selected choice, plus an instance that already has a different
//     value — ported from `cedar-input-multiple-choice.component.spec.ts`.
//
//     The guard is `populateItemsOnLoad`: if the data object already holds a
//     non-null `@value` it uses that and returns, leaving the template's
//     `selectedByDefault` unapplied. Getting that backwards would silently
//     overwrite a value someone had saved with a template default, which is data
//     loss that looks like a working form — the field shows *a* value, just not
//     theirs.
//
//     Only testable with an instance to inject, which is why `host.html` learned
//     `?i=`. The template default is `Limited`; the instance says `Private`.
{
  const choice = field(
    'access',
    () => CedarBuilders.radioFieldBuilder(),
    (b) => b.addRadioOption('Private', false).addRadioOption('Limited', true).addRadioOption('Public', false),
  );
  let tb = common(CedarBuilders.templateBuilder(), 'ChoiceDefault', 'templates').withSchemaDescription(
    'A default-selected choice, to be overridden by an injected instance',
  );
  tb = tb.addChild(choice, deploy(choice, 'access'));
  const template = tb.build();
  write('11-choice-default', template);

  writeRaw(
    '11-choice-default-instance',
    instance('ChoiceDefault', {
      id: 'https://example.org/instances/choice-default-1',
      name: 'ChoiceDefault instance',
      description: 'Access already set to Private',
      values: { _access: literal('Private') },
    }),
  );
}

// 12. The three branches of `shouldRenderContentOfNonIterable` — ported from
//     `cedar-component-renderer.component.spec.ts`.
//
//     `isMultiPage()` is `!(checkbox || list)`, so a list field is multi but not
//     paged and always shows its content, while a paged field with no instances
//     shows none — there is no occurrence to show, and the pager says so instead.
//     The spec drove the method directly with mocks; here the same three cases are
//     three fields on one page, and the assertion is whether `mat-card-content`
//     exists inside each one's card.
{
  const list = field(
    'list_no_values',
    () => CedarBuilders.multipleChoiceListFieldBuilder(),
    (b) => b.addListOption('North', false).addListOption('South', false),
  );
  const pagedEmpty = field('paged_no_instances', () => CedarBuilders.textFieldBuilder());
  const pagedFilled = field('paged_one_instance', () => CedarBuilders.textFieldBuilder());

  let tb = common(CedarBuilders.templateBuilder(), 'RenderDecision', 'templates').withSchemaDescription(
    'Whether a multi field renders its content, across the three deciding cases',
  );
  tb = tb.addChild(list, deploy(list, 'list_no_values'));
  tb = tb.addChild(pagedEmpty, deploy(pagedEmpty, 'paged_no_instances', { multi: true, minItems: 0, maxItems: 3 }));
  tb = tb.addChild(pagedFilled, deploy(pagedFilled, 'paged_one_instance', { multi: true, minItems: 1, maxItems: 3 }));
  write('12-render-decision', tb.build());
}

// 13. A choice field inside a multi-instance element, with a different value on
//     each occurrence — the case that decides whether widget-init population is
//     load-bearing.
//
//     `renderInstance` sweeps `updateViewToModel` over every child once, after a
//     load. Any widget created *later* — by paging to another occurrence, or by
//     expanding something collapsed — was not part of that sweep, so if anything
//     depends on a widget populating itself in `ngOnInit`, this is where it shows.
//     Two occurrences holding different values means a page change must repaint the
//     control, and reading the second page proves the value came from the model
//     rather than from whatever the first page left behind.
{
  const choice = field(
    'access',
    () => CedarBuilders.radioFieldBuilder(),
    (b) => b.addRadioOption('Private', false).addRadioOption('Limited', true).addRadioOption('Public', false),
  );
  let el = common(CedarBuilders.templateElementBuilder(), 'record', 'template-elements');
  el = el.addChild(choice, deploy(choice, 'access'));
  const record = el.build();

  let tb = common(CedarBuilders.templateBuilder(), 'PagedChoice', 'templates').withSchemaDescription(
    'A choice field inside a multi-instance element, one value per occurrence',
  );
  tb = tb.addChild(record, deploy(record, 'record', { multi: true, minItems: 2, maxItems: 4 }));
  write('13-paged-choice', tb.build());

  writeRaw(
    '13-paged-choice-instance',
    instance('PagedChoice', {
      id: 'https://example.org/instances/paged-choice-1',
      name: 'PagedChoice instance',
      description: 'Two occurrences, Public then Private',
      // Neither is the template's default (`Limited`), so a default leaking through
      // is visible rather than coincidentally right.
      values: {
        _record: [occurrence({ _access: literal('Public') }), occurrence({ _access: literal('Private') })],
      },
    }),
  );
}

// 15. Two date fields of different granularity, both filled — the case that asks
//     whether each picker formats with its own granularity.
//
//     Each date picker provides a local `DateTimeService`, writes its `dateFormat`
//     into it, and `CustomDateAdapter` formats that picker's native Date. The
//     fixture keeps that isolation observable: a year field showing `03/04/2026`
//     or a day field showing `2026` is wrong in a way a user would notice and a
//     developer would struggle to reproduce from one field alone.
//
//     A year-granularity field needs a full date in the instance — bare `2019` does not
//     reach the control, which is input handling rather than formatting — so the value
//     here is `2019-01-01` and the field should render it as `2019`.
{
  writeRaw(
    '15-date-formats-instance',
    instance('TemporalGranularity', {
      id: 'https://example.org/instances/date-formats-1',
      name: 'TemporalGranularity instance',
      description: 'Two granularities, both filled',
      values: {
        // Deliberately a different year from the day field, and a day-of-month that
        // cannot be mistaken for a month.
        _year_only: typed('2019-01-01', 'xsd:date'),
        _day_only: typed('2026-03-04', 'xsd:date'),
      },
    }),
  );
}

// 16. YouTube content — a full URL, because real CEDAR templates contain both
// full URLs and bare IDs and the old Angular wrapper only handled the latter.
{
  const video = field(
    'video',
    () => CedarBuilders.youtubeFieldBuilder(),
    (b) => {
      b = opt(b, 'withVideoId', 'https://www.youtube.com/watch?v=1NBYWOKo9qo');
      b = opt(b, 'withWidth', 400);
      return opt(b, 'withHeight', 300);
    },
  );
  let tb = common(CedarBuilders.templateBuilder(), 'YouTube', 'templates').withSchemaDescription(
    'A native YouTube embed without the Player API',
  );
  tb = tb.addChild(video, deploy(video, 'video'));
  write('16-youtube', tb.build());
}

/**
 * 17. Files for the host input that fetches.
 *
 * `loadConfigFromURL(url, onSuccess, onError)` is an entry point a host page uses that
 * no test touched, and it is untestable without something to fetch. So this writes what
 * it fetches, under `fixtures/served/`, which the harness page copies into place.
 */
{
  const served = join(OUT, 'served');
  mkdirSync(served, { recursive: true });
  // A config a host would fetch. `showFooter` is the observable part: it is off in the
  // harness's base preset, so seeing a footer means this config was applied rather than
  // the preset's.
  writeFileSync(
    join(served, 'host-config.json'),
    JSON.stringify({ showHeader: false, showFooter: true, defaultLanguage: 'en', fallbackLanguage: 'en' }, null, 2),
  );

  // Deliberately not JSON. `loadConfigFromURL` calls `JSON.parse` on any 200 response
  // with no guard, so this is what a misconfigured URL that returns a page looks like.
  writeFileSync(join(served, 'not-json.json'), '<html><body>not a config</body></html>\n');

  /**
   * An external language map, for the one branch of translation nothing reached.
   *
   * `FallbackTranslateLoader` fetches `<languageMapPathPrefix><lang>.json` through
   * `TranslateHttpLoader` and falls back to the bundled map if that fails. Only the
   * failure side was covered, and by accident: the multi-editor route points at a
   * prefix that does not exist, so every run 404s into the fallback. The success
   * side — an external map fetched over HTTP and winning over the built-in one — ran
   * in no test, which is the wrong half to leave untested when the loader is a
   * third-party package on its own release schedule.
   *
   * `App.Maintained` is the override because it already has an assertion on it, in
   * the footer, so the two readings sit side by side: built-in text without a prefix,
   * this text with one.
   */
  const languages = join(served, 'languages');
  mkdirSync(languages, { recursive: true });
  writeFileSync(
    join(languages, 'en.json'),
    JSON.stringify({ App: { Maintained: 'Maintained per an externally served language map.' } }, null, 2),
  );

  console.log('wrote fixtures/served/ (host config, malformed config, language map)');
}

// 21. Existing temporal values that carry more information than their declared
//     granularity.
//
//     The temporal editor deliberately normalizes these on load. This is a
//     compatibility fixture rather than a screenshot fixture: it proves that a
//     dateTime whose granularity stops at the day loses its old clock value and
//     that fractional zeroes survive when decimalSecond is the requested
//     precision.
{
  const temporal = (name, type, granularity, timezone = false) =>
    field(
      name,
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => {
        let out = b.withTemporalType(type).withTemporalGranularity(granularity);
        if (timezone) out = out.withTimezoneEnabled(true);
        return out;
      },
    );

  const fields = [
    temporal('date_year', TemporalType.DATE, TemporalGranularity.YEAR),
    temporal('date_month', TemporalType.DATE, TemporalGranularity.MONTH),
    temporal('datetime_day', TemporalType.DATETIME, TemporalGranularity.DAY),
    temporal('time_minute', TemporalType.TIME, TemporalGranularity.MINUTE),
    temporal('time_fraction', TemporalType.TIME, TemporalGranularity.DECIMAL_SECOND),
  ];

  let tb = common(CedarBuilders.templateBuilder(), 'TemporalNormalization', 'templates').withSchemaDescription(
    'Existing temporal values normalized to their declared granularity',
  );
  for (const f of fields) {
    tb = tb.addChild(f, deploy(f, f.schema_name ?? 'x'));
  }
  write('21-temporal-normalization', tb.build());

  writeRaw(
    '21-temporal-normalization-instance',
    instance('TemporalNormalization', {
      id: 'https://example.org/instances/temporal-normalization-1',
      name: 'Temporal normalization instance',
      description: 'Values deliberately finer than their template granularities',
      values: {
        _date_year: typed('2026-08-09', 'xsd:date'),
        _date_month: typed('2026-08-09', 'xsd:date'),
        // The offset is undeclared as well as the clock being too precise, so both
        // disappear when the template contract is applied.
        _datetime_day: typed('2026-08-09T21:45:32.125-07:00', 'xsd:dateTime'),
        _time_minute: typed('21:45:32.125', 'xsd:time'),
        _time_fraction: typed('21:45:32.001', 'xsd:time'),
      },
    }),
  );
}
