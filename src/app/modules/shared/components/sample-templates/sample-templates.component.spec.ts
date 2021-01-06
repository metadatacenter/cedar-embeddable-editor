import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SampleTemplatesComponent } from './sample-templates.component';

describe('SampleTemplatesComponent', () => {
  let component: SampleTemplatesComponent;
  let fixture: ComponentFixture<SampleTemplatesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SampleTemplatesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SampleTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
