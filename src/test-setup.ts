/**
 * Make Angular's JIT compiler available before any spec imports Angular code.
 *
 * Angular libraries ship in "partial" form: a declaration like `ɵɵngDeclareFactory`
 * is linked at runtime rather than at publish time. The Angular CLI's build links
 * them ahead of time, so Karma never needed a compiler present. Vite hands the
 * published bundles over unlinked, and the first partial declaration reached —
 * `@angular/common`'s, pulled in by a service two specs import — asks for the
 * compiler and throws when it is absent.
 *
 * The symptom is worth recognising, because it is not an obvious missing-compiler
 * error: the spec file fails to import, so its tests are never registered, and the
 * run reports a smaller number of passing tests rather than a failure. Seven of the
 * 51 went missing that way.
 *
 * No `zone.js` here. Nothing under `src/**` uses `TestBed`, `fakeAsync` or change
 * detection, so no spec needs a zone — and importing one would patch globals for
 * every spec to no purpose.
 */
import '@angular/compiler';
