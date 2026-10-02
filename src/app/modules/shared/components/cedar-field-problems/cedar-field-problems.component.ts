import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { Translatable } from '../../models/ui/translatable.model';
import { HandlerContext } from '../../util/handler-context';
import { ValidationCode, ValidationProblem } from '../../validation/validation-problem.model';
import { componentsAlong, occurrencesOnScreen } from '../../util/component-location';
import { FieldRevealService } from '../../service/field-reveal.service';
import { MultiInfo } from '../../models/info/multi-info.model';

/** What a component with a list declares about its length. */
type Bounded = CedarComponent & { multiInfo?: MultiInfo };

/**
 * How each problem a widget cannot state is put to the user.
 *
 * A widget states what its own control finds wrong. Some of what the data quality
 * report finds has no control to find it: a stored choice that is not one of the
 * options, a term missing half of itself, an identifier that is not an IRI, and a
 * list of the wrong length. Without this, those appeared in a host's list of
 * problems and nowhere on the form.
 */
const NOTICES: Partial<Record<string, (problem: ValidationProblem, component: Bounded) => Translatable>> = {
  [ValidationCode.choiceMembership]: (problem) => ({
    key: 'Validation.Report.ChoiceMembership',
    params: { value: String(problem.value ?? '') },
  }),
  [ValidationCode.controlledStructure]: () => ({ key: 'Validation.Report.ControlledStructure' }),
  [ValidationCode.iriMalformed]: () => ({ key: 'Validation.Report.IriMalformed' }),
  [ValidationCode.minItems]: (_problem, component) => ({
    key: 'Validation.Report.MinItems',
    params: { min: component.multiInfo?.minItems ?? 0 },
  }),
  [ValidationCode.maxItems]: (_problem, component) => ({
    key: 'Validation.Report.MaxItems',
    params: { max: component.multiInfo?.maxItems ?? 0 },
  }),
};

/** Problems about a whole list, which are located by the entries above the list. */
const LIST_CODES: ReadonlySet<string> = new Set([ValidationCode.minItems, ValidationCode.maxItems]);

/**
 * The report's problems with this field or element, in the entries on screen.
 *
 * Only those its widget cannot state, so nothing is said twice. A list too short for
 * its `minItems` is a warning, and like an unanswered requirement it waits until the
 * user is taken to it.
 */
@Component({
  selector: 'app-cedar-field-problems',
  templateUrl: './cedar-field-problems.component.html',
  styleUrls: ['./cedar-field-problems.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFieldProblemsComponent {
  @Input({ required: true }) componentToShow!: CedarComponent;
  @Input({ required: true }) handlerContext!: HandlerContext;
  // Optional, because a lone `cedar-embeddable-field` shows a field without a form to
  // be taken around.
  private readonly reveal = inject(FieldRevealService, { optional: true });

  get notices(): Translatable[] {
    const context = this.handlerContext;
    if (context.readOnlyMode) {
      return [];
    }
    const path = this.componentToShow.path;
    const candidates = (context.dataContext.dataQualityReport?.problems ?? []).filter(
      (problem) => NOTICES[problem.code] !== undefined && CedarFieldProblemsComponent.same(problem.path, path),
    );
    if (candidates.length === 0) {
      return [];
    }
    const chain = componentsAlong(context.dataContext.templateRepresentation, path) ?? [];
    const onScreen = occurrencesOnScreen(chain, context.multiInstanceObjectService);
    const above = occurrencesOnScreen(chain.slice(0, -1), context.multiInstanceObjectService);

    const notices = new Map<string, Translatable>();
    for (const problem of candidates) {
      const list = LIST_CODES.has(problem.code);
      if (!CedarFieldProblemsComponent.same(problem.occurrences, list ? above : onScreen)) {
        continue;
      }
      if (problem.code === ValidationCode.minItems && !this.reveal?.wasRevealed(path, above)) {
        continue;
      }
      const notice = NOTICES[problem.code]!(problem, this.componentToShow);
      notices.set(`${notice.key}|${JSON.stringify(notice.params ?? {})}`, notice);
    }
    return [...notices.values()];
  }

  private static same<T>(left: readonly T[], right: readonly T[]): boolean {
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
  }
}
