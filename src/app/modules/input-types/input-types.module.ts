import {NgModule} from '@angular/core';
import {CedarInputEmailComponent} from './components/cedar-input-email/cedar-input-email.component';
import {MatFormFieldModule} from '@angular/material/form-field';
import {BrowserModule} from '@angular/platform-browser';
import {AppRoutingModule} from '../../app-routing.module';
import {HttpClientModule} from '@angular/common/http';
import {SharedModule} from '../shared/shared.module';
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
import {CedarInputNumericComponent} from './components/cedar-input-numeric/cedar-input-numeric.component';
import {CedarInputTextfieldComponent} from './components/cedar-input-textfield/cedar-input-textfield.component';
import {CedarStaticSectionBreakComponent} from './components/cedar-static-section-break/cedar-static-section-break.component';


@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
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
  ],
  declarations: [
    CedarInputEmailComponent,
    CedarInputNumericComponent,
    CedarInputTextfieldComponent,
    CedarStaticSectionBreakComponent],
  providers: [],
  exports: [
    CedarInputEmailComponent,
    CedarInputNumericComponent,
    CedarInputTextfieldComponent,
    CedarStaticSectionBreakComponent]
})
export class InputTypesModule {
}
