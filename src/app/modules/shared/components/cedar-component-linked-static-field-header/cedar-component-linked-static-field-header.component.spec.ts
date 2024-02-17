import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarComponentLinkedStaticFieldHeaderComponent } from './cedar-component-linked-static-field-header.component';

describe('CedarComponentLinkedStaticFieldHeaderComponent', () => {
  let component: CedarComponentLinkedStaticFieldHeaderComponent;
  let fixture: ComponentFixture<CedarComponentLinkedStaticFieldHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarComponentLinkedStaticFieldHeaderComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarComponentLinkedStaticFieldHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
