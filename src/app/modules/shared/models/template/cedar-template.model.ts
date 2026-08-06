import { TemplateComponent } from './template-component.model';
import { AbstractElementComponent } from '../element/abstract-element-component.model';
import { CedarComponent } from '../component/cedar-component.model';
import { DataObjectUtil } from '../../util/data-object-util';

export class CedarTemplate extends AbstractElementComponent implements TemplateComponent {
  override className = 'CedarTemplate';
  pageBreakChildren: Array<CedarComponent[]>;

  /**
   * The template's own IRI, which every instance of it has to name.
   *
   * An instance without `schema:isBasedOn` does not say what it is an instance
   * of, so nothing downstream can validate it, render it, or find its template
   * again. The Java artifact library treats it as mandatory — a non-optional
   * URI, checked on construction — and CEE was not writing it at all.
   *
   * Supplied by the parser, like the `@context` block, because it is a property
   * of the template rather than of the form.
   */
  isBasedOn: string | null = null;

  hasPageBreaks(): boolean {
    return this.pageBreakChildren.length > 1 && !DataObjectUtil.arraysEqual(this.children, this.pageBreakChildren[0]);
  }

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }
}
