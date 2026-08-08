import { Injectable } from '@angular/core';
import { CedarReaders } from 'cedar-model-typescript-library';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, from, Observable, of, Subject } from 'rxjs';
import { catchError, concatMap, map, takeUntil } from 'rxjs/operators';
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
  private readonly MAX_CHECK = 500;
  readonly TEMPLATE_FILENAME = 'template.json';
  readonly METADATA_FILENAME = 'metadata.json';
  readonly TEMPLATE_REGISTRY_FILENAME = 'registry.json';
  private allTemplates: Observable<SampleTemplateEntry[]>;
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
    this.loadTemplateFromURL(templateUrl, this.templateNum);
    if (this.doLoadMetadata) {
      const metadataUrl = this.templateLocationPrefix + this.templateNum + '/' + this.METADATA_FILENAME;
      this.loadMetadataFromURL(metadataUrl, this.templateNum);
    }
  }

  loadTemplateFromURL(templateUrl: string, templateNum: string | null = null): void {
    if (!templateNum) {
      templateNum = this.templateNumberFromUrl(templateUrl);
    }
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

  loadMetadataFromURL(metadataUrl: string, templateNum: string | null = null): void {
    if (!templateNum) {
      templateNum = this.templateNumberFromUrl(metadataUrl);
    }
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

  getSampleTemplatesDynamically(templateLocationPrefix: string): Observable<object> {
    if (!this.allTemplates) {
      templateLocationPrefix = this.fixedLocationPrefix(templateLocationPrefix);
      this.buildAllTemplatesDynamically(templateLocationPrefix);
    }
    return this.allTemplates;
  }

  private buildAllTemplatesDynamically(templateLocationPrefix: string): void {
    const allTemplates: SampleTemplateEntry[] = [];
    this.getAllTemplatesSubscription(templateLocationPrefix).subscribe((resp) => {
      allTemplates.push({ num: Object.keys(resp)[0], label: String(Object.values(resp)[0]) });
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
            const templateEntry: Record<string, string> = {};
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

  /**
   * The name a fetched sample template goes by, for the menu.
   *
   * Read through the model library rather than by reaching for `schema:name`.
   * This was the last place outside CEE's three artifact boundaries that opened a
   * CEDAR document itself — a small thing, two key lookups, but the point of the
   * boundaries is that there are three of them and not four.
   *
   * A template that fails to parse yields no name and is skipped, which is what
   * the previous null check did for a template that had no `schema:name`.
   */
  private getSingleTemplateLabel(templateUrl: string): Observable<string | null> {
    return this.http.get(templateUrl).pipe(
      map((response) => {
        if (response == null) {
          return null;
        }
        try {
          const parsed = CedarReaders.json()
            .getFebruary2024()
            .getTemplateReader()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .readFromObject(response as any).template;
          return parsed.schema_name || null;
        } catch {
          return null;
        }
      }),
    );
  }

  private templateNumberFromUrl(url: string): string {
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
