# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.3] - 2026-08-27

This release aligns CEE's build-time model dependency with the public
`cedar-model-typescript-library@1.0.4` package. The model library remains compiled into CEE's
browser bundle and is not a runtime dependency for embedding applications.

### Changed

- The application and visual-test dependency graphs now pin the same public
  `cedar-model-typescript-library@1.0.4` tarball from npmjs.

## [2.0.2] - 2026-08-27

The second stable release on the 2.x line adds field identities to required-value validation and
bundles the public `cedar-model-typescript-library@1.0.3`. The application and the visual fixtures
use that same model build, so the package exercised in browsers carries the contract those fixtures
were generated against.

### Added

- The data quality report now includes one `required` problem for each unsatisfied required field
  declaration, with the same `path`, `field`, and `inputType` carried by other problems. The report's
  four-member shape, required-field counters, and validity result are unchanged; hosts that already
  read `problems` gain the field identities that the counters alone could not provide.

### Changed

- The application and visual-test dependency graphs now use the public
  `cedar-model-typescript-library@1.0.3` release from npmjs.

## [2.0.1] - 2026-08-21

The first stable release on the 2.x line, published to npmjs as `cedar-embeddable-editor@2.0.1`.
It takes its model library from the public registry — `cedar-model-typescript-library@1.0.2` in
place of the scoped Nexus snapshot the `2.0.0-dev.*` builds carried — so an embedder installs CEE
and the model it speaks from npmjs alone. The entries below were accumulated across those
snapshots, which are recorded individually further down.

### Fixed

- A host's malformed template no longer spends the one assignment it gets. `templateObject`
  and the template half of `templateAndInstanceObject` are set-once, so a payload that the
  parser could not read used up the claim and left the element permanently empty with no
  way to correct it. Each is now parsed into a throwaway context first, and rejected with
  the parser's own reason before the claim is taken.

- Consecutive page breaks produce the blank pages they describe, at the positions they
  describe. The count of breaks in a row was carried forward and the blank pages emitted
  after the next page of content, so a template that broke twice in the middle showed its
  blanks in the wrong order; a trailing break is still a final blank page.

- A widget that a new occurrence has no value for is cleared rather than left showing the
  previous one. The same widget instance is reused as a multi-element pages, and a child
  absent from the occurrence being shown was simply skipped, so the value from the
  occurrence before it stayed on screen while the model held nothing. A temporal field
  clears every part of the instant it had, not only its text.

- Paging between two controlled terms carries the term rather than its label. The registry
  handed an editable controlled field the label alone, so the widget lost the IRI it needs
  for the term's link and could not tell two occurrences with the same label apart.

- Declared text, textarea and controlled-term defaults now enter a newly built
  instance before any widget renders, just as selected choice defaults do. A
  controlled default keeps both its IRI and label, optional multi-choice defaults
  create their own occurrences, and rendering no longer overwrites an explicitly
  blank instance supplied by a host.

- Declared numeric and temporal defaults now follow that same instance-first path.
  Numbers retain their declared XSD datatype; temporal defaults at year, month,
  day, hour, minute, second and fractional-second granularity are normalized to
  complete instance values. Editable controls receive the seeded value, while a
  read-only template view labels it as a default rather than as recorded data.

- A read-only field's occurrence chips no longer land on the facts beside its name.
  The chips are pulled 33px up onto the field's title row, which saves a row while
  the form is editable and that row holds only the field's name; read-only the same
  row carries the field's terse facts. The read-only placement that sits below the
  row had a name nothing matched, so it had never applied.

- A read-only choice group no longer behaves like a control. The value was always
  safe — a change in read-only is reverted before it reaches the instance — but the
  group kept a pointer cursor, a hover ripple, a focus ring and the tab order, so it
  flickered when clicked and arrow keys moved the selection before it snapped back.

- A read-only checkbox draws its box inside its own row. Material insets the box
  11px absolutely to centre it in the 40px control, and read-only shrinks that
  control to 22px, so the box hung below the row and into the label.

- A single-class value constraint is stated as a value rather than as a class. It
  enumerates what the field permits, so `class disease (DOID)` put jargon in front
  of a bare label; it reads `value disease (DOID)`.

- A choice field with no option selected by default no longer records the empty
  string. That was a third state beside the two an empty field has — `@value:
null` for a literal and `{}` for an IRI — and the compact serialization, the one
  that omits an empty field, listed exactly the unanswered radios because of it.

- A read-only temporal box shows each part of the instant cut to the granularity
  the field records. It showed the stored value whole, so a day-granularity field
  asserted a midnight nobody entered and a to-the-minute field a zero second, with
  a serialization's `T` between the halves.

- A value a host pushes into a read-only form is no longer blanked on arrival. The
  rule that clears a template's declared default out of the control tested the mode
  alone, and the view-to-model sync runs on every push; it compares against the
  declared default now.

- A populated multi-select no longer shows a red dropdown arrow. Its Angular
  control holds an array, and shared choice validation coerced that array to one
  comma-joined string before checking membership, so two valid selections were
  rejected as one nonexistent option. Each selected label is now validated
  independently; genuine undeclared values remain invalid.

- A language map named after the artifact now loads. `languageMapPathPrefix` arriving in a `config`
  assigned after the template was lost outright: no request for the map, and every built-in label
  left in place. ngx-translate guards the work twice — `use()` returns at once when the language
  asked for is already current, and behind it the loader is consulted only for a language it holds no
  map for — and a host that renders first and configures second hits both, because the built-in map
  is already loaded under `en` and the late config names `en` again. The map is now refetched and
  republished, which is what makes already-rendered labels re-read it. Only maps loaded before the
  configuration are refetched, so a first config and one naming a different language each fetch once.

- A configuration value CEE cannot use is refused rather than merely reported. The check said
  "Ignored." and the reader then coerced the value: `readOnlyMode: 'false'` locked the form, since a
  non-empty string is truthy, and `terminologyBaseUrl: 7` built the endpoint
  `7bioportal/integrated-search`. A base URL missing its trailing slash was used as well, producing
  `…/terminologybioportal/…`. Every such value now reads as unset, so the setting keeps the default
  it documents, and one bad key costs only that key. CEE does not repair a value either: appending
  its own path to a URL nobody wrote would name an endpoint nobody chose.

- A `config` that is not an object no longer spends the one assignment there is. A host that handed
  over a string was told the configuration was ignored and then had its next, correct assignment
  refused as a second one, leaving an element that could never be configured.

- An element assigned a template and no `config` now renders. It did not: the editor waited for a
  configuration before building, so a host that wanted every default — which every key on
  `CeeConfig` documents, all of them optional — had no way to say so. The element stayed blank for
  good, `currentMetadata` answering `{}` and `currentMetadataYaml` answering `''`, with no error, no
  warning, and nothing tying an empty frame to a key nobody had set. An unset configuration and `{}`
  now mean the same thing.

  Rendering therefore no longer waits for configuration, so for the first time a `config` can arrive
  after the editor is built. It still applies: what it carries reaches already-built widgets through
  services they subscribe to, rather than being read once at construction. The visible cost is that
  a template followed by a config initialises twice, the second time replacing the defaults the
  first installed.

  The gap was invisible to the suites because every test host assigned a configuration — the visual
  harness page always sets one, so nothing ever exercised the smallest thing a host can do. It
  surfaced from the e2e smoke, whose own check had been passing vacuously: it asserted that the
  metadata "is an object", and `{}` is one.

### Added

- A host is told what changed rather than that something did. The `change` event carries a
  `CeeChangeDetail` naming the operation, the template path, the value supplied to it, the
  resulting validity, the whole data-quality report, and the instance's title and
  description; `valueChanged(path, value)` on the event handler receives the same field
  mutations. It fires when the serialized instance actually changed, so focus, blur, paging,
  a read-only control and a write that leaves `currentMetadata` identical produce nothing.
  What a host had before was whatever `change` bubbled out of the root element, which named
  no field and could not distinguish an edit from an edit undone. Dirty state stays the
  host's to keep, since only the host knows which serialization it last loaded or saved.

- The published element type declares the `change` listener, so a TypeScript host reads
  `event.detail` as `CeeChangeDetail` without a cast, and the inherited overloads still
  cover every other DOM event.

- A host can be told when the form is first on screen. `ready` was declared on
  `CeeEventHandler` and called from nowhere, so an embedder that wanted to act once
  the widgets existed had to poll the DOM for them. It now fires once, after this
  element's first completed render, and it does not fire for an artifact CEE
  refused; a handler attached after that render is not sent a replay.

- The identifier of a controlled term or an external-authority value is a link when
  the form is read with a value in hand. It was text inside a readonly `input`, which
  cannot contain an anchor, so a reader had to select and paste it. The authority's own
  link-out keeps its place beside it — for a controlled term those are two different
  destinations: the IRI is what the instance records, the icon is the term's page in
  its ontology. Only an `http` or `https` identifier is linked; anything that
  identifies without locating renders as text, and link fields are left alone.

- The header states what the template says about itself — its `pav:version` and
  whether it is a draft or published — on the icon's row, right-aligned above the
  controls. A reader of a form wants to know which revision produced it and
  whether that revision can still change under them. A template declaring neither
  states nothing rather than guessing.

- A form read with no instance behind it states each field instead of showing an
  empty control: how many values it takes, the shape of one, the permitted values,
  the pattern, the unit, the declared default, and the authorities a controlled
  field draws on, each linked to its BioPortal page. The statement goes in a box
  the size of the control it replaces, so the page still reads as the form it
  stands for, and it wraps where placeholder text would truncate. Radio and
  checkbox groups keep their controls — a set of options already shows what the
  values are — and the option carrying the declared default is marked there.
  Every control returns when an instance is supplied, since then the box has a
  value to show.

- `Compact YAML - Instance` in the download menu writes the model library's
  compact instance form to `<name>-instance-compact.yaml`, omitting root identity
  and provenance metadata while retaining the instance data.

- `Compact YAML - Template` in the download menu writes the model library's
  compact template form to `<name>-template-compact.yaml`, alongside the full
  YAML document rather than replacing it.

- `CeeValidationProblem` declares `field` and `inputType`. Every problem has carried both and the
  validation guide documents both, so the one kind of consumer the declarations exist for was the
  only one that could not read them without a cast.

### Changed

- Every timer and subscription a widget owns ends with the widget. The authority and
  controlled-term fields held `setTimeout` callbacks for opening the autocomplete panel and
  for expiring the reverted and cleared notices, and a panel-closing subscription with no
  teardown, so a field destroyed inside those windows left work that ran against a dead
  component. They are `timer` piped through `takeUntilDestroyed` now.

- The seven authority widgets share one search and lifecycle implementation. ORCID and ROR
  kept their own copies of the pipeline alongside the detail panels that are genuinely
  theirs, so a change here had to be made three times; the panels stay with each widget and
  the rest lives once in the base class.

- The host artifact inputs are accepted as one atomic state. `templateObject`,
  `instanceJsonObject` and `templateAndInstanceObject` overlap and may arrive in any order,
  and the wrapper coordinated them inline, which left a failure halfway through
  initialization able to publish a half-replaced context. A coordinator now parses into a
  candidate context and publishes the completed state, and the inner component renders what
  it is given rather than parsing the artifact a second time.

- Widget subscriptions end with the widget through `takeUntilDestroyed` rather than a
  hand-held `Subscription` per component, which removes the teardown each of the six had to
  implement.

- Work that has to happen after Angular has rendered waits for the render rather
  than for a timer. Pushing model values into live widgets, and the same push after
  a page change or an occurrence added, copied or deleted, was scheduled with
  `setTimeout` — a guess that the components would exist by the next task, taken
  once per call site and in one case twice for one click. One scheduler now owns
  that wait, built on `afterNextRender`, and a newer state supersedes an older one
  instead of both being pushed: several host inputs arriving in one turn, or a
  reader paging faster than the form renders, no longer race. A failed push is
  reported through the message handler rather than lost in a callback.

- The required-field asterisk is the colour of the label it belongs to rather than
  red. A form of required fields opened covered in error-coloured marks before
  anybody had done anything, and a missing value is already reported in the error
  line and in the data-quality report.

- `eventHandler` is documented as replaceable, and replacing one is traced. The published contract
  said every member of the element keeps its first assignment, which was false for the handler and
  meaningless for the three read-only getters. Set-once protects the inputs that decide what the
  editor is; a callback slot decides nothing about the form, and sealing it would have answered a
  host's second assignment by reporting the refusal to the handler being replaced. A handler still
  hears only what follows it, so a page wanting the diagnostics from configuration registers it
  first.

- The ROR mark is inlined instead of fetched. It was pulled from
  `raw.githubusercontent.com/ror-community/ror-logos/main/…` while a form rendered, so every
  embedding told GitHub that someone was looking at a ROR field, from the host application's origin
  — in a component whose fonts and stylesheets travel inside the bundle precisely so nothing is
  fetched. An offline deployment drew no icon, and the URL named a branch rather than a commit, so
  the asset could change without a release. It also decoded late often enough to move two visual
  baselines by 91 pixels a run, which is what surfaced it.

- **BREAKING.** A host names two CEDAR servers and nothing below them. `terminologyIntegratedSearchUrl`
  becomes `terminologyBaseUrl` and `extAuthBaseUrl` becomes `bridgeBaseUrl`, each taking a server
  alone, with CEE appending the routes: `bioportal/integrated-search` on one side, `ext-auth/` and
  the seven authorities' fourteen paths on the other. Those routes belong to the servers they
  address, and hosts had been spelling them out — the terminology endpoint whole, and the bridge's
  `ext-auth/` segment — so they stood written in four deployment configs that would have had to
  change together.

  Neither key has a default now. `extAuthBaseUrl` held a `.orgx` hostname for a year, which resolved
  nowhere off the machine it was written on, and then the production bridge, which the two frontends
  that never set the key reached from a local stack without asking or knowing.

  Both bases must end in a slash, and both are validated for it. Unset, each turns its lookups off
  and CEE reports which key is missing, once, rather than a form of working-looking fields that find
  nothing. That replaces two different silences: controlled-term search returned an empty result
  indistinguishable from a term nobody has, and an authority field threw on every keystroke — right
  while endpoints were always registered from a default, and wrong once their absence became the
  ordinary case of a host that configured no lookups.

- **BREAKING.** The eight diagnostic panels become a download menu, behind one key.
  `showDownloadMenu` replaces sixteen: eight `show…` keys and their eight `expanded…`
  partners. It defaults to `false`, where `showTemplateSourceData` and `showInstanceDataFull`
  defaulted to `true` — so an embedder who configured nothing used to get a JSON Schema dump
  and a JSON-LD dump under every form. The visual suite had been documenting that: its base
  preset switched five panels off and never the sixth, so all 48 fixture baselines carried a
  collapsed JSON-LD panel, which is the 40px every one of them lost. CEE now renders no dumps
  at all; each view is saved as a file named from the template, `AttributeValues-instance.yaml`
  rather than `instance.yaml`, so several open forms do not collide. `SourcePanelsComponent`
  and its 207-line template are gone, replaced by a descriptor list, a pure
  `downloadContentFor` the harness can ask without a browser, and a menu that holds no state.
  Downloads are page-initiated and a sandboxed host can refuse one with no observable event,
  so each attempt is traced through the event handler.

- **BREAKING.** `trustTemplateMarkup` is renamed `trustTemplateRichText`, with no alias. The old
  name claimed a surface far wider than the one it has: a reader could reasonably expect it to
  govern field descriptions, help text or labels, none of which render as HTML. CEE renders HTML
  in exactly two places — the body of a static rich-text field, from the template, and a field
  value in the read-only view, from the instance — and this key governs the first and can never
  govern the second. The new name states both the provenance that makes the trust decision the
  host's to make, and the single surface it applies to. `TemplateTrustService` renames its
  members to match. A host still passing the old key is told the key is unknown and falls back
  to sanitizing, which is the safe direction but a visible change: rich text styled beyond the
  sanitizer's policy will render flattened until the key is renamed.

### Removed

- A placeholder component and an RDF pipe that nothing rendered.

- `Template Rendering Data`, `Multi-Instance Information` and the duplicate
  `JSON-LD - Instance - Core` are no longer in the download menu. The first two
  exposed CEE's private working state rather than a portable CEDAR artifact;
  removing the exports does not remove the internal rendering tree or occurrence
  tracking that the editor itself still uses. `Core` had become a legacy alias
  that downloaded exactly the same canonical document as `JSON-LD - Instance`.

- **BREAKING.** CEE mints no element-occurrence identifiers. It stamped a fresh GUID onto every
  occurrence it built, under `https://repo.metadatacenter.org/template-element-instances/`, on the
  grounds that CEDAR requires an `@id` there. A template's element sub-schema does name `@id` in its
  `required` list, but the validator does not enforce a value for it: measured against the canonical
  `CedarValidator`, an occurrence validates with the key null and with the key absent, and is
  rejected only for a string that is not a URI. The requirement being met did not exist, and what
  was minted was an identity the artifact does not have — different on every build of the same form,
  naming a repository that has never heard of it. An `@id` on an occurrence now only ever arrives in
  a loaded instance, and CEE leaves that one alone: duplicating an occurrence clears the copy's
  rather than reminting it.

  Two builds of the same template are now the same document, which they never were. The harness
  carried a `normalize` that rewrote every minted identifier to `<minted>` before any comparison, so
  that instance snapshots recorded a value meaning nothing; it and four such recordings are gone.
  `addRandomAtId`, `getTemplateElementInstanceIRIPrefix` and `util/iri-prefix.ts` go with them.

- **BREAKING.** `iriPrefix`. It set the prefix an element occurrence's minted identifier was built
  under, and what identified an occurrence was the GUID appended to it — so the prefix carried
  nothing a host could usefully vary, and every host that set it named its own deployment's
  repository, which nothing resolves and the identifier did not otherwise mention. The key went
  first and the minting followed, so nothing is built under any prefix now; the entry above is the
  whole of the current behaviour.

  The key was the only reason `IriPrefix` was a class provided per element rather than a constant,
  so its provider, its three injections — one of which, in the text widget, read it nowhere — and
  the function threaded through `HandlerContext` into `DataObjectBuilderHandler` all went with it.
  Removing the minting then took the constant and `util/iri-prefix.ts` too. What that file existed
  to prove outlives it and is still guarded by `import-boundaries.spec.ts`: the value once lived on
  the editor component, and reading it from the domain layer dragged the whole Angular subtree in
  behind it.

- **BREAKING.** All fourteen per-authority endpoint keys, `<name>IntegratedExtAuthUrl` and
  `<name>IntegratedDetailsUrl`. Each named a path appended to the bridge server's base — the search
  path for a name typed into the field, the details path for an identifier pasted into it —
  and every host that set one set the value CEE already uses, with NIH Grant's and DOI's
  never named by any host at all. The paths are the bridge server's routes, which
  `bridgeBaseUrl` already identifies, so a host free to move them could only move them
  somewhere nothing answers. Both endpoints are unchanged and still used: pasting an ORCID,
  a DOI or a PubMed ID resolves through the details path rather than running a name search.
  A deployment now moves all fourteen endpoints by moving the base URL, or none of them, and
  a host still passing a retired key is told it is unknown and ignored.

  With them goes the index signature on `CeeConfig`, which existed to carry them. The
  interface is closed: every key a host can set is declared, so a misspelling is a compile
  error rather than a silent no-op reported only at runtime. `CeeConfigKey` becomes
  `keyof CeeConfig` — it was `Exclude<keyof CeeConfig, number | symbol>`, which is what an
  open interface costs. `CeeAuthority` is removed; it named the authorities only to describe
  the keys that are gone.

- **BREAKING.** `bioPortalPrefix`, and a broken link it half-governed. It was named as a prefix
  and used as a base for the "read about this term" link out to BioPortal's web UI, which is
  BioPortal's address rather than a deployment's to set. It governed only two of the three
  constraint kinds that reach that link: a branch was linked through its own `source`, and
  `source` is not a URL. Across the corpus a branch carries `"Medical Subject Headings (MESH)"`,
  or the FDC-GDMT ontology's full name, or occasionally a bioportal.bioontology.org URL — so two
  shapes out of three produced `Medical Subject Headings (MESH)?p=classes&conceptid=…`, a
  relative link resolved against whatever page CEE was embedded in. Every kind is now built the
  same way, from the acronym each reliably carries, and the acronym is escaped rather than
  concatenated. The link moves to `bioPortalTermLink`, a plain function the harness covers
  against the real constraint shapes, where nothing covered it before. `IriPrefix` is left
  holding the one prefix that is genuinely a prefix.

- **BREAKING.** `orcidPrefix` and `rorPrefix`. Neither was a prefix: nothing minted or built a
  URL from them, they recognised one. Each was interpolated straight into
  `new RegExp('^' + prefix)`, so every `.` in the configured URL matched any character and a
  prefix carrying a regex metacharacter matched something else again or threw. They also existed
  for two of the seven authorities CEE knows, so the same value in a DOI, PubMed, RRID, PFAS or
  NIH Grant field got none of the treatment. What they gated stays: a read-only text field holding
  an `https://orcid.org/` or `https://ror.org/` value still renders as a link with the registry's
  icon, showing the identifier rather than the whole IRI. It now tests fixed constants with
  `startsWith` and builds no regex at all, because a registry's own IRI is not a deployment's to
  configure. The two prefixes that were genuinely a deployment's — `iriPrefix`, which minted IRIs
  into the instance, and `bioPortalPrefix`, which built the link out to BioPortal's web UI — are
  retired in their own right, above and below.

- **BREAKING.** `showHeader` and `showFooter`, and the header and footer they gated. CEE drew
  a `mat-toolbar` carrying the CEDAR logo and the title "CEDAR Embeddable Editor", and a footer
  carrying the Stanford Division of Computational Medicine mark, the maintainer line and a
  contact link. Every string and every destination was hardcoded, so an embedder could take
  CEDAR's identity or nothing, and the key names said "header" and "footer" as though a host
  could put its own there. An embedded component has no business drawing the page around
  itself: a host renders its own, and the standalone developer app now does exactly that as a
  worked example. The CEDAR mark and the version stamp stay, inside the form's own title block,
  which is a component naming itself rather than dressing someone else's page. Gone with them:
  the `App.Title`, `App.Maintained` and `App.Contact` translations from both language maps, and
  the visual suite's `chrome` preset and its two baselines. The suite's only rendered surface
  for an externally served translation was the footer, so that coverage moves onto the form's
  own Expand All label, which renders on every template behind no key.

- **BREAKING.** `inputSerialization`, `outputSerialization` and the
  `currentMetadataSerialized` accessor that existed for the second of them. CEE now picks the
  template reader from the template. The two CEDAR serialisations do not resemble each other,
  and it is measured rather than assumed: across the 37 corpus templates, each shipped in both
  forms, eighteen top-level keys appear in every JSON template and in no YAML one — `@context`,
  `@type`, `properties`, `$schema`, `_ui` and the `pav:` and `schema:` families among them —
  while `modelVersion`, `name`, `status` and `version` appear in every YAML template and in no
  JSON one, with no key shared between the sets. All 94 JSON templates the harness carries,
  including vendored HuBMAP production artifacts, have both `@context` and `properties`. So
  `inputSerialization` asked a host to declare what the artifact already states.
  `outputSerialization` only chose what a third output accessor returned; `currentMetadata` and
  `currentMetadataYaml` are unconditional and unchanged, so a host reads whichever it wants and
  the call site now says which format it expects. YAML template support is untouched:
  `parser-selection.spec.ts` asserts every corpus template in both forms selects the reader that
  can read it, and `format-independence.spec.ts` still requires both readers to produce identical
  trees.

- **BREAKING.** CEE no longer fetches artifacts. The sample-template loader took
  `sampleTemplateLocationPrefix` and `loadSampleTemplateName`, built
  `<prefix><name>/template.json` and `<prefix><name>/metadata.json`, fetched both and
  assembled them into `templateAndInstanceObject`. It was the only path where CEE reached
  the network for an artifact, and the only one that could reassign one — it bypassed the
  assign-once claims deliberately, because it loaded a different sample on every click.
  A host supplies its artifact by assigning a parsed object, which is what every route
  now does. Removed with it: `showSampleTemplateLinks` and `expandedSampleTemplateLinks`,
  which showed the picker listing what had been fetched; `SampleTemplatesService`, the
  two picker components and the `SampleTemplateLoaderOwner` model; and the
  sample-registry fixtures the visual suite served. The standalone developer app now
  fetches its own demo from `src/assets/cee-demo` and assigns it, like any other host.

- **BREAKING.** `hideEmptyFields`, and the empty-field hiding it switched on. In read-only mode
  it dropped every field the loaded instance had no value for. It worked only when the artifact
  arrived on `templateAndInstanceObject`: the form is built when the template lands, and on the
  two-input route nothing has read the instance by then, so no field is yet known to be empty.
  Three of the six known consumers use that route, where the key silently did nothing and the
  validator said nothing either. Rebuilding it properly means changing when the form is built,
  which is the same ordering the assign-once contract rests on, so it is removed rather than
  half-fixed. Gone with it: `HandlerContext.hideEmptyFields` and `enableEmptyFieldHiding`, the
  factory's `applyEmptyFieldHiding`, `hasNonEmptyChild` and `getValueByPath`, and
  `ActiveComponentRegistryService.setVisibility` with the `getFieldComponents` it used. Fields
  hidden by the template's own `_ui.hidden` are unaffected — that is `hiddenInTemplate`, a
  separate flag on a separate path, and it still hides.

- **BREAKING.** `showSpinnerBeforeInit`, and the placeholder it switched on. Before a template
  arrived the wrapper drew a 24px indeterminate spinner beside the translated string "CEDAR
  Embeddable Editor initializing...", and a host could suppress it but not replace it — so an
  embedder's only choices were CEDAR's branding during every load or an empty box. The editor
  renders as soon as `editorDataReady()` is true either way; nothing now occupies the interval
  before it. Gone with it: the `Process.Initializing` translation group from both language maps,
  the `.spinner-wrapper` style, and `MatProgressSpinnerModule` from the shared module, which no
  remaining component there uses.

- **BREAKING.** `showAllMultiInstanceValues`, and the "All Values" summary it switched on.
  The summary listed every occurrence of a multi-instance field above that field, and had
  never once rendered as designed. Its occurrence numbers were meant to be the grey chips the
  pager itself uses — `.multiinfo-index` styles them, and `.not-first-multiinfo-index` puts a
  15px gap before each one — but the strip was built as an HTML string and injected through
  `[innerHTML]`, and Angular's emulated encapsulation scopes component styles by an
  `_ngcontent-*` attribute that injected nodes never receive. So none of it applied: the
  numbers rendered as bare text with no gap, and `1 Alpha2 Beta3 Gamma` read as four values
  rather than three. An occurrence with no value printed the literal word `null` on top of
  that. Gone with it: `getMultiInstanceDataValueInfo`, `shortValue` and the 30-character cap,
  the pager's `ngDoCheck`, the `Generic.AllValues` translation in both language maps, the
  three `multiinfo-index` rules, and the global `.info-box` style they used.

- **BREAKING.** `collapseStaticComponents`, and the collapsing it switched on. A lone image,
  video or rich-text static immediately before a field or element was removed from the sibling
  list and re-attached inside that successor, recursively through nested elements. For an
  element it went further and replaced the element's own heading with the static's label, so a
  group of questions could lose its name to a decorative video: in the `18-real-nested` fixture
  the panel titled "All Field Types (single)" rendered as "YouTube Video". Static content now
  renders where the template puts it, which is what the key's own default already did. Gone with
  it: `linkedStaticFieldComponent` from the component model, the
  `CedarComponentLinkedStaticFieldHeaderComponent` that drew the substituted heading, and the
  `cee-element-content-with-static` spacing rule.

- **BREAKING.** `showStaticText`. The key read as a switch over a template's static content
  and was never that. It could hide only a lone image, video or rich-text block that the
  renderer had absorbed into the item following it; section breaks, page breaks and any static
  paired with another static were untouched. It was also consulted on only one of the two
  branches that draw an absorbed static, the one where the item is a field rather than an
  element, so whether the key did anything depended on what a template author happened to put
  after the static. It defaulted to on, and removing it leaves rendering unchanged for every
  template in the fixture corpus. A host still passing the key is told it is unknown, by the
  same configuration validator that reports any other unrecognised key.

## [1.6.0] - 2026-08-13

The first stable release since 1.5.2, published to npmjs as `cedar-embeddable-editor@1.6.0`.
It carries the Angular 14 → 22 migration and a host contract that is now stated rather than
implied. The dated `1.6.0-dev.*` sections below record how it was reached, one build at a
time; this section is what changed between 1.5.2 and 1.6.0.

### Added

- TypeScript declarations for the host contract, shipped with the package: `CeeConfig`,
  `CeeEventHandler`, `CeeDataQualityReport` and the artifact types. A host now gets a compile
  error for a misspelled key or a wrong value.
- Configuration validation where a configuration crosses the custom-element boundary. Unknown
  keys, wrong value types and settings that contradict each other are reported through the
  event handler. Reporting only: a bad key is ignored as it always was, and the host is told.
- YAML as an artifact serialization, both directions. `inputSerialization` accepts a template
  parsed from CEDAR YAML, `outputSerialization` selects the form `currentMetadataSerialized`
  returns, and `currentMetadata` and `currentMetadataYaml` are always available regardless.
- Source panels showing the template and the live instance as CEDAR YAML, through
  `showTemplateYaml` and `showInstanceYaml`, each expanding independently.
- `trustTemplateMarkup`, for hosts whose template authors are as trusted as their own code.
- `--cee-element-heading-size`, `--cee-element-heading-weight` and `--cee-element-content-gap`
  as host-settable custom properties.

### Changed

- **BREAKING.** Every input on the custom element takes one assignment and keeps it. A second
  assignment to `config`, `templateObject`, `instanceObject` or `templateAndInstanceObject` is
  reported through the event handler and ignored, and the first value stands. A host wanting
  different configuration or a different artifact creates a new element. The element previously
  only accumulated state, so it could not be returned to a known state and the same assignments
  in a different order produced a different editor.
- **BREAKING.** `readOnlyMode` is the only way in or out of read-only mode, and it reaches the
  widgets directly rather than through a UI control.
- **Angular 14.3 → 22.1.** Eight major versions. The build runs through
  `@angular/build:application` and the webpack `browser` builder and
  `@angular-devkit/build-angular` are gone; all 203 `*ngIf` and `*ngFor` sites moved to block
  control flow; TypeScript `strict` is on throughout, including the domain harness. Building
  CEE now requires Node `^24.15.0`. The published package declares no `engines` and no
  dependencies, so this constrains building CEE, not embedding it.
- **The instance CEE edits is a model rather than a CEDAR document.** CEE names no CEDAR
  serialization key outside its two wire adapters, and reads no key constant from the model
  library. Requires `cedar-model-typescript-library@1.0.0`.
- Each editor owns its own services, endpoints, language settings, preferences and IRI
  prefixes, and releases its registrations and its shadow-local overlay and accessibility nodes
  when destroyed. Two editors on one page no longer interfere.
- CEE and Angular Material styles are encapsulated in the custom element's shadow root.
- The temporal editors are rebuilt around one temporal value, covering date, time and timezone.
- A typed field reports its validation error on blur rather than on every keystroke.
- Read-only mode hides the multi-instance pager for a group holding one instance or none.
- An attribute name the user types is validated where they type it and refused with a message
  under the field, rather than being renamed to `Attribute Value Field<N>` and reported in a
  toast after the name had been thrown away.
- Timezone data is current. `moment-timezone` was pinned to a release carrying stale tzdb.
- The version names the commit whose content it carries.

### Removed

- **BREAKING.** The preferences menu and its read-only switch, along with the
  `showPreferencesMenu` key. The switch wrote to the same state the widgets read, so a form
  embedded as a viewer could be made editable from inside it.
- **BREAKING.** `loadConfigFromURL`. It was a second way to spend the single configuration
  assignment and raced a host that also assigned `config` directly. A host that keeps
  configuration in a deployed file fetches it and assigns the result.
- **BREAKING.** `BrowserAnimationsModule`, and with it the `@angular/animations` dependency.

### Fixed

- Attribute-value fields, across the whole surface: a field stays editable after a host saves
  an instance and injects it back; it keeps the name the user typed; a copy is named
  `<name> copy` and then `<name> copy 2` until the name is free; renaming or clearing one
  occurrence no longer deletes a property another occurrence still carries; a slot the loaded
  instance has no key for can be filled in; and the JSON-LD and YAML panels show the field as a
  CEDAR document rather than CEE's internals.
- `hideEmptyFields: true` never survived startup, so the key did nothing. Both artifact setters
  cleared it after the configuration had set it. It is honoured on `templateAndInstanceObject`;
  on the two separate inputs the form is built before the instance is read, so no field is
  known to be empty, and that limit is asserted rather than hidden.
- External authority fields distinguish a lookup that failed from one that matched nothing, no
  longer read a response shape no authority sends, and no longer offer a populated field's own
  value back as its one suggestion.
- A failed terminology lookup no longer ends a controlled-term field's `valueChanges` pipeline.
- An open suggestion panel stays with its field while the host page scrolls.
- The multi-instance pager marks the page it is actually showing, and its actions align with
  its chips and reflow beneath them below 620px.
- Static fields: an image honours the width and height its template asks for and is centred, a
  YouTube field renders at its declared size, an image URL that cannot be loaded is reported
  instead of drawing an empty card, and a YouTube link that cannot be embedded explains why.
- A numeric field renders its unit only when the template declares one.

### Security

- Static rich-text fields are sanitized by default. A template author's markup previously
  rendered verbatim in the host's origin; `trustTemplateMarkup` opts back out.
- Links in template rich text that open a new tab are given `rel="noopener noreferrer"`.
- `lodash-es` moves to 4.18.1 and Vitest to 4.1.10, clearing the high-severity advisories a
  production audit reported.

## [1.6.0-dev.20260812.b953153] - 2026-08-12

### Changed

- **BREAKING.** Every input on the custom element takes one assignment and keeps it.
  A second assignment to `config`, `templateObject`, `instanceObject` or
  `templateAndInstanceObject` is reported through the event handler and ignored, and
  the first value stands; a host wanting different configuration or a different
  artifact creates a new element. The element previously only accumulated state — a
  second `config` patched the first for most keys and replaced it for
  `outputSerialization`, and three inputs could each supply an artifact with nothing
  saying which won — so a host could not return it to a known state, and the same
  assignments in a different order produced a different editor. `templateObject` and
  `instanceObject` remain independent and may be assigned in either order;
  `templateAndInstanceObject` supplies what both do and cannot be combined with
  either.
- **BREAKING.** `readOnlyMode` is the only way in or out of read-only mode, and it
  now reaches the widgets directly. It used to travel through the preferences menu:
  the host's flag was an input on that component, whose setter wrote to the state the
  widgets subscribe to. So host configuration reached the form only by passing through
  a UI control, which is how that control came to be able to override it, and why the
  menu had to stay instantiated even when configured invisible or read-only never
  arrived at all.

### Removed

- **BREAKING.** The preferences menu and its read-only switch, along with the
  `showPreferencesMenu` key that governed the menu. The switch wrote to the same state
  the widgets read, so a form embedded as a viewer could be made editable from inside
  it — and a host offering its own save button would then store the edits. Read-only is
  the host's decision, and the menu had nothing else in it.
- **BREAKING.** `loadConfigFromURL`. It was a second way to spend the single
  configuration assignment and raced a host that also assigned `config` directly; the
  method carried a note saying CEE should not need to know how to fetch. A host that
  keeps configuration in a deployed file fetches it and assigns the result.

### Fixed

- `hideEmptyFields: true` never survived startup, so the key did nothing on the one
  input that honours it. Both artifact setters cleared the flag, on the reasoning that
  a new artifact invalidates a hiding decision made against the old one, and on the
  single pass an artifact gets the clear ran after the configuration set it. Nothing
  caught it because the only test of the key exercised the wrapper alone, with no child
  editor and no template — it watched the flag being set and never saw either setter
  run. The key now has behavioural coverage on the combined input, and the separate
  inputs' failure to honour it is asserted as the build-ordering limit it is.

## [1.6.0-dev.20260811.c67ccae] - 2026-08-11

### Fixed

- The YAML source panel shows an attribute-value field the user has been editing. CEE
  holds one as name slots plus sibling atoms, which is the shape the pager edits, and
  the library's YAML writer understood only the packed form its own reader produces —
  so the field name disappeared and its attributes were written as ordinary children.
  The AV-only YAML output is asserted in the harness.

### Changed

- Requires `@org.metadatacenter/cedar-model-typescript-library@0.9.2-dev.20260811.d87b47c`,
  which fixes that and exports `AttributeValueNamePolicy` — the library's own account of
  the namespace an attribute name enters, which the reserved set CEE holds locally was
  written to match, and which its `InstanceValidator` now enforces.

## [1.6.0-dev.20260811.feaebdb] - 2026-08-11

### Added

- Two source panels showing the template and the live instance as CEDAR YAML, written
  by the model library's YAML writer. Both are opt-in, through `showTemplateYaml` and
  `showInstanceYaml`, and each expands independently through `expandedTemplateYaml` and
  `expandedInstanceYaml`. The four keys are declared on `CeeConfig`, checked by the
  config validator, and titled in the English and Hungarian language maps.

### Changed

- The instance panels are written with the source template in hand, which is what the
  model library's writer needs to produce the document a host reads back.
- The source panels' styling lives in the component's own stylesheet rather than in the
  global sheet, and the panels are more compact. The visual baselines are re-recorded.

## [1.6.0-dev.20260811.563e8b6] - 2026-08-11

### Fixed

- The multi-instance pager marks the page it is actually showing. Selection was
  declared on each chip with `[selected]`, which the chip listbox does not track, so
  after cloning or paging the highlighted chip and the occurrence on screen could
  disagree. The listbox now holds the selection and each chip declares its own value.

### Changed

- A duplicate attribute name is reported as already used "in this instance" rather
  than "on this object", which is what a person filling in a form is looking at.

## [1.6.0-dev.20260811.72892c7] - 2026-08-11

### Changed

- An attribute name the user types is validated where they type it, and refused with a
  message under the field: one already used by a sibling attribute or reserved by a
  template child, and one reserved for instance metadata, which is any name starting
  with `@` plus the envelope and label keys. A collision used to be renamed to
  `Attribute Value Field<N>` and reported in a toast, so a name the user had typed was
  thrown away. The model is left alone while the name is invalid, and the error clears
  when the field is loaded again. The reserved set is held here in step with the model
  library's `AttributeValueNamePolicy` until the next library package is published.

### Fixed

- Copying an attribute-value occurrence names the copy `<name> copy`, then `<name>
copy 2` and so on until the name is free, rather than producing a collision the
  handler had to resolve. If no name is free the copy is left unnamed and the failure
  is reported. The registry's guess at which occurrence was a clone — comparing a slot
  with the one before it — is gone.
- Renaming or clearing one occurrence no longer deletes the property while another
  occurrence still carries that name. The old check compared the name's first index
  against the slot being edited, which is not the same question.

## [1.6.0-dev.20260811.2db8763] - 2026-08-11

### Fixed

- The "JSON-LD - Instance" panel, and its copy button, show the instance as a CEDAR
  document. Both rendered `instanceFullData` through the `json` pipe, which is a
  `TemplateInstance` since the model move, so a user asking to see or copy their
  metadata got `_values` and `_iris` — CEE's internals. They now render what the
  model library's writer produces. The panel that leaves the envelope off was
  corrected earlier; this is the one that keeps it.

## [1.6.0-dev.20260811.61ac9c2] - 2026-08-11

### Fixed

- An attribute-value field stays editable after a host saves an instance and injects it
  back. The model reader pairs the wire form's list of names with their sibling values
  into an `InstanceDataAttributeValueField`, which reads well and is not a list; the
  pager treated it as one and crashed on the first change-detection pass. A loaded
  instance is brought to the typed list shape CEE creates and edits, once, at the input
  boundary.

## [1.6.0-dev.20260811.26630a1] - 2026-08-11

### Fixed

- An attribute-value field keeps the name the user typed. The widget is handed a
  one-entry name/value view the active-component registry projects from the instance,
  and it guarded that view with the model library's `isInstanceObject`, which tests
  for an `InstanceDataContainer`. A plain projected object is never one, so the guard
  rejected every payload and cleared both controls on each sync. The guard now
  describes the view the registry actually sends, and accepts a name whose value is
  not filled in yet. The visual test that fills a name asserts the name is still
  there afterwards.
- An open suggestion panel stays with its field while the host page scrolls, rather
  than holding its original position over unrelated fields. It affected every
  autocomplete — the seven authority fields and controlled terms — and every select.
  Neither of Material's scroll strategies can reach this case: the default filters
  scroll events to `cdkScrollable` ancestors, and the container CEE scrolls inside
  belongs to the embedding page, while the close strategy listens on `document` in
  the bubble phase, which a `scroll` event never reaches. The strategy here listens
  in the capture phase and repositions from the origin's own rect. A scroll inside
  the panel is ignored, so reading a long suggestion list does not move it.
- A populated authority field no longer offers its own value back as its one
  suggestion, and focusing one sends no lookup for the compound `Label - iri` string.
  The autocomplete is disabled while the box shows the term already chosen, and
  re-enables on the first keystroke.
- A static image field is centred. `margin-left: auto` and `margin-right: auto` never
  applied, because an `img` is inline and an inline element ignores auto margins;
  `display: block` is what makes them mean anything.

### Removed

- The khaki background declared on the image field's card. Material sets the card
  background at a higher specificity, so no one has ever seen it — the card has
  always been white, like every other field.

### Fixed

- An attribute-value field the loaded instance carries no slot for can be filled in.
  A template declares the property and an instance need not carry it, so a field
  nobody has filled in arrives with nothing at that path. The add had no list to put
  an occurrence into and turned the click away, leaving a field that could not be
  used and reported it only in the console; the list the template implies is now
  created. A node holding something other than a list is left alone. The "All
  values" summary no longer reports the same absent node as an error on every
  change-detection pass.

### Changed

- Every screenshot is judged by an absolute pixel budget rather than a ratio of the
  page, so a localised change to a tall page is no longer forgiven in proportion to
  the page's height.
- Takes the model library build that inflates an omitted attribute-value field to an
  empty list rather than an empty node, which is the other way a document reaches
  CEE with nothing usable at that path.

## [1.6.0-dev.20260810.ab37f62] - 2026-08-10

### Changed

- CEE reads no key constant from the model library. It imported two — the name given to
  an attribute whose name collides with another, which is CEE's own product decision and
  now lives here, and the namespace property IRIs are minted in, which the library exposes
  as `PropertyIri` along with both ways one is arrived at. Neither was a serialization key.
- Requires `@org.metadatacenter/cedar-model-typescript-library@0.9.2-dev.20260810.b48728a`,
  which stops exporting `JsonSchema`, `YamlKeys` and `CedarModel`. Those are the spelling
  tables its readers and writers use to describe a document; a consumer works in artifacts
  and asks for a serialization by name, at the edge, from a writer.
- The external authority service no longer reads a response shape no authority sends. A
  branch handled `results` arriving as a list of terms and named the keys such a term would
  carry; it came from a guard in the widget one layer downstream, where the value being
  tested was the service's own output. A response that is not the documented map now yields
  no terms.

## [1.6.0-dev.20260810.e4b63f4] - 2026-08-10

### Changed

- The instance CEE edits is a model rather than a CEDAR document. `DataContext.instanceFullData`
  holds a `TemplateInstance`, so CEE no longer writes the `@context` block, the nine envelope
  keys or a minted `@id` per occurrence — how any of that is written down is asked once, at the
  edge, by the model library's writer. Gone with it: the five value keys CEE kept in order to
  clear a stale one when a field changed kind, the in-place value overwrite the widgets needed
  while nodes had identity, the round trip that handed the library's reader the tree CEE had
  just edited, and the projections that rebuilt a parsed model as plain objects.
- The data quality report hands a host page the instance as a document, under `instance`. It was
  `instanceExtractData`, the envelope-free view of a tree that was itself a document; handing
  out the model's container would have shown a host `_values` and `_iris`.
- Requires `@org.metadatacenter/cedar-model-typescript-library@0.9.2-dev.20260810.cc9ff84`, which
  refuses to construct a value that is not a value or a controlled-term constraint that points at
  nothing, and which lets a container be edited through its own methods rather than through the
  two dictionaries it exposes for reading.

### Fixed

- The source panel shows the instance as a document again. It rendered the working tree through
  the `json` pipe, which showed a user their metadata while the tree was a document and CEE's
  internals once it was not.
- An attribute-value slot added with the pager, or produced by copying an occurrence, stays
  unnamed until the user names it, and an unnamed slot is left out of the pager's summary.

## [1.6.0-dev.20260809.9755ad1] - 2026-08-09

### Changed

- CEE no longer names a CEDAR serialization key outside its two wire adapters. The authority
  layer — ORCID, ROR, and the five simpler authorities, plus the terminology server's integrated
  search — held its terms as `{'@id', 'rdfs:label'}`, borrowing the model library's key constants
  for HTTP responses that have nothing to do with CEDAR's JSON. Terms are now `{iri, label}`. The
  three keys that remain are read where an external service sends them, and converted on arrival.
- Because those constants are declared `string` rather than as literals, an interface keyed by them
  became an index signature over every string key. That is what made a `details` member untypeable
  and forced 20 `as string` casts; all of it is gone.
- An attribute-value slot added with the pager, or produced by copying an occurrence, stays unnamed
  until the user names it. It used to be given `Attribute Value Field1` on the next sync, so a user
  who clicked "+" and stopped had a property in their instance they never asked for.

### Fixed

- Static image and YouTube fields, temporal inputs, section breaks, radio controls, pager actions
  and nested element headings all take the styling pass's corrections; the visual baselines they
  left behind are re-recorded.

## [1.6.0-dev.20260809.604e9e6] - 2026-08-09

### Added

- Static image fields honour the width and height a template asks for. The previous release
  recorded that they could not, because the model library carried `width` and `height` on its
  YouTube field alone. `0.9.2-dev.20260808.92f3412` carries them on the image field too, and CEE
  now reads them. A template declaring no size leaves the attributes unset, so the browser uses the
  image's own dimensions, while a static YouTube field, having no intrinsic size of its own, still
  falls back to 640 × 390.
- The instance-conformance spec runs in the domain harness. It builds CEE's instance for each
  corpus template and validates it against that template with the model library's
  `InstanceValidator`, so a dropped `@type` or a missing property fails the gate.
- `--cee-element-heading-size`, `--cee-element-heading-weight` and `--cee-element-content-gap` on
  the element, so an embedder can adapt the typography and density of a nested element's heading
  and content without acquiring a second say in the template's structure.

### Changed

- The build runs through `@angular/build:application`. The webpack `browser` builder is gone,
  along with the dev-server and extract-i18n builders beside it.
- `@angular-devkit/build-angular` is no longer a devDependency. Nothing had referenced it since the
  builder move, and removing it takes 427 packages and eight `npm audit` findings with it, every
  high among them. `npm run audit:prod`, which describes what an embedder downloads, reported 0
  before and after.
- TypeScript `strict` is on throughout, including the domain harness, which previously opted out.
- The model library moves to `0.9.2-dev.20260808.92f3412` in the application, the harness and the
  visual suite together, since a skew between them would mean the domain tests and the bundle
  disagreed about the model.

### Fixed

- `CeeDataQualityReport` names the problem array `problems`, as the report has always carried it.
  The declarations called it `validationProblems`, so a TypeScript host reading that member
  compiled and received `undefined`. Hosts using the published declarations should rename their
  reads.
- `cee-public-api.spec.ts` holds the report types against the objects behind them. It checked the
  configuration keys only, which is how the name drifted unnoticed.
- Read-only mode hides the multi-instance pager for a group holding one instance or none, rather
  than showing a control that offers nothing.
- The attribute-value widget labels its value input `Generic.AttributeValue` instead of repeating
  the name input's label, and floats both labels so neither collapses over a filled value.
- The multi-instance pager's actions align with its chips, and reflow beneath them below 620px
  rather than overhanging the container.
- A numeric field renders its unit only when the template declares one, with spacing that keeps it
  clear of the input.
- The page-break paginator drops the 64px of margin Material reserved for a range label the
  component hides, and gives its arrows a 44px target.

## [1.6.0-dev.20260809.8127503] - 2026-08-09

### Added

- TypeScript declarations for the host contract, shipped with the package: `CeeConfig`,
  `CedarEmbeddableEditorElement`, the report and event-handler types, and an
  `HTMLElementTagNameMap` entry so `document.querySelector('cedar-embeddable-editor')` is
  typed without a cast. Types only — the bundle registers a custom element and exports no
  values, so use `import type`.
- Configuration is checked when it crosses the custom-element boundary. Unknown keys are
  named with the nearest real key suggested, values of the wrong kind say what was
  expected, and conflicting settings are reported. This covers the two routes a compiler
  cannot: a JavaScript host, and `loadConfigFromURL`. Reporting only — a key CEE cannot
  use is ignored as it always was.

### Changed

- The version names the commit whose content it carries. `-ng22` named the branch that
  produced the build and `-eN` counted local deploys from it; both stopped meaning
  anything once that branch was merged and CEE went back to being developed on
  `develop`. A published build is now `1.6.0-dev.<date>.<sha>`, which identifies exactly
  one set of bytes and says where to read them.

- The temporal editors are rebuilt around one temporal value. Date, time and timezone
  are parsed, normalized and rendered through `CedarTemporalValue` rather than each
  picker carrying its own string handling, so a field's granularity decides what is
  shown and what is written. The time and timezone pickers were reworked to match.
  Existing values are normalized on load: information finer than the template's
  declared granularity is intentionally discarded, hidden parts are padded to a
  canonical complete XSD value, and an offset is removed when time zones are disabled.

- A typed field reports its validation error on blur rather than on every keystroke,
  so an address, email, phone number or URL is not marked invalid while it is still
  being typed.

- A static YouTube field renders at the size its template asks for. `_ui._size` was
  read by nobody: the component carried 640 × 390 as two fixed values, so every video
  was that size whatever the template said. The corpus asks for 400 × 300 six times
  and 192 × 108 four times. A template that sets no size still gets 640 × 390, and a
  dimension that cannot be a size — zero, negative, not a number — falls back on its
  own rather than taking the other with it.

  Static **images** still ignore `_ui._size`, and cannot honour it: the model library
  models `width` and `height` on its YouTube field and not on its image field, so an
  image's size is gone before CEE can see it.

- Templates use Angular's block control flow. All 203 `*ngIf` and `*ngFor` sites across
  33 templates are now `@if` and `@for`, migrated by
  `ng generate @angular/core:control-flow`. The directives have been deprecated since
  Angular 20 and are intended for removal in a later major. Nothing renders differently
  — all 108 pixel snapshots match — and the bundle is 17,912 bytes smaller, since the
  blocks compile to instructions rather than pulling the directives in.

### Removed

- `BrowserAnimationsModule`, and with it the `@angular/animations` dependency. Angular
  deprecated the module at 20.2 and intends to remove it at 23. CEE declares no
  animation of its own, and Material 22 animates in CSS without that package, so
  nothing changes visually — 64,099 bytes leave the bundle.

### Fixed

- Timezone data is current. `moment-timezone` was pinned to a release carrying tzdb
  2023c, so the timezone picker computed offsets from rules three years old and
  stamped them into instances. `Asia/Almaty` read `+06:00` after Kazakhstan unified
  the country to UTC+5 in March 2024, and `America/Asuncion` read `-04:00` after
  Paraguay abandoned daylight saving the same year. Now tzdb 2026c — and the bundle
  is 60,655 bytes smaller, since the newer packed dataset is smaller despite
  covering three more years.

### Security

- Vitest moves from 1.6.1 to 4.1.10, in the root and the harness together, clearing
  the critical advisory that lets a listening Vitest UI server read and execute
  arbitrary files. Nothing shipped is affected: this is test tooling, and CEE never
  had `@vitest/ui` installed. The exposure was one command away rather than present,
  since the harness declared a `test:ui` script for a package that was not a
  dependency — that script is removed. Both projects had to move at once: the harness
  sets its Vite root to the repository, so a split loads the root's worker and dies
  with `No handler function exported`. A root audit falls from 19 findings to 12, both
  criticals among the seven, and the harness now reports none.

- `lodash-es` moves to 4.18.1, clearing the one high-severity advisory group a
  production audit reported against 4.17.21 — code injection through `_.template`,
  prototype pollution through `_.unset` and `_.omit`. CEE calls only `cloneDeep`, so
  no advisory described a path this code could reach, but a flagged package is one
  every embedder would otherwise have to reason about themselves. The shipped bundle
  is byte-for-byte unchanged by the upgrade.
- Static rich-text fields are sanitized by default. A template author's markup previously
  rendered verbatim, so an embedder that let its users choose a template gave those users
  script execution in the embedder's origin — a property documented only in a source
  comment. Script, event handlers, `javascript:` URLs, frames, form controls and AngularJS
  directive attributes are removed; inline styles, tables, lists, links and raster `data:`
  images are kept, so the formatting the field exists for is unaffected. Angular's own
  sanitizer cannot do this: it drops the `style` attribute that 99 of the 271 static
  content blocks in the CEDAR, HuBMAP and test-artifact corpora carry.
- Added the `trustTemplateMarkup` configuration key, default `false`, for hosts that
  control which templates load and want the author's markup rendered as written. The
  README's new _Embedding security_ section says who should set it and who should not.
- Links in template rich text that open a new tab are given `rel="noopener noreferrer"`.

### Fixed

- A static rich-text field's body renders in a `div` rather than a `p`. Rich text is block
  content, which a `p` cannot contain, so the browser was silently reparenting it.

## [1.6.0-dev.20260806.62725e3] - 2026-08-06

### Fixed

- Static image fields report a URL that cannot be loaded instead of rendering an empty card, and
  fall back to the field label when `schema:description` is empty rather than emitting `alt=""`.
- Static YouTube fields explain why a link cannot be embedded — a playlist or channel link, a
  non-YouTube host, or an invalid video ID — instead of rendering an empty card.
- Controlled-term and external-authority fields distinguish a failed lookup from one that matched
  nothing, rather than labelling both "No results found".
- A failed terminology lookup no longer ends the controlled-term field's `valueChanges` pipeline,
  which left its autocomplete inoperative for the rest of the session.

## [1.6.0-dev.20260804.85b7ccf] - 2026-08-04

### Added

- JSON and YAML instance serialization through the CEDAR Model TypeScript Library.
- Browser, domain, and multiple-editor isolation regression coverage.

### Changed

- Isolated each editor's configurable services, endpoints, language settings, preferences, and IRI prefixes.
- Encapsulated CEE and Angular Material styles in the custom element's shadow root.

### Fixed

- Released destroyed UI component registrations and shadow-local overlay and accessibility nodes.

## [1.5.2] - 2026-07-28

### Added

- PubMed ID (PMID) and RRID external authority fields, registered as external-authority input types.
- Expose the loaded CEE version as `window.cedarEmbeddableEditorVersion`, so host applications (e.g. the CEDAR template editor) can display which CEE bundle is actually running.

## [1.5.1] - 2026-07-16

### Added

- PFAS external authority field (config, icons, and embedding build).
- DOI and NIH-grant external authority fields.
- External-field logos inlined as base64, removing external image dependencies (build budget raised to accommodate).

### Changed

- Improved Angular packaging and build; CSS updates and code cleanup.

### Fixed

- Multi-instance handling for external-authority fields (PFAS, ROR, and others).
- Multiple-choice component: restored missing imports, and corrected initialization, multi-page rendering, and data-value handling.
- Controlled-term result filtering.
- Data-availability rendering.
- Checkbox selection race condition.

## [1.5.0] - - 2025-05-30

### Added

- Configuration option to control visibility of the preferences-menu.

### Fixed

- Issue where the preferences menu could override the initial read-only mode configuration.
- Hide the section-break help icon when no help text is available.

### Changed

- Text input values now detect HTML context using a DOM parser.

## [1.4.0]

### Added

- ORCID and ROR fields.
- Preferences menu and read-only mode toggle under it.
- Version number under the logo.

### Fixed

- Non-empty attribute key/value fields being incorrectly hidden in read-only mode.

### Changed

- Rendering style of section breaks.

## [1.3.5]

### Fixed

- Instance load issue that appears when instance and template passed in different times

## [1.3.4]

### Changed

- Pagination on multi instances are not shown if the instance count is less than the page size

## [1.3.3]

### Changed

- Removed outer border of fields for a cleaner look
- Representation of BioPortal, ORCID and ROR iris
- Added icons for expand and collapse all. These buttons are also repositioned to top right corner.

### Fixed

- Some internal errors that appear in the stand-alone mode
- Some border color to comply with accessibility requirements

## [1.3.2]

### Added

- Link to BioPortal controlled terms
- Link to ORCID and ROR ids

### Fixed

- Hiding state of nested empty elements

## [1.3.1]

### Added

- New property to set template and instance together
- Option to hide empty fields in viewer mode
- Configuration option to display template description

### Changed

- Fields that have HTML as their value will be rendered in readOnlyMode

### Fixed

- Not making terminology calls in viewer mode

## [1.2.1] - 2024-02-20

### Fixed

- <https://github.com/metadatacenter/cedar-embeddable-editor/issues/102> Updating required fields with value constraints does not update validation status.

## [1.2.0] - 2024-02-14

### Added

- Viewer mode
- Configuration option to display template description

### Changed

- Name of linked static fields are rendered
- Better accessibility support

## [1.1.0] - 2024-02-08

This version contains only fixes and non-breaking changes related to the language map handling for the UI.

However, there was a new feature introduced in 1.0.14 - the data quality report. Because of this, we are changing the minor version number.

### Added

- `CustomEvent` with `type`:`'change'` is emitted when a multi instance operation is performed (add, copy, delete)

### Fixed

- Load built-in `en` language map if nothing is specified in the config

### Changed

- Better language map related logging
- If no external or internal language map can be found based on the config, still use the built-in `en` map
- Allow uppercase in domain names of Link components

## [1.0.16] - 2024-02-07

### Added

- Language map loading configuration option `languageMapPathPrefix` + docs

### Fixed

- Data Quality Report in case of mandatory fields with 0..n cardinality
- Fixed bug regarding required value of multi-instance fields

## [1.0.15] - 2024-02-05

### Added

- Added naive throttling prevention to the `/integrated-search` calls (random delay < 2000 ms)
- Added validation error message for links

### Fixed

- Fixed null reference in Data Quality Report builder
- Fixed required symbol for multi instance fields

## [1.0.14] - 2024-01-26

### Added

- Data Quality Report feature.

## [1.0.13] - 2024-01-25

### Added

- showAllMultiInstanceValues flag is added.
  Now it's possible to hide "All Values" section of multi instance fields by adding showAllMultiInstanceValues : false to config.

## [1.0.12] - 2024-01-19

### Changed

- Allow empty string value representing an empty attribute-value field

## [1.0.11] - 2024-01-18

### Changed

- Material Icons and Roboto font embedded in package

## [1.0.10] - 2024-01-11

### Added

- A randomly generated UUID together with the trailing path is assigned as to @id is to nested element instances for model validation

## [1.0.9] - UNPUBLISHED

## [1.0.8] - 2023-11-20

### Changed

- Added some error-tolerance to instances that don't align with the template

## [1.0.7] - 2023-11-20

### Fixed

- Fixed null reference

### Changed

- Language map loading logging

## [1.0.6] - 2023-11-17

### Fixed

- Fixed empty link value handling in the model

## [1.0.5] - 2023-11-16

### Fixed

- Fixed null/undefined references
- Added prettier as dev dependency

## [1.0.4] - 2023-11-08

### Fixed

- Fixed same density style multiple generation
- Removed `console.log` debug messages

## [1.0.3] - 2023-11-07

### Fixed

- Default `en` and `hu` language maps embedded in production build
- Removed `console.log` debug messages

### Added

- `Load metadata` checkbox added to the sample template loader

### Changed

- Dev mode config changed to compact initial view (hidden sample template links, hidden core metadata)
- Dependency version updates

## [1.0.2] - 2023-11-03

### Fixed

- Stylesheet not properly rendering
- Multi-instance field add bug

### Changed

- Refactoring: eslint + prettier added

## [1.0.1] - 2023-11-03

### Added

- Changelog
- Code of conduct

### Fixed

- Controlled term field UI update on invalid data
- Model update when date is entered from input (see 'Changed' below)
- Default value selection for dropdowns

### Changed

- Date can only be selected with date picker (no keyboard input)
- Refactored component initialization

### Removed

- Removed extra style inclusion causing duplicate style generation

## [1.0.0] - 2023-09-08

### Added

### Fixed

### Changed

### Removed
