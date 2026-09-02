import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldComponent } from '../../models/component/field-component.model';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { bioPortalSourceLink } from '../../util/bioportal-term-link';
import { SpecFact, SpecTermSource, specHeaderFactsOf, specTermSourcesOf } from '../../util/field-spec';

/**
 * A field's specification, for a reader rather than for someone filling the form in.
 *
 * Read-only rendering has so far been the editor with its inputs disabled, which answers the wrong
 * question when there is no instance behind it: an empty box says where a value would go and nothing
 * about what an acceptable one is. This states the field instead — what it requires, how many
 * what an acceptable value looks like, which values are permitted, and the description, in full and
 * as text rather than inside a hover tooltip. Occurrence bounds live beside every repeating
 * component's name, fields and elements alike.
 *
 * It renders nothing at all when the field states nothing, so a plain text field with no constraints
 * and no description does not gain an empty panel.
 */
@Component({
  selector: 'app-cedar-field-spec',
  templateUrl: './cedar-field-spec.component.html',
  styleUrls: ['./cedar-field-spec.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFieldSpecComponent implements OnInit {
  @Input({ required: true }) fieldToDescribe!: FieldComponent;

  /**
   * Which half of the specification this instance renders. The terse facts belong beside the field's
   * name, where a reader takes them in with the label; the description is prose and belongs on its
   * own line beneath. One component with two placements rather than two components, because the
   * derivation and the read-only rule are the same for both.
   *
   * Neither states that a value is required. The header already marks that with a red asterisk on
   * the label, and a specification beside it saying "Required" is the same fact twice.
   */
  @Input({ required: true }) variant!: 'facts' | 'description';

  /**
   * The block belongs to read-only rendering, so it decides that here rather than making every call
   * site test for it. An editor is a different question: someone filling a field in is told what is
   * acceptable by the control itself and by validation as they type.
   */
  readOnlyMode = false;
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyMode = mode;
    });
  }

  get description(): string | null {
    const description = this.fieldToDescribe.labelInfo.description;
    // 'Help Text' is the Template Designer's placeholder, which the header already refuses to show.
    // A specification repeating it would state the default as though an author had written it.
    return description !== null && description !== undefined && description !== '' && description !== 'Help Text'
      ? description
      : null;
  }

  /**
   * Beside the name: only what the field's own control cannot state.
   *
   * Most widgets have a placeholder, and `ceeSpecPlaceholder` puts the value specification there —
   * the shape of a value, the permitted values, the authority. The exceptions
   * have no such slot: a radio or checkbox group is a set of options rather than a box, a temporal
   * row is three boxes with their own notation, and an attribute-value pair is two boxes whose
   * placeholders name the pair. Those keep their facts here.
   */
  /**
   * What the field's own control cannot state.
   *
   * Almost nothing, by design: a widget's placeholder carries the whole specification, the declared
   * default included, and read-only clears a prefilled default out of the control so that placeholder
   * is visible. The exceptions are the two widgets with no placeholder at all — a radio group and a
   * checkbox group are sets of options rather than boxes — where this is the only place left.
   */
  get facts(): ReadonlyArray<SpecFact> {
    return specHeaderFactsOf(this.fieldToDescribe);
  }

  /**
   * The authorities a controlled field draws on, beside the name rather than in the box.
   *
   * They belong here because they are links: a reader asking what may go in the field wants to see
   * the branch or the ontology, and placeholder text cannot be clicked. The value's own link-out
   * inside the control answers a different question — what is this term? — and stays where it is.
   */
  get termSources(): ReadonlyArray<SpecTermSource> {
    return specTermSourcesOf(this.fieldToDescribe);
  }

  /** Where the authority can be read about, or null when it names no acronym to address it by. */
  linkFor(source: SpecTermSource): string | null {
    return bioPortalSourceLink(source);
  }

  /** Whether this half has anything to state, which decides whether it appears at all. */
  get hasContent(): boolean {
    if (!this.readOnlyMode) {
      return false;
    }
    return this.variant === 'description' ? this.description !== null : this.facts.length > 0;
  }
}
