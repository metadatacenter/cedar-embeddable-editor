/**
 * Whether `_ui._size` reaches CEE's tree at all.
 *
 * The rules for choosing a final size are arithmetic and are tested beside the
 * components. This is the other half, and the half that was actually missing:
 * the number has to survive the trip from the template's `_ui._size`, through
 * the model library's reader, into `contentInfo`.
 *
 * Both sizeable kinds carry it now. The model library modelled `width` and
 * `height` on `StaticYoutubeField` alone until 0.9.2-dev.20260808.92f3412, so a
 * template could ask an image to be 300 × 200 and CEE could not know — the size
 * was dropped before the parser saw the field. That was a model library gap
 * rather than a CEE one, and it was asserted here rather than described so that
 * the day the library grew the property, the test would fail and say so. It did.
 *
 * What each renderer does with an absent size is its own question, answered
 * beside the components: a video falls back to a default because an `iframe`
 * collapses without one, an image is left at its natural dimensions.
 */
import { describe, expect, it } from 'vitest';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';

/**
 * A template holding one static field of each kind, both asking for a size.
 *
 * Through `buildTemplate` like every other fixture here. It was written out as
 * CEDAR JSON because the generator had no way to ask for `_ui._size`; the
 * library's image and YouTube builders both take a width and a height, so the
 * generator does now and the template stops being a document this file knows
 * how to write.
 */
const templateWithSizedStatics = () =>
  buildTemplate({
    name: 'size probe',
    children: [
      { kind: kind('youtube'), name: 'video', size: { width: 400, height: 300 } },
      { kind: kind('image'), name: 'picture', size: { width: 300, height: 200 } },
    ],
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const childNamed = (driver: CeeDriver, name: string): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (driver.representation?.children ?? []).find((c: any) => c.name === name);

const parse = () => new CeeDriver(templateWithSizedStatics(), { templateParser: new ModelLibraryTemplateParser() });

describe('a size a template asks for', () => {
  it('reaches a video field', () => {
    const video = childNamed(parse(), '_video');
    expect(video, 'the probe template did not produce a video child').toBeTruthy();
    expect({ width: video.contentInfo.width, height: video.contentInfo.height }).toEqual({ width: 400, height: 300 });
  });

  /**
   * This asserted the opposite until the library grew the property, which is
   * what it was for: `StaticImageField` exposed `content` and nothing else, so
   * an image's size was dropped before the parser could see it, and the test
   * was written to fail on the day that stopped being true.
   *
   * It did stop being true, in 0.9.2-dev.20260808.92f3412.
   *
   * Only the size is asserted. The hand-written fixture this replaced carried a
   * content URL and the test checked it alongside, to show the two travel
   * through different properties of the same field; the generator gives a static
   * field the empty content its kind declares, so that pairing has nowhere to
   * stand here and is covered where content is the subject.
   */
  it('reaches an image field', () => {
    const picture = childNamed(parse(), '_picture');
    expect(picture, 'the probe template did not produce an image child').toBeTruthy();
    expect({ width: picture.contentInfo.width, height: picture.contentInfo.height }).toEqual({
      width: 300,
      height: 200,
    });
  });
});
