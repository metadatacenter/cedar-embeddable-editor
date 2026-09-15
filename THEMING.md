# Theming and the Visual Contract

CEE uses Angular Material's M3 system-token theme. A theme change is a visual
migration: each changed snapshot must be explained as a regression to fix or a
restyle to accept. The commitments below distinguish the two.

## Palette and ownership

CEE's Material adapter consumes `cedar-design-tokens`, as do CED and CETP.
It maps the shared palette directly to M3 light-theme roles: primary is CEDAR
500 (`#0f7686`), secondary is primary 700, and tertiary is rust 500. Pale brand
hues supply container roles; shared neutrals supply surfaces, text and borders.
The M2 accent A200 value remains available in the shared package, but M3 has
secondary and tertiary roles instead of an accent palette.

`mat.theme()` emits the system at each CEE/CEF shadow host. Every color role is
mapped explicitly, including native-select fallbacks, so Material's stock palette
does not supply CEDAR colors. All typography levels and shorthands use the
namespaced font stack and px values. The component stays light even when an
embedding page requests a dark color scheme; dark mode is not a supported API.

Material's M3 chrome is accepted: muted action icons, outlined unselected chips,
tinted selected chips, rounded calendar surfaces and M3 choice/select treatment.
CEE's card dimensions, control heights, status colors and layout stay governed
by the contracts below. Comfortable inputs keep black resting outlines, with
Material's primary focus and error states; the old forced-black border suppressed
both states and has been removed.

Brand values, type sizes and shared neutrals belong in that package. CEE's card
geometry stays in `_cee-layout.scss`; Material integration stays in
`_cee-material-theme.scss`. A copy of a shared literal in a component is not a
new design decision. Read its named token instead.

## What Is Load-Bearing

These are commitments. A diff that changes one of them is a regression unless
it is the explicit purpose of the change.

**Build-time design and host overrides have different contracts.** The package
sets the common defaults. CEE and CEF support the compact-control properties in
[STYLING.md](STYLING.md), including size, border, focus and error roles. CED's
native controls support that same compact contract. Preserve those existing
properties and the `density` attribute.

CEE has no general runtime brand-palette API: changing a `--cedar-primary-*`
property on a page does not recolor its compiled Material theme. Do not advertise
an override until a browser test proves it reaches the affected controls.
`--mat-*`, `--mdc-*` and private `--_cedar-*` properties are implementation details.
A general appearance API remains separate work in
[FRONTEND-ROADMAP.md](../cedar-development/ops/FRONTEND-ROADMAP.md#cee).

Shared prose sizes use the package's px scale so a host's root font size cannot
change them. Explicit icon sizes and component-specific geometry stay local.
The token package's README describes the policy across CEE, CED and CETP.

**`ViewEncapsulation.None` is how the component styles itself.** CEE is a web
component whose styles have to reach its own light-DOM content and the CDK
overlays it opens outside its tree. Any migration step that reintroduces
encapsulation, or that moves `.cdk-overlay-container` styling, breaks theming
wholesale rather than subtly.

**The single-file bundle stays loadable by a plain `<script>` tag.** Embedders
are not obliged to use `type="module"`. See `visual/README.md` for how packaging
holds this invariant across builders.

**Font identity.** `CEE Roboto` and `CEE Material Icons` are locally namespaced
faces, deliberately not the global `Roboto`/`Material Icons`, so an embedding page
cannot collide with them. The icon ligature codepoints in the `notify-*` rules
depend on `CEE Material Icons` specifically.

**Semantic status colors.** The `notify-info`/`success`/`error`/`warning`/
`progress` palette and `.info-box` are plain CSS with no Material dependency.
They have no reason to move in a version hop. If one does, something reached
into them by accident.

**Layout mechanisms the fixtures exercise.** The twelve fixture templates each
cover a distinct layout path. A snapshot that changes _structure_ — an element
wrapping differently, a section collapsing, a control escaping its container — is
a regression even when the new arrangement looks tidy.

## What Is Incidental

These may change, and a diff touching only them is an accepted restyle.

Material's own component chrome: ripple geometry, focus-ring rendering, the
internal padding and label float of form fields, checkbox and radio glyph
shapes, elevation shadows, the exact metrics of the paginator and menu. CEE never
specified any of it. MDC changed much of it and a later hop may change more.
Matching the old rendering would mean fighting the framework with overrides that
then need maintaining forever.

Text antialiasing and sub-pixel differences, which are noise from the renderer
rather than from the code.

## The Third-Party Selectors CEE Reaches Into

CEE styles Material's internal classes, and the `.mdc-*` classes underneath them,
from `styles-own.scss` and eight component stylesheets. The v15 hop moved most of
that, because MDC renamed most component classes with a `mat-mdc-` prefix and
changed the elements underneath them. Three CEE rules died in the migration — a
renamed class stops matching in silence, with no error — and only one of the three
was visible in a diff image.

So the inventory is executed rather than kept by hand.
`visual/tests/material-selectors.spec.ts` reads the selectors out of CEE's own
stylesheets at run time and asserts each one still matches an element in a
rendered fixture. Adding a rule adds a check, and a Material rename fails that
suite with the selector named instead of leaving snapshots to interpret. A
selector reachable only in a state the suite does not create is exempted by name,
and that list is meant to stay short.

`.mat-icon`, `.mat-expansion-panel` with its header and title, and
`.mat-calendar-period-button` and `.mat-calendar-arrow` kept their names through
the MDC rewrite. The form-field rules were the riskiest of the old set: they
overrode internal padding with `!important` against a DOM MDC replaces, so they
could apply to the wrong box rather than merely stop applying. They are gone.
`.mat-mdc-form-field-infix` no longer appears in CEE's stylesheets at all, and
the comfortable 48px field box is specified through `form-field-overrides()`
in the adapter. The compact adapter specifies 36px by default and supports the
public overrides in `STYLING.md`.

## How to Judge a Failing Snapshot

Work through it in this order. The first question that yields a clear answer
settles it.

1. **Did structure change, or only surface?** Reflow, wrapping, overflow and
   element order are regressions. Color, shadow, radius and spacing _within_ a
   Material control are candidates for acceptance.
2. **Does a load-bearing commitment move?** If a font face, a status color, one
   of the three element lengths or a layout mechanism changed, fix the code.
3. **Is a CEE rule now dead?** A rule targeting a renamed `.mat-*` class stops
   applying silently. The symptom is the control reverting to Material's default
   look, which reads as an innocuous restyle. `material-selectors.spec.ts`
   answers this question; run it before accepting a restyle.
4. **Is the change uniform across fixtures?** A shift in every snapshot is
   Material's restyle. A shift in one or two is CEE-specific and needs a cause.
5. **Only then re-baseline,** in a commit of its own, separate from the version
   hop, with the reasoning recorded. Never re-baseline in the same commit that
   changes a dependency: it makes the two indistinguishable afterwards.

A blanket `--update-snapshots` across a version hop destroys the gate. If the
work reaches a point where that is the only way forward, the honest move is to
stop and say the baselines need human review.

## Where Things Live

`cedar-design-tokens` holds CEDAR's values and may not reference Material.
`_cee-material-theme.scss` is the only file that touches Material's theming API
and maps shared values to M3 roles and supported component overrides. `styles-own.scss`
holds the component and layout CSS. `visual/tests/m3-theme.spec.ts` checks
CEE/CEF compact overrides, comfortable focus, and overlay typography under a
host font-size reset. `visual/README.md` covers the baselines and packaging.
