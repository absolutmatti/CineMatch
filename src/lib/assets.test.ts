import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssetWithBase } from './assets';

test('resolves local asset paths under root base /', () => {
  assert.equal(
    resolveAssetWithBase('/src/assets/images/cinema_hero_backdrop_1794870405404.jpg', '/'),
    '/src/assets/images/cinema_hero_backdrop_1794870405404.jpg'
  );
});

test('resolves local asset paths under GitHub Pages subpath /cinematch/', () => {
  assert.equal(
    resolveAssetWithBase('/src/assets/images/poster.jpg', '/cinematch/'),
    '/cinematch/src/assets/images/poster.jpg'
  );
  assert.equal(
    resolveAssetWithBase('src/assets/images/poster.jpg', '/cinematch'),
    '/cinematch/src/assets/images/poster.jpg'
  );
});

test('keeps external TMDB and data URLs untouched', () => {
  assert.equal(
    resolveAssetWithBase('https://image.tmdb.org/t/p/w500/abc.jpg', '/cinematch/'),
    'https://image.tmdb.org/t/p/w500/abc.jpg'
  );
  assert.equal(resolveAssetWithBase(undefined, '/cinematch/'), undefined);
});
