import { MultiInstanceObjectInfo } from './multi-instance-object-info.model';

/**
 * The multi-instance states belonging to one element occurrence.
 *
 * This used to put component names directly on the class instance. Its methods
 * therefore had to appear in the index signature beside its data, and every walk
 * through the structure eventually asserted a method-bearing object into a state
 * node. An explicit map keeps the two shapes distinct: this is the container; a
 * `MultiInstanceObjectInfo` is one component's state.
 */
export class MultiInstanceInfo {
  private readonly childrenByName = new Map<string, MultiInstanceObjectInfo>();

  addState(multiInfo: MultiInstanceObjectInfo): void {
    this.childrenByName.set(multiInfo.componentName, multiInfo);
  }

  getState(componentName: string): MultiInstanceObjectInfo | null {
    return this.childrenByName.get(componentName) ?? null;
  }

  /** A structural copy which deliberately keeps each live count supplier. */
  clone(): MultiInstanceInfo {
    const copy = new MultiInstanceInfo();
    for (const child of this.childrenByName.values()) {
      copy.addState(child.clone());
    }
    return copy;
  }
}
