import * as _ from 'lodash-es';
import { InstanceNode, isInstanceObject } from '../models/instance-node.model';

interface EntryHistory {
  baseline: InstanceNode | null;
  owned: boolean;
  structural: boolean;
  /** Original seed position, or null for an occurrence created by Add. */
  slot: number | null;
}

/**
 * Editor-only history. Object identity follows an occurrence when arrays splice;
 * replacement and copy explicitly transfer it. Nothing is added to exported data.
 * A migrated reader answer stays owned even when a new default happens to equal it.
 */
export class PreviewEditState {
  private readonly entries = new WeakMap<object, EntryHistory>();

  private baseline(node: InstanceNode): InstanceNode | null {
    // Containers are inspected recursively. Retaining a full snapshot at every
    // ancestor would multiply memory by nesting depth; only field values and
    // selections need a value baseline for explicit edits/reverts.
    return isInstanceObject(node) || (Array.isArray(node) && node.some(isInstanceObject)) ? null : _.cloneDeep(node);
  }

  seed(node: InstanceNode | null, slot: number | null = 0): void {
    if (node === null || typeof node !== 'object') return;
    if (!this.entries.has(node)) {
      this.entries.set(node, { baseline: this.baseline(node), owned: false, structural: false, slot });
    }
    if (Array.isArray(node)) node.forEach((entry, index) => this.seed(entry, index));
    else if (isInstanceObject(node)) Object.values(node.values).forEach((child) => this.seed(child));
  }

  slot(node: InstanceNode): number | null {
    return this.entries.get(node)?.slot ?? null;
  }

  own(node: InstanceNode): void {
    this.seed(node);
    this.entries.get(node)!.owned = true;
  }

  edited(node: InstanceNode): boolean {
    const entry = this.entries.get(node);
    if (entry?.owned || entry?.structural) return true;
    if (Array.isArray(node)) return node.some((child) => this.edited(child));
    if (isInstanceObject(node)) return Object.values(node.values).some((child) => this.edited(child));
    return entry !== undefined && !_.isEqual(node, entry.baseline);
  }

  /** Capture a value replacement; normalization does not manufacture user intent. */
  write(before: InstanceNode | null, after: InstanceNode | null, draft: boolean, normalization = false): void {
    if (after === null) return;
    const previous = before === null ? undefined : this.entries.get(before);
    this.seed(after);
    const entry = this.entries.get(after)!;
    if (previous) {
      entry.baseline = previous.baseline;
      entry.slot = previous.slot;
    }
    entry.owned = normalization ? (previous?.owned ?? false) : draft || !_.isEqual(after, entry.baseline);
  }

  structure(node: InstanceNode | null): void {
    if (node === null) return;
    this.seed(node);
    this.entries.get(node)!.structural = true;
  }

  /** A copy has independent history, while retaining the source's default origin. */
  copy(source: InstanceNode | null, target: InstanceNode | null): void {
    if (source === null || target === null) return;
    this.seed(target);
    const entry = this.entries.get(source);
    if (entry) this.entries.set(target, _.cloneDeep(entry));
    if (Array.isArray(source) && Array.isArray(target)) {
      source.forEach((node, index) => this.copy(node, target[index] ?? null));
    } else if (isInstanceObject(source) && isInstanceObject(target)) {
      Object.keys(source.values).forEach((key) => this.copy(source.values[key], target.values[key] ?? null));
    }
  }

  /** Transfer one node, with the new template's baseline for subsequent explicit edits. */
  inherit(previous: PreviewEditState, source: InstanceNode, target: InstanceNode, baseline: InstanceNode): void {
    const entry = previous.entries.get(source);
    this.entries.set(target, {
      baseline: this.baseline(baseline),
      owned: entry?.owned ?? false,
      structural: entry?.structural ?? false,
      slot: entry?.slot ?? null,
    });
  }
}
