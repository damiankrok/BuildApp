/**
 * @buildapp/image-metrology — measuring buildings out of pictures.
 *
 * Once an image has been registered against coordinates the building is
 * already known to have, every interval in it becomes a length in metres. That
 * is all this package does, and doing it properly means being strict about
 * three things: what the registration was fitted to, what it is then used on,
 * and how much either is worth.
 *
 * Pure arithmetic over decoded rasters. No DOM, no network, no filesystem, and
 * no knowledge of any particular building — a metric frame is told its anchors
 * by a caller that knows the architecture, and hands back metres.
 */
export * from './linalg.js'
export * from './frame.js'
export * from './orthographic.js'
export * from './measure.js'
export * from './bounds.js'
export * from './opening.js'
export * from './overlay.js'
export * from './homography.js'
export * from './camera.js'
