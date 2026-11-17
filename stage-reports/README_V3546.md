# v3.54.6 — debug od źródła do modelu, Marcówki GE: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3546.md`](SOURCE_TO_MODEL_V3546.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`54d31f6` (poprawki; na niej trzy odczyty Marcówek) i `f9cb3ef` (przyjęta rewizja D39; z niej host). Hand-off:
`research/source-to-model/v3546/HANDOFF.md`. Master Plan v3.54.6: `docs/MASTER_PLAN.md`.

## W pięciu zdaniach

1. Każdy defekt z briefu ma znalezioną pierwszą stratę z plikiem i funkcją; uzasadnienie Pliszki z v3.54.5 było błędne —
   6,71 m to metadana strony powtórzona przez czytnik na rzucie, nie liczba z przekroju (przekroju nie ma).
2. Na tych samych zapisanych odpowiedziach Pliszka ma teraz 4/4 strony, 10/11 otworów i 0 fałszywych (v3.54.5 oddawała
   LOCAL z 17 fałszywymi), a Mirabelka po naprawie wyboru obrazów — 9/9 otworów i 0 fałszywych (było 0/9).
3. Alaska: przeszklenie szczytu jest zbudowane (przybliżone, nazwane); 4 fałszywe otwory mają jedną przyczynę w odczycie
   kolumn ściany i zostają nienaprawione — granica nazwana.
4. Marcówki GE: trzy świeże odczyty tych samych bajtów dały trzy różne modele (pierwsza różnica już w pierwszej
   odpowiedzi), każdy odtworzony dwa razy daje ten sam model bit w bit; wybór we wszystkich trzech poprawnie zostawił
   LOCAL (11/11 otworów).
5. Dlatego przyjęta rewizja jest teraz odtwarzana: drugie zadanie na hoście na ten sam dom dało ten sam model za 0 USD;
   koszt kampanii 1,379534 USD (26 żądań), księgi 20,655864 z 24,11036.

## Gdzie co jest

| co | gdzie |
|---|---|
| diagnozy i tabela domów | raport, rozdz. 3–4 |
| wybór modelu (D38) | raport, rozdz. 5; `packages/analysis-service/src/house/describe.ts` (`arbitrate`, `openingsAgainstElevation`) |
| Marcówki: tabela trzech odczytów | raport, rozdz. 6; skrypt `research/source-to-model/v3546/marcowki-compare.py` |
| przyjęta rewizja (D39) | raport, rozdz. 8; `packages/analysis-service/src/house/accepted.ts` |
| regresja | raport, rozdz. 7; wyniki `research/source-to-model/v3546/results/` |
| testy przyczyn i kontrprzykładów | `packages/analysis-service/test/house-v3546.test.ts` |
| tablice ŹRÓDŁO / PRZED / PO, odpowiedzi, ślady | `/home/user/BuildPlan-V3546-Private.zip` (poza Git) |
| ledger | `research/ai-assist/spend-ledger-v3546.json` |

## Do decyzji OWNER-a

- Czy przyjmować dom z odczytu jako rewizję także wtedy, gdy oddany jest podgląd częściowy (teraz: tak, z tą informacją).
- Czy kolejny etap ma iść w czytnik (osobne pytanie o lica ścian — Alaska) czy w builder (filar/zwrot węższy niż dwie
  ściany — Marcówki). Oba są nazwanymi granicami, nie kodem w toku.
