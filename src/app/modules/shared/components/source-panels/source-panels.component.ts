import {Component, Input, OnInit} from '@angular/core';
import {DataContext} from '../../util/data-context';

@Component({
  selector: 'app-source-panels',
  templateUrl: './source-panels.component.html',
  styleUrls: ['./source-panels.component.scss']
})
export class SourcePanelsComponent implements OnInit {

  @Input() dataContext: DataContext = null;

  constructor() {
  }

  ngOnInit(): void {
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }

}
