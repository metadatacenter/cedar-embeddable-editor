import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor.component';

describe('CedarEmbeddableMetadataEditorComponent', () => {
  let component: CedarEmbeddableMetadataEditorComponent;
  let fixture: ComponentFixture<CedarEmbeddableMetadataEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CedarEmbeddableMetadataEditorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarEmbeddableMetadataEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
