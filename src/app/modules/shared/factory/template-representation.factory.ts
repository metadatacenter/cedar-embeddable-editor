import { CedarComponent } from '../models/component/cedar-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { NullTemplate } from '../models/template/null-template.model';
import { EmptyTemplate } from '../models/template/empty-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';
import { ComponentTypeHandler } from '../handler/component-type.handler';
import { InputType } from '../models/input-type.model';
import { HandlerContext } from '../util/handler-context';
import { TemplateParser } from './template-parser';
import { ModelLibraryTemplateParser } from './model-library-template-parser';
import { InstanceValueNode } from '../util/instance-value-node';
import { InstanceNode } from '../models/instance-node.model';
import { isInstanceObject } from '../models/instance-node.model';

/**
 * Builds the component tree CEE renders.
 *
 * Two stages, and the split is load-bearing. A `TemplateParser` turns the
 * template's JSON into the tree; everything below that depends on the
 * surrounding runtime rather than on the template — which fields are empty in
 * the loaded instance, whether the host asked for static-field collapsing,
 * where the page breaks fall — and is applied here, identically, whichever
 * parser ran. That is what lets the parser be swapped without the rendered
 * form moving.
 */
export class TemplateRepresentationFactory {
  private static readonly defaultParser: TemplateParser = new ModelLibraryTemplateParser();

  static create(
    inputTemplate: CedarInputTemplate,
    collapseStaticComponents: boolean,
    handlerContext: HandlerContext,
    parser: TemplateParser = TemplateRepresentationFactory.defaultParser,
  ): TemplateComponent {
    if (inputTemplate === null) {
      return new NullTemplate();
    } else {
      const template = new CedarTemplate();
      parser.parse(inputTemplate, template, handlerContext);
      TemplateRepresentationFactory.applyEmptyFieldHiding(template, handlerContext);
      if (collapseStaticComponents) {
        TemplateRepresentationFactory.collapseStaticFields(template);
      }
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

  /**
   * Under `hideEmptyFields`, mark anything the loaded instance has no value for.
   *
   * Distinct from `_ui.hidden`, which the parser honours by leaving the child
   * out of the tree altogether: this is about the data, not the template, so a
   * component still exists and merely renders as hidden.
   */
  private static applyEmptyFieldHiding(container: ElementComponent, handlerContext: HandlerContext): void {
    if (!handlerContext.hideEmptyFields || !handlerContext.dataContext.instanceExtractData) {
      return;
    }
    for (const child of container.children) {
      // A field the template marked `_ui.hidden` stays hidden whatever it
      // holds. This pass writes the same flag for a different reason — the
      // field is empty and the viewer is configured not to show empty fields —
      // so without the guard a template-hidden field carrying a value would be
      // revealed by it. `ActiveComponentRegistryService.setVisibility` makes
      // the same distinction; the two run at different moments.
      if (child.hiddenInTemplate) {
        child.hidden = true;
        continue;
      }
      if (child instanceof SingleFieldComponent || child instanceof MultiFieldComponent) {
        let val;
        if (child.basicInfo.inputType === InputType.attributeValue) {
          val = this.getValueByPath(child.path, handlerContext.dataContext.instanceExtractData);
          if (typeof val === 'string') {
            const newPath = [...child.path.slice(0, -1), val];
            val = this.getValueByPath(newPath, handlerContext.dataContext.instanceExtractData);
          }
        } else val = this.getValueByPath(child.path, handlerContext.dataContext.instanceExtractData);
        child.hidden = !val || (isInstanceObject(val) && Object.keys(val).length === 0);
      } else if (child instanceof MultiElementComponent || child instanceof SingleElementComponent) {
        this.applyEmptyFieldHiding(child, handlerContext);
        child.hidden = !this.hasNonEmptyChild(child, handlerContext);
      }
    }
  }

  /** Apply static-field collapsing to every container, innermost first. */
  private static collapseStaticFields(container: ElementComponent): void {
    for (const child of container.children) {
      if (ComponentTypeHandler.isContainerComponent(child)) {
        this.collapseStaticFields(child as ElementComponent);
      }
    }
    this.collapseStaticFieldsIntoNextFieldOrElement(container);
  }

  /**
   * True when any descendant of this element holds a value.
   *
   * Both branches stop at the first non-empty child. The element branch used to
   * assign its recursive result without stopping, so the last element child
   * decided the outcome and overwrote any earlier `true` — an element holding
   * data was reported empty whenever a later sibling element happened to be
   * empty, and under `hideEmptyFields` that section vanished from the viewer.
   */
  private static hasNonEmptyChild(component: ElementComponent, handlerContext: HandlerContext): boolean {
    const instanceExtractData = handlerContext.dataContext.instanceExtractData;
    for (const child of component.children) {
      if (child instanceof MultiElementComponent || child instanceof SingleElementComponent) {
        if (this.hasNonEmptyChild(child, handlerContext)) {
          return true;
        }
      } else if (this.getValueByPath(child.path, instanceExtractData)) {
        return true;
      }
    }
    return false;
  }

  private static getValueByPath(path: string[], json: InstanceNode | null): string | InstanceNode | null | undefined {
    if (!json) {
      return null;
    }
    if (path.length === 0) {
      // Read the leaf's literal or IRI through the value-node model rather than
      // off `@value`/`@id`. `literal` returns `undefined` only when the node is
      // not a literal — a stored `null` or `''` still comes back as itself — so
      // an empty-but-present value is preserved, and a node that is neither a
      // literal nor an IRI (an element, say) falls through unchanged.
      const literal = InstanceValueNode.literal(json);
      if (literal !== undefined) {
        return literal;
      }
      const iri = InstanceValueNode.iri(json);
      if (iri !== undefined) {
        return iri;
      }
      return json;
    }
    const currentKey = path[0];
    const remainingPath = path.slice(1);
    if (isInstanceObject(json) && json.hasValue(currentKey)) {
      const value = json.values[currentKey];
      if (value instanceof Array) {
        if (!value.length) {
          return null;
        }
        return this.getValueByPath(remainingPath, value[0]);
      } else {
        return this.getValueByPath(remainingPath, value);
      }
    }
    // The path names a child this node does not have.
    return undefined;
  }

  // Group RTF/image/video fields into consecutive pairs. Any pair gets combined
  // and displayed inline wherever it's located.
  // If the RTF/image/video field is odd (not paired with another RTF/image/video),
  // wrap this field into the next dynamic field/element
  private static collapseStaticFieldsIntoNextFieldOrElement(component: CedarComponent): void {
    // re-iterate, inject static components (images) into the next dynamic components
    // but only if they aren't paired with other like fields
    if (ComponentTypeHandler.isContainerComponent(component)) {
      const elementComponent = component as ElementComponent;
      let prevChild: CedarComponent | null = null;
      const newChildren: CedarComponent[] = [];
      let isStaticPair = false;

      for (let i = 0; i < elementComponent.children.length; i++) {
        const currentChild: CedarComponent = elementComponent.children[i];

        if (
          ComponentTypeHandler.isFieldOrElement(currentChild) &&
          ComponentTypeHandler.isStaticContentComponent(prevChild) &&
          !isStaticPair
        ) {
          currentChild.linkedStaticFieldComponent = prevChild as StaticFieldComponent;
          newChildren.pop();
          newChildren.push(currentChild);
        } else {
          newChildren.push(currentChild);
        }

        if (
          !isStaticPair &&
          ComponentTypeHandler.isStaticContentComponent(currentChild) &&
          ComponentTypeHandler.isStaticContentComponent(prevChild)
        ) {
          isStaticPair = true;
        } else if (isStaticPair) {
          isStaticPair = false;
        }
        prevChild = currentChild;
      }
      elementComponent.children = newChildren;
    }
  }
}
