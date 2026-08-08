export class BasicInfo {
  /**
   * Nullable because the library's `uiInputType.getValue()` is: a static field that
   * declares no `_ui.inputType` has none, and CEE dispatches on the value rather
   * than requiring it.
   */
  inputType: string | null;
  temporalGranularity: string;
  timezoneEnabled: boolean;
  inputTimeFormat: string;
}
