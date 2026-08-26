interface CeeHostEvent {
  kind: 'trace' | 'error' | 'ready';
  label?: string;
  value?: object | null;
}

declare global {
  interface Window {
    __ceeChanges?: import('../../src/app/cee-public-api').CeeChangeDetail[];
    __ceeError?: string;
    __ceeEvents: CeeHostEvent[];
    __ceeFirstBootstrap?: unknown;
    __ceeFirstConstructor?: CustomElementConstructor;
    __ceeReady?: boolean;
    __ceeSmokeChanges: number;
    __handlerRan?: boolean;
    __staticMarkupRan?: boolean;
    __templateMarkupRan?: boolean;
    cedarEmbeddableEditorBootstrap?: unknown;
  }
}

export {};
