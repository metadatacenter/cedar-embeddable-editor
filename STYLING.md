# Shared controls: CEE, CEF, CED and CEFD

Read-only CEE is the reference. A single-line control is 36px high, with 14px
regular text, a 21px line height, a 1px outline and 4px corners. Editing adds
interaction without enlarging the box when a value, clear button or calendar
button appears. Precision, formatting and validation are independent of density.

CEE and CEF use this read-only-based sizing by default, independently of
`config.readOnlyMode`. `density="compact"` remains a supported explicit spelling.
Use `density="authoring"` for the shared 32px authoring profile (12px text,
18px line height, the shared 4px corner). CED/CEFD use that profile for settings and embedded
CEF. Host overrides take precedence in both compact and authoring profiles.
Use `density="comfortable"` only to request the older, larger editable sizing.

## Tokens

Set these CSS custom properties on a common ancestor of CED, CEFD, CEE and CEF. They
inherit through shadow roots. CED's native default inputs consume the same tokens.

| Token                         | Default   | Purpose                              |
| ----------------------------- | --------- | ------------------------------------ |
| `--cedar-control-height`      | `36px`    | Single-line box and action height    |
| `--cedar-control-font-size`   | `14px`    | Value text                           |
| `--cedar-control-line-height` | `21px`    | Value line height                    |
| `--cedar-control-radius`      | `4px`     | Outline corners                      |
| `--cedar-control-border`      | `rgba(0, 0, 0, 0.38)`    | Resting outline                      |
| `--cedar-control-focus`       | `#0f7686` | Focus outline                        |
| `--cedar-textarea-min-rows`   | `2`       | Starting rows for compact paragraphs |
| `--cedar-control-error`       | `#b42318` | Invalid outline and message          |

Keep height at least 32px, with room for a 24px action. Multiline text, multiple
values, long labels and error messages may increase total height; they must wrap,
not clip. Errors appear below the control. Do not reserve an extra empty row just
for a clear action. Keep focus visible and preserve keyboard navigation.

## Ownership

`src/_cedar-compact.scss` is the shared adapter used by both CEE and CEF, including
Material token mappings and the native segmented clock. Add presentation rules
there rather than per input type. `ControlDensityDirective` applies paragraph row
counts through CDK's public autosize API, preserving content-driven growth. Widget styles own only their structural layout.
CED must not target Material classes or CEF's internal DOM.

The date/time widgets retain their existing format and precision logic: HH, HH:MM,
seconds, fractional seconds, 12/24-hour display and optional timezone. Never replace
those widgets with a generic text field to obtain a smaller box.

Test empty, populated, focused and invalid controls in editable CEE, editable CEF
and read-only CEE. A populated single-line control must remain the same height.
Test narrow hosts and the widest temporal precision; compare against the same
read-only fixture rather than inventing another visual reference.

## Comparison page

After building the bundle and staging visual fixtures, serve `visual/public` with
`node visual/serve-public.mjs 4455` from the repository root. Open
`http://127.0.0.1:4455/compact.html`. It places read-only CEE, editable CEF and
editable CEE side by side, with simple and temporal fixture sets.

Defaults and density profiles come from `cedar-design-tokens`; adapters must not
redeclare public host override properties. Error text and borders use the shared
`status-error-text` role, advisory notices use `status-warning-text`.

## Ownership of local styles

A scanner baseline is migration debt, not permission to copy a local rule.
The aim is no unexplained deviations, not a component with no layout CSS.

| Surface | Owner and review rule |
| --- | --- |
| Editable controls and density | Central control/choice roles, translated by `_cee-material-theme.scss` and `_cedar-compact.scss`. Material internals stay in these adapters. Pixel arithmetic that compensates for a Material border or intrinsic glyph must name that dependency and have a computed-layout test. |
| Read-only boxes, facts and authority links | Central `patterns.specification-box`, `specification-separator` and `specification-link`. Components own their content, suffix placement and wrapping/truncation policy. Do not copy the surface recipe. |
| Field headers, occurrence pager, nested elements | `_cee-layout.scss` and the owning component. Header trailing slots, pager overlap and responsive breakpoints are CEE geometry, not platform spacing defaults. Preserve the narrow-width and help/action collision tests. |
| Images, video and authority branding | The owning component. Aspect ratios, resource-provided dimensions and BioPortal logo proportions are content constraints. A border, label font or warning color is still a shared design role. |
| Demo application | `app.component.scss` belongs to the sample host, not the embedded editor. Its findings remain visible but must not justify copying its styling into CEE. |
| Notifications, time picker and static-content hints | Remaining local typography, spacing and palette findings are migration debt. Adopt an existing role or introduce a reviewed reusable pattern; do not rubber-stamp these as customization. |

Host customization belongs on the documented CSS properties. Read-only specification
surfaces accept the control height, border and radius overrides above, plus
`--cedar-specification-text`, `--cedar-specification-padding-block`,
`--cedar-specification-padding-inline`, `--cedar-specification-line-height`,
`--cedar-specification-separator-color`, `--cedar-specification-keyword-color`
and `--cedar-specification-link-underline`. Defaults are embedded by the central
recipe so a standalone CEE/CEF does not depend on a host stylesheet. The text and
links remain readable, and boxes grow rather than clip when a value wraps.

Changing a host property must be tested on both CEE and standalone CEF. The
`visual/tests/specification-theme.spec.ts` checks exercise this at 375px; the full
visual suite protects default appearance. A local exception must have a concrete
reason, exact location and bounded occurrence count. Adding a copy must fail the
adoption gate even when the original exception is approved.
