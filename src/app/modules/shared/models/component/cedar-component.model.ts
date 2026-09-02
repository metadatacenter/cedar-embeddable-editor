import { LabelInfo } from '../info/label-info.model';

export interface CedarComponent {
  className: string;
  name: string;
  path: string[];
  /**
   * The property IRI assigned to this child by its parent artifact.
   *
   * This is deployment metadata: it belongs to the child as it appears in a
   * particular parent, not to the reusable field or element artifact itself.
   */
  propertyIri: string | null;
  /**
   * Whether the renderer draws this component.
   *
   * On every component, not only the field and element halves, because the parser
   * flags every child it builds and both renderers ask every child. It was
   * optional here and declared on the two abstract classes, which left a static
   * field carrying a flag its own type did not have — so the parser wrote it
   * through a cast and the template representation factory read it back through
   * another.
   */
  hidden: boolean;
  /**
   * The template said `_ui.hidden`, which is permanent.
   *
   * Distinct from `hidden`, which the read-only viewer also writes when a field
   * is empty. One boolean cannot carry both: a template-hidden field holding a
   * value would be un-hidden the moment the empty-field pass ran over it.
   */
  hiddenInTemplate: boolean;

  labelInfo: LabelInfo;

  isMulti(): boolean;
  isMultiPage(): boolean;
}
