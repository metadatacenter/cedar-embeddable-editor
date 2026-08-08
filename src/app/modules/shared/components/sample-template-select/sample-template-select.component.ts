import { Component, Input, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { SampleTemplatesService } from '../sample-templates/sample-templates.service';
import { FormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CedarEmbeddableMetadataEditorComponent } from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { SampleTemplateLoaderOwner } from '../../models/ui/sample-template-loader-owner.model';
import { MatSelectChange } from '@angular/material/select';
import { SampleTemplateEntry } from '../sample-templates/sample-templates.service';

@Component({
  selector: 'app-sample-template-select',
  templateUrl: './sample-template-select.component.html',
  styleUrls: ['./sample-template-select.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SampleTemplateSelectComponent implements OnInit, OnDestroy {
  @Input() callbackOwnerObject: SampleTemplateLoaderOwner = null;
  sampleTemplates: SampleTemplateEntry[];
  templateLocationPrefix: string;
  templateCtrl: FormControl = new FormControl();
  templateFilterCtrl: FormControl = new FormControl();
  filteredTemplates: ReplaySubject<SampleTemplateEntry[]> = new ReplaySubject<SampleTemplateEntry[]>(1);
  loadMetadata = true;
  protected _onDestroy = new Subject<void>();

  constructor(public sampleTemplateService: SampleTemplatesService) {}

  ngOnInit(): void {
    this.templateLocationPrefix = this.callbackOwnerObject.innerConfig[
      CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX
    ] as string;
    this.sampleTemplateService
      .getSampleTemplatesFromRegistry(this.templateLocationPrefix)
      .pipe(takeUntil(this._onDestroy))
      .subscribe((templates: SampleTemplateEntry[]) => {
        this.sampleTemplates = templates;
        this.filteredTemplates.next(this.sampleTemplates);
      });

    this.sampleTemplateService.templateJson$.pipe(takeUntil(this._onDestroy)).subscribe((templateJson) => {
      if (templateJson) {
        this.templateCtrl.setValue(Object.keys(templateJson)[0]);
      }
    });

    // listen for search field value changes
    this.templateFilterCtrl.valueChanges.pipe(takeUntil(this._onDestroy)).subscribe(() => {
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
      this.sampleTemplates.filter((template) => template.label?.toLowerCase().indexOf(search) > -1),
    );
  }

  loadBuiltinTemplate(templateNum: string): void {
    this.sampleTemplateService.loadTemplate(this.templateLocationPrefix, templateNum);
    window.scroll(0, 0);
  }

  inputChanged(event: MatSelectChange): void {
    if (event) {
      this.loadBuiltinTemplate(event.value);
    }
  }

  loadMetadataChanged(checked: boolean) {
    this.sampleTemplateService.reloadTemplateWithMetadata(checked);
  }
}
