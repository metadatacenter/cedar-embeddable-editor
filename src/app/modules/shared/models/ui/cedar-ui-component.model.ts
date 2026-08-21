import { ChangeDetectorRef, DestroyRef, Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { CedarComponent } from '../component/cedar-component.model';

@Directive()
export abstract class CedarUIDirective implements OnInit, OnDestroy {
  protected readonly userPreferencesService = inject(UserPreferencesService);
  protected readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly componentRegistry = inject(ActiveComponentRegistryService);
  private readonly destroyRef = inject(DestroyRef);
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

  readOnlyMode = false;

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
}
