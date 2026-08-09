# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
