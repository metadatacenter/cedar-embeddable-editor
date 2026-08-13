import { InstanceNode } from './instance-node.model';

/**
 * A node reached by walking a path, which may not be there.
 *
 * Nullable, because every producer of one already answers null for a path that
 * names nothing — a field on a page that has no occurrence, a child of an
 * element the instance does not carry. The alias said `InstanceNode` and the
 * nulls flowed anyway, hidden while a node was plain parsed JSON and `null` was
 * one of the shapes it could be. A container or an atom is not null, so the
 * declaration has to say what the walk actually returns.
 */
export type InstanceExtractData = InstanceNode | null;
