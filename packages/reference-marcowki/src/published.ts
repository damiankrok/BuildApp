/**
 * The official project page as it reads today (fetched 2026-09-15), for
 * the deterministic fact audit. Every figure here is a PUBLISHED aggregate;
 * none of them is allowed to move a dimensioned chain.
 */
export const PUBLISHED_CURRENT = {
  houseNetArea: 129.04,
  garageArea: 24.1,
  boilerArea: 5.8,
  usableAreaWithoutStairs: 153.31,
  stairsArea: 5.63,
  footprintArea: 131.16,
  floorArea: 170.62,
  totalArea: 231.11,
  roofArea: 150.57,
  buildingHeight: 8.27,
  kneeWall: 1.3,
  roofPitchDeg: 40,
  groundStoreyArea: 96.5,
  groundStoreyGrossArea: 97.48,
  atticNetArea: 62.44,
  atticGrossArea: 73.14,
} as const

/** Room table of the current page: net area, and the gross figure printed in brackets where the page prints one. */
export type PublishedRoom = { roomId: string; label: string; index: number; net: number; gross?: number; counted: boolean }

export const PUBLISHED_ROOMS: readonly PublishedRoom[] = [
  { roomId: 'g-entry', label: 'Wiatrołap', index: 1, net: 3.7, counted: true },
  { roomId: 'g-hall', label: 'Hol', index: 2, net: 9.18, counted: true },
  { roomId: 'g-kitchen', label: 'Kuchnia', index: 3, net: 9.63, counted: true },
  { roomId: 'g-salon', label: 'Salon + Jadalnia', index: 4, net: 29.52, counted: true },
  { roomId: 'g-pantry', label: 'Spiżarnia', index: 5, net: 1.44, gross: 2.42, counted: true },
  { roomId: 'g-bathroom', label: 'Łazienka', index: 6, net: 3.95, counted: true },
  { roomId: 'g-room', label: 'Pokój', index: 7, net: 9.18, counted: true },
  { roomId: 'g-boiler', label: 'Kotłownia', index: 8, net: 5.8, counted: false },
  { roomId: 'g-garage', label: 'Garaż', index: 9, net: 24.1, counted: false },
  { roomId: 'u-corridor', label: 'Korytarz', index: 1, net: 6.17, counted: true },
  { roomId: 'u-pokoj-s', label: 'Pokój', index: 2, net: 10.25, gross: 11.88, counted: true },
  { roomId: 'u-garderoba-sw', label: 'Garderoba', index: 3, net: 5.19, gross: 6.53, counted: true },
  { roomId: 'u-bathroom', label: 'Łazienka', index: 4, net: 6.4, gross: 7.81, counted: true },
  { roomId: 'u-pralnia', label: 'Pralnia', index: 5, net: 5.59, gross: 6.73, counted: true },
  { roomId: 'u-pokoj-nw', label: 'Pokój', index: 6, net: 12.57, gross: 15.13, counted: true },
  { roomId: 'u-pokoj-ne', label: 'Pokój', index: 7, net: 9.02, gross: 10.88, counted: true },
  { roomId: 'u-garderoba-ne', label: 'Garderoba', index: 8, net: 1.62, gross: 2.38, counted: true },
  { roomId: 'u-stairs', label: 'Schody', index: 9, net: 5.63, counted: false },
]
