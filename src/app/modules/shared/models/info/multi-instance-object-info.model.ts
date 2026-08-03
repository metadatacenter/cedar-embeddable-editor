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
  componentName: string;
  currentIndex: number;
  children: Array<MultiInstanceInfo>;

  /**
   * Where the count comes from: the live instance, at this component's path.
   *
   * Installed when the node is built, because that is where the component — and
   * so its path — is in hand. Left unset on nodes that describe no component,
   * which fall back to the stored number.
   */
  countSupplier: (() => number) | null = null;

  /** Only used by nodes with no supplier. */
  private storedCount = 0;

  constructor() {
    this.componentName = null;
    this.currentIndex = -1;
    this.children = new Array<MultiInstanceInfo>();
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

  public addChild(child: MultiInstanceInfo): void {
    this.children.push(child);
  }
}
