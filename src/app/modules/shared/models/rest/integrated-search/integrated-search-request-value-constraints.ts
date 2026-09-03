export class IntegratedSearchRequestValueConstraints {
  ontologies: Array<object> = [];
  valueSets: Array<object> = [];
  classes: Array<object> = [];
  branches: Array<object> = [];
  /**
   * The arrangements the author applied to the offered values. The endpoint
   * rejects a body carrying a key it does not declare, so this name matches the
   * one `_valueConstraints` uses, as the four above do.
   */
  actions: Array<object> = [];
}
