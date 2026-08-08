import { InstanceNode } from './instance-node.model';

/**
 * A node in the extract view of an instance — the tree CEE hands out as
 * `currentMetadata`, without the `@context` and type machinery.
 *
 * An alias for `InstanceNode` rather than a type of its own: extract and full
 * differ in *what they contain*, not in the shape of a node, and giving them
 * distinct node types would claim a distinction the documents do not have. The
 * names are kept because they say which tree a value came from, which is a
 * genuine and frequently-confused difference at the call sites.
 */
export type InstanceExtractData = InstanceNode;
