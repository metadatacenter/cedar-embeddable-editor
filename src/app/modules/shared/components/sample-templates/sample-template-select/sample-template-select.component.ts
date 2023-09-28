import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {SampleTemplatesService} from '../sample-templates.service';
import {FormControl} from '@angular/forms';
import {ReplaySubject, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {CedarEmbeddableMetadataEditorComponent} from '../../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';

@Component({
  selector: 'app-sample-template-select',
  templateUrl: './sample-template-select.component.html',
  styleUrls: ['./sample-template-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SampleTemplateSelectComponent implements OnInit, OnDestroy {
  @Input() callbackOwnerObject: any = null;
  sampleTemplates: object[];
  templateLocationPrefix: string;
  templateCtrl: FormControl = new FormControl();
  templateFilterCtrl: FormControl = new FormControl();
  filteredTemplates: ReplaySubject<object[]> = new ReplaySubject<object[]>(1);
  protected _onDestroy = new Subject<void>();


  constructor(public sampleTemplateService: SampleTemplatesService) {
  }

  ngOnInit(): void {
    this.templateLocationPrefix = this.callbackOwnerObject.innerConfig[CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX];
    this.sampleTemplateService.getSampleTemplatesFromRegistry(this.templateLocationPrefix)
      .pipe(takeUntil(this._onDestroy))
      .subscribe(
        (templates: object[]) => {
          this.sampleTemplates = templates;
          this.filteredTemplates.next(this.sampleTemplates);
        }
      );

    this.sampleTemplateService.templateJson$
      .pipe(takeUntil(this._onDestroy))
      .subscribe(templateJson => {
        this.templateCtrl.setValue(Object.keys(templateJson)[0]);
      });

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
    this.filteredTemplates.next(
      this.sampleTemplates.filter(
        template => template[this.sampleTemplateService.TEMPLATE_LABEL].toLowerCase().indexOf(search) > -1)
    );
  }

  loadBuiltinTemplate(templateNum: string): void {
    this.sampleTemplateService.loadTemplate(this.templateLocationPrefix, templateNum);
    window.scroll(0, 0);
  }

  inputChanged(event): void {
    if (event) {
      this.loadBuiltinTemplate(event.value);
    }
  }

}
