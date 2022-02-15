import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {MatListOption} from '@angular/material/list/public-api';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {HttpClient} from '@angular/common/http';
import {SampleTemplatesService} from './sample-templates.service';
import {Subject} from 'rxjs';
import {FormControl} from '@angular/forms';
import {takeUntil} from 'rxjs/operators';

@Component({
  selector: 'app-sample-templates',
  templateUrl: './sample-templates.component.html',
  styleUrls: ['./sample-templates.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplatesComponent implements OnInit, OnDestroy {

  @Input() callbackOwnerObject: any = null;
  @Input() expandedSampleTemplateLinks: boolean;
  templateCtrl: FormControl = new FormControl();
  sampleTemplates: object[];
  protected _onDestroy = new Subject<void>();


  constructor(
    private http: HttpClient,
    public sampleTemplateService: SampleTemplatesService
  ) {
  }

  ngOnInit(): void {
    const templateLocationPrefix = this.callbackOwnerObject.
      innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX];
    this.sampleTemplateService.getSampleTemplates(templateLocationPrefix)
      .pipe(takeUntil(this._onDestroy))
      .subscribe(
      (templates: object[]) => {
        this.sampleTemplates = templates;
      }
    );

    this.callbackOwnerObject.customTemplate$
      .pipe(takeUntil(this._onDestroy))
      .subscribe(
        templateUrl => {
          if (templateUrl) {
            this.templateCtrl.setValue(null);
          }
        });
  }

  isSelectedByDefault(key): boolean {
    return this.callbackOwnerObject.innerConfig.hasOwnProperty(CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME) &&
      key === this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME];
  }

  loadBuiltinTemplate(s: string): void {
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  selectionClicked({option}: { option: MatListOption }): void {
    this.loadBuiltinTemplate(option.value);
  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

}
