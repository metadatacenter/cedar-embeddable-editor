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
    let numPBInRow = 0;

    template.children.forEach((child, index) => {
      // encountered page-break component
      if (
        child instanceof StaticFieldComponent &&
        (child as StaticFieldComponent).basicInfo.inputType === InputType.pageBreak
      ) {
        if (page.length) {
          pages.push(page);
        }
        // if page-break is the last component, always add an empty page
        if (index === template.children.length - 1) {
          pages.push([new EmptyTemplate()]);
        } else {
          numPBInRow++;
        }
        page = [];
      } else {
        page.push(child);

        if (index === template.children.length - 1) {
          pages.push(page);
        }

        // add empty pages corresponding to: (number of page breaks in a row - 1)
        for (let i = 0; i < numPBInRow - 1; i++) {
          pages.push([new EmptyTemplate()]);
        }
        numPBInRow = 0;
      }
    });
    template.pageBreakChildren = pages;
  }
}
