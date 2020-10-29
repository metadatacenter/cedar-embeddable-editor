import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SecureJsonPipe} from './pipe/secure-json.pipe';


@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [SecureJsonPipe],
  providers: [],
  exports: [SecureJsonPipe]
})
export class SharedModule {
}
