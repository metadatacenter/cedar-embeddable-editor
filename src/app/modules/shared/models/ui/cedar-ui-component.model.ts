import { Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Directive()
export abstract class CedarUIDirective implements OnInit, OnDestroy {
  protected readonly userPreferencesService = inject(UserPreferencesService);
  abstract setCurrentValue(currentValue: any): void;

  readOnlyMode = false;

  private readOnlyModeSubscription: Subscription;

  protected constructor() {}
  ngOnInit() {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
    });
  }
  ngOnDestroy(): void {
    this.readOnlyModeSubscription?.unsubscribe();
  }
  deleteCurrentValue(): void {
    // do nothing unless overridden
    // used for executing component-specific operations
    // for deleting an instance
  }
}
