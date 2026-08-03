import { CedarComponent } from '../component/cedar-component.model';
import { ElementComponent } from '../component/element-component.model';
import { LabelInfo } from '../info/label-info.model';
import { StaticFieldComponent } from '../static/static-field-component.model';

export abstract class AbstractElementComponent implements ElementComponent {
  className = 'AbstractElementComponent';
  name: string;
  path: string[];
  children: CedarComponent[] = [];
  labelInfo: LabelInfo = new LabelInfo();
  linkedStaticFieldComponent: StaticFieldComponent = null;
  hidden: boolean;

  /**
   * The `@context` block an instance of this container carries: the standard
   * CEDAR prefixes and typed entries, plus one IRI per child property.
   *
   * A property of the template, so a parser supplies it — the same way it
   * supplies the children. It used to be read out of the raw template's
   * `properties/@context/properties` while the instance was being built, which
   * meant the builder walked the template JSON alongside the component tree it
   * was already walking.
   */
  contextEntries: Record<string, unknown> = {};

  getChildByName(childName: string): CedarComponent {
    for (const child of this.children) {
      if (child.name === childName) {
        return child;
      }
    }
    return null;
  }

  abstract isMulti(): boolean;
  abstract isMultiPage(): boolean;
}
