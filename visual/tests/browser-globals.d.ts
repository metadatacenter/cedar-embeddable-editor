interface CeeHostEvent {
  kind: 'trace' | 'error' | 'ready';
  label?: string;
  value?: object | null;
}

declare global {
  interface Window {
    __ceeChanges?: import('../../src/app/cee-public-api').CeeChangeDetail[];
    __ceeError?: string;
    __ceeFieldChanges?: import('../../src/app/cee-public-api').CedarEmbeddableFieldChangeDetail[];
    __ceeEvents: CeeHostEvent[];
    __ceeFirstBootstrap?: unknown;
    __ceeFirstConstructor?: CustomElementConstructor;
    __ceeReady?: boolean;
    __ceeSmokeChanges: number;
    __handlerRan?: boolean;
    __staticMarkupRan?: boolean;
    __templateMarkupRan?: boolean;
    cedarEmbeddableEditorBootstrap?: unknown;
    /** `public/standalone-field.js`: a template fixture's child as a field written on its own. */
    ceeStandaloneField: (child: object) => {
      field: import('../../src/app/cee-public-api').CeeJsonObject;
      placement: { required: boolean };
    };
  }
}

export {};
