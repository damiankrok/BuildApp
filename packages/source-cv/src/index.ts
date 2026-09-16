/**
 * @buildapp/source-cv — the deterministic computer-vision layer of the source
 * analyzer.
 *
 * What this package is: arithmetic over already-decoded rasters. Grayscale and
 * ink fields, binary masks, connected components, runs, straight segments,
 * parallel families, rectangles, silhouettes and slope histograms.
 *
 * What it is deliberately NOT: it does not decode images, fetch anything,
 * touch the DOM or the filesystem, and it knows nothing whatsoever about
 * buildings, projects or metres. It cannot tell you that a rectangle is a
 * window — only that a rectangle is there, where, and how well its perimeter
 * is backed by ink. Interpretation belongs to a layer that also knows the
 * drawing's type, its scale and its view, and keeping that knowledge out of
 * here is what lets this package be tested against synthetic pictures with
 * exact expected answers.
 *
 * Everything is a pure function: no randomness, no clock, no ambient state,
 * no iteration order reaching a result. The same input bytes produce the same
 * output on every engine, which is the property the sealed-package layer above
 * depends on when it hashes what was seen.
 */
export * from './raster.js'
export * from './mask.js'
export * from './lines.js'
export * from './shapes.js'
export * from './bands.js'
