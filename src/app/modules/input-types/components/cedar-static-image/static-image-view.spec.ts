import { resolveStaticImageView } from './static-image-view';

/**
 * These pin the behaviour a real template exercised and the component did not
 * have: a static image field whose URL answered `200 text/html` rendered as an
 * empty khaki card, because the `img` carried no error handler and an empty
 * `schema:description` made its `alt` decorative. Nothing on the page said the
 * image had failed, so the field read as one that simply had no picture.
 *
 * The decision is a pure function of the template content and one boolean, which
 * is what lets the load-failure path be covered here. The component holds the
 * boolean and does nothing else.
 */
describe('resolveStaticImageView', () => {
  describe('a usable URL renders', () => {
    it.each([
      'https://cedar.metadatacenter.org/img/cedar-logo.png',
      'http://example.org/photo.jpg',
      'data:image/png;base64,iVBORw0KGgo=',
      '/img/cedar-logo.png',
      'img/cedar-logo.png',
      '//cdn.example.org/logo.png',
    ])('passes %s through as the src', (content) => {
      expect(resolveStaticImageView(content, false)).toEqual({ src: content, error: null });
    });

    it('trims surrounding whitespace', () => {
      expect(resolveStaticImageView('  https://example.org/a.png  ', false).src).toBe('https://example.org/a.png');
    });
  });

  describe('a load failure is reported, not swallowed', () => {
    const url = 'https://cedar.metadatacenter.org/cedar-logo.png';
    const view = resolveStaticImageView(url, true);

    it('renders no image', () => {
      expect(view.src).toBeNull();
    });

    it('explains that the load failed', () => {
      expect(view.error).toContain('could not be loaded');
    });

    it('names the URL, which is the only thing that lets an author fix it', () => {
      expect(view.error).toContain(url);
    });
  });

  describe('content that can never render is caught before the browser tries', () => {
    it.each([null, undefined, '', '   '])('reports %s as having no URL', (content) => {
      const view = resolveStaticImageView(content, false);
      expect(view.src).toBeNull();
      expect(view.error).toBe('This image field has no URL.');
    });

    it.each(['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.org/a.png'])(
      'refuses the unrenderable scheme in %s',
      (content) => {
        const view = resolveStaticImageView(content, false);
        expect(view.src).toBeNull();
        expect(view.error).toContain(content);
      },
    );

    it('reports a URL the browser cannot parse', () => {
      const view = resolveStaticImageView('http://[unclosed', false);
      expect(view.src).toBeNull();
      expect(view.error).toContain('cannot parse');
    });

    it('prefers the content complaint over the load failure, since the load was never worth trying', () => {
      expect(resolveStaticImageView('javascript:alert(1)', true).error).toContain('cannot address an image');
    });
  });
});
