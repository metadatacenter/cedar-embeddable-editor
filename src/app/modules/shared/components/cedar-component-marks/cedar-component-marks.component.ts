import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { textLanguageOf } from '../../a11y/language-tag';

/**
 * The two marks that end a component's title row: its description, shown while editing, and its
 * property IRI. Each is a Tab stop, and focusing it from the keyboard shows its tooltip as a pointer
 * does.
 *
 * A field's marks are drawn in its title row. An element's title row is its panel header, which is a
 * button, and a control inside a button cannot take focus. So the header draws the marks only to keep
 * their room, unseen, and the element draws the marks themselves over that room, outside the button.
 */
@Component({
  selector: 'app-cedar-component-marks',
  templateUrl: './cedar-component-marks.component.html',
  styleUrls: ['./cedar-component-marks.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
  host: { '[class.holds-place]': 'holdsPlace' },
})
export class CedarComponentMarksComponent implements OnInit {
  @Input({ required: true }) componentToRender!: CedarComponent;

  /** Whether the marks are drawn unseen, so that a row keeps their room while they are drawn elsewhere. */
  @Input() holdsPlace = false;

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

  /** The description, where a mark shows it. Read-only, a description is not marked. */
  get description(): string | null {
    const description = this.componentToRender.labelInfo.description;
    return !this.readOnlyMode && description ? description : null;
  }

  /** The property IRI, or null for a component the template gives none. */
  get propertyIri(): string | null {
    return this.componentToRender.propertyIri || null;
  }

  /** The language the template declares for the description, as a `lang` tag, or null. */
  get textLanguage(): string | null {
    return textLanguageOf(this.componentToRender);
  }
}
