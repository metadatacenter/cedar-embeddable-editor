import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { SampleTemplateLoaderOwner } from '../../models/ui/sample-template-loader-owner.model';

@Component({
  selector: 'app-static-header',
  templateUrl: './static-header.component.html',
  styleUrls: ['./static-header.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StaticHeaderComponent {
  @Input() callbackOwnerObject: SampleTemplateLoaderOwner = null;
  @Input() showSampleTemplateLinks: boolean = null;

  constructor() {}
}
