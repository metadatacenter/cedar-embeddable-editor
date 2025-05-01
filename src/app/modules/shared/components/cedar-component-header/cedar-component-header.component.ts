import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';
import { MultiComponent } from '../../models/component/multi-component.model';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { Subscription } from 'rxjs';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarComponentHeaderComponent implements OnInit, OnDestroy {
  component: CedarComponent;
  multiComponent: MultiComponent;
  shouldRenderRequiredMark = false;
  isOrcid = false;
  isRor = false;
  readOnlyMode: boolean;
  readOnlyModeSubscription: Subscription;
  userPreferencesService: UserPreferencesService;

  constructor(
    public cds: ComponentDataService,
    userPreferencesService: UserPreferencesService,
  ) {
    this.userPreferencesService = userPreferencesService;
  }
  ngOnInit() {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
    });
  }

  ngOnDestroy(): void {
    this.readOnlyModeSubscription.unsubscribe();
  }

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    if (ComponentTypeHandler.isMulti(componentToRender)) {
      this.multiComponent = componentToRender as MultiComponent;
      if (this.multiComponent instanceof MultiFieldComponent) {
        const _multiToFieldComp = this.multiComponent as MultiFieldComponent;
        if (_multiToFieldComp.valueInfo.requiredValue) {
          this.shouldRenderRequiredMark = true;
        }
      }
    } else {
      this.multiComponent = null;
    }
    if (this.component instanceof SingleFieldComponent) {
      const fieldComp = this.component as unknown as FieldComponent;
      if (fieldComp.basicInfo.inputType === InputType.orcid) {
        this.isOrcid = true;
      } else if (fieldComp.basicInfo.inputType === InputType.ror) {
        this.isRor = true;
      }
      if (fieldComp.valueInfo.requiredValue) {
        this.shouldRenderRequiredMark = true;
      }
    }
  }
}
