import { CedarComponent } from '../models/component/cedar-component.model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ComponentDataService {
  /**
   * The name to put in front of a reader.
   *
   * A parent's display override comes first, because it describes this deployment of an artifact
   * others also use. Then `skos:prefLabel`, which is written for a reader where `schema:name` often
   * is not — a template whose fields are named `lab_id` and `dataset_type` carries its only legible
   * labels there. Then `schema:name`.
   *
   * The property key is last, and only because every child has one. It identifies a child inside
   * its parent and inside the instances the parent produces, so a form reaches for it when the
   * template has given it nothing else to show.
   */
  public getRenderingLabelForComponent(component: CedarComponent): string {
    const labelInfo = component.labelInfo;
    return labelInfo?.deploymentLabel ?? labelInfo?.preferredLabel ?? labelInfo?.label ?? component.name ?? '';
  }
}
