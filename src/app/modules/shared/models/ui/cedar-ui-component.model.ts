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
  abstract setCurrentValue(currentValue: any): void;

  readOnlyMode = false;

  protected readOnlyModeSubscription: Subscription;

  protected constructor() {}
  ngOnInit() {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
      this.onReadOnlyModeChange(mode);
    });
  }
  ngOnDestroy(): void {
    this.readOnlyModeSubscription?.unsubscribe();
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
