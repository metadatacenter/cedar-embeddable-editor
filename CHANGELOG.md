# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  README's new *Embedding security* section says who should set it and who should not.
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
