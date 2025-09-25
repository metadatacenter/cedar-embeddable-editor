import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputRridComponent } from './cedar-input-rrid.component';

describe('CedarInputRridComponent', () => {
  let component: CedarInputRridComponent;
  let fixture: ComponentFixture<CedarInputRridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarInputRridComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CedarInputRridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
