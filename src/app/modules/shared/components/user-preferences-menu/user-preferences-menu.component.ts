// preferences-menu.component.ts
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { HandlerContext } from '../../util/handler-context';

@Component({
  selector: 'preferences-menu',
  templateUrl: './preferences-menu.component.html',
  styleUrls: ['./preferences-menu.component.scss'],
})
export class PreferencesMenu {
  @Input() handlerContext!: HandlerContext;
  @Output() readOnlyModeChange = new EventEmitter<boolean>();
  @ViewChild(MatMenuTrigger, { static: true }) menuTrigger!: MatMenuTrigger;

  close(): void {
    this.menuTrigger.closeMenu();
  }
  toggleReadOnly(checked: boolean): void {
    this.readOnlyModeChange.emit(checked);
  }
}
