import { MultiInstanceObjectInfo } from './multi-instance-object-info.model';

export class MultiInstanceInfo extends Object {
  //private clazz: string = 'MultiInstanceInfo';

  constructor() {
    super();
  }

  addChild(multiInfo: MultiInstanceObjectInfo): void {
    this[multiInfo.componentName] = multiInfo;
  }

  getChildByName(componentName: string): MultiInstanceObjectInfo {
    if (Object.hasOwn(this, componentName)) {
      return this[componentName];
    } else {
      return null;
    }
  }
}
