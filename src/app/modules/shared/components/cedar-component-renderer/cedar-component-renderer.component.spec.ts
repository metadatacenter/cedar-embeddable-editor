import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarComponentRendererComponent } from './cedar-component-renderer.component';

describe('CedarComponentRendererComponent', () => {
  let component: CedarComponentRendererComponent;
  let fixture: ComponentFixture<CedarComponentRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarComponentRendererComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarComponentRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
