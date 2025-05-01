import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserPreferencesMenu } from './user-preferences-menu.component';

describe('PreferencesMenuComponent', () => {
  let component: UserPreferencesMenu;
  let fixture: ComponentFixture<UserPreferencesMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserPreferencesMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(UserPreferencesMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
