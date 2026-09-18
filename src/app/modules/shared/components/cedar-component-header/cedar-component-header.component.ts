import { Component, DestroyRef, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';
import { MultiComponent } from '../../models/component/multi-component.model';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentHeaderComponent implements OnInit {
  private static readonly FIELD_TYPE_ICONS: Readonly<Record<string, string>> = {
    [InputType.orcid]: 'authority-person',
    [InputType.ror]: 'authority-organization',
    [InputType.pfas]: 'authority-chemical',
    [InputType.pmid]: 'authority-publication',
    [InputType.rrid]: 'authority-resource',
    [InputType.nihGrant]: 'authority-grant',
    [InputType.doi]: 'authority-doi',

    [InputType.numeric]: 'field-number',
    [InputType.text]: 'field-text',
    [InputType.textarea]: 'field-paragraph',
    [InputType.richText]: 'field-rich-text',
    [InputType.controlled]: 'field-controlled',
    [InputType.email]: 'field-email',
    [InputType.link]: 'field-link',
    [InputType.phoneNumber]: 'field-phone',
    [InputType.list]: 'field-list',
    [InputType.checkbox]: 'field-checkbox',
    [InputType.radio]: 'field-radio',
    [InputType.temporal]: 'field-date',
    [InputType.image]: 'field-image',
    [InputType.youtube]: 'field-video',
    [InputType.sectionBreak]: 'field-section-break',
    [InputType.pageBreak]: 'field-page-break',
    [InputType.attributeValue]: 'field-attribute-value',
  };

  component!: CedarComponent;
  /** Null for a component that is not multi-instance, which is most of them. */
  multiComponent: MultiComponent | null = null;
  shouldRenderRequiredMark = false;
  fieldTypeIcon: string | null = null;
  isOntologyField = false;
  readOnlyMode = false;
  /**
   * The field whose specification belongs beside this label, or null for an element, a template or a
   * static field — none of which constrains a value. Set from the same two classes the renderer tests,
   * so the two agree about what a field is.
   */
  fieldToDescribe: FieldComponent | null = null;
  userPreferencesService: UserPreferencesService;

  constructor(
    public cds: ComponentDataService,
    userPreferencesService: UserPreferencesService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.userPreferencesService = userPreferencesService;
  }
  ngOnInit() {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyMode = mode;
    });
  }

  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    this.fieldToDescribe =
      componentToRender instanceof SingleFieldComponent || componentToRender instanceof MultiFieldComponent
        ? (componentToRender as FieldComponent)
        : null;
    this.shouldRenderRequiredMark = false;
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
      if (inputType) {
        this.fieldTypeIcon = CedarComponentHeaderComponent.FIELD_TYPE_ICONS[inputType] ?? 'artifact-field';
        this.isOntologyField = inputType === InputType.controlled;
      }
      if (fieldComp.valueInfo.requiredValue) {
        this.shouldRenderRequiredMark = true;
      }
    }
  }
}
