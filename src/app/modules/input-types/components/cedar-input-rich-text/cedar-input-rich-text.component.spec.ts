import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {CedarInputRichTextComponent} from './cedar-input-rich-text.component';

describe('CedarInputRichTextComponent', () => {
  let component: CedarInputRichTextComponent;
  let fixture: ComponentFixture<CedarInputRichTextComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CedarInputRichTextComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarInputRichTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
