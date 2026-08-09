/**
 * Whether `_ui._size` reaches CEE's tree at all.
 *
 * The rules for choosing a final size are arithmetic and are tested beside the
 * component. This is the other half, and the half that was actually missing:
 * the number has to survive the trip from the template's `_ui._size`, through
 * the model library's reader, into `contentInfo` — and for one of the two field
 * types it does not.
 *
 * The model library models `width` and `height` on `StaticYoutubeField` and not
 * on `StaticImageField`. So a template can ask an image to be 300 × 200 and CEE
 * cannot know: the size is dropped before the parser sees the field. That is a
 * model library gap rather than a CEE one, it is on the roadmap, and it is
 * asserted here rather than described so that the day the library grows the
 * property, this test fails and says so.
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
  _ui: { order: ['video', 'picture'], propertyLabels: { video: 'Video', picture: 'Picture' }, propertyDescriptions: { video: '', picture: '' } },
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
   * Not a preference. `StaticImageField` in the model library exposes `content`
   * and nothing else, so this is what CEE can see, not what it chooses to read.
   * When this starts failing, the library has grown the property and the image
   * component can honour it — which is the whole point of asserting it.
   */
  it('does not reach an image field, because the model library drops it', () => {
    const picture = childNamed(parse(), 'picture');
    expect(picture, 'the probe template did not produce an image child').toBeTruthy();
    expect(picture.contentInfo.content).toBe('https://cedar.metadatacenter.org/img/cedar-logo.png');
    expect({ width: picture.contentInfo.width, height: picture.contentInfo.height }).toEqual({
      width: null,
      height: null,
    });
  });
});
