import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarStaticRichTextComponent } from './cedar-static-rich-text.component';

describe('CedarStaticRichTextComponent', () => {
  let component: CedarStaticRichTextComponent;
  let fixture: ComponentFixture<CedarStaticRichTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarStaticRichTextComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarStaticRichTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
