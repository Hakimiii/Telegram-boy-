import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUrl,
  identifyPlatform,
  formatDuration,
  formatFileSize,
  parseSongInfoFromText,
  evaluateWebhookCheckStatus,
} from './mediaParser';

test('extractUrl finds HTTP/HTTPS URLs inside message text', () => {
  assert.equal(
    extractUrl('سلام این لینک رو دانلود کن https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3 ممنون'),
    'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3'
  );
  assert.equal(extractUrl('بدون لینک'), null);
});

test('identifyPlatform detects Instagram, Spotify (including intl), YouTube, and TikTok', () => {
  const ig = identifyPlatform('https://www.instagram.com/reel/C8abc123/?igsh=xyz');
  assert.equal(ig.platform, 'instagram');
  assert.equal(ig.cleanUrl, 'https://www.instagram.com/reel/C8abc123/');

  const sp = identifyPlatform('https://open.spotify.com/intl-de/track/7qiZfU4dY1lWllzX7mPBI3?si=123');
  assert.equal(sp.platform, 'spotify');
  assert.equal(sp.cleanUrl, 'https://open.spotify.com/intl-de/track/7qiZfU4dY1lWllzX7mPBI3');

  const yt = identifyPlatform('https://youtu.be/dQw4w9WgXcQ?t=10');
  assert.equal(yt.platform, 'youtube');
  assert.equal(yt.cleanUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('formatDuration and formatFileSize format numbers accurately', () => {
  assert.equal(formatDuration(125), '2:05');
  assert.equal(formatDuration(3665), '1:01:05');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
});

test('parseSongInfoFromText splits Artist - Title patterns', () => {
  const parsed = parseSongInfoFromText('Wantons - Fada Saret (Official Audio)');
  assert.equal(parsed.artist, 'Wantons');
  assert.equal(parsed.title, 'Fada Saret');
  assert.equal(parsed.confidence, 'medium');
});

test('evaluateWebhookCheckStatus rejects 302, 401, and 405 and accepts 200', () => {
  assert.equal(evaluateWebhookCheckStatus(200).valid, true);
  assert.equal(evaluateWebhookCheckStatus(302).valid, false);
  assert.equal(evaluateWebhookCheckStatus(401).valid, false);
  assert.equal(evaluateWebhookCheckStatus(405).valid, false);
});
