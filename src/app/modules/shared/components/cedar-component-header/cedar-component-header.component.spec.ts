import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarComponentHeaderComponent } from './cedar-component-header.component';

describe('CedarComponentHeaderComponent', () => {
  let component: CedarComponentHeaderComponent;
  let fixture: ComponentFixture<CedarComponentHeaderComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarComponentHeaderComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarComponentHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
