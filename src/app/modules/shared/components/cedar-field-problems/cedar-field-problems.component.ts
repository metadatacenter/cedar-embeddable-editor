import { REPORT_NOTICES } from '../../validation/validation-message';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { Translatable } from '../../models/ui/translatable.model';
import { HandlerContext } from '../../util/handler-context';
import { ValidationCode } from '../../validation/validation-problem.model';
import { componentsAlong, occurrencesOnScreen } from '../../util/component-location';
import { FieldRevealService } from '../../service/field-reveal.service';
import { AbstractFieldComponent } from '../../models/field/abstract-field-component.model';
import { DescriptionLink, FIELD_CONTROLS } from '../../a11y/message-links';
import { languageTag } from '../../a11y/language-tag';
import { AroundLabel, aroundLabel, LABEL_SLOT } from '../../a11y/joined-name';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InstanceNode, isInstanceArray } from '../../models/instance-node.model';
import { ValidationProblem } from '../../validation/validation-problem.model';
import { InstanceValueNode } from '../../util/instance-value-node';

/**
 * A stored value a notice quotes inside CEE's sentence, with the language it is in, and the
 * parameters that ask the translation for the sentence with the value's place left to be found.
 */
interface QuotedValue {
  readonly text: string;
  readonly language: string;
  readonly params: Record<string, unknown>;
}

type Notice = Translatable & { severity: string; category: string; quoted?: QuotedValue };

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
 *
 * The element is a polite live region, present for as long as the field is, so a
 * problem that appears is announced without focus moving to it. Its id is in the
 * description of each of the field's controls, or of an element's heading, so the
 * problems are read again on reaching one.
 */
@Component({
  selector: 'app-cedar-field-problems',
  templateUrl: './cedar-field-problems.component.html',
  styleUrls: ['./cedar-field-problems.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '[id]': 'id', 'aria-live': 'polite' },
  standalone: false,
})
export class CedarFieldProblemsComponent implements AfterViewChecked, OnDestroy {
  private static nextId = 0;
  readonly id = `cee-field-problems-${CedarFieldProblemsComponent.nextId++}`;
  // Optional, like the reveal service, so a spec can build the component without a view.
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  private readonly described = new DescriptionLink();

  @Input({ required: true }) componentToShow!: CedarComponent;
  @Input({ required: true }) handlerContext!: HandlerContext;
  // Optional, because a lone `cedar-embeddable-field` shows a field without a form to
  // be taken around.
  private readonly reveal = inject(FieldRevealService, { optional: true });

  get notices(): Notice[] {
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

    const notices = new Map<string, Notice>();
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
      const quoted = this.quotedValue(problem, notice);
      notices.set(`${notice.key}|${JSON.stringify(notice.params ?? {})}`, {
        ...notice,
        severity: problem.severity,
        category: problem.category,
        ...(quoted === null ? {} : { quoted }),
      });
    }
    return [...notices.values()];
  }

  /** CEE's words before a quoted value and after it, from the translation asked for with its slot. */
  split(translated: string): AroundLabel {
    return aroundLabel(translated);
  }

  /**
   * The stored value a notice quotes, where it is text in a language that can be told: the tag the
   * stored value carries, and otherwise the language the field declares for its values. Null where
   * the notice quotes no value or neither states a language, so the notice is said as one text.
   */
  private quotedValue(problem: ValidationProblem, notice: Translatable): QuotedValue | null {
    if (problem.code !== ValidationCode.choiceMembership || !(this.componentToShow instanceof AbstractFieldComponent)) {
      return null;
    }
    const text = String(notice.params?.['value'] ?? '');
    const language =
      languageTag(InstanceValueNode.language(this.storedNode(problem))) ??
      languageTag(this.componentToShow.basicInfo.valueLanguage);
    return language === null ? null : { text, language, params: { ...notice.params, value: LABEL_SLOT } };
  }

  /**
   * The stored entry a problem quotes. Of a field that pages through its values, the entry the
   * problem names. Of a field that holds a list as one value, the entry holding the value quoted.
   */
  private storedNode(problem: ValidationProblem): InstanceNode | null {
    const held = this.handlerContext.getDataObjectNodeByPath(this.componentToShow.path);
    if (!isInstanceArray(held)) {
      return held;
    }
    if (this.componentToShow instanceof MultiFieldComponent && this.componentToShow.isMultiPage()) {
      return held[problem.occurrences.at(-1) ?? -1] ?? null;
    }
    return held.find((node) => InstanceValueNode.literal(node) === problem.value) ?? null;
  }

  ngAfterViewChecked(): void {
    this.described.set(this.id, this.describedControls());
  }

  ngOnDestroy(): void {
    this.described.clear();
  }

  /**
   * A field's controls, in the widget drawn beside this element, or an element's heading.
   *
   * Read after each render, because a widget draws a different control as its value or its mode
   * changes, and a control drawn afresh carries none of the ids its predecessor did.
   */
  private describedControls(): Element[] {
    const host = this.host?.nativeElement;
    const widget = host?.parentElement?.querySelector(':scope > app-cedar-field-widget');
    if (widget) {
      return [...widget.querySelectorAll(FIELD_CONTROLS)];
    }
    const heading = host?.closest('mat-expansion-panel')?.querySelector(':scope > mat-expansion-panel-header');
    return heading ? [heading] : [];
  }

  private static same<T>(left: readonly T[], right: readonly T[]): boolean {
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
  }
}
