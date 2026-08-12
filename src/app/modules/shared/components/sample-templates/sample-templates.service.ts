import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MessageHandlerService } from '../../service/message-handler.service';
import { InstanceObject } from '../../models/instance-node.model';

/** One row of the sample-template registry: which template, and what to call it. */
export interface SampleTemplateEntry {
  num: string;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class SampleTemplatesService {
  readonly TEMPLATE_FILENAME = 'template.json';
  readonly METADATA_FILENAME = 'metadata.json';
  readonly TEMPLATE_REGISTRY_FILENAME = 'registry.json';
  /** The registry, fetched once. Null until then — which is the state both readers already test for. */
  private allTemplates: Observable<SampleTemplateEntry[]> | null = null;
  private templateJsonSubject = new BehaviorSubject<Record<string, InstanceObject | null> | null>(null);
  templateJson$ = this.templateJsonSubject.asObservable();
  private metadataJsonSubject = new BehaviorSubject<Record<string, InstanceObject | null> | null>(null);
  metadataJson$ = this.metadataJsonSubject.asObservable();
  private loadedTemplate: InstanceObject | null = null;
  private loadedMetadata: InstanceObject | null = null;
  private attemptedFileCount = 0;
  private targetAttemptedFileCount = 0;
  private templateNum = '';
  private templateLocationPrefix = '';
  private doLoadMetadata = true;

  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
  ) {}

  loadTemplate(tLocationPrefix: string, templateNum: string): void {
    this.templateLocationPrefix = this.fixedLocationPrefix(tLocationPrefix);
    this.templateNum = templateNum;
    this.loadTemplateAndMetadata();
  }

  reloadTemplateWithMetadata(doLoadMetadata: boolean) {
    this.doLoadMetadata = doLoadMetadata;
    this.loadTemplateAndMetadata();
  }

  private loadTemplateAndMetadata() {
    this.attemptedFileCount = 0;
    this.targetAttemptedFileCount = this.doLoadMetadata ? 2 : 1;
    this.loadedTemplate = null;
    this.loadedMetadata = null;
    const templateUrl = this.templateLocationPrefix + this.templateNum + '/' + this.TEMPLATE_FILENAME;
    this.loadTemplateFromURL(templateUrl);
    if (this.doLoadMetadata) {
      const metadataUrl = this.templateLocationPrefix + this.templateNum + '/' + this.METADATA_FILENAME;
      this.loadMetadataFromURL(metadataUrl);
    }
  }

  private loadTemplateFromURL(templateUrl: string): void {
    this.http.get<InstanceObject>(templateUrl).subscribe(
      (value) => {
        this.attemptedFileCount++;
        this.loadedTemplate = value;
        this.messageHandlerService.trace(
          'Loaded template: ' + templateUrl + ' (' + JSON.stringify(value).length + ' characters)',
        );
        this.handleLoadedDataFiles();
      },
      () => {
        this.attemptedFileCount++;
        this.loadedTemplate = null;
        this.messageHandlerService.error('Error while loading sample template from: ' + templateUrl);
        this.handleLoadedDataFiles();
      },
    );
  }

  private loadMetadataFromURL(metadataUrl: string): void {
    this.http.get<InstanceObject>(metadataUrl).subscribe(
      (value) => {
        this.attemptedFileCount++;
        this.loadedMetadata = value;
        this.messageHandlerService.trace(
          'Loaded metadata: ' + metadataUrl + ' (' + JSON.stringify(value).length + ' characters)',
        );
        this.handleLoadedDataFiles();
      },
      () => {
        this.attemptedFileCount++;
        this.loadedMetadata = null;
        this.messageHandlerService.error('Error while loading sample metadata from: ' + metadataUrl);
        this.handleLoadedDataFiles();
      },
    );
  }

  handleLoadedDataFiles(): void {
    if (this.attemptedFileCount === this.targetAttemptedFileCount) {
      // Only published once both files have arrived, which is what the count above
      // waits for — but a fetch can fail, and the wrapper's subscriber already
      // tests each half, so the maps admit the miss rather than claiming it cannot
      // happen.
      const templateObj: Record<string, InstanceObject | null> = {};
      templateObj[this.templateNum] = this.loadedTemplate;
      this.templateJsonSubject.next(templateObj);

      const metadataObj: Record<string, InstanceObject | null> = {};
      metadataObj[this.templateNum] = this.loadedMetadata;
      this.metadataJsonSubject.next(metadataObj);
    }
  }

  getSampleTemplatesFromRegistry(templateLocationPrefix: string): Observable<SampleTemplateEntry[]> {
    if (this.allTemplates) {
      return this.allTemplates;
    }
    templateLocationPrefix = this.fixedLocationPrefix(templateLocationPrefix);
    const registryUrl = templateLocationPrefix + this.TEMPLATE_REGISTRY_FILENAME;
    this.allTemplates = this.http.get<Record<string, string>>(registryUrl).pipe(
      map((resp) => {
        return Object.keys(resp)
          .sort()
          .map((key): SampleTemplateEntry => ({ num: key, label: resp[key] }));
      }),
      catchError((error) => {
        this.messageHandlerService.errorObject(error.message, error);
        return EMPTY;
      }),
    );
    return this.allTemplates;
  }

  private fixedLocationPrefix(locationPrefix: string): string {
    const locationPrefixPatternStr = '\\/$';
    const locationPrefixPattern = new RegExp(locationPrefixPatternStr);
    const locationPrefixMatch = locationPrefix.match(locationPrefixPattern);

    if (!locationPrefixMatch) {
      locationPrefix += '/';
    }
    return locationPrefix;
  }
}
