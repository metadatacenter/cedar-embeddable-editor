import { Component, ViewEncapsulation } from '@angular/core';

@Component({
    selector: 'app-static-footer',
    templateUrl: './static-footer.component.html',
    styleUrls: ['./static-footer.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    standalone: false
})
export class StaticFooterComponent {
  constructor() {}
}
