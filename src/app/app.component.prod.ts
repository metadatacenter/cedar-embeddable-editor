import { Component } from '@angular/core';

@Component({
  selector: 'app-component-prod',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppProdComponent {
  ceeConfig = {
    // Do not remove this even if unused
    // The prod build needs it
  };

  constructor() {}
}
