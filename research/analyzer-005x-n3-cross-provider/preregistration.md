# 005X-N3 — preregistration nowego projektu (zapisane przed uruchomieniem analizatora i przed obejrzeniem obrazów)

Data: 2026-10-20. Kod testowany w FAZIE 0: **niezmieniony 005X-N2** `586fa40859e6811cf44db4e76797324f84122fe2`
(uruchamiany z osobnego worktree poza repo). Gałąź robocza N3 wychodzi z kandydata
`629a11d5f875ac0602ee1fd402a022f646dc774f` (`analyzer/005x-n3-tinted-callout-bar-gate-candidate-v1`).

## Źródło

| pole | wartość |
|---|---|
| wydawca | TeA Projekt (`teaprojekt.pl`) — wydawca **nieużywany dotąd** w żadnym etapie; brak adaptera specjalnego |
| projekt | AR-18 TREND P, wersja podstawowa (bez odbicia lustrzanego) |
| URL | `https://teaprojekt.pl/gotowe-projekty-domow/projekt-domu-ar-18-trend-p/` |
| odczyt strony | 2026-10-20, HTTP 200, 391 975 B, SHA-256 HTML `3ea2e29f0e5b4db1d0012dbd93a202737d0f2803934b11fabd828fc593e64923` |
| robots.txt | ścieżka projektu i `/wp-content/uploads/` nie są wyłączone |
| dostęp | wyłącznie strona publiczna; bez logowania, bez plików płatnych |

## Co strona publicznie udostępnia (inwentarz z HTML, bez oglądania pikseli)

| typ wejścia | plik (nazwa z HTML) | uwagi |
|---|---|---|
| rzut parteru | `2024/12/ar-18-trend-p-rzut-parteru-800.webp` (800×800) | **jedyny rysunek techniczny** |
| wizualizacja zewnętrzna | `2025/02/ar-18-trend-p-front-1200-1.jpg` („widok od frontu”) | |
| wizualizacja zewnętrzna | `2025/02/ar-18-trend-ogrod-2-1200.jpg` („widok od ogrodu 2”) | |
| wizualizacje wnętrz | `2024/12/AR-18-p-w{1,2,3,5,7}c-1200-sharp.webp` | 5 sztuk |
| działka, orientacja, karta katalogowa | `AR-18-trend-p-dzialka-600.webp`, `ar-18-p-zakres-orientacji-{1a,2,3}.png`, `karta-katalogowa-AR-18-trend-P-web-2560.webp` | zawartość karty nieznana przed testem |
| elewacje, przekrój | **brak w HTML** (sekcja „Elewacje” to opis tekstowy wykończenia) | |
| tabela pomieszczeń | 9 pomieszczeń, razem 84,88 m² | tekst |

## Parametry producenta (referencja OCENY, nie wejście modelu)

Obrys 14,60 × 7,45 m; wysokość 6,16 m; dach dwuspadowy 35°; **bez okapów**; jedna kondygnacja (parter), bez garażu,
bez piwnicy; pow. użytkowa 84,88 m²; pow. zabudowy 109,79 m²; pow. dachu 170,00 m².
Uwaga spójności (zapisana z góry): 14,60 × 7,45 = 108,8 m² ≈ 109,79 m² (różnica 1 %); pow. dachu 170 m² **nie** wynika
z obrysu i 35° (2 × 14,60 × 3,725 / cos 35° ≈ 132,8 m²) — agregat traktowany jako niejednoznaczny, nie jako kotwica.

Żadna z tych liczb nie jest podawana analizatorowi ręcznie. Analizator może je przeczytać sam ze strony (tak działa
publiczna trasa URL dla każdego wydawcy); to, co z nich weźmie, zostanie zaraportowane jako jego odczyt.

## Oczekiwana bryła (z jawnych parametrów)

- jedna kondygnacja nadziemna, prostokątny obrys o proporcji 14,60 / 7,45 = **1,96** (±0,10);
- dach dwuspadowy, kalenica **wzdłuż dłuższego boku**, nachylenie 35° (±3°), szczyty na krótszych bokach;
- okap ≈ 0 (wysięg ≤ 0,15 m);
- wysokość kalenicy ≈ 6,16 m nad poziomem odniesienia (±0,4 m; poziom odniesienia nieznany: teren / ±0,00);
- brak garażu, brak piętra, brak lukarn/wykuszy;
- otwory: większość okien od strony ogrodu (tekst strony); wejście z wiatrołapu; położenia — z rzutu.

## Dopuszczalne niepewności

- skala rzutu: jeśli nieodczytana z rzutu, wymiary są założeniem i muszą być tak oznaczone (nie `SOURCE_EXACT`);
- wysokości otworów i parapetów: brak elewacji/przekroju → `DISPLAY_ASSUMPTION` / `MISSING`;
- rzędna okapu / ścianki kolankowej: brak przekroju → założenie albo pytanie;
- które okna są drzwiami tarasowymi — z rzutu tylko, gdy rzut je rozróżnia.

## Kryteria oceny (trasa URL)

| id | kryterium | PASS |
|---|---|---|
| U1 | akwizycja | pakiet źródeł z rzutem; błąd akwizycji raportowany osobno |
| U2 | model | zamknięty model albo nazwana odmowa (odmowa ≠ PASS) |
| U3 | kondygnacje | dokładnie 1, bez garażu |
| U4 | dach | GABLE, kalenica wzdłuż dłuższego boku, 35° ±3°, okap ≤ 0,15 m |
| U5 | obrys | proporcja 1,96 ±0,10; wymiary ±3 % gdy skala odczytana, inaczej oznaczone jako założenie |
| U6 | otwory | wejście i okna na właściwych ścianach wg rzutu; 0 otworów zmyślonych |
| U7 | proweniencja | nic z wizualizacji jako `SOURCE_EXACT` |

## Kryteria oceny (tryb `Photo…`, jedno zdjęcie)

Obraz wybrany regułą przed obejrzeniem: **pierwsza wizualizacja zewnętrzna w kolejności strony** — „widok od frontu”
(`ar-18-trend-p-front-1200-1.jpg`, wariant 1200 px). Drugi obraz („od ogrodu 2”) tylko jako dodatkowy bieg.
PASS: zamknięta bryła z dachem dwuspadowym, 1 kondygnacja, kalenica zgodna z obrazem, okap ≈ 0, główne drzwi/okna widoczne
na froncie odczytane, 0 fałszywych otworów, proweniencja `ASSUMED_FOR_RENDERING`/`VISUAL_INFERRED`; nazwana odmowa jest
dopuszczalnym, ale nie zaliczonym wynikiem. Wymiary bezwzględne ze zdjęcia nie są oceniane (skala założona).

## Zasady

Brak kodu wyjątkowego dla TeA (provider-agnostic). Obrazy wydawcy tylko poza repozytorium
(`/home/user/work005xn3/tea/`). Wynik FAIL jest dopuszczalny; najpierw FIRST_BAD, potem ewentualne poprawki.
