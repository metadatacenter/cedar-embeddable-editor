import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RdfPipe} from './pipe/rdf.pipe';


@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [RdfPipe],
  providers: [],
  exports: [RdfPipe]
})
export class SharedModule {
}
