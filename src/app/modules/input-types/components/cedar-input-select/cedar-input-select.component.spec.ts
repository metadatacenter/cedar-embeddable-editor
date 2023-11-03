import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarInputSelectComponent } from './cedar-input-select.component';

describe('CedarInputSelectComponent', () => {
  let component: CedarInputSelectComponent;
  let fixture: ComponentFixture<CedarInputSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarInputSelectComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
