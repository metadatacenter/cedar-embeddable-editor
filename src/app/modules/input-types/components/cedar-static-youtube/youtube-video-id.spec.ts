import { extractYouTubeVideoId } from './youtube-video-id';

describe('extractYouTubeVideoId', () => {
  it.each([
    ['qf6-_JLZ3lw', 'qf6-_JLZ3lw'],
    [' https://www.youtube.com/watch?v=1NBYWOKo9qo&t=20 ', '1NBYWOKo9qo'],
    ['https://youtu.be/qf6-_JLZ3lw?si=example', 'qf6-_JLZ3lw'],
    ['https://www.youtube.com/embed/1NBYWOKo9qo', '1NBYWOKo9qo'],
    ['https://youtube.com/shorts/qf6-_JLZ3lw', 'qf6-_JLZ3lw'],
    ['https://www.youtube-nocookie.com/embed/1NBYWOKo9qo', '1NBYWOKo9qo'],
  ])('normalizes %s', (value, expected) => {
    expect(extractYouTubeVideoId(value)).toBe(expected);
  });

  it.each([
    null,
    '',
    'not a video',
    'too-short',
    'https://example.org/watch?v=1NBYWOKo9qo',
    'https://www.youtube.com/watch?v=not-valid',
    'https://www.youtube.com.evil.example/watch?v=1NBYWOKo9qo',
  ])('rejects %s', (value) => {
    expect(extractYouTubeVideoId(value)).toBeNull();
  });
});
