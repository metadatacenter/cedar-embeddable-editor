/** Coordinated hosts supply these exact runtimes as deferred browser modules. */
export const loadRdfRuntime = async () => {
  const [{ default: jsonld }, { DataFactory, Parser, Writer }] = await Promise.all([import('jsonld'), import('n3')]);
  return { jsonld, DataFactory, Parser, Writer };
};
