import { ChangeDetectorRef, Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { CedarComponent } from '../component/cedar-component.model';

@Directive()
export abstract class CedarUIDirective implements OnInit, OnDestroy {
  protected readonly userPreferencesService = inject(UserPreferencesService);
  protected readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly componentRegistry = inject(ActiveComponentRegistryService);
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

  /*
   * `Subscription.EMPTY` rather than nothing, here and in the five components that
   * keep their own. It is a real subscription to nothing, so "never subscribed"
   * stops being a separate state the teardown has to test for — the closed
   * singleton's `unsubscribe` is a no-op by design.
   */
  protected readOnlyModeSubscription: Subscription = Subscription.EMPTY;

  protected constructor() {}
  ngOnInit() {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
      this.onReadOnlyModeChange(mode);
    });
  }
  ngOnDestroy(): void {
    this.readOnlyModeSubscription.unsubscribe();
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
