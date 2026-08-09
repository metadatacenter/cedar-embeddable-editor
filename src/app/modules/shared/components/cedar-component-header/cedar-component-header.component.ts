import { Component, Input, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
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
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentHeaderComponent implements OnInit, OnDestroy {
  private static readonly FIELD_TYPE_ICONS: Readonly<Record<string, string>> = {
    [InputType.numeric]: 'dialpad',
    [InputType.text]: 'short_text',
    [InputType.textarea]: 'notes',
    [InputType.richText]: 'format_align_left',
    [InputType.controlled]: 'device_hub',
    [InputType.email]: 'email',
    [InputType.link]: 'link',
    [InputType.phoneNumber]: 'phone',
    [InputType.list]: 'arrow_drop_down_circle',
    [InputType.checkbox]: 'check_box',
    [InputType.radio]: 'radio_button_checked',
    [InputType.temporal]: 'event',
    [InputType.image]: 'image',
    [InputType.youtube]: 'play_circle_filled',
    [InputType.sectionBreak]: 'remove',
    [InputType.pageBreak]: 'insert_drive_file',
    [InputType.attributeValue]: 'list_alt',
  };

  component!: CedarComponent;
  /** Null for a component that is not multi-instance, which is most of them. */
  multiComponent: MultiComponent | null = null;
  shouldRenderRequiredMark = false;
  isOrcid = false;
  isRor = false;
  isPfas = false;
  isPmid = false;
  isRrid = false;
  isNihGrant = false;
  isDoi = false;
  fieldTypeIcon: string | null = null;
  isOntologyField = false;
  readOnlyMode = false;
  readOnlyModeSubscription: Subscription = Subscription.EMPTY;
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

  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    this.shouldRenderRequiredMark = false;
    this.isOrcid = false;
    this.isRor = false;
    this.isPfas = false;
    this.isPmid = false;
    this.isRrid = false;
    this.isNihGrant = false;
    this.isDoi = false;
    this.fieldTypeIcon = null;
    this.isOntologyField = false;

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
    if (this.component instanceof SingleFieldComponent || this.component instanceof MultiFieldComponent) {
      const fieldComp = this.component as unknown as FieldComponent;
      const inputType = fieldComp.basicInfo.inputType;
      if (inputType === InputType.orcid) {
        this.isOrcid = true;
      } else if (inputType === InputType.ror) {
        this.isRor = true;
      } else if (inputType === InputType.pfas) {
        this.isPfas = true;
      } else if (inputType === InputType.pmid) {
        this.isPmid = true;
      } else if (inputType === InputType.rrid) {
        this.isRrid = true;
      } else if (inputType === InputType.nihGrant) {
        this.isNihGrant = true;
      } else if (inputType === InputType.doi) {
        this.isDoi = true;
      } else if (inputType) {
        this.fieldTypeIcon = CedarComponentHeaderComponent.FIELD_TYPE_ICONS[inputType] ?? 'edit';
        this.isOntologyField = inputType === InputType.controlled;
      }
      if (fieldComp.valueInfo.requiredValue) {
        this.shouldRenderRequiredMark = true;
      }
    }
  }
}
