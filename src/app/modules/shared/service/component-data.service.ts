import { CedarComponent } from '../models/component/cedar-component.model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ComponentDataService {
  public getRenderingLabelForComponent(component: CedarComponent): string {
    if (
      component.labelInfo !== undefined &&
      component.labelInfo.preferredLabel !== undefined &&
      component.labelInfo.preferredLabel !== null
    ) {
      return component.labelInfo.preferredLabel;
    }
    if (
      component.labelInfo !== undefined &&
      component.labelInfo.label !== undefined &&
      component.labelInfo.label !== null
    ) {
      return component.labelInfo.label;
    }
    if (component.name !== null) {
      return component.name;
    }
  }
}
