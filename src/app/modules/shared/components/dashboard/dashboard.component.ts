import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  encapsulation: ViewEncapsulation.ShadowDom
})
export class DashboardComponent implements OnInit {

  @Input() callbackOwnerObject: any = null;

  constructor() {
  }

  ngOnInit(): void {
  }

  loadBuiltinTemplate(s: string): void {
    if (this.callbackOwnerObject.loadSampleTemplate != null) {
      this.callbackOwnerObject.loadSampleTemplate(s);
    } else {
      console.log('Load Template:' + s);
    }
  }
}
