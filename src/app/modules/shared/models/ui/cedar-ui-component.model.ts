import {Component, OnInit} from '@angular/core';

@Component({
  template: ''
})
export abstract class CedarUIComponent implements OnInit {

  abstract ngOnInit(): void;

  abstract setCurrentValue(currentValue: any): void;
}
