import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-component-prod',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponentProd implements OnInit {

  ceeConfig = {
    // Do not remove this even if unused
    // The prod build needs it
  };

  constructor() {
  }

  ngOnInit(): void {
  }

}
