import { describe, expect, it } from 'vitest';
import type { CedarComponent } from '@cee/models/component/cedar-component.model';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';

const TEXT = FIELD_KINDS.find((kind) => kind.inputType === 'textfield')!;
const PAGE_BREAK = FIELD_KINDS.find((kind) => kind.inputType === 'page-break')!;

type Token = 'content' | 'break';

const sequences = (maximumLength: number): Token[][] => {
  const result: Token[][] = [];
  for (let length = 1; length <= maximumLength; length++) {
    for (let mask = 0; mask < 2 ** length; mask++) {
      const tokens = Array.from({ length }, (_, index) => ((mask >> index) & 1 ? 'break' : 'content') as Token);
      if (tokens.includes('content')) {
        result.push(tokens);
      }
    }
  }
  return result;
};

const expectedPages = (tokens: readonly Token[]): string[][] => {
  const pages: string[][] = [[]];
  let contentIndex = 0;
  for (const token of tokens) {
    if (token === 'break') {
      pages.push([]);
    } else {
      pages[pages.length - 1].push(`_c${contentIndex++}`);
    }
  }
  return pages.map((page) => (page.length === 0 ? ['<blank>'] : page));
};

describe('page-break invariants', () => {
  it.each(sequences(6).map((tokens) => [tokens.join('-'), tokens] as const))(
    'preserves every boundary and content item for %s',
    (_name, tokens) => {
      let contentIndex = 0;
      let breakIndex = 0;
      const template = buildTemplate({
        name: `page_invariant_${_name}`,
        children: tokens.map((token) =>
          token === 'break'
            ? { kind: PAGE_BREAK, name: `pb${breakIndex++}` }
            : { kind: TEXT, name: `c${contentIndex++}` },
        ),
      });
      const driver = new CeeDriver(template);
      const pages = driver.representation.pageBreakChildren.map((page: CedarComponent[]) =>
        page.map((component) => component.name || '<blank>'),
      );

      expect(pages).toEqual(expectedPages(tokens));
      expect(pages).toHaveLength(tokens.filter((token) => token === 'break').length + 1);
      expect(pages.flat().filter((name: string) => name !== '<blank>')).toEqual(
        Array.from({ length: contentIndex }, (_, index) => `_c${index}`),
      );
    },
  );
});
