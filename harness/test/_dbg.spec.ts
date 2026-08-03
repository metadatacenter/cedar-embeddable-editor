import { describe, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
const TEXT: any = { key:'text', inputType:'textfield', make:()=>CedarBuilders.textFieldBuilder(), isStatic:false, write:'value', sample:'x' };
describe('dbg', () => { it('extract vs full', () => {
  const t = buildTemplate({ name:'x', elements:[{ name:'el', cardinality:'multi', minItems:2, maxItems:9, children:[{ kind:TEXT, name:'f' }] }] });
  const d = new CeeDriver(t);
  d.setValue(['_el','_f'], TEXT, 'v');
  console.log('EXTRACT:', JSON.stringify(d.extract, null, 1).slice(0, 700));
  console.log('FULL:', JSON.stringify(d.metadata, null, 1).slice(0, 700));
}); });
