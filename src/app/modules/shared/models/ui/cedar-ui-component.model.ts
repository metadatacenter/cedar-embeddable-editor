import { AbstractControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { EditedFieldErrorStateMatcher } from '../../../input-types/edited-field-error-state-matcher';
import { ChangeDetectorRef, DestroyRef, Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { CedarComponent } from '../component/cedar-component.model';
import { BasicInfo } from '../info/basic-info.model';
import { languageTag } from '../../a11y/language-tag';
import { renderingLabelOf } from '../../service/component-data.service';

@Directive()
export abstract class CedarUIDirective implements OnInit, OnDestroy {
  protected readonly userPreferencesService = inject(UserPreferencesService);
  protected readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly componentRegistry = inject(ActiveComponentRegistryService);
  /** Component-scoped teardown signal for subscriptions and delayed UI work. */
  protected readonly destroyRef = inject(DestroyRef);
  abstract component: CedarComponent;
  /**
   * The value the field should now show, as it sits in the instance.
   *
   * `unknown` rather than `any` because it genuinely varies by field: a string for
   * text, link, phone and email; `string[]` for checkbox; an object for
   * attribute-value and controlled terms. There is no one type, and pretending
   * otherwise with `any` meant every implementation silently opted out of checking.
   * Each narrows what it expects instead — several already did.
   */
  abstract setCurrentValue(currentValue: unknown): void;

  /**
   * The `@language` tag the shown value carries, set beside each `setCurrentValue`.
   *
   * A read-only widget marks the value with it, since an instance may hold text in a language other
   * than CEE's own.
   */
  valueLanguage: string | null = null;

  readOnlyMode = false;

  /** The field's label as the form shows it, which every name for one of its controls contains. */
  get fieldLabel(): string {
    return renderingLabelOf(this.component);
  }

  /**
   * The language the field declares for its values, as a `lang` tag, or null where it declares none
   * or declares a tag that is not well formed. A static component declares none.
   */
  get declaredValueLanguage(): string | null {
    const component = this.component;
    return 'basicInfo' in component && component.basicInfo instanceof BasicInfo
      ? languageTag(component.basicInfo.valueLanguage)
      : null;
  }

  /**
   * The `lang` the control showing the value is marked with.
   *
   * Read-only, that is the tag the shown value carries, where it carries one. Otherwise it is the
   * language the field declares, since whatever is typed into the field is a value of it. The tag a
   * stored value carries does not mark an editable box: what the box holds is being typed.
   */
  get valueLanguageMark(): string | null {
    return (this.readOnlyMode ? languageTag(this.valueLanguage) : null) ?? this.declaredValueLanguage;
  }

  quietEmptyPreview(value: unknown): boolean {
    return (
      this.userPreferencesService.suppressEmptyFieldErrors &&
      (value == null || value === '' || (Array.isArray(value) && value.length === 0))
    );
  }

  protected previewMatcher(delegate: ErrorStateMatcher): ErrorStateMatcher {
    return {
      isErrorState: (control, form) => !this.quietEmptyPreview(control?.value) && delegate.isErrorState(control, form),
    };
  }

  readonly previewErrorStateMatcher = this.previewMatcher(new EditedFieldErrorStateMatcher());

  protected constructor() {}
  ngOnInit() {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyMode = mode;
      this.onReadOnlyModeChange(mode);
    });
  }
  ngOnDestroy(): void {
    this.componentRegistry.unregisterComponent(this.component, this);
  }
  deleteCurrentValue(): void {
    // do nothing unless overridden
    // used for executing component-specific operations
    // for deleting an instance
  }
  protected onReadOnlyModeChange(_mode: boolean): void {
    this.cdr.markForCheck();
  }

  /**
   * Whether the host has taken the user to this field.
   *
   * An unanswered requirement stays quiet on a form nobody has started, and speaks
   * once the user reaches the field, whether by leaving it or by being taken to it.
   */
  revealed = false;

  /** The user has been taken to this field, so its unanswered requirement speaks. */
  markRevealed(): void {
    this.revealed = true;
    for (const control of this.revealedControls()) {
      control.markAllAsTouched();
    }
    this.cdr.markForCheck();
  }

  /** The controls whose requirement a reveal makes visible. None for a field with nothing to answer. */
  protected revealedControls(): AbstractControl[] {
    return [];
  }
}
