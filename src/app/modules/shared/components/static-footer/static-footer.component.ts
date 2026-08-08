import { Component, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-static-footer',
  templateUrl: './static-footer.component.html',
  styleUrls: ['./static-footer.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StaticFooterComponent {
  constructor() {}
}
