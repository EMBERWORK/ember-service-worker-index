import { ENVIRONMENT, INDEX_EXCLUDE_SCOPE, INDEX_HTML_PATH, INDEX_INCLUDE_SCOPE, VERSION } from 'ember-service-worker-index/service-worker/config';
import cleanupCaches from 'ember-service-worker/service-worker/cleanup-caches';
import { urlMatchesAnyPattern } from 'ember-service-worker/service-worker/url-utils';


const CACHE_KEY_PREFIX = 'esw-index';
const CACHE_NAME = `${CACHE_KEY_PREFIX}-${VERSION}`;

const INDEX_HTML_URL = new URL(INDEX_HTML_PATH, self.location).toString();

const _fetchIndex = function() {
  return fetch(INDEX_HTML_URL, { credentials: 'include' }).then((response) => {
    caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_HTML_URL, response));
    return response;
  })
};

const _returnCachedIndex = function() {
  return caches.match(INDEX_HTML_URL, { cacheName: CACHE_NAME }).then((response) => {
      if (response) {
        return response;
      }

      // Re-fetch the resource in the event that the cache had been cleared
      // (mostly an issue with Safari 11.1 where clearing the cache causes
      // the browser to throw a non-descriptive blank error page).
      return _fetchIndex();
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(_fetchIndex());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupCaches(CACHE_KEY_PREFIX, CACHE_NAME));
});

self.addEventListener('fetch', (event) => {
  let request = event.request;
  let url = new URL(request.url);
  let isGETRequest = request.method === 'GET';
  let isHTMLRequest = request.headers.get('accept').indexOf('text/html') !== -1;
  let isLocal = url.origin === location.origin;
  let scopeExcluded = urlMatchesAnyPattern(request.url, INDEX_EXCLUDE_SCOPE);
  let scopeIncluded = !INDEX_INCLUDE_SCOPE.length || urlMatchesAnyPattern(request.url, INDEX_INCLUDE_SCOPE);
  let isTests = url.pathname === '/tests' && ENVIRONMENT === 'development';

  if (!isTests && isGETRequest && isHTMLRequest && isLocal && scopeIncluded && !scopeExcluded) {
    event.respondWith(_fetchIndex().catch(() => _returnCachedIndex()))
  }
});
