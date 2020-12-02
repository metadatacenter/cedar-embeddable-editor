import {Component, OnInit, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-static-footer',
  templateUrl: './static-footer.component.html',
  styleUrls: ['./static-footer.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StaticFooterComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
