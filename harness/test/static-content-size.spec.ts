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
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';

/** A template holding one static field of each kind, both asking for a size. */
const templateWithSizedStatics = () => ({
  '@id': 'https://repo.metadatacenter.orgx/templates/size-probe',
  '@type': 'https://schema.metadatacenter.org/core/Template',
  '@context': {
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    pav: 'http://purl.org/pav/',
    bibo: 'http://purl.org/ontology/bibo/',
    oslc: 'http://open-services.net/ns/core#',
    schema: 'http://schema.org/',
    'schema:name': { '@type': 'xsd:string' },
    'schema:description': { '@type': 'xsd:string' },
    'pav:createdOn': { '@type': 'xsd:dateTime' },
    'pav:createdBy': { '@type': '@id' },
    'pav:lastUpdatedOn': { '@type': 'xsd:dateTime' },
    'oslc:modifiedBy': { '@type': '@id' },
  },
  type: 'object',
  title: 'size probe',
  description: 'size probe',
  'schema:name': 'Size probe',
  'schema:description': '',
  'schema:schemaVersion': '1.6.0',
  additionalProperties: false,
  $schema: 'http://json-schema.org/draft-04/schema#',
  _ui: {
    order: ['video', 'picture'],
    propertyLabels: { video: 'Video', picture: 'Picture' },
    propertyDescriptions: { video: '', picture: '' },
  },
  required: [],
  properties: {
    '@context': {},
    '@id': {},
    video: {
      '@type': 'https://schema.metadatacenter.org/core/StaticTemplateField',
      type: 'object',
      title: 'video',
      description: 'video',
      'schema:name': 'Video',
      'schema:description': '',
      'schema:schemaVersion': '1.6.0',
      _ui: {
        inputType: 'youtube',
        _content: 'https://www.youtube.com/watch?v=1NBYWOKo9qo',
        _size: { width: 400, height: 300 },
      },
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
    picture: {
      '@type': 'https://schema.metadatacenter.org/core/StaticTemplateField',
      type: 'object',
      title: 'picture',
      description: 'picture',
      'schema:name': 'Picture',
      'schema:description': '',
      'schema:schemaVersion': '1.6.0',
      _ui: {
        inputType: 'image',
        _content: 'https://cedar.metadatacenter.org/img/cedar-logo.png',
        _size: { width: 300, height: 200 },
      },
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const childNamed = (driver: CeeDriver, name: string): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (driver.representation?.children ?? []).find((c: any) => c.name === name);

const parse = () => new CeeDriver(templateWithSizedStatics(), { templateParser: new ModelLibraryTemplateParser() });

describe('a size a template asks for', () => {
  it('reaches a video field', () => {
    const video = childNamed(parse(), 'video');
    expect(video, 'the probe template did not produce a video child').toBeTruthy();
    expect({ width: video.contentInfo.width, height: video.contentInfo.height }).toEqual({ width: 400, height: 300 });
  });

  /**
   * This asserted the opposite until the library grew the property, which is
   * what it was for: `StaticImageField` exposed `content` and nothing else, so
   * an image's size was dropped before the parser could see it, and the test
   * was written to fail on the day that stopped being true.
   *
   * It did stop being true, in 0.9.2-dev.20260808.92f3412. The assertion is now
   * that the size arrives, and the content beside it, because the two travel
   * through different properties of the same field and only one of them was
   * ever missing.
   */
  it('reaches an image field', () => {
    const picture = childNamed(parse(), 'picture');
    expect(picture, 'the probe template did not produce an image child').toBeTruthy();
    expect(picture.contentInfo.content).toBe('https://cedar.metadatacenter.org/img/cedar-logo.png');
    expect({ width: picture.contentInfo.width, height: picture.contentInfo.height }).toEqual({
      width: 300,
      height: 200,
    });
  });
});
