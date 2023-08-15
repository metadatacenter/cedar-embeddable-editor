import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CedarEmbeddableMetadataEditorWrapperComponent} from './cedar-embeddable-metadata-editor-wrapper.component';


describe('CedarEmbeddableMetadataEditorWrapperComponent', () => {
  let component: CedarEmbeddableMetadataEditorWrapperComponent;
  let fixture: ComponentFixture<CedarEmbeddableMetadataEditorWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CedarEmbeddableMetadataEditorWrapperComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CedarEmbeddableMetadataEditorWrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
