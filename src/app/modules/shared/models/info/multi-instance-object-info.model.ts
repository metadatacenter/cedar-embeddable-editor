import { MultiInstanceInfo } from './multi-instance-info.model';

export class MultiInstanceObjectInfo {
  //private clazz: string = 'MultiInstanceObjectInfo';
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
    this.children.push(child);
  }
}
