/**
 * What a field presentation tells the messages its widget draws. The presentation provides it, so a
 * message takes the state of the field it is drawn in and never that of a field around it.
 */
export abstract class FieldSeverity {
  /** Whether each of the field's problems is a warning, which is when its frame and messages are amber. */
  abstract readonly warningOnly: boolean;
}
