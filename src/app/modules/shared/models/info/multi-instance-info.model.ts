import { MultiInstanceObjectInfo } from './multi-instance-object-info.model';

/**
 * A map from component name to that component's multi-instance state.
 *
 * The index signature is the model, not a workaround: `addChild` writes
 * `this[multiInfo.componentName] = multiInfo`, which is the only way anything is
 * ever put in here. Declaring it lets the path walker step through the tree without
 * asserting at every level.
 *
 * The two method types are part of the union because TypeScript requires every
 * member of a class to be assignable to its own index signature. That is a
 * constraint of the language rather than a claim about the contents.
 */
export class MultiInstanceInfo {
  [componentName: string]:
    | MultiInstanceObjectInfo
    | ((multiInfo: MultiInstanceObjectInfo) => void)
    | ((componentName: string) => MultiInstanceObjectInfo);

  addChild(multiInfo: MultiInstanceObjectInfo): void {
    this[multiInfo.componentName] = multiInfo;
  }

  getChildByName(componentName: string): MultiInstanceObjectInfo {
    if (Object.hasOwn(this, componentName)) {
      return this[componentName] as MultiInstanceObjectInfo;
    } else {
      return null;
    }
  }
}
