import { MultiInstanceInfo } from './multi-instance-info.model';

export class MultiInstanceObjectInfo {
  componentName: string;
  currentCount: number;
  currentIndex: number;
  children: Array<MultiInstanceInfo>;

  constructor() {
    this.componentName = null;
    this.currentCount = 0;
    this.currentIndex = -1;
    this.children = new Array<MultiInstanceInfo>();
  }

  public addChild(child: MultiInstanceInfo): void {
    // console.log('MultiInstanceObjectInfo.addChild');
    // console.log(this);
    // console.log(this.children);
    // console.log(child);
    this.children.push(child);
  }

  //
  // getChildByName(childName: string): MultiInstanceInfo {
  //   for (const child of this.children) {
  //     if (child.componentName === childName) {
  //       return child;
  //     }
  //   }
  //   return null;
  // }
}
