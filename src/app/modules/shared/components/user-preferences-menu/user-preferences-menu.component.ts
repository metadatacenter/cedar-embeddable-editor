import { Component, ViewChild } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Component({
  selector: 'user-preferences-menu',
  templateUrl: './user-preferences-menu.component.html',
  styleUrls: ['./user-preferences-menu.component.scss'],
})
export class UserPreferencesMenu {
  @ViewChild(MatMenuTrigger, { static: true }) menuTrigger!: MatMenuTrigger;
  constructor(private userPreferencesService: UserPreferencesService) {
    this.userPreferencesService = userPreferencesService;
  }
  readOnlyMode$ = false;

  toggleReadOnly(checked: boolean): void {
    this.userPreferencesService.setReadOnlyMode(checked);
  }
  enableReadOnlyMode() {
    this.readOnlyMode$ = true;
    this.userPreferencesService.setReadOnlyMode(true);
  }
  close(): void {
    this.menuTrigger.closeMenu();
  }
}
