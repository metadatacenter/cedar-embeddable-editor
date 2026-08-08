import { CedarComponent } from './cedar-component.model';

/**
 * The single-occurrence half of the Single/Multi pair.
 *
 * Empty on purpose, and structurally identical to `CedarComponent` — which is what
 * `no-empty-object-type` correctly reports. It stays because the pair is the model:
 * `MultiComponent` extends the same base and adds `multiInfo` and `name`, and three
 * classes declare `implements SingleComponent` to say which half they are. Collapsing
 * this to a type alias would say `SingleComponent` *is* `CedarComponent`, when what the
 * taxonomy means is that it is the branch of it that `MultiComponent` is not.
 *
 * The declaration is documentation and a place for the members that would make it
 * non-degenerate, so the rule is disabled here rather than obeyed. It replaces a
 * `tslint:disable-next-line:no-empty-interface`, which had been dead for years:
 * tslint is gone, and ESLint never read that comment, so the rule was never actually
 * suppressed — it simply was not in the Angular 14 rule set CEE was pinned to.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SingleComponent extends CedarComponent {}
