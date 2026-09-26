import jsonld from 'jsonld';
import type { JsonLdDocument } from 'jsonld';
import { DataFactory, Parser, Writer } from 'n3';
import type { JsonNode } from 'cedar-model-typescript-library';

/**
 * An instance as RDF, converted by a JSON-LD processor rather than by hand.
 *
 * The instance's JSON-LD carries its own `@context`, so conversion needs nothing from the network.
 * The document loader refuses every URL: an instance naming a remote context fails to convert
 * rather than making CEE fetch from somewhere its embedding contract never mentioned.
 *
 * CEDAR's JSON conventions are settled by `toRdfReady` before JSON-LD expansion.
 * Expansion warnings and invalid RDF terms fail conversion rather than discard information: a
 * download that fails says so, and one that silently loses a field does not.
 */
const refuseRemoteContexts = async (url: string): Promise<never> => {
  throw new Error(`CEE does not fetch remote JSON-LD contexts; the instance names ${url}`);
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (value: Json): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A writer's JSON tree as plain JSON, with absent members left out as `JSON.stringify` would. */
const asJson = (value: unknown): Json => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(asJson);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .map(([key, member]) => [key, asJson(member)]),
    );
  }
  throw new Error(`An instance holds a ${typeof value}, which JSON cannot state`);
};

/** A field with nothing in it: `{}` for an IRI field, `{"@value": null}` for a literal one. */
const isEmptyField = (value: Json): boolean =>
  isObject(value) &&
  (Object.keys(value).length === 0 ||
    (value['@value'] === null && Object.keys(value).every((key) => ['@value', '@type', '@language'].includes(key))));

/**
 * An attribute-value field's list of the attribute names it holds.
 *
 * Each named attribute is a property of the same object with an IRI in the context, so the triples
 * are all there without the list, and the list itself names no property: it is structure.
 */
const isAttributeNameList = (
  key: string,
  value: Json,
  node: JsonObject,
  context: ReadonlyMap<string, Json>,
  schema: Json,
): boolean =>
  !key.startsWith('@') &&
  (isAttributeSchema(schema) || (!context.has(key) && !context.has('@vocab'))) &&
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((name) => typeof name === 'string' && name !== key && name in node);

/**
 * A term JSON-LD 1.1 would read as an IRI of its own.
 *
 * A field name such as `Date (month/year)` or `Time: start` is an ordinary CEDAR term, but a term
 * holding a slash, or a colon after anything but a declared prefix, must expand to itself in JSON-LD
 * 1.1, and the processor refuses one that maps elsewhere. `schema:name` stays, since `schema` is a
 * declared prefix and the term is the compact form of its own IRI.
 */
const needsAlias = (term: string, prefixes: ReadonlySet<string>): boolean => {
  if (term.startsWith('@')) {
    return false;
  }
  if (['__proto__', 'constructor', 'prototype'].includes(term)) return true;
  const colon = term.indexOf(':');
  if (colon > 0 && prefixes.has(term.slice(0, colon)) && !term.slice(colon + 1).startsWith('//')) {
    return false;
  }
  return term.includes('/') || colon >= 0;
};

interface Scope {
  /** Prefixes declared by this object's context or any context above it. */
  prefixes: ReadonlySet<string>;
  /** Each renamed term, by its original name, as this object's context and those above define it. */
  aliases: ReadonlyMap<string, string>;
  /** Numbers the aliases of one conversion. */
  next: { value: number };
  names: ReadonlySet<string>;
  definitions: ReadonlyMap<string, Json>;
}

const childSchema = (schema: Json, key: string): Json => {
  const properties = isObject(schema) ? schema['properties'] : null;
  const child = isObject(properties) ? properties[key] : null;
  return isObject(child) && child['type'] === 'array' ? (child['items'] ?? null) : (child ?? null);
};
const isAttributeSchema = (schema: Json): boolean =>
  isObject(schema) && isObject(schema['_ui']) && schema['_ui']['inputType'] === 'attribute-value';

const allNames = (value: Json, names = new Set<string>()): ReadonlySet<string> => {
  if (Array.isArray(value)) value.forEach((item) => allNames(item, names));
  else if (isObject(value))
    Object.entries(value).forEach(([key, member]) => {
      names.add(key);
      allNames(member, names);
    });
  return names;
};

/** This object's context with its IRI-like terms renamed, and the scope its own keys resolve in. */
const enterContext = (context: Json, outer: Scope): { context: Json; scope: Scope } => {
  if (context === null)
    return { context, scope: { ...outer, prefixes: new Set(), aliases: new Map(), definitions: new Map() } };
  if (Array.isArray(context)) {
    let scope = outer;
    const entries = context.map((entry) => {
      const entered = enterContext(entry, scope);
      scope = entered.scope;
      return entered.context;
    });
    return { context: entries, scope };
  }
  if (!isObject(context)) {
    return { context, scope: outer };
  }
  const prefixes = new Set(outer.prefixes);
  for (const [term, definition] of Object.entries(context)) {
    if (typeof definition === 'string' && /[/#]$/.test(definition) && !term.includes(':')) {
      prefixes.add(term);
    }
    if (
      isObject(definition) &&
      definition['@prefix'] === true &&
      typeof definition['@id'] === 'string' &&
      !term.includes(':')
    ) {
      prefixes.add(term);
    }
  }
  const aliases = new Map(outer.aliases);
  const definitions = new Map(outer.definitions);
  const renamed: JsonObject = {};
  for (const [term, definition] of Object.entries(context)) {
    definitions.set(term, definition);
    if (needsAlias(term, prefixes)) {
      let alias: string;
      do {
        alias = `cee-term-${outer.next.value++}`;
      } while (outer.names.has(alias));
      aliases.set(term, alias);
      renamed[alias] = definition;
    } else {
      aliases.delete(term);
      renamed[term] = definition;
    }
  }
  return { context: renamed, scope: { ...outer, prefixes, aliases, definitions } };
};

const convert = (node: Json, outer: Scope, schema: Json): Json => {
  if (Array.isArray(node)) {
    return node.map((item) => convert(item, outer, schema)).filter((item) => !isEmptyField(item));
  }
  if (!isObject(node)) {
    return node;
  }
  if ('@value' in node) {
    if ('@id' in node) throw new Error('An RDF field cannot contain both @id and @value.');
    if (Array.isArray(node['@type']) && node['@type'].length > 1)
      throw new Error('An RDF literal has at most one datatype.');
    if (node['@value'] === null && !isEmptyField(node))
      throw new Error('A null literal carries metadata RDF would discard.');
  }
  const { context, scope } =
    '@context' in node ? enterContext(node['@context'], outer) : { context: undefined, scope: outer };
  const ready: JsonObject = {};
  if (context !== undefined) {
    ready['@context'] = context;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === '@context') {
      continue;
    }
    if (
      (key === '@id' && value === null) ||
      isAttributeNameList(key, value, node, scope.definitions, childSchema(schema, key))
    ) {
      continue;
    }
    if (key === '@type' && '@value' in node && Array.isArray(value)) {
      if (value.length === 1) ready[key] = value[0];
      continue;
    }
    const converted = convert(value, scope, childSchema(schema, key));
    if (isEmptyField(converted)) continue;
    if (Array.isArray(converted) && converted.length === 0) {
      continue;
    }
    ready[scope.aliases.get(key) ?? key] = converted;
  }
  return ready;
};

/**
 * The instance with CEDAR's conventions restated as JSON-LD.
 *
 * - `"@id": null` is how CEDAR asks the server for an identifier. JSON-LD forbids it; the RDF
 *   equivalent of a node without an identifier is a blank node, so the key goes.
 * - An empty field states nothing. Left in, `{}` would become a triple pointing at a blank node,
 *   asserting a value that does not exist, so empty fields go.
 * - An attribute-value field's name list goes, for the reason `isAttributeNameList` gives.
 * - A field name JSON-LD would read as an IRI is renamed, for the reason `needsAlias` gives. A term
 *   is only a local name for its IRI, so the renaming changes no triple.
 */
export const toRdfReady = (node: Json, schema: Json = null): Json =>
  convert(
    node,
    { prefixes: new Set(), aliases: new Map(), definitions: new Map(), names: allNames(node), next: { value: 0 } },
    schema,
  );

/** Validate without changing RDF identity. URL serialization would normalize the spelling. */
const assertIri = (iri: string): void => {
  if (iri.startsWith('_:')) {
    if (!/^_:[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(iri) || iri.endsWith('.'))
      throw new Error('Invalid blank-node identifier.');
    return;
  }
  if (
    !/^[A-Za-z][A-Za-z0-9+.-]*:.+/.test(iri) ||
    /%(?![0-9A-Fa-f]{2})/.test(iri) ||
    iri.indexOf('#') !== iri.lastIndexOf('#')
  ) {
    throw new Error('RDF requires a well-formed absolute IRI: ' + iri);
  }
  // Square brackets are reserved for IP literals in an authority, never a path or opaque part.
  if (iri.includes('[') || iri.includes(']')) {
    const match = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)(.*)$/.exec(iri);
    if (!match || /[[\]]/.test(match[2])) throw new Error('Invalid brackets in RDF IRI.');
    try {
      new URL('http://' + match[1]);
    } catch {
      throw new Error('Invalid IP literal in RDF IRI.');
    }
  }
  let query = false;
  let fragment = false;
  for (const character of iri) {
    const cp = character.codePointAt(0)!;
    if (character === '#') {
      fragment = true;
      query = false;
    } else if (character === '?' && !fragment) query = true;
    if (cp < 0x80) {
      if (cp <= 0x20 || cp === 0x7f || '<>"{}|\\^`'.includes(character)) throw new Error('Invalid RDF IRI character.');
    } else {
      const ucs =
        (cp >= 0xa0 && cp <= 0xd7ff) ||
        (cp >= 0xf900 && cp <= 0xfdcf) ||
        (cp >= 0xfdf0 && cp <= 0xffef) ||
        (cp >= 0x10000 && cp <= 0xdfffd && (cp & 0xffff) <= 0xfffd) ||
        (cp >= 0xe1000 && cp <= 0xefffd);
      const privateChar =
        (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
      if (!ucs && !(query && privateChar)) throw new Error('Invalid Unicode RDF IRI character.');
    }
  }
};

/**
 * Processors have URI-only checks and jsonld.js rewrites string-valued xsd:double literals.
 * After expansion, validate every IRI and temporarily replace it with an opaque absolute IRI.
 * Restore RDF terms by exact lookup after conversion. Every original IRI is replaced, so an
 * input spelling that resembles our tokens cannot collide. Literal text is never replaced.
 */
const protectExpanded = (expanded: Json): { document: Json; restore: (iri: string) => string } => {
  let tokenPrefix = 'urn:cedar:rdf:';
  const inputText = JSON.stringify(expanded);
  while (inputText.includes(tokenPrefix)) tokenPrefix += 'x:';
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();
  const protect = (iri: Json): Json => {
    if (typeof iri !== 'string') throw new Error('RDF identifiers and datatypes must be strings.');
    assertIri(iri);
    if (iri.startsWith('_:')) return iri;
    let token = forward.get(iri);
    if (!token) {
      token = `${tokenPrefix}${forward.size}`;
      forward.set(iri, token);
      reverse.set(token, iri);
    }
    return token;
  };
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObject(node)) return node;
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === '@value' || key === '@language') {
        result[key] = value;
        continue;
      }
      if (key === '@index' || key === '@direction' || key === '@json')
        throw new Error('RDF export cannot preserve ' + key + '.');
      if (key === '@id' || key === '@type') {
        // Numeric values still need the processor's datatype-specific numeric conversion.
        result[key] =
          key === '@type' && typeof node['@value'] === 'number'
            ? value
            : Array.isArray(value)
              ? value.map(protect)
              : protect(value);
        if (key === '@type' && typeof node['@value'] === 'number') {
          (Array.isArray(value) ? value : [value]).forEach((type) => {
            if (typeof type !== 'string') throw new Error('Invalid datatype.');
            assertIri(type);
          });
        }
      } else {
        if (key.startsWith('@') && !['@graph', '@list', '@reverse', '@included'].includes(key))
          throw new Error('Unsupported expanded RDF keyword: ' + key);
        const property = key.startsWith('@') ? key : (protect(key) as string);
        if (key.startsWith('_:')) throw new Error('RDF predicates must be IRIs.');
        result[property] = walk(value);
      }
    }
    return result;
  };
  return { document: walk(expanded), restore: (iri) => reverse.get(iri) ?? iri };
};

/**
 * The processor's refusal, restated where CEDAR explains it.
 *
 * A property without an IRI is, in practice, an attribute the user has just named: CEE gives it no
 * IRI of its own, and the server assigns one when the instance is saved. RDF cannot state a value
 * without a predicate, so the download waits for the save rather than dropping the value.
 */
/** One member of a value of unknown shape, or `undefined` when it has none. */
const member = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (Reflect.get(value, key) as unknown) : undefined;

const explained = (error: unknown): unknown => {
  const event = member(member(error, 'details'), 'event');
  const property = member(member(event, 'details'), 'property');
  if (member(event, 'code') === 'invalid property' && typeof property === 'string') {
    return new Error(
      `"${property}" has no property IRI yet, so RDF cannot state its value. ` +
        'An attribute receives its IRI when the instance is saved.',
    );
  }
  return error;
};

/** The instance as N-Quads, one statement per line. */
export const toNQuads = async (instance: JsonNode, schema?: JsonNode): Promise<string> => {
  const document = toRdfReady(asJson(instance), schema ? asJson(schema) : null);
  if (!isObject(document)) {
    throw new Error('An instance is a JSON object');
  }
  // jsonld's safe handler uses a URI-only regular expression. Defer identifier warnings
  // to our RFC 3987 check on expanded IRIs; every other warning still refuses export.
  type Event = { code: string; message: string; details: Record<string, unknown> };
  const options: jsonld.Options.ToRdf & { eventHandler: (input: { event: Event }) => void } = {
    format: 'application/n-quads',
    documentLoader: refuseRemoteContexts,
    eventHandler: ({ event }) => {
      if (['relative @id reference', 'relative @type reference'].includes(event.code)) return;
      throw Object.assign(new Error(event.message), { details: { event } });
    },
  };
  if (Object.keys(document).every((key) => ['@context', '@id'].includes(key))) {
    if (typeof document['@id'] === 'string') assertIri(document['@id']);
    // Still validate contexts, including the no-network rule, using an empty anonymous node.
    await jsonld.expand(
      { '@context': document['@context'] ?? {} } as JsonLdDocument,
      {
        ...options,
        eventHandler: ({ event }: { event: Event }) => {
          if (event.code !== 'empty object') options.eventHandler({ event });
        },
      } as typeof options,
    );
    return '';
  }
  let nquads: unknown;
  try {
    const expanded = await jsonld.expand(document, options);
    const protectedRdf = protectExpanded(asJson(expanded));
    const rdfOptions: jsonld.Options.ToRdf & { skipExpansion: boolean } = { ...options, skipExpansion: true };
    nquads = await jsonld.toRDF(protectedRdf.document as JsonLdDocument, rdfOptions);
    if (typeof nquads !== 'string') throw new Error('Expected N-Quads.');
    const restore = (term: ReturnType<typeof DataFactory.namedNode> | import('n3').Term): import('n3').Term => {
      if (term.termType === 'NamedNode') return DataFactory.namedNode(protectedRdf.restore(term.value));
      if (term.termType === 'Literal')
        return DataFactory.literal(
          term.value,
          term.language || DataFactory.namedNode(protectedRdf.restore(term.datatype.value)),
        );
      return term;
    };
    const writer = new Writer({ format: 'N-Quads' });
    writer.addQuads(
      new Parser({ format: 'N-Quads', blankNodePrefix: '' })
        .parse(nquads)
        .map((q) =>
          DataFactory.quad(
            restore(q.subject) as typeof q.subject,
            restore(q.predicate) as typeof q.predicate,
            restore(q.object) as typeof q.object,
            restore(q.graph) as typeof q.graph,
          ),
        ),
    );
    nquads = await new Promise<string>((resolve, reject) =>
      writer.end((error, text) => (error ? reject(error) : resolve(text))),
    );
  } catch (error) {
    throw explained(error);
  }
  if (typeof nquads !== 'string') {
    throw new Error('The JSON-LD processor returned a dataset rather than N-Quads');
  }
  return nquads;
};

/**
 * The instance as Turtle.
 *
 * Produced from the N-Quads, so both downloads state exactly the same triples. The prefixes are the
 * ones the instance's own context declares, which keeps the Turtle as readable as the JSON-LD.
 */
export const toTurtle = async (instance: JsonNode, schema?: JsonNode): Promise<string> => {
  const quads = new Parser({ format: 'N-Quads', blankNodePrefix: '' }).parse(await toNQuads(instance, schema));
  if (quads.some((q) => q.graph.termType !== 'DefaultGraph'))
    throw new Error('Turtle cannot preserve named graphs; use N-Quads.');
  const writer = new Writer({ format: 'Turtle', prefixes: declaredPrefixes(asJson(instance)) });
  writer.addQuads(quads);
  return new Promise((resolve, reject) =>
    writer.end((error: Error | null, result: string) => (error ? reject(error) : resolve(result))),
  );
};

/** Every term of the instance's context that names a namespace: an IRI ending in `/` or `#`. */
const declaredPrefixes = (instance: Json): Record<string, string> => {
  const context = isObject(instance) ? instance['@context'] : null;
  if (context === null || context === undefined || !isObject(context)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(context).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && /^[A-Za-z][\w.-]*$/.test(entry[0]) && /[/#]$/.test(entry[1]),
    ),
  );
};
