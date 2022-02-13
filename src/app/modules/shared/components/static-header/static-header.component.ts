import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-static-header',
  templateUrl: './static-header.component.html',
  styleUrls: ['./static-header.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StaticHeaderComponent implements OnInit {

  @Input() callbackOwnerObject: any = null;


  constructor() {
  }

  ngOnInit(): void {
  }

}
