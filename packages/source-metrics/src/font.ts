/**
 * A digit font, as bitmaps.
 *
 * The numeric OCR in this package is template matching, and template matching
 * needs templates. Rather than ship a font file or depend on a rasteriser,
 * the ten digits and the handful of signs a drawing uses are written out here
 * as small bitmaps — which is what a font IS, at the size printed dimensions
 * are actually set at on a published drawing.
 *
 * They are drawn upright and unslanted. Real drawing text is very often
 * italic, so the reader de-skews a token before matching rather than carrying
 * a second, slanted set: one shear estimate is cheaper and more honest than
 * two template sets that can disagree.
 *
 * The shapes are deliberately plain — no serifs, no closed 4, an open 6 and 9
 * — because a prototype that commits to one typeface's mannerisms matches that
 * typeface and nothing else. The classifier scores shape overlap and uses
 * TOPOLOGY (how many enclosed holes a glyph has) as a separate, strong signal,
 * so the prototypes carry the skeleton and the topology carries the identity.
 */

/** Rows of a glyph, `#` for ink. All the same height; width varies. */
export type GlyphBitmap = readonly string[]

export const DIGIT_BITMAPS: Record<string, GlyphBitmap> = {
  '0': ['.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  '1': ['...##.', '..###.', '.#.##.', '...##.', '...##.', '...##.', '...##.', '...##.', '...##.', '...##.', '...##.', '..####'],
  '2': ['.####.', '#....#', '#....#', '.....#', '.....#', '....#.', '...#..', '..#...', '.#....', '#.....', '#.....', '######'],
  '3': ['.####.', '#....#', '.....#', '.....#', '..###.', '..###.', '.....#', '.....#', '.....#', '#....#', '#....#', '.####.'],
  '4': ['....##', '...###', '..#.##', '.#..##', '#...##', '#...##', '######', '....##', '....##', '....##', '....##', '....##'],
  '5': ['######', '#.....', '#.....', '#.....', '#####.', '.....#', '.....#', '.....#', '.....#', '#....#', '#....#', '.####.'],
  '6': ['..###.', '.#....', '#.....', '#.....', '#.....', '#####.', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  '7': ['######', '.....#', '.....#', '....#.', '....#.', '...#..', '...#..', '..#...', '..#...', '.#....', '.#....', '#.....'],
  '8': ['.####.', '#....#', '#....#', '#....#', '.####.', '.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  '9': ['.####.', '#....#', '#....#', '#....#', '#....#', '.#####', '.....#', '.....#', '.....#', '.....#', '....#.', '.###..'],
}

/** Signs and separators a dimension or a level datum carries. Shorter glyphs, matched on the same grid. */
export const SIGN_BITMAPS: Record<string, GlyphBitmap> = {
  '+': ['......', '......', '......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......', '......', '......'],
  '-': ['......', '......', '......', '......', '......', '######', '######', '......', '......', '......', '......', '......'],
  ',': ['......', '......', '......', '......', '......', '......', '......', '......', '......', '..##..', '..##..', '.##...'],
  '.': ['......', '......', '......', '......', '......', '......', '......', '......', '......', '..##..', '..##..', '......'],
  '/': ['.....#', '.....#', '....#.', '....#.', '...#..', '...#..', '..#...', '..#...', '.#....', '.#....', '#.....', '#.....'],
  '°': ['.###..', '#...#.', '#...#.', '.###..', '......', '......', '......', '......', '......', '......', '......', '......'],
  '±': ['......', '......', '..##..', '..##..', '######', '..##..', '..##..', '......', '######', '######', '......', '......'],
}

/**
 * Second forms of the digits whose shape genuinely varies between typefaces,
 * and between one typeface and the same typeface rendered eleven pixels tall.
 * Both forms are matched and the better one wins, which is truer than picking
 * one and calling the other a misread: an open four and a closed four are both
 * fours, and at this size the difference is one pixel of counter.
 */
export const ALTERNATE_BITMAPS: Record<string, GlyphBitmap[]> = {
  '4': [['....##', '...###', '..####', '.#..##', '#...##', '#####.', '....##', '....##', '....##', '....##', '....##', '....##']],
  '1': [['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..']],
  '5': [['.#####', '.#....', '#.....', '#.....', '#####.', '.....#', '.....#', '.....#', '.....#', '#....#', '##...#', '.####.']],
  '7': [['######', '#....#', '.....#', '....##', '....#.', '...##.', '...#..', '...#..', '..##..', '..#...', '..#...', '.##...']],
  '9': [['.####.', '#....#', '#....#', '#....#', '#....#', '.#####', '.....#', '.....#', '.....#', '#....#', '#....#', '.####.']],
  '0': [['..##..', '.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '..##..']],
}

export const GLYPH_BITMAPS: Record<string, GlyphBitmap> = { ...DIGIT_BITMAPS, ...SIGN_BITMAPS }

/** The characters a numeric reader may return, in a fixed order so a result never depends on object key order. */
export const GLYPH_ALPHABET: readonly string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', ',', '.', '/', '°', '±']
