import { CedarComponent } from '../models/component/cedar-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';

/**
 * Whether each entry of this component is a place on the form.
 *
 * A repeating element and a repeating field show one entry at a time, and the pager
 * moves between them. A checkbox group or a multiple-choice list also holds a list,
 * but one widget shows all of it: its entries are selections, not places.
 */
export function pagesEntries(component: CedarComponent): component is MultiComponent {
  return (
    component instanceof MultiElementComponent || (component instanceof MultiFieldComponent && component.isMultiPage())
  );
}

/**
 * The components a path passes through, outermost first, ending with the one it names.
 *
 * Null when a step names nothing the template declares, which is what a path into a
 * template that has since been replaced looks like.
 */
export function componentsAlong(template: CedarComponent | null, path: readonly string[]): CedarComponent[] | null {
  const chain: CedarComponent[] = [];
  let parent = template;
  for (const step of path) {
    if (
      !(parent instanceof CedarTemplate) &&
      !(parent instanceof SingleElementComponent) &&
      !(parent instanceof MultiElementComponent)
    ) {
      return null;
    }
    const child = parent.getChildByName(step);
    if (child === null) {
      return null;
    }
    chain.push(child);
    parent = child;
  }
  return chain;
}

/**
 * The entry on screen at each component of `chain` whose entries are places, outermost first.
 *
 * The same shape a problem's `occurrences` takes, so the two compare directly. A
 * component with nothing in it contributes -1, which no problem names.
 */
export function occurrencesOnScreen(chain: readonly CedarComponent[], entries: MultiInstanceObjectHandler): number[] {
  return chain
    .filter(pagesEntries)
    .map((component) => entries.getMultiInstanceInfoForComponent(component)?.currentIndex ?? -1);
}
