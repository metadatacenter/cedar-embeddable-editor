import type { FieldComponent } from '../models/component/field-component.model';
import type { HandlerContext } from './handler-context';

/** A suggestion list belongs to one template field and its current occurrence.
 * Value edits in that same place may keep the list for another selection. */
export class LookupContext {
  private context: HandlerContext | undefined;
  private field: FieldComponent | undefined;
  private location: string | undefined;

  changed(context: HandlerContext | undefined, field: FieldComponent | undefined): boolean {
    const location = JSON.stringify(
      field?.path?.map(
        (_, index) =>
          context?.multiInstanceObjectService?.getDataPathNode(field.path.slice(0, index + 1))?.currentIndex ?? null,
      ) ?? [],
    );
    const changed = this.context !== context || this.field !== field || this.location !== location;
    this.context = context;
    this.field = field;
    this.location = location;
    return changed;
  }
}
