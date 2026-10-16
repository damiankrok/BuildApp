/*
 * boot.js — picks the pack (real by default, `?pack=synthetic` for the demo) and loads local scripts in order.
 * Only these fixed relative paths can be loaded; nothing is fetched from a network.
 */
(function () {
  'use strict'
  const PACKS = {
    real: { dir: 'pack/' },
    synthetic: { dir: 'examples/synthetic/' },
  }
  const wanted = new URLSearchParams(window.location.search).get('pack')
  const pack = PACKS[wanted] ? wanted : 'real'
  window.OWNER_REVIEW_PACK_DIR = PACKS[pack].dir

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script')
      s.src = src
      s.onload = resolve
      s.onerror = function () { reject(new Error('cannot load ' + src)) }
      document.body.appendChild(s)
    })
  }
  window.OwnerReviewLoadScript = loadScript

  loadScript(PACKS[pack].dir + 'queue.js')
    .then(function () { return loadScript('tool/review-ui.js') })
    .catch(function (e) {
      document.getElementById('app').textContent = 'Nie udało się wczytać pakietu (' + e.message + '). Otwórz review.html z katalogu pakietu.'
    })
})()
