import { ElementComponent } from '../component/element-component.model';
import { CedarComponent } from '../component/cedar-component.model';

// tslint:disable-next-line:no-empty-interface
export interface TemplateComponent extends ElementComponent {
  pageBreakChildren: Array<CedarComponent[]>;

  hasPageBreaks(): boolean;
}
