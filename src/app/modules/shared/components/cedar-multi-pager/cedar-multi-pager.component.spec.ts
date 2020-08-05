import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarMultiPagerComponent } from './cedar-multi-pager.component';

describe('CedarMultiPagerComponent', () => {
  let component: CedarMultiPagerComponent;
  let fixture: ComponentFixture<CedarMultiPagerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CedarMultiPagerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarMultiPagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
