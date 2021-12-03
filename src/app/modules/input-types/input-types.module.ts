import {NgModule} from '@angular/core';
import {MatFormFieldModule} from '@angular/material/form-field';
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
import {CedarInputEmailComponent} from './components/cedar-input-email/cedar-input-email.component';
import {CedarInputCheckboxComponent} from './components/cedar-input-checkbox/cedar-input-checkbox.component';
import {CedarInputSelectComponent} from './components/cedar-input-select/cedar-input-select.component';
import {CedarInputMultipleChoiceComponent} from './components/cedar-input-multiple-choice/cedar-input-multiple-choice.component';
import {CedarInputDatetimeComponent} from './components/cedar-input-datetime/cedar-input-datetime.component';
import {CedarInputLinkComponent} from './components/cedar-input-link/cedar-input-link.component';
import {CedarInputNumericComponent} from './components/cedar-input-numeric/cedar-input-numeric.component';
import {CedarInputTextComponent} from './components/cedar-input-text/cedar-input-text.component';
import {CedarInputRichTextComponent} from './components/cedar-input-rich-text/cedar-input-rich-text.component';
import {CedarInputPhoneComponent} from './components/cedar-input-phone/cedar-input-phone.component';
import {CedarStaticSectionBreakComponent} from './components/cedar-static-section-break/cedar-static-section-break.component';
import {CedarStaticImageComponent} from './components/cedar-static-image/cedar-static-image.component';
import {CedarStaticYoutubeComponent} from './components/cedar-static-youtube/cedar-static-youtube.component';
import {YouTubePlayerModule} from '@angular/youtube-player';
import {CedarFooBarComponent} from './components/cedar-foo-bar/cedar-foo-bar.component';
import {CedarInputControlledComponent} from './components/cedar-input-controlled/cedar-input-controlled.component';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {CKEditorModule} from '@ckeditor/ckeditor5-angular';
import {NgMultiSelectDropDownModule} from 'ng-multiselect-dropdown';
import {EscapeHtmlPipe} from '../shared/pipe/keep-html.pipe';

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
    YouTubePlayerModule,
    CKEditorModule,
    NgMultiSelectDropDownModule.forRoot(),
    FormsModule
  ],
  declarations: [
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputRichTextComponent,
    CedarInputPhoneComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarInputCheckboxComponent,
    CedarInputSelectComponent,
    CedarInputMultipleChoiceComponent,
    CedarInputDatetimeComponent,
    CedarInputLinkComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent,
    EscapeHtmlPipe
  ],
  providers: [],
  exports: [
    // FooBar is needed because the first component gets exported without style otherwise
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputRichTextComponent,
    CedarInputPhoneComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarInputCheckboxComponent,
    CedarInputSelectComponent,
    CedarInputMultipleChoiceComponent,
    CedarInputDatetimeComponent,
    CedarInputLinkComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent,
    EscapeHtmlPipe
  ]
})
export class InputTypesModule {
}
