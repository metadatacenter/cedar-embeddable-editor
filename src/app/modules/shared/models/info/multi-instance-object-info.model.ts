import { MultiInstanceInfo } from './multi-instance-info.model';

/**
 * How many occurrences a multi component has, and which one is on screen.
 *
 * The two are not the same kind of thing, and it took a while to notice.
 * `currentIndex` is UI state: which page the user has paged to, information that
 * exists nowhere else and belongs here. `currentCount` is not — it is
 * `instance[path].length`, a fact about the document, and it used to be *stored*
 * here and kept in step by hand: incremented on add and copy, decremented on
 * delete, alongside the splice into the instance itself.
 *
 * That is the same shape as the two instance trees that diverged three times
 * before they were collapsed, and the same question applies — does the second copy
 * need to exist? It does not. `currentCount` now reads the instance through
 * `countSupplier`, so the number cannot drift from the document it describes,
 * and add/copy/delete no longer maintain it.
 */
export class MultiInstanceObjectInfo {
  readonly componentName: string;
  occurrences: Array<MultiInstanceInfo>;

  /**
   * Which occurrence is on screen, and never one that is not there.
   *
   * The cursor is UI state and the count is a fact about the document, so the
   * two can disagree — and they were seeded from different places. A component's
   * starting index came from the *template's* `minItems`, while the count reads
   * the *instance*, so a repeating field a sparse instance omits began with the
   * cursor on occurrence zero of a list with none. Adding then spliced at
   * `currentIndex + 1`, which is 1, into an empty list, and every add or copy
   * pushed the cursor further past the end.
   *
   * Clamped here rather than at each of the eleven places that read it.
   * `multiInstanceItemDelete` already did exactly this by hand afterwards, which
   * is the rule stated once and maintained in one of the places it applies.
   */
  get currentIndex(): number {
    const count = this.currentCount;
    return count === 0 ? -1 : Math.min(this.storedIndex, count - 1);
  }

  set currentIndex(value: number) {
    this.storedIndex = value;
  }

  private storedIndex = -1;

  /**
   * Where the count comes from: the live instance, at this component's path.
   *
   * Installed for repeatable components when the node is built, because that is
   * where the component — and so its path — is in hand. Single components have no
   * list to count and keep their fixed build-time number instead.
   */
  private readonly countSupplier: (() => number) | null;

  /** Only used by single-component nodes, which have no occurrence array to count. */
  private storedCount = 0;

  constructor(componentName: string, countSupplier: (() => number) | null = null) {
    this.componentName = componentName;
    this.countSupplier = countSupplier;
    this.occurrences = new Array<MultiInstanceInfo>();
  }

  get currentCount(): number {
    return this.countSupplier ? this.countSupplier() : this.storedCount;
  }

  /**
   * Kept as a setter so the build path and the initial read from an injected
   * instance can still say what they found. A write is ignored once a supplier is
   * installed — the instance is the answer by then, and letting a stale
   * assignment win would reintroduce exactly the drift this removes.
   */
  set currentCount(value: number) {
    if (!this.countSupplier) {
      this.storedCount = value;
    }
  }

  public addOccurrence(occurrence: MultiInstanceInfo): void {
    this.occurrences.push(occurrence);
  }

  /** Copy cursor state and occurrence branches without copying the live document. */
  clone(): MultiInstanceObjectInfo {
    const copy = new MultiInstanceObjectInfo(this.componentName, this.countSupplier);
    copy.storedIndex = this.storedIndex;
    copy.storedCount = this.storedCount;
    for (const occurrence of this.occurrences) {
      copy.addOccurrence(occurrence.clone());
    }
    return copy;
  }
}
