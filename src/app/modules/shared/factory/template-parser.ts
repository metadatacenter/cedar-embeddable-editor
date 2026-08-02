import { CedarTemplate } from '../models/template/cedar-template.model';
import { HandlerContext } from '../util/handler-context';

/**
 * Turns a CEDAR template's JSON into CEE's component tree.
 *
 * Everything a parser is responsible for is derivable from the template alone:
 * which children exist, in what order, of what type, with what constraints and
 * cardinality. Two implementations exist — the hand-written JSON walk CEE has
 * always used, and one backed by the CEDAR Model TypeScript Library — and they
 * are required to produce identical trees. `template-parser-parity.spec.ts` in
 * the harness is what holds them to that.
 *
 * Deliberately *not* a parser's job: anything that depends on the surrounding
 * runtime rather than on the template. Empty-field hiding needs the loaded
 * instance, static-field collapsing is a display option, and page breaks are a
 * property of the rendered form. Those stay in `TemplateRepresentationFactory`,
 * applied identically whichever parser produced the tree — so a parser swap
 * cannot quietly change them.
 */
export interface TemplateParser {
  /**
   * Populate `template` from `templateJson`: children (recursively), their
   * names, paths, and info objects, and the template's own labels.
   *
   * Children marked `_ui.hidden` are omitted entirely rather than flagged —
   * that is a property of the template, so it belongs here.
   *
   * A malformed template is reported through
   * `handlerContext.messageHandlerService` and otherwise skipped. Parsing must
   * not throw: CEE renders whatever it can, and a template it cannot fully
   * read is still better than a blank screen.
   */
  parse(templateJson: object, template: CedarTemplate, handlerContext: HandlerContext): void;
}
