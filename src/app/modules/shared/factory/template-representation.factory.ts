import { CedarComponent } from '../models/component/cedar-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { NullTemplate } from '../models/template/null-template.model';
import { EmptyTemplate } from '../models/template/empty-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';
import { InputType } from '../models/input-type.model';
import { HandlerContext } from '../util/handler-context';
import { TemplateParser } from './template-parser';
import { selectTemplateParser } from './select-template-parser';

/**
 * Builds the component tree CEE renders.
 *
 * Two stages, and the split is load-bearing. A `TemplateParser` turns the
 * template's JSON into the tree; where the page breaks fall depends on the
 * surrounding runtime rather than on the template, and is applied here,
 * identically, whichever parser ran. That is what lets the parser be swapped
 * without the rendered form moving.
 */
export class TemplateRepresentationFactory {
  /**
   * `parser` is left unset in production, where the reader is chosen from the
   * template's own shape. The parity suite passes one explicitly, to run the same
   * artifact through both and compare.
   */
  static create(
    inputTemplate: CedarInputTemplate,
    handlerContext: HandlerContext,
    parser?: TemplateParser,
  ): TemplateComponent {
    if (inputTemplate === null) {
      return new NullTemplate();
    } else {
      const template = new CedarTemplate();
      (parser ?? selectTemplateParser(inputTemplate)).parse(inputTemplate, template, handlerContext);
      TemplateRepresentationFactory.extractPageBreakPages(template);
      return template;
    }
  }

  static extractPageBreakPages(template: CedarTemplate): void {
    const pages: CedarComponent[][] = [];
    let page: CedarComponent[] = [];

    for (const child of template.children) {
      if (child instanceof StaticFieldComponent && child.basicInfo.inputType === InputType.pageBreak) {
        // A break closes the page at its position. If the previous child was
        // also a break, this page is intentionally blank and must be emitted
        // now, before any later content.
        pages.push(page.length > 0 ? page : [new EmptyTemplate()]);
        page = [];
      } else {
        page.push(child);
      }
    }

    if (page.length > 0) {
      pages.push(page);
    } else if (template.children.length > 0) {
      // A trailing break opens one final blank page.
      pages.push([new EmptyTemplate()]);
    }
    template.pageBreakChildren = pages;
  }
}
