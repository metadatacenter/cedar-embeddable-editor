import jsonld from 'jsonld';
import { Parser, Writer } from 'n3';
import type { JsonNode } from 'cedar-model-typescript-library';

/**
 * An instance as RDF, converted by a JSON-LD processor rather than by hand.
 *
 * The instance's JSON-LD carries its own `@context`, so conversion needs nothing from the network.
 * The document loader refuses every URL: an instance naming a remote context fails to convert
 * rather than making CEE fetch from somewhere its embedding contract never mentioned.
 *
 * CEDAR's JSON is not quite JSON-LD, in three deliberate ways that `toRdfReady` settles first. Past
 * those, the processor runs in safe mode, so anything else it would drop fails the conversion: a
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
  isObject(value) && (Object.keys(value).length === 0 || ('@value' in value && value['@value'] === null));

/**
 * An attribute-value field's list of the attribute names it holds.
 *
 * Each named attribute is a property of the same object with an IRI in the context, so the triples
 * are all there without the list, and the list itself names no property: it is structure.
 */
const isAttributeNameList = (key: string, value: Json, node: JsonObject): boolean =>
  !key.startsWith('@') &&
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
}

/** This object's context with its IRI-like terms renamed, and the scope its own keys resolve in. */
const enterContext = (context: Json, outer: Scope): { context: Json; scope: Scope } => {
  if (!isObject(context)) {
    return { context, scope: outer };
  }
  const prefixes = new Set(outer.prefixes);
  for (const [term, definition] of Object.entries(context)) {
    if (typeof definition === 'string' && /[/#]$/.test(definition) && !term.includes(':')) {
      prefixes.add(term);
    }
  }
  const aliases = new Map(outer.aliases);
  const renamed: JsonObject = {};
  for (const [term, definition] of Object.entries(context)) {
    if (needsAlias(term, prefixes)) {
      const alias = `cee-term-${outer.next.value++}`;
      aliases.set(term, alias);
      renamed[alias] = definition;
    } else {
      aliases.delete(term);
      renamed[term] = definition;
    }
  }
  return { context: renamed, scope: { prefixes, aliases, next: outer.next } };
};

const convert = (node: Json, outer: Scope): Json => {
  if (Array.isArray(node)) {
    return node.filter((item) => !isEmptyField(item)).map((item) => convert(item, outer));
  }
  if (!isObject(node)) {
    return node;
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
    if ((key === '@id' && value === null) || isEmptyField(value) || isAttributeNameList(key, value, node)) {
      continue;
    }
    const converted = convert(value, scope);
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
export const toRdfReady = (node: Json): Json =>
  convert(node, { prefixes: new Set(), aliases: new Map(), next: { value: 0 } });

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
export const toNQuads = async (instance: JsonNode): Promise<string> => {
  const document = toRdfReady(asJson(instance));
  if (!isObject(document)) {
    throw new Error('An instance is a JSON object');
  }
  // Safe mode arrived in jsonld 6, after the type declarations were last written.
  const options: jsonld.Options.ToRdf & { safe: boolean } = {
    format: 'application/n-quads',
    documentLoader: refuseRemoteContexts,
    safe: true,
  };
  let nquads: unknown;
  try {
    nquads = await jsonld.toRDF(document, options);
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
export const toTurtle = async (instance: JsonNode): Promise<string> => {
  const quads = new Parser({ format: 'N-Quads', blankNodePrefix: '' }).parse(await toNQuads(instance));
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
