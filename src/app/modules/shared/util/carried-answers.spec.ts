/**
 * What a reader keeps when the template they are filling in is replaced by an edit of it.
 *
 * Best effort, and silent. The form keeps as much of what the reader entered as the
 * new template will take, drops the rest without a word, and never shows an error the
 * carrying caused. Each test edits a template the way an author in the designer would
 * and checks what the reader is left with; `replace` checks the silence every time.
 */
import { InstanceSerializer } from './instance-serializer';
import { ChildSpec, FieldSpec, Reader, templateJson, TemplateOptions } from './carried-answers.testing';

const ID = 'https://repo.metadatacenter.org/templates/7e5b1c2a-0000-4000-8000-000000000001';

/** A reader with this template open. */
const reading = (children: readonly ChildSpec[], options: TemplateOptions = {}): Reader =>
  new Reader().open(templateJson(children, options));

/**
 * Give the reader's form this template instead, and check that the carrying showed
 * nothing: every error the new form holds is one a fresh form of the new template, or
 * the reader's own entry, already had.
 */
const replace = (reader: Reader, children: readonly ChildSpec[], options: TemplateOptions = {}): Reader => {
  const before = new Set(reader.errors());
  const template = templateJson(children, options);
  const fresh = new Set(new Reader().open(template).errors());
  reader.open(template);
  expect(reader.errors().filter((error) => !fresh.has(error) && !before.has(error))).toEqual([]);
  expect(reader.error).not.toHaveBeenCalled();
  return reader;
};

const text = (key: string, more: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'text', key, ...more });
const list = (key: string, more: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'text', key, multi: true, ...more });

describe('which template is an edit of which', () => {
  it('carries answers into a template with the same identifier', () => {
    const reader = reading([text('title')]).type(['title'], 'Ada');
    replace(reader, [text('title')], { description: 'Edited' });
    expect(reader.value(['title'])).toBe('Ada');
  });

  it('starts the reader on an empty form for a template with another identifier', () => {
    const reader = reading([text('title')]).type(['title'], 'Ada');
    replace(reader, [text('title')], { id: `${ID}-other` });
    expect(reader.value(['title'])).toBeNull();
  });

  it('starts empty again once a different template has been shown in between', () => {
    const reader = reading([text('title')]).type(['title'], 'Ada');
    replace(reader, [text('title')], { id: `${ID}-other` });
    replace(reader, [text('title')]);
    expect(reader.value(['title'])).toBeNull();
  });
});

describe('edits that leave a field alone', () => {
  const form: ChildSpec[] = [
    text('title'),
    { kind: 'numeric', key: 'count', numberType: 'xsd:int' },
    { kind: 'temporal', key: 'when', temporalType: 'xsd:date', granularity: 'day' },
    { kind: 'radio', key: 'answer', options: ['Yes', 'No'] },
    { kind: 'checkbox', key: 'flags', options: ['A', 'B', 'C'] },
    { kind: 'link', key: 'site' },
    list('aliases'),
    { key: 'person', multi: true, element: [text('name'), list('emails')] },
  ];

  const fill = (reader: Reader): Reader =>
    reader
      .type(['title'], 'Ada')
      .type(['count'], '4')
      .type(['when'], '2026-10-09')
      .type(['answer'], 'No')
      .choose(['flags'], ['A', 'C'])
      .type(['site'], 'https://example.org/ada')
      .add(['aliases'])
      .type(['aliases', 0], 'Countess')
      .add(['aliases'])
      .type(['aliases', 1], 'Enchantress of Numbers')
      .add(['person'])
      .type(['person', 0, 'name'], 'Charles')
      .add(['person', 0, 'emails'])
      .type(['person', 0, 'emails', 0], 'charles@example.org');

  const kept = (reader: Reader): void => {
    expect(reader.value(['title'])).toBe('Ada');
    expect(reader.value(['count'])).toBe('4');
    expect(reader.value(['when'])).toBe('2026-10-09');
    expect(reader.value(['answer'])).toBe('No');
    expect(reader.values(['flags'])).toEqual(['A', 'C']);
    expect(reader.value(['site'])).toBe('https://example.org/ada');
    expect(reader.values(['aliases'])).toEqual(['Countess', 'Enchantress of Numbers']);
    expect(reader.value(['person', 0, 'name'])).toBe('Charles');
    expect(reader.values(['person', 0, 'emails'])).toEqual(['charles@example.org']);
  };

  it('keeps everything through a change to the template description', () => {
    const reader = fill(reading(form));
    replace(reader, form, { description: 'Who wrote it' });
    kept(reader);
  });

  it('keeps everything through labels, help text, requirement and hiding', () => {
    const reader = fill(reading(form));
    const edited = form.map((child) =>
      'element' in child
        ? child
        : { ...child, label: `${child.key} label`, required: true, hidden: child.key === 'site' },
    );
    replace(reader, edited);
    kept(reader);
  });

  it('keeps everything when the fields are put in another order', () => {
    const reader = fill(reading(form));
    replace(reader, [...form].reverse());
    kept(reader);
  });

  it('keeps everything when a field is added, and shows the new field as a new form would', () => {
    const reader = fill(reading(form));
    replace(reader, [...form, text('subtitle', { default: 'None yet' })]);
    kept(reader);
    expect(reader.value(['subtitle'])).toBe('None yet');
  });

  it('leaves the instance exactly as it was when the template has not changed at all', () => {
    const reader = fill(reading(form));
    const written = () => InstanceSerializer.toJson(reader.coordinator.state.dataContext.instanceFullData);
    const before = written();
    replace(reader, form);
    expect(written()).toEqual(before);
  });
});

describe('which child continues which', () => {
  it('follows a field whose key changes while its property IRI stays', () => {
    const iri = 'https://schema.metadatacenter.org/properties/title-iri';
    const reader = reading([text('title', { iri })]).type(['title'], 'Ada');
    replace(reader, [text('heading', { iri })]);
    expect(reader.value(['heading'])).toBe('Ada');
    expect(reader.node(['title'])).toBeNull();
  });

  it('follows two fields whose keys are swapped, by their property IRIs', () => {
    const first = 'https://schema.metadatacenter.org/properties/first';
    const second = 'https://schema.metadatacenter.org/properties/second';
    const reader = reading([text('a', { iri: first }), text('b', { iri: second })])
      .type(['a'], 'one')
      .type(['b'], 'two');
    replace(reader, [text('b', { iri: first }), text('a', { iri: second })]);
    expect(reader.value(['b'])).toBe('one');
    expect(reader.value(['a'])).toBe('two');
  });

  it('keeps a field by its key when the author gives it a new property IRI', () => {
    const reader = reading([text('title', { iri: 'https://schema.metadatacenter.org/properties/old' })]).type(
      ['title'],
      'Ada',
    );
    replace(reader, [text('title', { iri: 'https://schema.metadatacenter.org/properties/new' })]);
    expect(reader.value(['title'])).toBe('Ada');
  });

  it('matches by key where two fields share a property IRI', () => {
    const shared = 'https://schema.metadatacenter.org/properties/shared';
    const reader = reading([text('a', { iri: shared }), text('b', { iri: shared })])
      .type(['a'], 'one')
      .type(['b'], 'two');
    replace(reader, [text('b', { iri: shared }), text('a', { iri: shared })]);
    expect(reader.value(['a'])).toBe('one');
    expect(reader.value(['b'])).toBe('two');
  });

  it('drops the answer to a field the author removes', () => {
    const reader = reading([text('title'), text('note')])
      .type(['title'], 'Ada')
      .type(['note'], 'kept');
    replace(reader, [text('note')]);
    expect(reader.node(['title'])).toBeNull();
    expect(reader.value(['note'])).toBe('kept');
  });

  it('does not bring an answer back when the removed field returns', () => {
    const reader = reading([text('title')]).type(['title'], 'Ada');
    replace(reader, []);
    replace(reader, [text('title')]);
    expect(reader.value(['title'])).toBeNull();
  });

  it('drops a field’s answer when an element takes its key', () => {
    const reader = reading([text('address')]).type(['address'], '1 Main Street');
    replace(reader, [{ key: 'address', element: [text('street')] }]);
    expect(reader.value(['address', 'street'])).toBeNull();
  });

  it('starts afresh a field moved into an element', () => {
    const reader = reading([text('street'), { key: 'address', element: [text('city')] }]).type(
      ['street'],
      '1 Main Street',
    );
    replace(reader, [{ key: 'address', element: [text('city'), text('street')] }]);
    expect(reader.value(['address', 'street'])).toBeNull();
  });

  it('follows fields inside an element whose key changes', () => {
    const iri = 'https://schema.metadatacenter.org/properties/address';
    const reader = reading([{ key: 'address', iri, element: [text('city')] }]).type(['address', 'city'], 'Paris');
    replace(reader, [{ key: 'location', iri, element: [text('city')] }]);
    expect(reader.value(['location', 'city'])).toBe('Paris');
  });
});

describe('what the reader entered, and what they left alone', () => {
  it('shows a changed default in a field the reader never touched', () => {
    const reader = reading([text('title', { default: 'Draft' })]);
    replace(reader, [text('title', { default: 'Final' })]);
    expect(reader.value(['title'])).toBe('Final');
  });

  it('keeps the reader’s answer over a changed default', () => {
    const reader = reading([text('title', { default: 'Draft' })]).type(['title'], 'Mine');
    replace(reader, [text('title', { default: 'Final' })]);
    expect(reader.value(['title'])).toBe('Mine');
  });

  it('keeps a default the reader emptied empty, since clearing it was their answer', () => {
    const reader = reading([text('title', { default: 'Draft' })]).type(['title'], null);
    replace(reader, [text('title', { default: 'Final' })]);
    expect(reader.value(['title'])).toBeNull();
  });

  it('treats an answer typed and then cleared, where there was no default, as never given', () => {
    const reader = reading([text('title')])
      .type(['title'], 'Mine')
      .type(['title'], null);
    replace(reader, [text('title', { default: 'Final' })]);
    expect(reader.value(['title'])).toBe('Final');
  });

  it('keeps an emptied radio choice empty when its default changes', () => {
    const reader = reading([{ kind: 'radio', key: 'f', options: ['A', 'B'], selected: ['A'] }]).type(['f'], null);
    replace(reader, [{ kind: 'radio', key: 'f', options: ['A', 'B'], selected: ['B'] }]);
    expect(reader.value(['f'])).toBeNull();
  });

  it('gives an entry the reader added but left alone the new default', () => {
    const reader = reading([list('tags', { default: 'old' })]).add(['tags']);
    expect(reader.values(['tags'])).toEqual(['old', 'old']);
    reader.type(['tags', 0], 'mine');
    replace(reader, [list('tags', { default: 'new' })]);
    expect(reader.values(['tags'])).toEqual(['mine', 'new']);
  });

  it('follows changed default selections in a checkbox group the reader never touched', () => {
    const reader = reading([{ kind: 'checkbox', key: 'flags', options: ['A', 'B'], selected: ['A'] }]);
    replace(reader, [{ kind: 'checkbox', key: 'flags', options: ['A', 'B'], selected: ['B'] }]);
    expect(reader.values(['flags'])).toEqual(['B']);
  });

  it('keeps a checkbox selection the reader made as one answer, defaults and all', () => {
    const reader = reading([{ kind: 'checkbox', key: 'flags', options: ['A', 'B'], selected: ['A'] }]).choose(
      ['flags'],
      ['A', 'B'],
    );
    replace(reader, [{ kind: 'checkbox', key: 'flags', options: ['A', 'B'] }]);
    expect(reader.values(['flags'])).toEqual(['A', 'B']);
  });

  it('keeps a reader’s answer inside an element whose other fields follow their new defaults', () => {
    const element = (note: string): ChildSpec[] => [
      { key: 'entry', element: [text('name'), text('note', { default: note })] },
    ];
    const reader = reading(element('first')).type(['entry', 'name'], 'Ada');
    replace(reader, element('second'));
    expect(reader.value(['entry', 'name'])).toBe('Ada');
    expect(reader.value(['entry', 'note'])).toBe('second');
  });
});

describe('a value restated for the changed field', () => {
  type Row = [string, FieldSpec, string, FieldSpec, string | null, (string | null)?];
  const rows: Row[] = [
    // Text between text-like fields.
    ['text to paragraph', text('f'), 'hello', { kind: 'textarea', key: 'f' }, 'hello'],
    ['text to email, an address', text('f'), 'a@example.org', { kind: 'email', key: 'f' }, 'a@example.org'],
    ['text to email, not an address', text('f'), 'hello', { kind: 'email', key: 'f' }, null],
    ['text to phone, a number', text('f'), '+1 650 555 0100', { kind: 'phone', key: 'f' }, '+1 650 555 0100'],
    ['text to phone, not a number', text('f'), 'call me', { kind: 'phone', key: 'f' }, null],
    ['email to text', { kind: 'email', key: 'f' }, 'a@example.org', text('f'), 'a@example.org'],
    // Text constraints the author tightens.
    ['a new maximum length', text('f'), 'abcdef', text('f', { maxLength: 3 }), null],
    ['a new maximum length it fits', text('f'), 'abc', text('f', { maxLength: 3 }), 'abc'],
    ['a new minimum length', text('f'), 'ab', text('f', { minLength: 3 }), null],
    ['a new pattern it breaks', text('f'), 'abc', text('f', { regex: '[A-Z]+' }), null],
    ['a new pattern it meets', text('f'), 'ABC', text('f', { regex: '[A-Z]+' }), 'ABC'],
    // Numbers.
    ['text to number', text('f'), '4', { kind: 'numeric', key: 'f' }, '4', 'xsd:decimal'],
    ['words to number', text('f'), 'four', { kind: 'numeric', key: 'f' }, null],
    [
      'decimal to integer, whole',
      { kind: 'numeric', key: 'f' },
      '4',
      { kind: 'numeric', key: 'f', numberType: 'xsd:int' },
      '4',
      'xsd:int',
    ],
    [
      'decimal to integer, fraction',
      { kind: 'numeric', key: 'f' },
      '4.5',
      { kind: 'numeric', key: 'f', numberType: 'xsd:int' },
      null,
    ],
    ['number to text', { kind: 'numeric', key: 'f' }, '7', text('f'), '7', null],
    ['a new maximum value', { kind: 'numeric', key: 'f' }, '7', { kind: 'numeric', key: 'f', maxValue: 5 }, null],
    [
      'a new minimum value it meets',
      { kind: 'numeric', key: 'f' },
      '7',
      { kind: 'numeric', key: 'f', minValue: 5 },
      '7',
    ],
    ['fewer decimal places', { kind: 'numeric', key: 'f' }, '1.25', { kind: 'numeric', key: 'f', decimals: 1 }, null],
    // Dates and times.
    [
      'a date to year precision',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'year' },
      '2026-01-01',
      'xsd:date',
    ],
    [
      'a date to month precision',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'month' },
      '2026-10-01',
    ],
    [
      'a date and time to a date',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:dateTime', granularity: 'minute' },
      '2026-10-09T10:30:00',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      'xsd:date',
    ],
    [
      'a date to a date and time at day precision',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:dateTime', granularity: 'day' },
      '2026-10-09T00:00:00',
      'xsd:dateTime',
    ],
    [
      'a date to a date and time needing the minute',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:dateTime', granularity: 'minute' },
      null,
    ],
    [
      'a date to a time',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:date', granularity: 'day' },
      '2026-10-09',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:time', granularity: 'minute' },
      null,
    ],
    [
      'a time to hour precision',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:time', granularity: 'minute' },
      '10:30:00',
      { kind: 'temporal', key: 'f', temporalType: 'xsd:time', granularity: 'hour' },
      '10:00:00',
    ],
    ['text to a date, a date', text('f'), '2026-10-09', { kind: 'temporal', key: 'f' }, '2026-10-09', 'xsd:date'],
    ['text to a date, not a date', text('f'), 'tomorrow', { kind: 'temporal', key: 'f' }, null],
    ['a date to text', { kind: 'temporal', key: 'f' }, '2026-10-09', text('f'), '2026-10-09', null],
    // Choices.
    ['text to radio, an option', text('f'), 'Beta', { kind: 'radio', key: 'f', options: ['Alpha', 'Beta'] }, 'Beta'],
    ['text to radio, not an option', text('f'), 'Zeta', { kind: 'radio', key: 'f', options: ['Alpha', 'Beta'] }, null],
    ['radio to text', { kind: 'radio', key: 'f', options: ['Alpha', 'Beta'] }, 'Beta', text('f'), 'Beta'],
    [
      'a renamed option',
      { kind: 'radio', key: 'f', options: ['Alpha', 'Beta'] },
      'Beta',
      { kind: 'radio', key: 'f', options: ['Alpha', 'Bravo'] },
      null,
    ],
    [
      'radio to list',
      { kind: 'radio', key: 'f', options: ['Alpha', 'Beta'] },
      'Beta',
      { kind: 'list', key: 'f', options: ['Alpha', 'Beta'] },
      'Beta',
    ],
    // Identifiers never become text, nor text identifiers.
    [
      'link to link',
      { kind: 'link', key: 'f' },
      'https://example.org/a',
      { kind: 'link', key: 'f' },
      'https://example.org/a',
    ],
    ['link to text', { kind: 'link', key: 'f' }, 'https://example.org/a', text('f'), null],
    ['text to link', text('f'), 'https://example.org/a', { kind: 'link', key: 'f' }, null],
    ['link to number', { kind: 'link', key: 'f' }, 'https://example.org/a', { kind: 'numeric', key: 'f' }, null],
  ];

  it.each(rows)('%s', (_name, from, typed, to, expected, datatype) => {
    const reader = reading([from]).type(['f'], typed);
    replace(reader, [to]);
    expect(reader.value(['f'])).toBe(expected);
    if (datatype !== undefined && expected !== null) {
      expect(reader.datatype(['f'])).toBe(datatype);
    }
  });

  it('shows the new default where a value could not be kept', () => {
    const reader = reading([text('f')]).type(['f'], 'four');
    replace(reader, [{ kind: 'numeric', key: 'f', default: 1 }]);
    expect(reader.value(['f'])).toBe('1');
  });

  it('keeps an entry the reader has not yet made valid, while the field stays as it was', () => {
    const reader = reading([{ kind: 'email', key: 'f' }, text('g')]).type(['f'], 'ada@');
    expect(reader.errors()).toEqual(['f email']);
    replace(reader, [{ kind: 'email', key: 'f' }, text('g')], { description: 'Edited' });
    expect(reader.value(['f'])).toBe('ada@');
  });

  it('drops an entry not yet valid once the change would find something more wrong with it', () => {
    const reader = reading([{ kind: 'email', key: 'f' }]).type(['f'], 'ada@');
    replace(reader, [{ kind: 'email', key: 'f' }]);
    replace(reader, [text('f', { maxLength: 2 })]);
    expect(reader.value(['f'])).toBeNull();
  });
});

describe('how many entries survive', () => {
  it('keeps two of three entries when the maximum drops to two, the last going first', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 0], 'a')
      .type(['tags', 1], 'b')
      .type(['tags', 2], 'c');
    replace(reader, [list('tags', { max: 2 })]);
    expect(reader.values(['tags'])).toEqual(['a', 'b']);
  });

  it('drops an empty entry before an answered one when the maximum drops', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 0], 'a')
      .type(['tags', 2], 'c');
    replace(reader, [list('tags', { max: 2 })]);
    expect(reader.values(['tags'])).toEqual(['a', 'c']);
  });

  it('drops an entry whose value the new field refuses before one it keeps', () => {
    const reader = reading([list('codes')])
      .add(['codes'], 3)
      .type(['codes', 0], 'AB')
      .type(['codes', 1], 'too long')
      .type(['codes', 2], 'CD');
    replace(reader, [list('codes', { max: 2, maxLength: 2 })]);
    expect(reader.values(['codes'])).toEqual(['AB', 'CD']);
  });

  it('keeps the entries the reader added, empty ones included, within the bounds', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 1], 'b');
    replace(reader, [list('tags')], { description: 'Edited' });
    expect(reader.values(['tags'])).toEqual([null, 'b', null]);
  });

  it('keeps the first answered entry when a list becomes a single field', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 1], 'b')
      .type(['tags', 2], 'c');
    replace(reader, [text('tags')]);
    expect(reader.value(['tags'])).toBe('b');
  });

  it('keeps the first answered entry when the maximum drops to one', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 2)
      .type(['tags', 1], 'b');
    replace(reader, [list('tags', { max: 1 })]);
    expect(reader.values(['tags'])).toEqual(['b']);
  });

  it('makes a single answer the first entry of a field that becomes a list', () => {
    const reader = reading([text('tags')]).type(['tags'], 'a');
    replace(reader, [list('tags')]);
    expect(reader.values(['tags'])).toEqual(['a']);
  });

  it('fills a list up to a new minimum with what a new form holds at each place', () => {
    const reader = reading([list('tags')])
      .add(['tags'])
      .type(['tags', 0], 'a');
    expect(new Reader().open(templateJson([list('tags', { min: 3, default: 'x' })])).values(['tags'])).toEqual([
      'x',
      null,
      null,
    ]);
    replace(reader, [list('tags', { min: 3, default: 'x' })]);
    expect(reader.values(['tags'])).toEqual(['a', null, null]);
  });

  it('keeps the reader’s entries when the minimum falls', () => {
    const reader = reading([list('tags', { min: 3 })]).type(['tags', 2], 'c');
    replace(reader, [list('tags', { min: 0 })]);
    expect(reader.values(['tags'])).toEqual([null, null, 'c']);
  });

  it('keeps the first selection the new single choice offers', () => {
    const reader = reading([{ kind: 'checkbox', key: 'f', options: ['A', 'B', 'C'] }]).choose(['f'], ['B', 'C']);
    replace(reader, [{ kind: 'radio', key: 'f', options: ['A', 'C'] }]);
    expect(reader.value(['f'])).toBe('C');
  });

  it('makes a single choice the selection of a field that takes several', () => {
    const reader = reading([{ kind: 'radio', key: 'f', options: ['A', 'B'] }]).type(['f'], 'B');
    replace(reader, [{ kind: 'checkbox', key: 'f', options: ['A', 'B'] }]);
    expect(reader.values(['f'])).toEqual(['B']);
  });

  it('keeps only as many selections as a new maximum allows', () => {
    const reader = reading([{ kind: 'multiList', key: 'f', options: ['A', 'B', 'C'] }]).choose(['f'], ['A', 'B', 'C']);
    replace(reader, [{ kind: 'multiList', key: 'f', options: ['A', 'B', 'C'], max: 2 }]);
    expect(reader.values(['f'])).toEqual(['A', 'B']);
  });

  it('makes each selection an entry of a list of text', () => {
    const reader = reading([{ kind: 'checkbox', key: 'f', options: ['A', 'B'] }]).choose(['f'], ['A', 'B']);
    replace(reader, [list('f')]);
    expect(reader.values(['f'])).toEqual(['A', 'B']);
  });

  const people = (
    more: { multi?: boolean; max?: number | null; min?: number | null } = { multi: true },
  ): ChildSpec[] => [{ key: 'person', ...more, element: [text('name'), list('emails')] }];

  it('keeps two of three element entries when the maximum drops, unanswered ones first', () => {
    const reader = reading(people())
      .add(['person'], 3)
      .type(['person', 0, 'name'], 'Ada')
      .type(['person', 2, 'name'], 'Grace');
    replace(reader, people({ multi: true, max: 2 }));
    expect(reader.count(['person'])).toBe(2);
    expect(reader.value(['person', 0, 'name'])).toBe('Ada');
    expect(reader.value(['person', 1, 'name'])).toBe('Grace');
  });

  it('keeps the first answered element entry, with what it holds, when the element becomes single', () => {
    const reader = reading(people())
      .add(['person'], 2)
      .type(['person', 1, 'name'], 'Grace')
      .add(['person', 1, 'emails'])
      .type(['person', 1, 'emails', 0], 'grace@example.org');
    replace(reader, people({ multi: false }));
    expect(reader.value(['person', 'name'])).toBe('Grace');
    expect(reader.values(['person', 'emails'])).toEqual(['grace@example.org']);
  });

  it('makes a single element the first entry of one that repeats', () => {
    const reader = reading(people({ multi: false })).type(['person', 'name'], 'Ada');
    replace(reader, people());
    expect(reader.count(['person'])).toBe(1);
    expect(reader.value(['person', 0, 'name'])).toBe('Ada');
  });

  it('fits a list inside each entry of a repeating element to its own new bound', () => {
    const reader = reading(people())
      .add(['person'], 2)
      .add(['person', 0, 'emails'], 2)
      .type(['person', 0, 'emails', 0], 'a@example.org')
      .type(['person', 0, 'emails', 1], 'b@example.org')
      .add(['person', 1, 'emails'])
      .type(['person', 1, 'emails', 0], 'c@example.org');
    replace(reader, [{ key: 'person', multi: true, element: [text('name'), list('emails', { max: 1 })] }]);
    expect(reader.values(['person', 0, 'emails'])).toEqual(['a@example.org']);
    expect(reader.values(['person', 1, 'emails'])).toEqual(['c@example.org']);
  });
});

describe('a template that contradicts itself', () => {
  it('empties an entry the reader added rather than show a new default its own limit refuses', () => {
    const element = (note: FieldSpec): ChildSpec[] => [{ key: 'person', multi: true, element: [text('name'), note] }];
    const reader = reading(element(list('note', { maxLength: 4 }))).add(['person'], 2);
    replace(reader, element(list('note', { maxLength: 4, default: 'Final' })));
    expect(reader.count(['person'])).toBe(2);
    expect(reader.values(['person', 0, 'note'])).toEqual([]);
    expect(reader.trace).not.toHaveBeenCalled();
  });
});

describe('the entry each pager stands on', () => {
  it('stays on the entry the reader was looking at', () => {
    const reader = reading([list('F1')])
      .add(['F1'], 2)
      .type(['F1', 0], 'first')
      .type(['F1', 1], '4');
    expect(reader.cursor(['F1'])).toBe(1);
    replace(reader, [list('F1')], { description: 'Element description' });
    expect(reader.values(['F1'])).toEqual(['first', '4']);
    expect(reader.cursor(['F1'])).toBe(1);
  });

  it('moves to the nearest earlier entry when the one on screen is dropped', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 0], 'a')
      .type(['tags', 1], 'b');
    reader.turn(['tags'], 2);
    replace(reader, [list('tags', { max: 2 })]);
    expect(reader.cursor(['tags'])).toBe(1);
  });

  it('follows the entry on screen to where trimming moves it', () => {
    const reader = reading([list('tags')])
      .add(['tags'], 3)
      .type(['tags', 0], 'a')
      .type(['tags', 2], 'c');
    replace(reader, [list('tags', { max: 2 })]);
    expect(reader.values(['tags'])).toEqual(['a', 'c']);
    expect(reader.cursor(['tags'])).toBe(1);
  });

  it('keeps a pager inside an element entry where it was', () => {
    const reader = reading([{ key: 'person', multi: true, element: [list('emails')] }])
      .add(['person'], 2)
      .add(['person', 1, 'emails'], 2)
      .type(['person', 1, 'emails', 1], 'b@example.org');
    expect(reader.cursor(['person'])).toBe(1);
    expect(reader.cursor(['person', 1, 'emails'])).toBe(1);
    replace(reader, [{ key: 'person', multi: true, element: [list('emails')] }], { description: 'Edited' });
    expect(reader.cursor(['person'])).toBe(1);
    expect(reader.cursor(['person', 1, 'emails'])).toBe(1);
  });

  it('starts on the first entry of a field that has just become a list', () => {
    const reader = reading([text('tags')]).type(['tags'], 'a');
    replace(reader, [list('tags')]);
    expect(reader.cursor(['tags'])).toBe(0);
  });
});

describe('attributes a reader names', () => {
  const attributes = (more: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'attribute', key: 'extra', ...more });

  it('keeps named attributes and their values', () => {
    const reader = reading([text('title'), attributes()])
      .add(['extra'])
      .attribute(['extra', 0], 'colour', 'red');
    replace(reader, [text('title'), attributes()], { description: 'Edited' });
    expect(reader.values(['extra'])).toEqual(['colour']);
    expect(reader.value(['colour'])).toBe('red');
  });

  it('drops the attributes past a new maximum, values and all', () => {
    const reader = reading([attributes()])
      .add(['extra'])
      .attribute(['extra', 0], 'colour', 'red')
      .add(['extra'])
      .attribute(['extra', 1], 'size', 'large');
    replace(reader, [attributes({ max: 1 })]);
    expect(reader.values(['extra'])).toEqual(['colour']);
    expect(reader.value(['colour'])).toBe('red');
    expect(reader.node(['size'])).toBeNull();
  });

  it('drops an attribute whose name the template now declares as a field of its own', () => {
    const reader = reading([attributes()]).add(['extra']).attribute(['extra', 0], 'colour', 'red');
    replace(reader, [attributes(), text('colour', { default: 'blue' })]);
    expect(reader.value(['colour'])).toBe('blue');
    expect(reader.values(['extra'])).not.toContain('colour');
  });

  it('drops the attributes of an attribute-value field the author removes', () => {
    const reader = reading([text('title'), attributes()])
      .add(['extra'])
      .attribute(['extra', 0], 'colour', 'red');
    replace(reader, [text('title')]);
    expect(reader.node(['colour'])).toBeNull();
  });
});
