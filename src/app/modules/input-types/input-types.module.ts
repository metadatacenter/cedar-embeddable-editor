import {NgModule} from '@angular/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material/card';
import {ReactiveFormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
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
import {CedarInputNumericComponent} from './components/cedar-input-numeric/cedar-input-numeric.component';
import {CedarInputTextComponent} from './components/cedar-input-text/cedar-input-text.component';
import {CedarStaticSectionBreakComponent} from './components/cedar-static-section-break/cedar-static-section-break.component';
import {CedarStaticImageComponent} from './components/cedar-static-image/cedar-static-image.component';
import {CedarStaticYoutubeComponent} from './components/cedar-static-youtube/cedar-static-youtube.component';
import {YouTubePlayerModule} from '@angular/youtube-player';
import {CedarFooBarComponent} from './components/cedar-foo-bar/cedar-foo-bar.component';
import {CedarInputControlledComponent} from './components/cedar-input-controlled/cedar-input-controlled.component';
import {MatAutocompleteModule} from '@angular/material/autocomplete';

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
    YouTubePlayerModule
  ],
  declarations: [
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent
  ],
  providers: [],
  exports: [
    // FooBar is needed because the first component gets exported without style otherwise
    CedarFooBarComponent,
    CedarInputTextComponent,
    CedarInputControlledComponent,
    CedarInputNumericComponent,
    CedarInputEmailComponent,
    CedarStaticSectionBreakComponent,
    CedarStaticImageComponent,
    CedarStaticYoutubeComponent
  ]
})
export class InputTypesModule {
}
