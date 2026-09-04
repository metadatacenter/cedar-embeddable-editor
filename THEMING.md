# Theming and the Visual Contract

CEE's visual baselines went red across the Angular 14 → 22 upgrade, and they
were right to. Angular Material 15 rewrote every component onto MDC: different
DOM, different class names, different default metrics. The rendering changed
whether or not CEE changed.

That put a decision in the path of the upgrade, and the M3 token API still ahead
puts it there again. Each failing snapshot is either a regression to fix or a
restyle to accept, and nothing in a diff image says which. Answering it one
snapshot at a time, at whatever hour the hop finishes, is how a gate worth having
gets replaced by `--update-snapshots`. What follows is the standing answer: what
CEE's appearance is actually committed to, what it merely happens to look like,
and how to tell a diff of one kind from the other.

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
since. The upgrade preserved it exactly, because correcting it would change what
users see, and an upgrade branch is the worst place to hide a visual change.

**Open decision, for a separate change:** whether CEE should adopt its own brand
palette for component theming. Adopting it would shift most of the interface from
`#00897b` to `#0f7686` and invalidate nearly every baseline on purpose. The
14 → 22 upgrade preserved stock teal, so that cycle is spent. The next occasion
is the M3 token migration, which rewrites the applied theme anyway, and the rule
that held through the last hop holds through that one: the palette change gets
its own commit and its own re-baselining, never the hop's.

## What Is Load-Bearing

These are commitments. A diff that changes one of them is a regression.

**CEE publishes no theming surface, and that is the current state rather than a
settled position.** Eight `--cee-*` custom properties stood on `:host`, described
here as versioned API. They are gone, and what they were worth is the reason:

* `--cee-color-text-primary` and `--cee-color-accent` were read nowhere. This
  document said that was the point.
* The Material theme is compiled from Sass — `_cee-material-theme.scss` contains
  no `var(--cee-…)` at all — so no override reached a button, chip, form field or
  focus ring. What `--cee-color-primary` actually moved was the time picker's
  focus border, in three declarations, and nothing else.
* `--cee-element-heading-size`, `-weight` and `-content-gap` were the only three
  that described a real seam, bounded by `clamp()` and typed through
  `CSS.registerProperty` so a wrong value failed visibly rather than inheriting
  the 14px body size.
* No embedder set any of the eight. Not the Template Designer, not openview, not
  artifacts, not bridging, not the demo.

The test that guarded them asserted each was *published on `:host`* — which a
property that does nothing passes as well as one that works. Replacing the
`clamp(12px, var(…), 32px)` forms with the literal values they resolved to moved
393 pixels of glyph antialiasing across sixteen baselines and nothing else, which
is the restyle this document's own rule accepts.

Designing a real surface — roles rather than Material palette slots, values
derived with `color-mix` rather than enumerated, a Material theme that reads them,
and a test that a colour reaches rendered pixels — is on
[CEE-ROADMAP.md](../cedar-development/ops/CEE-ROADMAP.md). Until then an embedder
styles CEE by not styling it.

The three element lengths' defaults were once `1.125rem` and `0.75rem`, and are
now `18px`, `600` and `12px`. A default in `rem` was not a default — `rem`
resolves against the host document's root, so a page carrying
`html { font-size: 62.5% }` got 11.25px and 7.5px, and CEE could neither see that
nor say it was wrong. The type scale in `_cee-tokens.scss` is absolute for the
same reason.

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
cover a distinct layout path. A snapshot that changes *structure* — an element
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
the 48px field box is asked of Material through `form-field-density(-2)`, which
is where that height is now decided.

## How to Judge a Failing Snapshot

Work through it in this order. The first question that yields a clear answer
settles it.

1. **Did structure change, or only surface?** Reflow, wrapping, overflow and
   element order are regressions. Color, shadow, radius and spacing *within* a
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

`_cee-tokens.scss` holds CEDAR's values and may not reference Material.
`_cee-material-theme.scss` is the only file that touches Material's theming API
and records the renames behind it and the one still ahead. `styles-own.scss`
holds the component and layout CSS. `visual/README.md` covers the baselines and
packaging.
