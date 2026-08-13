import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';

/**
 * Which occurrence of a multi element to descend into, while resolving a path.
 *
 * A component path — `['_el', '_field']` — does not identify a node in an
 * instance. A multi element has many occurrences, so the path identifies one
 * node *per occurrence chosen at each multi ancestor*. Resolution has always
 * made that choice by reading each ancestor's `currentIndex`, the cursor the
 * pager moves, which meant:
 *
 * - `getDataObjectNodeByPath` returned different nodes at different times with
 *   no write in between, and nothing in its signature said so;
 * - every caller was order-dependent on a mutation to the cursor, an ordering
 *   requirement stated nowhere;
 * - nothing could ask for a *specific* occurrence, which is why the quality
 *   report had to walk the instance itself to answer "is any occurrence of this
 *   required field filled in".
 *
 * Making the choice a parameter is what fixes that. The walk is now pure in the
 * ordinary sense — same inputs, same node — and "read the cursor" becomes one
 * named, obvious thing a caller opts into rather than the only behaviour
 * available.
 *
 * Returning `null` means there is no such occurrence, and resolution stops.
 */
export type OccurrenceSelector = (component: MultiElementComponent) => number | null;

export class OccurrenceSelectors {
  /**
   * Whichever occurrence the user is looking at.
   *
   * The historical behaviour, and still the right one for anything acting on
   * behalf of the visible form — a widget writing what was just typed, the pager
   * labelling the page. Named so that a caller depending on the cursor is doing
   * so visibly.
   */
  static fromCursor(multiInstanceObjectService: MultiInstanceObjectHandler): OccurrenceSelector {
    return (component: MultiElementComponent): number | null => {
      const info = multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
      if (!info) {
        return null;
      }
      return info.currentIndex;
    };
  }

  /**
   * Specific occurrences, outermost first.
   *
   * One index per multi ancestor along the path, in the order they are
   * descended through — which is the only sensible shape for this, because an
   * inner element's occurrences live *inside* an outer element's chosen
   * occurrence. "Which occurrence" is not one number when there is nesting.
   *
   * A selector is single-use: it consumes its indices as the walk descends. Build
   * a fresh one per resolution.
   */
  static at(indices: ReadonlyArray<number>): OccurrenceSelector {
    let consumed = 0;
    return (): number | null => {
      const index = indices[consumed];
      consumed += 1;
      return index === undefined ? null : index;
    };
  }
}
