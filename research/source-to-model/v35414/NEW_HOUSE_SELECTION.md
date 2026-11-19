# v3.54.14 R2 — selection rule for the one new simple house (written and committed before any candidate is opened)

Publisher: Lipińscy Domy (lipinscy.pl), not ARCHON; its pages go through the generic project-page adapter that the
service registers. The private H2 / OWNER holdout is not in this repository and is not touched.

1. **Pool.** `lipinscy-pool.txt`: the publisher's `/sitemap/projects-sitemap.xml` (robots.txt allows it), 460
   addresses in the sitemap's order, fetched 2026-11-19; SHA-256 of the XML
   `d41a1d9e8e39f84489a16a71be369581326fdff692ceb2288b4048025d3e2782`. No project page was opened to build it.
2. **Excluded families.** `lipinscy-seen.txt`: every Lipińscy project name found in this repository and in the
   private run directories (alaska, dublin, haga, lancaster-ii, lille, mindelo, norwich-ii, oslo, praia-ii). A family
   is the name without a trailing roman numeral (`-ii`, `-iii`, …), so `lancaster-iii` is excluded with
   `lancaster-ii` (the safe direction).
3. **Order.** seed = SHA-256 of "`ea1c91da9f38f5ca9fdc058c9a6787b06fd5ee2b`:V35414-NEW-SIMPLE" (the commit before this file); the walk starts at
   index (seed as an integer) mod (pool size) and goes forward cyclically. At most 25 candidates are opened.
4. **Acceptance — read from the acquired source inventory and the page's own facts only, never from an analysis.**
   Each candidate is acquired with `npm run source:acquire` (the one acquisition path). It is accepted when all hold:
   a. a section (`document = SECTION`);
   b. elevations of all four views (`FRONT`, `REAR`, `SIDE_LEFT`, `SIDE_RIGHT`);
   c. a ground-floor plan; and an upper-storey plan when the page's description names a storey above the ground
      (`piętro`, `poddasze użytkowe`, `dwukondygnacyjny`);
   d. simple: the page states a footprint (`footprint_area`) of at most 160 m² and a roof pitch of at least 20°, its
      description names a gable roof (`dwuspadow`), and names no garage (`garaż`) and no second roof form
      (`wielospadow`, `kopertow`, `płaski`);
   e. its family is not excluded (2).
   The first accepted candidate is the house; every opened candidate is listed with the reason it was refused. The
   choice is not changed after its first result, whatever that result is.
