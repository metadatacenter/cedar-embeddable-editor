import { Component, Input, ViewChild } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Component({
  selector: 'user-preferences-menu',
  templateUrl: './user-preferences-menu.component.html',
  styleUrls: ['./user-preferences-menu.component.scss'],
})
export class UserPreferencesMenu {
  @ViewChild(MatMenuTrigger, { static: false }) menuTrigger!: MatMenuTrigger;
  constructor(private userPreferencesService: UserPreferencesService) {
    this.userPreferencesService = userPreferencesService;
  }
  readOnlyMode$ = false;
  visible: boolean = true;

  @Input() set readOnlyMode(isReadOnly: boolean) {
    if (isReadOnly) {
      this.enableReadOnlyMode();
    }
  }
  @Input() set isVisible(visible: boolean) {
    this.visible = visible;
  }
  toggleReadOnly(checked: boolean): void {
    this.readOnlyMode$ = checked;
    this.userPreferencesService.setReadOnlyMode(checked);
  }
  enableReadOnlyMode() {
    this.readOnlyMode$ = true;
    this.userPreferencesService.setReadOnlyMode(true);
  }
  close(): void {
    this.menuTrigger?.closeMenu();
  }
}
