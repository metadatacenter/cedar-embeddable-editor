import { SpecPlaceholderPipe } from '../shared/pipe/spec-placeholder.pipe';
import { CedarTermLinkComponent } from '../shared/components/cedar-term-link/cedar-term-link.component';
import { NgModule } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MAT_AUTOCOMPLETE_SCROLL_STRATEGY } from '@angular/material/autocomplete';
import { MAT_SELECT_SCROLL_STRATEGY } from '@angular/material/select';
import { DOCUMENT } from '@angular/common';
import { RepositionOnAnyScrollStrategy } from './reposition-on-any-scroll.strategy';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
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
import { CedarFooBarComponent } from './components/cedar-foo-bar/cedar-foo-bar.component';
import { CedarInputControlledComponent } from './components/cedar-input-controlled/cedar-input-controlled.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TrustHtmlPipe } from '../shared/pipe/keep-html.pipe';
import { SafeHtmlPipe } from '../shared/pipe/safe-html.pipe';
import { DatePickerComponent } from '../shared/components/date-picker/date-picker.component';
import { TimezonePickerComponent } from '../shared/components/timezone-picker/timezone-picker.component';
import { TimePickerComponent } from '../shared/components/time-picker/time-picker.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
    FormsModule,
    MatSelectModule,
    TranslateModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  declarations: [
    SpecPlaceholderPipe,
    CedarTermLinkComponent,
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
    CedarInputPfasComponent,
    CedarInputRridComponent,
    CedarInputPmidComponent,
    CedarInputNihGrantComponent,
    CedarInputDoiComponent,
  ],
  providers: [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    /*
     * Both overlay kinds CEE opens, because both default to Material's reposition
     * strategy and neither can see the container an embedding page scrolls — see
     * `RepositionOnAnyScrollStrategy` for why. The autocomplete is where it was
     * reported, on the authority and controlled-term fields; the select is the
     * timezone picker and the choice lists, which had the same defect unreported.
     *
     * A factory rather than a value: a `ScrollStrategy` holds the overlay it is
     * attached to, so every overlay needs its own.
     */
    {
      provide: MAT_AUTOCOMPLETE_SCROLL_STRATEGY,
      useFactory: (documentRef: Document) => () => new RepositionOnAnyScrollStrategy(documentRef),
      deps: [DOCUMENT],
    },
    {
      provide: MAT_SELECT_SCROLL_STRATEGY,
      useFactory: (documentRef: Document) => () => new RepositionOnAnyScrollStrategy(documentRef),
      deps: [DOCUMENT],
    },
  ],
  exports: [
    // Exported for the shared module, whose field-spec block shows what no control can.
    SpecPlaceholderPipe,
    CedarTermLinkComponent,
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
    CedarInputPmidComponent,
    CedarInputRridComponent,
    CedarInputNihGrantComponent,
    CedarInputDoiComponent,
  ],
})
export class InputTypesModule {}
