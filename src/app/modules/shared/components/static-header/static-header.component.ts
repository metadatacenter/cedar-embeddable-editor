import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-static-header',
  templateUrl: './static-header.component.html',
  styleUrls: ['./static-header.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  standalone: false,
})
export class StaticHeaderComponent {
  @Input() callbackOwnerObject: any = null;
  @Input() showSampleTemplateLinks: boolean = null;

  constructor() {}
}
