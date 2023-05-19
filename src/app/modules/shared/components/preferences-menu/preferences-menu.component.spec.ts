import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreferencesMenu } from './preferences-menu.component';

describe('PreferencesMenuComponent', () => {
  let component: PreferencesMenu;
  let fixture: ComponentFixture<PreferencesMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PreferencesMenu ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreferencesMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
