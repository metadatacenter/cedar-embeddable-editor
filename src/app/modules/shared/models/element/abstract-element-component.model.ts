import { CedarComponent } from '../component/cedar-component.model';
import { ElementComponent } from '../component/element-component.model';
import { LabelInfo } from '../info/label-info.model';

export abstract class AbstractElementComponent implements ElementComponent {
  className = 'AbstractElementComponent';
  name = '';
  path: string[] = [];
  children: CedarComponent[] = [];
  labelInfo: LabelInfo = new LabelInfo();
  hidden = false;

  /**
   * The template said `_ui.hidden`, which is permanent.
   *
   * Distinct from `hidden`, which the read-only viewer also writes when a field
   * is empty. One boolean cannot carry both: a template-hidden field holding a
   * value would be un-hidden the moment the empty-field pass ran over it.
   */
  hiddenInTemplate = false;

  /**
   * The property IRI of each child, which is what a CEDAR instance's `@context`
   * block is made of.
   *
   * A name-to-IRI map, and now declared as one. It said `InstanceObject` while a
   * container was a bag of instance nodes, so the builder could write it
   * straight into the tree as the block itself. The block is the writer's to
   * emit; these go on the container as `setIri`.
   */
  contextEntries: Record<string, string> = {};

  getChildByName(childName: string): CedarComponent | null {
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
