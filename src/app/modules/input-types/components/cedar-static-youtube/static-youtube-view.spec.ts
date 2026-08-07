import { resolveStaticYoutubeView } from './static-youtube-view';

/**
 * `extractYouTubeVideoId` answers yes or no, and its own spec covers which
 * inputs get which answer. These cover what the component does with a no.
 *
 * It used to do nothing, so an unembeddable link rendered the field's red card
 * with no content and no explanation — the same silent failure the static image
 * field had, in a colour that reads as an error while naming no cause.
 */
describe('resolveStaticYoutubeView', () => {
  describe('an embeddable link yields a video ID and no error', () => {
    it.each([
      ['https://www.youtube.com/watch?v=1NBYWOKo9qo', '1NBYWOKo9qo'],
      ['https://youtu.be/qf6-_JLZ3lw?si=example', 'qf6-_JLZ3lw'],
      ['https://m.youtube.com/watch?v=1NBYWOKo9qo', '1NBYWOKo9qo'],
      ['1NBYWOKo9qo', '1NBYWOKo9qo'],
    ])('accepts %s', (content, expected) => {
      expect(resolveStaticYoutubeView(content)).toEqual({ videoId: expected, error: null });
    });
  });

  describe('a rejection always explains itself', () => {
    it.each([
      'https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMfO6uJbDzN8pTbZ3d',
      'https://vimeo.com/76979871',
      'https://www.youtube.com/watch?v=not-valid',
      'https://www.youtube.com.evil.example/watch?v=1NBYWOKo9qo',
      'not a video',
      '',
    ])('embeds nothing and says why for %s', (content) => {
      const view = resolveStaticYoutubeView(content);
      expect(view.videoId).toBeNull();
      expect(view.error).toBeTruthy();
    });

    it.each([
      'https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMfO6uJbDzN8pTbZ3d',
      'https://vimeo.com/76979871',
      'https://www.youtube.com/watch?v=not-valid',
    ])('names the offending value in the message for %s', (content) => {
      expect(resolveStaticYoutubeView(content).error).toContain(content);
    });
  });

  /**
   * The three causes call for different corrections, so a message that did not
   * tell them apart would send an author looking in the wrong place: a playlist
   * link needs a different link, a Vimeo link needs a different field, and a
   * malformed ID needs a typo fixed.
   */
  describe('the cause is identified, not merely reported', () => {
    it('calls a playlist out as naming no single video', () => {
      const view = resolveStaticYoutubeView('https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6');
      expect(view.error).toContain('names no single video');
    });

    it('calls a channel link out the same way', () => {
      expect(resolveStaticYoutubeView('https://www.youtube.com/@someChannel').error).toContain('names no single video');
    });

    it('names the wrong host rather than blaming the ID', () => {
      const view = resolveStaticYoutubeView('https://vimeo.com/76979871');
      expect(view.error).toContain('vimeo.com');
      expect(view.error).toContain('only YouTube');
    });

    it('treats a lookalike host as the wrong host, not as YouTube', () => {
      expect(resolveStaticYoutubeView('https://www.youtube.com.evil.example/watch?v=1NBYWOKo9qo').error).toContain(
        'only YouTube',
      );
    });

    it('calls a malformed ID on a real YouTube watch link a bad ID', () => {
      expect(resolveStaticYoutubeView('https://www.youtube.com/watch?v=not-valid').error).toContain(
        'video ID that is not valid',
      );
    });

    it('says the field is empty rather than that it is malformed', () => {
      expect(resolveStaticYoutubeView('   ').error).toBe('This video field has no YouTube link.');
    });

    it('reports a value that is not a link at all as neither link nor ID', () => {
      expect(resolveStaticYoutubeView('not a video').error).toContain('neither a YouTube link nor a video ID');
    });
  });
});
