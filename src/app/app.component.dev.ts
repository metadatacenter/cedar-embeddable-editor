import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import {
  CedarEmbeddableFieldChangeDetail,
  CedarEmbeddableFieldValue,
  CeeJsonObject,
  CeeTemplateAndInstance,
} from './cee-public-api';

/**
 * One field of the demo template, as the demo asset carries it.
 *
 * The artifacts are extracted from `template.json`, one per input type, and kept
 * beside it. Extracted rather than sliced out here: which key of a template holds a
 * field is the model's business, and a host page that knew would be spelling out a
 * serialization it is supposed to consume through the model.
 */
interface DemoField {
  label: string;
  field: CeeJsonObject;
}

@Component({
  selector: 'app-component-dev',
  templateUrl: './app.component.dev.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AppDevComponent implements OnInit {
  /**
   * The demo artifact, fetched the way any host fetches its own.
   *
   * CEE used to load this itself, given a location prefix and a name. That was
   * the one path where CEE reached the network for an artifact, and it existed
   * for this app. The developer app is a host like any other, so it does what a
   * host does: fetch, then assign. Null until then, which the input ignores.
   */
  artifact: CeeTemplateAndInstance | null = null;

  ceeConfig = {
    showTemplateDescription: true,
    showDownloadMenu: true,

    terminologyBaseUrl: 'https://terminology.metadatacenter.orgx/',
    languageMapPathPrefix: '/assets/i18n-cee/',
    defaultLanguage: 'en',
    fallbackLanguage: 'en',

    readOnlyMode: false,

    bridgeBaseUrl: 'https://bridge.metadatacenter.orgx/',
  };

  /**
   * The `cedar-embeddable-field` element's own demo: one field, no form around it.
   *
   * Here because this app is a host like any other, and because the element is the
   * surface a designer acquires a default value through. Picking a different field
   * reassigns `fieldObject`, which is the property that has to keep working for a
   * designer whose author is changing a field's type as they go.
   */
  demoFields: DemoField[] = [];
  selectedFieldIndex = 0;
  fieldValue: CedarEmbeddableFieldValue = { kind: 'none' };
  fieldValueValid = true;

  get selectedField(): CeeJsonObject | null {
    return this.demoFields[this.selectedFieldIndex]?.field ?? null;
  }

  /**
   * The element's `valueChange`, narrowed rather than cast.
   *
   * It is a DOM `CustomEvent` rather than an Angular output, because that is what a
   * host page outside Angular receives, and this app is a host page. So the detail
   * arrives untyped and is checked here.
   */
  onFieldValue(event: Event): void {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const detail = event.detail as CedarEmbeddableFieldChangeDetail;
    this.fieldValue = detail.value;
    this.fieldValueValid = detail.valid;
  }

  selectField(event: Event): void {
    this.selectedFieldIndex = Number((event.target as HTMLSelectElement).value);
  }

  /** Show the value in the shape a host receives, which is the point of the readout. */
  get fieldValueJson(): string {
    return JSON.stringify(this.fieldValue);
  }

  languages = {
    selected: 'en',
    options: [
      { value: 'en', viewValue: 'en' },
      { value: 'hu', viewValue: 'hu' },
    ],
  };

  constructor() {}

  async ngOnInit(): Promise<void> {
    const load = async (file: string): Promise<CeeJsonObject> => (await fetch(`/assets/cee-demo/demo/${file}`)).json();
    const [templateObject, instanceObject] = await Promise.all([load('template.json'), load('metadata.json')]);
    this.artifact = { templateObject, instanceObject };
    this.demoFields = (await (await fetch('/assets/cee-demo/demo/fields.json')).json()) as DemoField[];
  }
}
