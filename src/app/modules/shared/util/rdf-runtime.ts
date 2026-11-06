import jsonld from 'jsonld';
import { DataFactory, Parser, Writer } from 'n3';

/** Standalone scripts carry only the RDF exports they use, with no extra asset requirement. */
export const loadRdfRuntime = async () => ({ jsonld, DataFactory, Parser, Writer });
