export class BasicInfo {
  /**
   * Nullable because the library's `uiInputType.getValue()` is: a static field that
   * declares no `_ui.inputType` has none, and CEE dispatches on the value rather
   * than requiring it.
   */
  inputType: string | null = null;
  /** The three temporal settings, set only for a temporal field. */
  temporalGranularity: string | null = null;
  inputTimeFormat: string | null = null;
  timezoneEnabled = false;
}
