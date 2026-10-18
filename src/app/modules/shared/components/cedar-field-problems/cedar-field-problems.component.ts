import { REPORT_NOTICES } from '../../validation/validation-message';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { Translatable } from '../../models/ui/translatable.model';
import { HandlerContext } from '../../util/handler-context';
import { ValidationCode } from '../../validation/validation-problem.model';
import { componentsAlong, occurrencesOnScreen } from '../../util/component-location';
import { FieldRevealService } from '../../service/field-reveal.service';
import { AbstractFieldComponent } from '../../models/field/abstract-field-component.model';

/** Problems applying across a field's entries, located by its containing elements. */
const LIST_CODES: ReadonlySet<string> = new Set([
  ValidationCode.minItems,
  ValidationCode.maxItems,
  ValidationCode.templateConstraint,
]);

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

  get notices(): (Translatable & { severity: string; category: string })[] {
    const context = this.handlerContext;
    if (context.readOnlyMode) {
      return [];
    }
    const path = this.componentToShow.path;
    const candidates = (context.dataContext.dataQualityReport?.problems ?? []).filter(
      (problem) => REPORT_NOTICES[problem.code] !== undefined && CedarFieldProblemsComponent.same(problem.path, path),
    );
    if (candidates.length === 0) {
      return [];
    }
    const chain = componentsAlong(context.dataContext.templateRepresentation, path) ?? [];
    const onScreen = occurrencesOnScreen(chain, context.multiInstanceObjectService);
    const above = occurrencesOnScreen(chain.slice(0, -1), context.multiInstanceObjectService);

    const notices = new Map<string, Translatable & { severity: string; category: string }>();
    for (const problem of candidates) {
      // Links already expose malformed identifiers through their URL input error.
      // Authority controls edit a search query, so their stored IRI still needs this notice.
      if (problem.code === ValidationCode.iriMalformed && problem.inputType === 'link') continue;
      if (problem.code === ValidationCode.attributeName && this.componentToShow instanceof AbstractFieldComponent) {
        const draft = context.validation.draftFor(this.componentToShow);
        // Rejected names already have the widget's more specific explanation.
        if (draft?.code === ValidationCode.attributeName && (draft.state as { error?: unknown })?.error) continue;
      }
      const list = LIST_CODES.has(problem.code);
      if (!CedarFieldProblemsComponent.same(problem.occurrences, list ? above : onScreen)) {
        continue;
      }
      if (problem.category === 'completeness' && !this.reveal?.wasRevealed(path, list ? above : onScreen)) {
        continue;
      }
      const notice = REPORT_NOTICES[problem.code]!(problem, this.componentToShow);
      notices.set(`${notice.key}|${JSON.stringify(notice.params ?? {})}`, {
        ...notice,
        severity: problem.severity,
        category: problem.category,
      });
    }
    return [...notices.values()];
  }

  private static same<T>(left: readonly T[], right: readonly T[]): boolean {
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
  }
}
