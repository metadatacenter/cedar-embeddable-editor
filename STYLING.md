# Shared compact controls: CEE, CEF and CED

Read-only CEE is the reference. A single-line control is 36px high, with 14px
regular text, a 22px line height, a 1px outline and 4px corners. Editing adds
interaction without enlarging the box when a value, clear button or calendar
button appears. Precision, formatting and validation are independent of density.

Set `density="compact"` on either `cedar-embeddable-editor` or
`cedar-embeddable-field`. This is a presentation attribute, independent of
`config.readOnlyMode`; it can change without recreating a control or losing input.
Without it, existing editable layouts retain their current sizing.

## Tokens

Set these CSS custom properties on a common ancestor of CED, CEE and CEF. They
inherit through shadow roots. CED's native default inputs consume the same tokens.

| Token                         | Default   | Purpose                              |
| ----------------------------- | --------- | ------------------------------------ |
| `--cedar-control-height`      | `36px`    | Single-line box and action height    |
| `--cedar-control-font-size`   | `14px`    | Value text                           |
| `--cedar-control-line-height` | `22px`    | Value line height                    |
| `--cedar-control-radius`      | `4px`     | Outline corners                      |
| `--cedar-control-border`      | `#777`    | Resting outline                      |
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
