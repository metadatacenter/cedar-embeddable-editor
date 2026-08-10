# Theming and the Visual Contract

CEE's 98 visual baselines will go red during the Angular 14 → 22 upgrade, and
they will be right to. Angular Material 15 rewrote every component onto MDC:
different DOM, different class names, different default metrics. The rendering
changes whether or not CEE changes.

That puts a decision in the path of the upgrade. Each failing snapshot is either
a regression to fix or a restyle to accept, and nothing in a diff image says
which. Answering it one snapshot at a time, at whatever hour the hop finishes, is
how a gate worth having gets replaced by `--update-snapshots`. What follows is
the standing answer: what CEE's appearance is actually committed to, what it
merely happens to look like, and how to tell a diff of one kind from the other.

## What the Colors Currently Are

CEE defines two Material themes. Only the second is applied.

`_cee-tokens.scss` holds CEDAR's brand palettes, a teal built from `#0f7686` and
a rust built from `#861f0f`, both hand-generated across the full 14-step Material
scale with contrast maps. They are applied to nothing but three CSS custom
properties.

The theme handed to `all-component-themes()` uses Angular's stock `$teal-palette`
at hue 600 and stock `$deep-orange-palette`. So every Material surface in CEE —
buttons, form fields, checkboxes, chips, the focus indicators — is colored
`#00897b`, which is not a CEDAR color. In the shipped bundle stock teal accounts
for 35 color values; CEDAR's `#0f7686` appears twice, both times outside the
Material theme.

This reads as an accident. Someone generated the brand palettes carefully, then
themed the components with a scaffold left in place, and the two have coexisted
since. It is preserved exactly during the upgrade regardless, because correcting
it would change what users see, and an upgrade branch is the worst place to hide
a visual change.

**Open decision, for a separate change:** whether CEE should adopt its own brand
palette for component theming. Adopting it would shift most of the interface from
`#00897b` to `#0f7686` and invalidate nearly every baseline on purpose. Doing it
before the upgrade means re-baselining twice. Doing it after means the upgrade's
own re-baselining bakes in stock teal for another cycle. Either is defensible;
doing it *during* is not.

## What Is Load-Bearing

These are commitments. A diff that changes one of them is a regression.

**The `--cee-*` custom properties are public API.** `--cee-color-primary`,
`--cee-color-text-primary`, `--cee-color-accent` and `--cee-color-warn` are
published on `:host`, where an embedder can override them. Element hierarchy is
customizable in the same way through `--cee-element-heading-size`,
`--cee-element-heading-weight`, and `--cee-element-content-gap`. Their defaults
are `1.125rem`, `600`, and `0.75rem` respectively. Two of the color properties have no
internal consumer, which is the point. Renaming or dropping any public property
breaks embedders silently, so treat the set as versioned surface.

These layout properties deliberately customize presentation rather than
structure. The template still decides which elements are nested and collapsible;
an embedding application can adapt their typography and density without gaining
a second, conflicting representation of the template hierarchy.

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
They should survive the upgrade byte-identical. If one moves, something reached
into them by accident.

**Layout mechanisms the fixtures exercise.** The twelve fixture templates each
cover a distinct layout path. A snapshot that changes *structure* — an element
wrapping differently, a section collapsing, a control escaping its container — is
a regression even when the new arrangement looks tidy.

## What Is Incidental

These may change, and a diff touching only them is an accepted restyle.

Material's own component chrome: ripple geometry, focus-ring rendering, the
internal padding and label float of form fields, checkbox and radio glyph
shapes, elevation shadows, the exact metrics of the paginator and menu. CEE never
specified any of it. MDC will change much of it, and matching the old rendering
would mean fighting the framework with overrides that then need maintaining
forever.

Text antialiasing and sub-pixel differences, which are noise from the renderer
rather than from the code.

## The `.mat-*` Selectors That Will Break

CEE reaches into Material's internals from 16 distinct selectors across 10 files.
This is the concrete work of the v15 hop, because MDC renamed most component
classes with a `mat-mdc-` prefix and changed the elements underneath them.

Expected to be renamed, and to need their surrounding rules rechecked rather than
merely re-prefixed:

| Selector | Where it is used for |
| --- | --- |
| `.mat-form-field-infix`, `.mat-form-field-appearance-outline`, `.mat-form-field-outline` | Compressing field padding, forcing a black outline |
| `.mat-card`, `.mat-card-header` | Removing elevation, margins, the template header |
| `.mat-tooltip` | Font size, black background |
| `.mat-progress-spinner` | Spinner placement in `.spinner-wrapper` |
| `.mat-paginator`, `.mat-paginator-range-label` | Pager layout |
| `.mat-menu-item` | Preferences menu |

The form-field rules are the riskiest of these. They override internal padding
with `!important` against a DOM that MDC replaces, so they will not merely stop
applying: they may apply to the wrong box.

Expected to keep their class names, because these components were not part of the
MDC rewrite: `.mat-icon`, `.mat-expansion-panel` and its header title and
description, `.mat-calendar-period-button`, `.mat-calendar-arrow`.

Verify both lists against the installed version at the hop rather than trusting
the split here. The point is the inventory, not the prediction.

## How to Judge a Failing Snapshot

Work through it in this order. The first question that yields a clear answer
settles it.

1. **Did structure change, or only surface?** Reflow, wrapping, overflow and
   element order are regressions. Color, shadow, radius and spacing *within* a
   Material control are candidates for acceptance.
2. **Does a load-bearing commitment move?** If a `--cee-*` value, a font face, a
   status color or a layout mechanism changed, fix the code.
3. **Is a CEE rule now dead?** A rule targeting a renamed `.mat-*` class stops
   applying silently. The symptom is the control reverting to Material's default
   look, which reads as an innocuous restyle. Check the selector still matches
   before accepting anything in the table above.
4. **Is the change uniform across fixtures?** A shift in every snapshot is
   Material's restyle. A shift in one or two is CEE-specific and needs a cause.
5. **Only then re-baseline,** in a commit of its own, separate from the version
   hop, with the reasoning recorded. Never re-baseline in the same commit that
   changes a dependency: it makes the two indistinguishable afterwards.

A blanket `--update-snapshots` across a version hop destroys the gate. If the
work reaches a point where that is the only way forward, the honest move is to
stop and say the baselines need human review.

## Where Things Live

`_cee-tokens.scss` holds CEDAR's values and may not reference Material.
`_cee-material-theme.scss` is the only file that touches Material's theming API
and carries the list of renames ahead of it. `styles-own.scss` holds the
component and layout CSS. `visual/README.md` covers the baselines and packaging.
