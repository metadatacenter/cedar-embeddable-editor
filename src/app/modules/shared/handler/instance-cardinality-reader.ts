import { InstanceExtractData } from '../models/instance-extract-data.model';

/**
 * How many occurrences of each component an existing instance holds.
 *
 * When a host page hands CEE an `instanceObject`, the template stops being the
 * only thing that decides the shape of the form: a multi element the template
 * starts at one may arrive holding four, and the pager has to come back showing
 * four. Working that out means walking the instance and reporting, for every
 * slot it describes, how many values are in it.
 *
 * The path uses the same `@#index[N]#@` encoding
 * `MultiInstanceObjectHandler.setSingleMultiInstance` parses — a segment is
 * spliced in for each occurrence, so `['_author', '@#index[1]#@', '_affil']`
 * means the `_affil` inside the second author. Emitting rather than returning a
 * structure keeps the two implementations honest about ordering as well as
 * content: they have to say the same things in the same sequence.
 *
 * Two implementations exist, one walking the raw JSON and one reading the
 * CEDAR Model TypeScript Library's parsed instance. The whole harness runs
 * against either; see `CEE_INSTANCE_READER` in the harness driver.
 */
export interface InstanceCardinalityReader {
  /**
   * Walk `instance` and report every slot.
   *
   * `emit` is called with the path to a component and how many values the
   * instance holds there — zero for a slot that exists but is empty, which the
   * pager still needs an entry for. Paths that match nothing in the component
   * tree are tolerated and ignored downstream; the instance carries `@context`,
   * provenance and other keys that are not components.
   */
  read(instance: InstanceExtractData, emit: (path: string[], count: number) => void): void;
}

/** The `@#index[N]#@` segment for occurrence `i`. */
export const indexSegment = (i: number): string => `@#index[${i}]#@`;
