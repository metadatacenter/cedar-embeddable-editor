import { NgModule } from '@angular/core';
import {
  MAT_LEGACY_FORM_FIELD_DEFAULT_OPTIONS as MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatLegacyFormFieldModule as MatFormFieldModule,
} from '@angular/material/legacy-form-field';
import { CommonModule } from '@angular/common';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { NgSelectModule } from '@ng-select/ng-select';
import { CedarInputEmailComponent } from './components/cedar-input-email/cedar-input-email.component';
import { CedarInputCheckboxComponent } from './components/cedar-input-checkbox/cedar-input-checkbox.component';
import { CedarInputSelectComponent } from './components/cedar-input-select/cedar-input-select.component';
import { CedarInputAttributeValueComponent } from './components/cedar-input-attribute-value/cedar-input-attribute-value.component';
import { CedarInputMultipleChoiceComponent } from './components/cedar-input-multiple-choice/cedar-input-multiple-choice.component';
import { CedarInputDatetimeComponent } from './components/cedar-input-datetime/cedar-input-datetime.component';
import { CedarInputLinkComponent } from './components/cedar-input-link/cedar-input-link.component';
import { CedarInputNumericComponent } from './components/cedar-input-numeric/cedar-input-numeric.component';
import { CedarInputTextComponent } from './components/cedar-input-text/cedar-input-text.component';
import { CedarInputPhoneComponent } from './components/cedar-input-phone/cedar-input-phone.component';
import { CedarStaticRichTextComponent } from './components/cedar-static-rich-text/cedar-static-rich-text.component';
import { CedarStaticSectionBreakComponent } from './components/cedar-static-section-break/cedar-static-section-break.component';
import { CedarStaticPageBreakComponent } from './components/cedar-static-page-break/cedar-static-page-break.component';
import { CedarStaticImageComponent } from './components/cedar-static-image/cedar-static-image.component';
import { CedarStaticYoutubeComponent } from './components/cedar-static-youtube/cedar-static-youtube.component';
import { CedarInputOrcidComponent } from './components/cedar-input-orcid/cedar-input-orcid.component';
import { CedarInputRorComponent } from './components/cedar-input-ror/cedar-input-ror.component';
import { RorDetailsComponent } from './components/cedar-input-ror/ror-details/ror-details.component';
import { CedarFooBarComponent } from './components/cedar-foo-bar/cedar-foo-bar.component';
import { CedarInputControlledComponent } from './components/cedar-input-controlled/cedar-input-controlled.component';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { TrustHtmlPipe } from '../shared/pipe/keep-html.pipe';
import { SafeHtmlPipe } from '../shared/pipe/safe-html.pipe';
import { DatePickerComponent } from '../shared/components/date-picker/date-picker.component';
import { TimezonePickerComponent } from '../shared/components/timezone-picker/timezone-picker.component';
import { TimePickerComponent } from '../shared/components/time-picker/time-picker.component';
import { TranslateModule } from '@ngx-translate/core';
import { NgOptimizedImage } from '@angular/common';
import { OrcidDetailsComponent } from './components/cedar-input-orcid/orcid-details/orcid-details.component';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { CedarInputPfasComponent } from './components/cedar-input-pfas/cedar-input-pfas.component';
import { CedarInputRridComponent } from './components/cedar-input-rrid/cedar-input-rrid.component';
import { CedarInputPmidComponent } from './components/cedar-input-pmid/cedar-input-pmid.component';
import { CedarInputNihGrantComponent } from './components/cedar-input-nih-grant/cedar-input-nih-grant.component';
import { CedarInputDoiComponent } from './components/cedar-input-doi/cedar-input-doi.component';

@NgModule({
  imports: [
    CommonModule,
    MatAutocompleteModule,
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatRadioModule,
    MatIconModule,
    MatExpansionModule,
    MatButtonModule,
    MatTooltipModule,
    ClipboardModule,
    MatToolbarModule,
    MatRippleModule,
    MatPaginatorModule,
    MatChipsModule,
    MatGridListModule,
    MatDatepickerModule,
    MatNativeDateModule,
    NgSelectModule,
    FormsModule,
    MatSelectModule,
    TranslateModule,
    NgOptimizedImage,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  declarations: [
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputPhoneComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarInputCheckboxComponent,
    CedarInputSelectComponent,
    CedarInputAttributeValueComponent,
    CedarInputMultipleChoiceComponent,
    CedarInputDatetimeComponent,
    CedarInputLinkComponent,
    CedarInputOrcidComponent,
    CedarInputRorComponent,
    RorDetailsComponent,
    CedarStaticRichTextComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticPageBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent,
    DatePickerComponent,
    TimePickerComponent,
    TimezonePickerComponent,
    TrustHtmlPipe,
    SafeHtmlPipe,
    OrcidDetailsComponent,
    CedarInputPfasComponent,
    CedarInputRridComponent,
    CedarInputPmidComponent,
    CedarInputNihGrantComponent,
    CedarInputDoiComponent,
  ],
  providers: [{ provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } }],
  exports: [
    // FooBar is needed because the first component gets exported without style otherwise
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputPhoneComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarInputCheckboxComponent,
    CedarInputSelectComponent,
    CedarInputAttributeValueComponent,
    CedarInputMultipleChoiceComponent,
    CedarInputDatetimeComponent,
    CedarInputLinkComponent,
    CedarStaticRichTextComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticPageBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent,
    TrustHtmlPipe,
    SafeHtmlPipe,
    CedarInputOrcidComponent,
    CedarInputRorComponent,
    CedarInputPfasComponent,
    RorDetailsComponent,
    CedarInputPmidComponent,
    CedarInputRridComponent,
    CedarInputNihGrantComponent,
    CedarInputDoiComponent,
  ],
})
export class InputTypesModule {}
