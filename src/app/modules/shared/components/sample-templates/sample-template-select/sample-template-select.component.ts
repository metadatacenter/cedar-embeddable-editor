import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {SampleTemplatesService} from '../sample-templates.service';
import {
  CedarEmbeddableMetadataEditorWrapperComponent
} from '../../cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import {FormControl} from '@angular/forms';
import {ReplaySubject, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
  selector: 'app-sample-template-select',
  templateUrl: './sample-template-select.component.html',
  styleUrls: ['./sample-template-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplateSelectComponent implements OnInit, OnDestroy {
  @Input() callbackOwnerObject: any = null;
  sampleTemplates: object[];
  templateCtrl: FormControl = new FormControl();
  templateFilterCtrl: FormControl = new FormControl();
  filteredTemplates: ReplaySubject<object[]> = new ReplaySubject<object[]>(1);
  protected _onDestroy = new Subject<void>();


  constructor(private sampleTemplateService: SampleTemplatesService) {
  }

  ngOnInit(): void {
    const templateLocationPrefix = this.callbackOwnerObject.
      innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.TEMPLATE_LOCATION_PREFIX];
    this.sampleTemplateService.getSampleTemplates(templateLocationPrefix).subscribe(
      (templates: object[]) => {
        this.sampleTemplates = templates;
        this.filteredTemplates.next(this.sampleTemplates);
      }
    );

    if (this.callbackOwnerObject.innerConfig.hasOwnProperty(
        CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME)) {
      this.templateCtrl.setValue(
        this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorWrapperComponent.LOAD_SAMPLE_TEMPLATE_NAME]);
    }

    // listen for search field value changes
    this.templateFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterTemplates();
      });
  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  filterTemplates(): void {
    if (!this.sampleTemplates) {
      return;
    }
    // get the search keyword
    let search = this.templateFilterCtrl.value;
    if (!search) {
      this.filteredTemplates.next(this.sampleTemplates.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the banks
    this.filteredTemplates.next(
      this.sampleTemplates.filter(
        template => template[this.sampleTemplateService.TEMPLATE_LABEL].toLowerCase().indexOf(search) > -1)
    );
  }

  loadBuiltinTemplate(s: string): void {
    this.callbackOwnerObject.loadSampleTemplate(s);
    window.scroll(0, 0);
  }

  inputChanged(event): void {
    if (event) {
      this.loadBuiltinTemplate(event.value);
    }
  }

}
