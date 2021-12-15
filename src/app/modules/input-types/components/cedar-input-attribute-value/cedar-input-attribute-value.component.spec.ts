import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {CedarInputAttributeValueComponent} from './cedar-input-attribute-value.component';

describe('CedarInputAttributeValueComponent', () => {
  let component: CedarInputAttributeValueComponent;
  let fixture: ComponentFixture<CedarInputAttributeValueComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarInputAttributeValueComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputAttributeValueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
