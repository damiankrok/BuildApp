# v3.54.21 — krótko dla OWNER-a

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V35421.md`. Decyzje: `docs/ADR-V35421-ROOF-SYSTEM-AND-ORIGINALS.md`. Co
obiecano przed biegami i co zmieniałem po drodze: `research/source-to-model/v35421/PROTOCOL.md`. APK: **1354**.

**Najkrócej.** Dach domu jest teraz jednym układem: kosze liczone z przecięcia połaci, niższy dach dochodzi do ściany
bez kosza, osobne dachy zostają osobne — dla bryły budowanej z odczytu API (LOCAL buduje dachy jak dotąd; przeniesienie
go na ten sam solver to następny krok). Odczyt struktury bierze
oryginalne elewacje, rzut, przekrój i perspektywy wydawcy i nie czeka już na szkice. Na pięciu nowych domach kod był
bliżej oryginałów w dwóch, gorzej w jednym, dwa remisy (oba ramiona złe). Po próbie poprawiłem cztery usterki, które
próba pokazała; trzy domy są od tego momentu DEV. **Jedna poprawka kosztowała wnętrze i okna elewacji**
(Anna II) i tego nie naprawiłem.

## Co działa (przykłady)

- **Debora (nowy dom)**: układ T z dwoma koszami; 3 z 3 oceniających: dach TAK (baseline: dwa osobne dachy bez
  kosza). Po poprawce zostaje też brama garażowa — także w świeżym biegu na żywo przez host.
- **Dom pod morwą (nowy)**: dwa kominy jak w źródle (baseline zostawiał dwa zmyślone przy szczycie; usunęła je
  recenzja na żywo, nie nowy odczyt).
- **Amber IV, Mindelo, Amarylis (audyt)**: kosze zamiast przenikających się dachów (2, 4, 4). Mindelo ma szczyt
  poprzeczny bez uskoku rzutu; Amarylis odzyskała szczyt frontowy (opis związany z właściwą bryłą), ale jej drugi
  szczyt poprzeczny nie powstał.
- **Willa Eliza**: nie ma już elementu 72° (maks. 22°). **Ametyst New**: bryła nie jest już obrócona.
- **Skagen**: dojście garażu do ściany zostało dojściem (kosz nie jest wymuszany).
- **Lyon (po próbie)**: dach płaski zamiast otwartego pudła. **Anna II (po próbie)**: bryła ze źródeł z 4 koszami.
- **Host (prawdziwy serwer)**: na ostatecznej rewizji świeży bieg Anny II, powtórka Debory bez żadnego żądania i z tymi
  samymi bajtami, bieg bez tokenu bez żądań — wszystkie kontrole zielone (świeży bieg Debory był w pierwszej sesji, na
  rewizji różniącej się tylko poprawką odmowy księgi). Host znalazł usterkę (odmowa księgi na pułapie
  kończyła zadanie błędem) — poprawiona i sprawdzona.

## Co się nie udało albo pogorszyło

- **Anna II po poprawce straciła wnętrze i okna LOCAL-a**: ściany wewnętrzne 26 → 17, otwory elewacji 39 → 9
  (okna 28 → 7; drzwi wewnętrzne 6 → 8). Dach i bryła bliżej, elewacje i wnętrze uboższe. Szczyt garażu ma kalenicę w złą stronę.
- **Dom pod osiką**: baseline był bliżej (3 z 3). Świeży odczyt postawił elewację boczną po złej stronie i przebudował
  okna prawej ściany; portyków (dwa szczyty poprzeczne) nie ma w żadnym wariancie.
- **Lyon**: płyta na głowicy ściany 5,6 m, attyka z przekroju 6,56 m nieosiągnięta; wiata i pergole bez przekrycia.
- **Aletta**: dach garażu nadal zbyt płaski (20,6°).
- Wnęki, tarasy, balkony, podcienie, daszki, wykusze, lukarny, wiata: 88 zgłoszeń API bez wykonawcy — nazwane,
  **niezbudowane**.
- **APK nie był uruchomiony na urządzeniu** (brak telefonu i emulatora w sesji).

## Liczby

| | baseline (1353) | po |
|---|---|---|
| NEW-H (5 nowych domów, ocena ślepa): bliżej oryginałów | 1 | 2 (remis 2) |
| NEW-H: dach „TAK" u wszystkich oceniających | 0 | 1 (Debora) |
| Kontrpróby audytu z koszami (Amber, Mindelo, Amarylis) | 0 z 3 | 3 z 3 |
| Najstromsza połać Elizy | 72° | 22° |
| Testy czerwone (vitest / web e2e / Android JVM) | 16 zmierzonych (lista dziedziczona 18) / 1 / 5 | 5 / 0 / 0 (vitest: 3 środowiskowe, 2 przekroczenia czasu tylko w pełnej macierzy) |

Koszt etapu: **8,403456 USD** (limit etapu 25 USD); księga 64,693909 USD. Z ok. 40 USD, które podałeś, zostaje
ok. 35,7 USD (licząc od stanu księgi w chwili Twojej informacji).

## Pliki

- `BuildPlan-Model-Preview-1354-arm64-v8a.apk` — osobno (127 scen, 31 nowych na początku listy; bajty scen w APK
  sprawdzone z eksportem; **na urządzeniu niesprawdzony**).
- Archiwa `BuildPlan-V35421-*.zip` (prywatne, każde < 30 000 000 B): `01-RAPORT-GALERIA` (galeria offline, raport,
  dokumenty, oceny i klucze), `02-PLANSZE`, `03-HOST`, `04-OCENA-SLEPA`, dalej `DOMY` (oryginały, dokładnie wysłane
  pakiety obrazów, surowe i kanoniczne odpowiedzi, szkice PNG/SVG/JSON, modele wszystkich wariantów, rendery, ślad
  pominięć). Rozpakuj wszystkie do jednego katalogu i otwórz `BuildPlan-V35421/gallery.html`. Lista z sumami:
  `stage-reports/artifacts/v35421/DELIVERY.txt`.

## Co dalej (moja rekomendacja)

1. Bryła ze źródeł ma przenosić wnętrze i okna (ściany, drzwi i okna LOCAL-a w ramie nowej bryły) — Anna II.
2. Wnęki, tarasy i podcienie jako cecha obrysu z wykonawcą (88 zgłoszeń bez wykonawcy, z tego 76 to wnęki, tarasy,
   balkony i podcienie).
3. Bok elewacji z odczytu sprawdzany oknami, które rzut rysuje na każdej ścianie (Osika).
4. Szczyty poprzeczne nad bryłą LOCAL (portyki Osiki).
