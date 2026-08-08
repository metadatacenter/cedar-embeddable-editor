import { Component, Input, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { MatListOption } from '@angular/material/list';
import { HttpClient } from '@angular/common/http';
import { SampleTemplatesService } from './sample-templates.service';
import { Subject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { CedarEmbeddableMetadataEditorComponent } from '../cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { SampleTemplateLoaderOwner } from '../../models/ui/sample-template-loader-owner.model';
import { SampleTemplateEntry } from './sample-templates.service';

@Component({
  selector: 'app-sample-templates',
  templateUrl: './sample-templates.component.html',
  styleUrls: ['./sample-templates.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SampleTemplatesComponent implements OnInit, OnDestroy {
  @Input() callbackOwnerObject: SampleTemplateLoaderOwner = null;
  @Input() expandedSampleTemplateLinks: boolean;
  templateLocationPrefix: string;
  templateCtrl: FormControl = new FormControl();
  sampleTemplates: SampleTemplateEntry[] = [];
  protected _onDestroy = new Subject<void>();

  constructor(
    private http: HttpClient,
    public sampleTemplateService: SampleTemplatesService,
  ) {}

  ngOnInit(): void {
    this.templateLocationPrefix = this.callbackOwnerObject.innerConfig[
      CedarEmbeddableMetadataEditorComponent.TEMPLATE_LOCATION_PREFIX
    ] as string;
    this.sampleTemplateService
      .getSampleTemplatesFromRegistry(this.templateLocationPrefix)
      .pipe(takeUntil(this._onDestroy))
      .subscribe((templates: SampleTemplateEntry[]) => {
        this.sampleTemplates.push(...templates);
      });

    this.sampleTemplateService.templateJson$.pipe(takeUntil(this._onDestroy)).subscribe((templateJson) => {
      if (templateJson) {
        this.templateCtrl.setValue([Object.keys(templateJson)[0]]);
      }
    });
  }

  loadBuiltinTemplate(templateNum: string): void {
    this.sampleTemplateService.loadTemplate(this.templateLocationPrefix, templateNum);
    window.scroll(0, 0);
  }

  selectionClicked({ option }: { option: MatListOption }): void {
    this.loadBuiltinTemplate(option.value);
  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }
}
