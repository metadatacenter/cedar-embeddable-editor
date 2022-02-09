import {Injectable} from '@angular/core';
import {JsonSchema} from '../../models/json-schema.model';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SampleTemplatesService {

  private sampleTemplatesSubject = new BehaviorSubject<object>(null);
  sampleTemplates$ = this.sampleTemplatesSubject.asObservable();


  constructor(private http: HttpClient) {
  }

  getSampleTemplates(templateLocationPrefix: string, maxNumTemplates: number): object {
    const val = this.sampleTemplatesSubject.getValue();

    if (!val) {
      this.loadSampleTemplates(templateLocationPrefix, maxNumTemplates);
    }
    return this.sampleTemplatesSubject.getValue();
  }

  private loadSampleTemplates(templateLocationPrefix: string, maxNumTemplates: number): void {
    const sampleTemplates = new Object();

    for (let i = 1; i <= maxNumTemplates; i++) {
      const templateName = (i < 10) ? '0' + i.toString() : i.toString();
      const url = templateLocationPrefix + templateName + '/template.json';
      this.loadTemplateFromURL(sampleTemplates, templateName, url);
    }
    this.sampleTemplatesSubject.next(sampleTemplates);
  }

  private loadTemplateFromURL(sampleTemplates: object, templateNumber: string, url: string): void {
    this.http.get(url).subscribe(
      value => {
        sampleTemplates[templateNumber] = 'Template ' + templateNumber + ' - ' + value[JsonSchema.schemaName];
      },
      error => {
      }
    );
  }

}
