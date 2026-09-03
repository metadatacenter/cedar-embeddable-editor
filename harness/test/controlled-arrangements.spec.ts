/**
 * The arrangements an author applied reach the terminology server.
 *
 * `_valueConstraints.actions` is how a template says which of the values a
 * constraint offers should be dropped from the list and which should be moved to
 * a chosen position. The terminology server applies them, and it can only apply
 * what it is sent, so the whole feature depends on CEE carrying the actions from
 * the parsed template into the search request.
 *
 * CEE used to drop them at the first step: `ControlledInfo` declared the four
 * source kinds and nothing else, so a field whose author had excluded two terms
 * offered them anyway and a custom order was lost. That is
 * https://github.com/metadatacenter/cedar-project/issues/1223.
 */
import { describe, expect, it } from 'vitest';
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';
import { corpusTemplates } from '../src/corpus';
import { CeeDriver } from '../src/driver';

/**
 * Every `controlledInfo` in the tree CEE built, each counted once.
 *
 * By identity rather than by position: a component is reachable through more than
 * one key of the representation, so a walker that merely recurses reports each
 * field's constraints twice.
 */
const controlledInfos = (root: unknown): Record<string, unknown>[] => {
  const seen = new Set<object>();
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record['controlledInfo'] !== undefined) {
      found.push(record['controlledInfo'] as Record<string, unknown>);
    }
    Object.values(record).forEach(walk);
  };
  walk(root);
  return found;
};

const parsedActions = (template: object): unknown[] =>
  controlledInfos(new CeeDriver(template, { templateParser: new ModelLibraryTemplateParser() }).representation)
    .flatMap((info) => (info['actions'] as unknown[]) ?? [])
    .filter((action) => action !== undefined);

const corpusTemplate = (id: string): object => {
  const found = corpusTemplates().find((artifact) => artifact.id === id);
  if (found === undefined) {
    throw new Error(`corpus template ${id} is missing`);
  }
  return found.json;
};

/** The actions a template declares, wherever in it they sit. */
const declaredActions = (node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (node !== null && typeof node === 'object') {
    const constraints = (node as Record<string, unknown>)['_valueConstraints'];
    if (constraints !== null && typeof constraints === 'object') {
      const actions = (constraints as Record<string, unknown>)['actions'];
      if (Array.isArray(actions)) {
        found.push(...(actions as Record<string, unknown>[]));
      }
    }
    Object.values(node as Record<string, unknown>).forEach((child) => declaredActions(child, found));
  }
  return found;
};

describe('a template that arranges the values a constraint offers', () => {
  // 030 deletes terms, 036 moves them. Both kinds have to survive the parse, and
  // the two are the only corpus templates that arrange anything at all.
  it.each(['030', '036'])('carries every action template-%s declares', (id) => {
    const template = corpusTemplate(id);
    const declared = declaredActions(template);

    expect(declared.length).toBeGreaterThan(0);
    expect(parsedActions(template)).toEqual(declared);
  });
});

describe('an action the terminology server would reject', () => {
  /**
   * The endpoint validates each action and answers 400 for the whole request when
   * one is incomplete, which would cost the field its autocomplete rather than
   * that action its effect. So an incomplete action is dropped and the rest stand.
   */
  it('is dropped, and the field keeps its other arrangements', () => {
    const template = structuredClone(corpusTemplate('030')) as object;
    const declared = declaredActions(template);
    expect(declared.length).toBeGreaterThan(1);

    delete declared[0]['source'];

    const carried = parsedActions(template);
    expect(carried).toHaveLength(declared.length - 1);
    expect(carried).toEqual(declared.slice(1));
  });
});
