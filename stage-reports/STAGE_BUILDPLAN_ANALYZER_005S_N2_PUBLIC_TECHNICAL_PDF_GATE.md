# STAGE BUILDPLAN-ANALYZER-005S-N2-PUBLIC-TECHNICAL-PDF-GATE — publiczne techniczne PDF jako źródło otworów (trasa a)

**Werdykt: `NO_USABLE_PUBLIC_TECHNICAL_PDF`.** Zero zmian produkcyjnych (`packages/`, `apps/`, `android/`, `.github/`
bajt w bajt jak w bazie). Bez CI, bez lustra, bez APK, bez powtórki 23 domów (nie było czego bramkować), bez etapu (b).

- Baza: `3fe0ba22287a462bd02a65b1576d5aba0ef0d340` (`analyzer/005s-technical-openings-n1`); preflight: HEAD = origin =
  baza, drzewo czyste, brak dryfu. Lustro `claude/new-session-3kzcgh` nietknięte (`bfaf286…`).
- Gałąź: `analyzer/005s-technical-pdf-openings-n2`, jeden commit zamykający (ten raport, `PROJECT_STATUS.md`,
  `research/analyzer-005s-technical-pdf/`).
- Zbiór kontrolny: **23 zbudowane wiersze** z `controls-base.json` (nie 27). Nie czekano na 27.

## 1. Preregistracja (przed jakimkolwiek wynikiem PDF)

`research/analyzer-005s-technical-pdf/preregistration.md`, SHA-256 `558a0e6f…f3a8e2`. Wybór deterministyczny
z zapieczętowanych modeli N1v (tylko liczby): udział otworów zewnętrznych bez żadnego `SOURCE_*` na parapecie i wysokości.

| rola | wiersz | edycja | uzasadnienie |
| --- | --- | --- | --- |
| POOR | `dom-w-arkadiach` | `m168264238cc55` | 8/8 bez źródła pionu (remis 1,0 z cieszyniankami i tunbergiami → pierwsze dwa wg id) |
| POOR | `dom-w-cieszyniankach` | `m43d25c0636969` | 15/15 bez źródła pionu; 0 zarejestrowanych elewacji (H1 w N1) |
| KNOWN-GOOD | `rarytasy-g2e` | `m84f2903cb8e14` | 12/13 parapetów `SOURCE_*`; jedyna odmowa emisji N1 (`opening-0-east-5-1`) |
| OWNER (osobno) | — | `m3ea28300f9b3e` | tylko przykład izolacji edycji i formatu; nigdy nie dołączany do `m84f…` |

## 2. Źródła i dostęp (fakty odczytane 2026-10-17 ~11:58 UTC)

Na każdej z czterech stron projektu (3 DEV + OWNER) jedynym podlinkowanym PDF jest **„Karta projektu – wersja
podstawowa (PDF)”** i **„… – lustrzane odbicie (PDF)”**. Link wywołuje `/crm_task_project_card_downloads/new.js?product_id=…`
— formularz, po którego wypełnieniu PDF jest **wysyłany e-mailem** (pola: e-mail, imię, telefon, pytania marketingowe,
zgoda na politykę prywatności). To nie jest dostęp publiczny bez logowania w rozumieniu §1 zlecenia.

Endpoint `/gotowe-projekty-domow-wydruk/pdf/<product_id>?file_name=…` odpowiada `200 application/pdf` bez logowania
(sprawdzone wyłącznie nagłówkiem HEAD dla przykładu OWNER-a), ale **nie jest podlinkowany z żadnej z czterech stron**.
Użycie go z identyfikatorami produktu wziętymi z formularza obchodziłoby bramkę pobierania wydawcy — zgodnie z §1
(„do not bypass … download blocks”) **nie pobrano żadnego bajtu PDF**, ani DEV, ani OWNER.

| edycja | strona (HTTP, SHA-256 HTML poza Git) | trasa PDF | publiczny bez logowania | bajty PDF | status |
| --- | --- | --- | --- | --- | --- |
| `m168264238cc55` | 200, `f56366c4…6e43` | formularz CRM, id 62954 (lustro 63529) | nie | nie pobrano | `NOT_READABLE_FOR_METRIC_USE` |
| `m43d25c0636969` | 200, `9cf4ac54…d099` | formularz CRM, id 57648 (lustro 57650) | nie | nie pobrano | `NOT_READABLE_FOR_METRIC_USE` |
| `m84f2903cb8e14` | 200, `1d176f0e…b139` | formularz CRM, id 74283 (lustro 74284), JS `03b3526f…cbbe` | nie | nie pobrano | `NOT_READABLE_FOR_METRIC_USE` |
| `m3ea28300f9b3e` (OWNER) | 200, `cee3d033…5b23` | karta 71110/71111; endpoint `wydruk` niepodlinkowany | nie (trasa wydawcy) | nie pobrano (tylko HEAD) | `NOT_READABLE_FOR_METRIC_USE` |

Pełny rejestr: `research/analyzer-005s-technical-pdf/ledger.json`. Struktura stron PDF (wektor/raster), czytelność
linii, wydrukowane wymiary, rzędna ±0,00, skala i orientacja: **NOT_EXAMINED** dla wszystkich — nie było prawomocnie
dostępnego dokumentu. Dodatkowo: dla każdej edycji wydawca publikuje kartę **lustrzanego odbicia** — każdy przyszły
odczyt musiałby jawnie wykluczyć niejednoznaczność lustra. Przykład OWNER-a, według opisu indeksu podanego przez
koordynatora, zawiera cztery małe miniatury elewacji — to i tak odmowa obowiązkowa z §2 preregistracji; ponadto
`m3ea…` ≠ `m84f…`, więc nie mógłby zasilić żadnego modelowanego wiersza.

## 3. Implementacja

**Brak.** §3 zlecenia nie został uruchomiony (brak pary kwalifikującej). Nie zmieniono `openings-v2.ts`, `frame.ts`,
`views.ts` ani żadnego czytnika; nie dodano zależności. Nie ma „przed/po” — nie raportuję żadnego zysku 3D.

## 4. Kontrole (tylko kontrakt źródła)

| kontrola | wynik |
| --- | --- |
| `python3 -I research/analyzer-005s-technical-pdf/check-ledger.py` (hash preregistracji, ≤ 3 DEV z 23-wierszowego zbioru, edycja w URL, brak sumy kontrolnej bez bajtów, izolacja OWNER `m3ea…`, brak PDF w Git) | PASS |
| negatyw: kopia rejestru z `attachedToModelledRow: true` | FAIL zgodnie z oczekiwaniem („OWNER example attached to a model”) |
| `git diff 3fe0ba2 -- packages apps android .github` | pusty |
| czas etapu badawczego (sieć: 4 strony HTML, 6 odpowiedzi formularza JS, 1 HEAD) | kilka minut; bez obliczeń modelowych |

**NOT_RUN:** powtórka solvera v2 na 23 wierszach (bez zmiany kodu wynik jest z definicji 23/23 jak w N1 — hashe
w `research/analyzer-005s-openings/controls-base.json`), testy jednostkowe/kontraktowe pakietów, typecheck, `npm test`,
e2e, 41 jobów CI, emulator, APK, replay 37×18, ślepa runda, niezależny audyt statyczny (brak kodu produkcyjnego do audytu),
pobranie i analiza struktury PDF.

## 5. Prawa źródła

Żaden PDF, rysunek ani obraz wydawcy nie został pobrany, otwarty, pokazany ani wysłany do modelu. Lokalnie (poza Git,
w katalogu tymczasowym sesji) leżą wyłącznie 4 strony HTML i odpowiedzi JS formularza, użyte do odczytu linków i tytułów.
Repozytorium dostaje adresy, statusy HTTP, sumy SHA-256 i klasyfikacje — bez treści wydawcy. Nie podano żadnych danych
osobowych w formularzu.

## 6. Jedna decyzja dla koordynatora

Techniczne PDF ARCHON są dostępne tylko przez formularz e-mail (lead CRM). Trasa (a) może ruszyć wyłącznie, jeżeli
OWNER sam pobierze kartę **swoją** drogą (formularz, własny e-mail) dla edycji już modelowanej i odczyta ją lokalnie
— albo koordynator uzna inną, jawnie publiczną trasę. Bez tego nie ma źródła; nic nie startuje automatycznie.

```
STAGE: BUILDPLAN-ANALYZER-005S-N2-PUBLIC-TECHNICAL-PDF-GATE
VERDICT: NO_USABLE_PUBLIC_TECHNICAL_PDF
FINAL_TOKEN: BUILDPLAN_ANALYZER_005S_N2_PUBLIC_TECHNICAL_PDF_GATE_NO_USABLE_PUBLIC_TECHNICAL_PDF
```
