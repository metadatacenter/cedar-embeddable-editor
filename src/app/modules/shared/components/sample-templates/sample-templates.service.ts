import { Injectable } from '@angular/core';
import { JsonSchema } from '../../models/json-schema.model';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, from, Observable, of, Subject } from 'rxjs';
import { catchError, concatMap, map, takeUntil } from 'rxjs/operators';
import { MessageHandlerService } from '../../service/message-handler.service';

@Injectable({
  providedIn: 'root',
})
export class SampleTemplatesService {
  private readonly MAX_CHECK = 500;
  readonly TEMPLATE_FILENAME = 'template.json';
  readonly METADATA_FILENAME = 'metadata.json';
  readonly TEMPLATE_REGISTRY_FILENAME = 'registry.json';
  readonly TEMPLATE_NUMBER = 'num';
  readonly TEMPLATE_LABEL = 'label';
  private allTemplates: Observable<object[]>;
  private templateJsonSubject = new BehaviorSubject<object>(null);
  templateJson$ = this.templateJsonSubject.asObservable();
  private metadataJsonSubject = new BehaviorSubject<object>(null);
  metadataJson$ = this.metadataJsonSubject.asObservable();
  private loadedTemplate = null;
  private loadedMetadata = null;
  private attemptedFileCount = 0;
  private templateNum = '';

  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
  ) {}

  loadTemplate(templateLocationPrefix: string, templateNum: string): void {
    templateLocationPrefix = this.fixedLocationPrefix(templateLocationPrefix);
    this.attemptedFileCount = 0;
    this.templateNum = templateNum;
    this.loadedTemplate = null;
    this.loadedMetadata = null;
    const templateUrl = templateLocationPrefix + templateNum + '/' + this.TEMPLATE_FILENAME;
    this.loadTemplateFromURL(templateUrl, templateNum);
    const metadataUrl = templateLocationPrefix + templateNum + '/' + this.METADATA_FILENAME;
    this.loadMetadataFromURL(metadataUrl, templateNum);
  }

  loadTemplateFromURL(templateUrl: string, templateNum: string = null): void {
    if (!templateNum) {
      templateNum = this.templateNumberFromUrl(templateUrl);
    }
    this.http.get(templateUrl).subscribe(
      (value) => {
        this.attemptedFileCount++;
        this.loadedTemplate = value;
        this.messageHandlerService.trace(
          'Loaded template: ' + templateUrl + ' (' + JSON.stringify(value).length + ' characters)',
        );
        this.handleLoadedDataFiles();
      },
      (error) => {
        this.attemptedFileCount++;
        this.loadedTemplate = null;
        this.messageHandlerService.error('Error while loading sample template from: ' + templateUrl);
        this.handleLoadedDataFiles();
      },
    );
  }

  loadMetadataFromURL(metadataUrl: string, templateNum: string = null): void {
    if (!templateNum) {
      templateNum = this.templateNumberFromUrl(metadataUrl);
    }
    this.http.get(metadataUrl).subscribe(
      (value) => {
        this.attemptedFileCount++;
        this.loadedMetadata = value;
        this.messageHandlerService.trace(
          'Loaded metadata: ' + metadataUrl + ' (' + JSON.stringify(value).length + ' characters)',
        );
        this.handleLoadedDataFiles();
      },
      (error) => {
        this.attemptedFileCount++;
        this.loadedMetadata = null;
        this.messageHandlerService.error('Error while loading sample metadata from: ' + metadataUrl);
        this.handleLoadedDataFiles();
      },
    );
  }

  handleLoadedDataFiles(): void {
    if (this.attemptedFileCount === 2) {
      const templateObj = {};
      templateObj[this.templateNum] = this.loadedTemplate;
      this.templateJsonSubject.next(templateObj);

      const metadataObj = {};
      metadataObj[this.templateNum] = this.loadedMetadata;
      this.metadataJsonSubject.next(metadataObj);
    }
  }

  getSampleTemplatesFromRegistry(templateLocationPrefix: string): Observable<object[]> {
    if (this.allTemplates) {
      return this.allTemplates;
    }
    templateLocationPrefix = this.fixedLocationPrefix(templateLocationPrefix);
    const registryUrl = templateLocationPrefix + this.TEMPLATE_REGISTRY_FILENAME;
    this.allTemplates = this.http.get(registryUrl).pipe(
      map((resp: object) => {
        return Object.keys(resp)
          .sort()
          .map((key, index) => {
            const entry = {};
            entry[this.TEMPLATE_NUMBER] = key;
            entry[this.TEMPLATE_LABEL] = resp[key];
            return entry;
          });
      }),
      catchError((error) => {
        this.messageHandlerService.errorObject(error.message, error);
        return EMPTY;
      }),
    );
    return this.allTemplates;
  }

  getSampleTemplatesDynamically(templateLocationPrefix: string): Observable<object> {
    if (!this.allTemplates) {
      templateLocationPrefix = this.fixedLocationPrefix(templateLocationPrefix);
      this.buildAllTemplatesDynamically(templateLocationPrefix);
    }
    return this.allTemplates;
  }

  private buildAllTemplatesDynamically(templateLocationPrefix: string): void {
    const allTemplates = [];
    this.getAllTemplatesSubscription(templateLocationPrefix).subscribe((resp) => {
      const entry = {};
      entry[this.TEMPLATE_NUMBER] = Object.keys(resp)[0];
      entry[this.TEMPLATE_LABEL] = Object.values(resp)[0];
      allTemplates.push(entry);
    });
    this.allTemplates = of(allTemplates);
  }

  private getAllTemplatesSubscription(templateLocationPrefix: string): Observable<object> {
    const singleUrls: string[] = [];
    const closeRequest$ = new Subject<void>();
    let errorIndex = 0;

    for (let i = 1; i <= this.MAX_CHECK; i++) {
      const templateName = i < 10 ? '0' + i.toString() : i.toString();
      const templateUrl = templateLocationPrefix + templateName + '/' + this.TEMPLATE_FILENAME;
      singleUrls.push(templateUrl);
    }
    return from(singleUrls).pipe(
      concatMap((singleUrl) => {
        const templateNum = this.templateNumberFromUrl(singleUrl);
        return this.getSingleTemplateLabel(singleUrl).pipe(
          map((templateLabel) => {
            errorIndex = 0;
            const templateEntry = {};
            templateEntry[templateNum] = 'Template ' + templateNum + ' - ' + templateLabel;
            return templateEntry;
          }),
          // if encounter two consecutive error requests, finish polling
          catchError((error) => {
            if (error.status === 0) {
              errorIndex++;
            } else {
              this.messageHandlerService.errorObject(error['message'], error);
            }

            if (errorIndex > 1) {
              closeRequest$.next();
              closeRequest$.complete();
            }
            return EMPTY;
          }),
        );
      }),
      takeUntil(closeRequest$),
    );
  }

  private getSingleTemplateLabel(templateUrl: string): Observable<string> {
    return this.http.get(templateUrl).pipe(
      map((response) => {
        if (response == null || !response[JsonSchema.schemaName]) {
          return null;
        }
        return response[JsonSchema.schemaName];
      }),
    );
  }

  private templateNumberFromUrl(url): string {
    const templateNumPatternStr = '\\/(\\d+)\\/' + this.TEMPLATE_FILENAME;
    const templateNumPattern = new RegExp(templateNumPatternStr);
    const templateNumMatch = url.match(templateNumPattern);

    if (templateNumMatch && templateNumMatch.length > 1) {
      return templateNumMatch[1];
    }
    return '-1';
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
