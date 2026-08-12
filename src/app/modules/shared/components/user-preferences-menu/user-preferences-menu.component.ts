import { Component, Input, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { UserPreferencesService } from '../../service/user-preferences.service';

@Component({
  selector: 'user-preferences-menu',
  templateUrl: './user-preferences-menu.component.html',
  styleUrls: ['./user-preferences-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UserPreferencesMenuComponent {
  @ViewChild(MatMenuTrigger, { static: false }) menuTrigger!: MatMenuTrigger;
  constructor(private userPreferencesService: UserPreferencesService) {
    this.userPreferencesService = userPreferencesService;
  }
  readOnlyMode$ = false;
  visible: boolean = true;

  /**
   * Whether the host, rather than the user, put the editor in read-only mode.
   *
   * A locked toggle rather than a hidden one, so the state is visible and its
   * source is explained instead of the control silently disappearing.
   */
  locked = false;

  /**
   * Read-only as the host configured it, which the user cannot then undo.
   *
   * The toggle used to write straight to the service the widgets read, so a host
   * embedding a form as a viewer got a form the user could switch back to
   * editable — and a host offering its own save button would then store the
   * edits. Host policy and user preference shared one piece of state; this input
   * is the policy, and it wins.
   */
  @Input() set hostReadOnly(isReadOnly: boolean) {
    if (isReadOnly) {
      this.locked = true;
      this.enableReadOnlyMode();
    }
  }
  @Input() set isVisible(visible: boolean) {
    this.visible = visible;
  }
  toggleReadOnly(checked: boolean): void {
    if (this.locked) {
      return;
    }
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
