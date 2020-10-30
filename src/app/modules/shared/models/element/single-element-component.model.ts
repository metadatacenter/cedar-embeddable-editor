import {ElementComponent} from '../component/element-component.model';
import {SingleComponent} from '../component/single-component.model';
import {AbstractElementComponent} from './abstract-element-component.model';
import {DataObjectService} from '../../service/data-object.service';

export class SingleElementComponent extends AbstractElementComponent implements SingleComponent, ElementComponent {

  className = 'SingleElementComponent';

  isMulti(): boolean {
    return false;
  }

  public updateUIComponentToModel(dataObjectService: DataObjectService): void {
    // console.log('SingleElementComponent.updateUIComponentToModel');
    for (const childComponent of this.children) {
      childComponent.updateUIComponentToModel(dataObjectService);
    }
  }
}
