import { afterEach, describe, expect, it, vi } from 'vitest';
import { SemanticChecks } from '@cee/validation/semantic-checks';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { instanceWith, templateIdOf, termValue } from '../src/values';

const term = 'https://example.org/term';
const answer = (status: string, iri = term) => ({
  status,
  iri,
  code:
    status === 'passed'
      ? 'controlledTermVerified'
      : status === 'failed'
        ? 'controlledTermMembership'
        : status === 'notChecked'
          ? 'semanticNotChecked'
          : 'semanticUnavailable',
  message: 'Membership result.',
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('semantic verification lifecycle', () => {
  it('preserves a label-only controlled answer and reports the missing identifier at its field', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'controlled')!;
    const template = buildTemplate({ name: 'Label only', children: [{ kind, name: 'term' }] });
    const driver = new CeeDriver(template, {
      instance: { ...instanceWith(templateIdOf(template), {}), _term: { 'rdfs:label': 'Homo sapiens' } },
    });
    expect(driver.qualityReport.problems).toContainEqual(
      expect.objectContaining({
        code: 'controlledStructure',
        path: ['_term'],
        category: 'structural',
        blocksSave: true,
      }),
    );
    expect(driver.qualityReport.problems).not.toContainEqual(expect.objectContaining({ code: 'valueShape' }));
    expect(driver.emitted._term).toEqual({ 'rdfs:label': 'Homo sapiens' });
    expect(driver.qualityReport.canSave).toBe(false);
  });

  it('counts an identifier-only controlled answer as present and verifies its exact identifier', async () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'controlled')!;
    const template = buildTemplate({ name: 'Identifier only', children: [{ kind, name: 'term', required: true }] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(answer('passed')))),
    );
    const driver = new CeeDriver(template, {
      instance: { ...instanceWith(templateIdOf(template), {}), _term: { '@id': term } },
    });
    driver.handlerContext.validation.configureSemantic('https://terminology.example.org/', null);
    await driver.handlerContext.validation.settled();
    expect(driver.qualityReport).toMatchObject({ isValid: true, canSave: true, nonNullRequiredFieldValueCount: 1 });
    expect(driver.emitted._term).toEqual({ '@id': term });
    driver.handlerContext.validation.dispose();
  });

  it('distinguishes omitted, passed, failed, malformed and unavailable checks', async () => {
    const checks = new SemanticChecks(() => {});
    expect(checks.inspect(null, { iri: term }, term).status).toBe('notChecked');
    for (const [result, status] of [
      [answer('passed'), 'passed'],
      [answer('failed'), 'failed'],
      [{}, 'unavailable'],
      [answer('passed', 'https://wrong.example.org'), 'unavailable'],
    ] as const) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(result))),
      );
      checks.begin();
      checks.inspect(`https://service/${status}/${JSON.stringify(result)}`, { iri: term, valueConstraints: {} }, term);
      checks.end();
      await checks.settled();
      expect(
        checks.inspect(`https://service/${status}/${JSON.stringify(result)}`, { iri: term, valueConstraints: {} }, term)
          .status,
      ).toBe(status);
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    checks.begin();
    checks.inspect('https://offline', { iri: term }, term);
    checks.end();
    await checks.settled();
    expect(checks.inspect('https://offline', { iri: term }, term).status).toBe('unavailable');
    checks.dispose();
  });

  it.each([
    ['failed', 'unexpectedStructuralCode'],
    ['failed', 'controlledTermVerified'],
    ['passed', 'controlledTermMembership'],
    ['passed', 'authorityVerified'],
  ])('reports incompatible %s/%s responses as unavailable without blocking instance saves', async (status, code) => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'controlled')!;
    const template = buildTemplate({ name: 'Unrecognized response', children: [{ kind, name: 'term' }] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ iri: term, status, code, message: 'Result.' }))),
    );
    const driver = new CeeDriver(template, {
      instance: instanceWith(templateIdOf(template), { _term: termValue(term, 'Term') }),
    });
    driver.handlerContext.validation.configureSemantic('https://terminology.example.org/', null);
    await driver.handlerContext.validation.settled();
    expect(driver.qualityReport).toMatchObject({
      isValid: false,
      canSave: true,
      structurallyValid: true,
      semanticChecks: [{ status: 'unavailable', code: 'semanticUnavailable' }],
    });
    driver.handlerContext.validation.dispose();
  });

  it('caches complete constraint identities and ignores superseded results', async () => {
    const changed = vi.fn();
    const replies: Array<(value: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve)));
    vi.stubGlobal('fetch', fetcher);
    const checks = new SemanticChecks(changed);
    checks.begin();
    checks.inspect('https://service', { iri: term, valueConstraints: { version: 'one' } }, term);
    checks.end();
    checks.begin();
    checks.inspect('https://service', { iri: term, valueConstraints: { version: 'two' } }, term);
    checks.end();
    replies[0](new Response(JSON.stringify(answer('failed'))));
    await Promise.resolve();
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    replies[1](new Response(JSON.stringify(answer('passed'))));
    await checks.settled();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(checks.inspect('https://service', { iri: term, valueConstraints: { version: 'two' } }, term).status).toBe(
      'passed',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    checks.dispose();
  });

  it.each([
    ['unavailable', 30_000],
    ['notChecked', 30_000],
    ['passed', 300_000],
    ['failed', 300_000],
  ] as const)('rechecks %s only when its settled %ims lifetime expires', async (status, lifetime) => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const replies: Array<(value: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve)));
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn();
    const checks = new SemanticChecks(changed);
    const inspect = () => {
      checks.begin();
      const value = checks.inspect(
        'https://service',
        { iri: term, valueConstraints: { ontologies: [{ version: { id: 'v1' } }] } },
        term,
      );
      checks.end();
      return value;
    };
    expect(inspect().status).toBe('notChecked');
    now += 600_000;
    expect(checks.hasExpired()).toBe(false);
    expect(inspect().status).toBe('notChecked');
    expect(fetcher).toHaveBeenCalledTimes(1);
    replies[0](new Response(JSON.stringify(answer(status))));
    await checks.settled();
    expect(inspect().status).toBe(status);
    now += lifetime - 1;
    expect(checks.hasExpired()).toBe(false);
    expect(inspect().status).toBe(status);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 1;
    expect(checks.hasExpired()).toBe(true);
    expect(inspect().status).toBe('notChecked');
    expect(checks.hasExpired()).toBe(false);
    expect(checks.pending).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    inspect();
    expect(fetcher).toHaveBeenCalledTimes(2);
    replies[1](new Response(JSON.stringify(answer('passed'))));
    await checks.settled();
    expect(inspect().status).toBe('passed');
    expect(changed).toHaveBeenCalledTimes(2);
    checks.dispose();
  });

  it('retries an expired outage through the existing quality-report rebuild', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'controlled')!;
    const template = buildTemplate({ name: 'Retry', children: [{ kind, name: 'term' }] });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify(answer('passed'))));
    vi.stubGlobal('fetch', fetcher);
    const driver = new CeeDriver(template, {
      instance: instanceWith(templateIdOf(template), { _term: termValue(term, 'Term') }),
    });
    driver.handlerContext.validation.configureSemantic('https://terminology.example.org/', null);
    await driver.handlerContext.validation.settled();
    expect(driver.qualityReport.semanticChecks[0].status).toBe('unavailable');
    now += 30_000;
    driver.handlerContext.buildQualityReport();
    expect(driver.qualityReport.pendingValidation).toBe(true);
    await driver.handlerContext.validation.settled();
    expect(driver.qualityReport).toMatchObject({ isValid: true, canSave: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    driver.handlerContext.validation.dispose();
  });

  it('verifies loaded terms with full version-aware constraints and keeps quality failure saveable', async () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'controlled')!;
    const template = buildTemplate({ name: 'terms', children: [{ kind, name: 'term' }] });
    const raw = template as any;
    const constraints = raw.properties._term._valueConstraints;
    constraints.ontologies = [
      { acronym: 'TEST', uri: 'https://example.org/ontologies/TEST', name: 'Test', version: { id: 'v2' } },
    ];
    constraints.actions = [{ action: 'delete', termUri: 'urn:removed' }];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ iri: term, valueConstraints: constraints });
      return new Response(JSON.stringify(answer('failed')));
    });
    vi.stubGlobal('fetch', fetcher);
    const driver = new CeeDriver(template, {
      instance: instanceWith(templateIdOf(template), { _term: termValue(term, 'A stale label') }),
    });
    expect(driver.qualityReport.semanticChecks[0].status).toBe('notChecked');
    driver.handlerContext.validation.configureSemantic('https://terminology.example.org/', null);
    expect(driver.qualityReport.pendingValidation).toBe(true);
    await driver.handlerContext.validation.settled();
    expect(driver.qualityReport).toMatchObject({
      isValid: false,
      canSave: true,
      structurallyValid: true,
      semanticChecks: [{ status: 'failed', path: ['_term'] }],
    });
    expect(driver.qualityReport.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'controlledTermMembership', severity: 'warning', blocksSave: false }),
      ]),
    );
    driver.handlerContext.validation.dispose();
  });
});
