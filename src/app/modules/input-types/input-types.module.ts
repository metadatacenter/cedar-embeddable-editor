import {NgModule} from '@angular/core';
import {MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule} from '@angular/material/form-field';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material/card';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatRadioModule} from '@angular/material/radio';
import {MatIconModule} from '@angular/material/icon';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ClipboardModule} from '@angular/cdk/clipboard';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatRippleModule} from '@angular/material/core';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatChipsModule} from '@angular/material/chips';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';
import {MatSelectModule} from '@angular/material/select';
import {NgxMatDatetimePickerModule, NgxMatNativeDateModule, NgxMatTimepickerModule} from '@angular-material-components/datetime-picker';
import {NgSelectModule} from '@ng-select/ng-select';
import {CedarInputEmailComponent} from './components/cedar-input-email/cedar-input-email.component';
import {CedarInputCheckboxComponent} from './components/cedar-input-checkbox/cedar-input-checkbox.component';
import {CedarInputSelectComponent} from './components/cedar-input-select/cedar-input-select.component';
import {CedarInputAttributeValueComponent} from './components/cedar-input-attribute-value/cedar-input-attribute-value.component';
import {CedarInputMultipleChoiceComponent} from './components/cedar-input-multiple-choice/cedar-input-multiple-choice.component';
import {CedarInputDatetimeComponent} from './components/cedar-input-datetime/cedar-input-datetime.component';
import {CedarInputLinkComponent} from './components/cedar-input-link/cedar-input-link.component';
import {CedarInputNumericComponent} from './components/cedar-input-numeric/cedar-input-numeric.component';
import {CedarInputTextComponent} from './components/cedar-input-text/cedar-input-text.component';
import {CedarInputPhoneComponent} from './components/cedar-input-phone/cedar-input-phone.component';
import {CedarStaticRichTextComponent} from './components/cedar-static-rich-text/cedar-static-rich-text.component';
import {CedarStaticSectionBreakComponent} from './components/cedar-static-section-break/cedar-static-section-break.component';
import {CedarStaticPageBreakComponent} from './components/cedar-static-page-break/cedar-static-page-break.component';
import {CedarStaticImageComponent} from './components/cedar-static-image/cedar-static-image.component';
import {CedarStaticYoutubeComponent} from './components/cedar-static-youtube/cedar-static-youtube.component';
import {YouTubePlayerModule} from '@angular/youtube-player';
import {CedarFooBarComponent} from './components/cedar-foo-bar/cedar-foo-bar.component';
import {CedarInputControlledComponent} from './components/cedar-input-controlled/cedar-input-controlled.component';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {EscapeHtmlPipe} from '../shared/pipe/keep-html.pipe';
import {DatePickerComponent} from '../shared/components/date-picker/date-picker.component';
import {TimezonePickerComponent} from '../shared/components/timezone-picker/timezone-picker.component';
import {MatFileUploadModule} from '../shared/components/file-uploader/mat-file-upload.module';
import {FileUploaderComponent} from '../shared/components/file-uploader/file-uploader.component';

@NgModule({
    imports: [
        BrowserModule,
        HttpClientModule,
        BrowserAnimationsModule,
        MatAutocompleteModule,
        MatCardModule,
        MatFormFieldModule,
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
        NgxMatDatetimePickerModule,
        NgxMatTimepickerModule,
        NgxMatNativeDateModule,
        NgSelectModule,
        MatFileUploadModule,
        YouTubePlayerModule,
        FormsModule,
        MatSelectModule
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
    CedarStaticRichTextComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticPageBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent,
    DatePickerComponent,
    TimezonePickerComponent,
    FileUploaderComponent,
    EscapeHtmlPipe
  ],
  providers: [
    MatDatepickerModule,
    MatNativeDateModule,
    {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: 'outline'}}
  ],
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
    EscapeHtmlPipe,
    FileUploaderComponent
  ]
})
export class InputTypesModule {
}
