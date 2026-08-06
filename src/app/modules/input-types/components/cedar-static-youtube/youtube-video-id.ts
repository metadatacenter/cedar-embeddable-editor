const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accept the values CEDAR templates have historically stored for YouTube
 * fields, but return only a validated video ID. The caller can therefore build
 * an embed URL from a fixed origin instead of trusting template content as a
 * resource URL.
 */
export const extractYouTubeVideoId = (value: string): string => {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }
  if (YOUTUBE_VIDEO_ID.test(candidate)) {
    return candidate;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  let videoId: string = null;
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com' ||
    hostname === 'youtube-nocookie.com' ||
    hostname === 'www.youtube-nocookie.com'
  ) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else {
      const [kind, id] = parsed.pathname.split('/').filter(Boolean);
      if (kind === 'embed' || kind === 'shorts' || kind === 'live') {
        videoId = id ?? null;
      }
    }
  }

  return videoId && YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
};
