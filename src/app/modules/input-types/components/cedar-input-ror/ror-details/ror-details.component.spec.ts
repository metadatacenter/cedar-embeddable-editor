import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RorDetailsComponent } from './ror-details.component';

describe('RorDetailsComponent', () => {
  let component: RorDetailsComponent;
  let fixture: ComponentFixture<RorDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RorDetailsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RorDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
