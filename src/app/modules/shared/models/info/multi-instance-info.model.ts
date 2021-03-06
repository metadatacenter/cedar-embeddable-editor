import {MultiInstanceObjectInfo} from './multi-instance-object-info.model';

export class MultiInstanceInfo extends Object {

  constructor() {
    super();
  }

  addChild(multiInfo: MultiInstanceObjectInfo): void {
    this[multiInfo.componentName] = multiInfo;
  }

  getChildByName(componentName: string): MultiInstanceObjectInfo {
    if (this.hasOwnProperty(componentName)) {
      return this[componentName];
    } else {
      return null;
    }
  }
}
