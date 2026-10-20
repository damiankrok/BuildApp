# 005X-N2 — preregistration (zapisane przed obejrzeniem pikseli czterech obrazów kontrolnych w N2)

Data: 2026-10-20. Baza kodu: `28cc5ee0f417dd8e4bb8861648f69e932d072610`.

## Zbiory

| zbiór | obrazy | status |
|---|---|---|
| DEV-N1 | zdjęcie OWNER-a (11697dc9…), wizualizacja A01 (d92ae9f8…) | strojone w N1 |
| DEV-N2 (dawny hold-out N1) | Goździkowce 3 (b751eeb4…), Cieszynianki 12 GE (0213e778…), Marcówki GE (d32a9a41…), Rarytasy 5 G2E (2a0a137d…) | od N2 **zbiór rozwojowy/ewaluacyjny znany wykonawcy**, nie hold-out |
| BLIND-N2 | ≥ 2 nowe, legalnie dostępne zdjęcia domów spoza tych sześciu, zamrożone hashami przed strojeniem | ostatni nieoglądany zestaw; uruchamiany raz, na końcu |

Żadne piksele nie trafiają do repozytorium.

## Wynik pierwszego ślepego przebiegu (kod 28cc5ee, przed jakąkolwiek zmianą N2)

| obraz | wynik | powód |
|---|---|---|
| OWNER | model a478b5ff | — |
| A01 vis | model a32163dc | — |
| Goździkowce | odmowa | `no straight eave line could be fitted` (kolor dachu 82,85,80; ściany 124,139,148) |
| Cieszynianki | odmowa | jw. (dach 144,151,153; ściana 166,168,179) |
| Marcówki | odmowa | jw. (dach 61,58,60; ściana 209,211,213) |
| Rarytasy G2E | odmowa | jw. (dach 5,6,10; ściana 239,225,202) |

Wcześniejsze logi N1 (pierwszy ślepy bieg N1): Goździkowce — okap dopasowany przy kalenicy, 1 fałszywe okno; Cieszynianki — „wall too narrow”; Marcówki — „no foot”; Rarytasy — „no eave”.

## Wskaźniki (ocena każdej iteracji na wszystkich 6 obrazach)

1. **CLOSED_MASS** — zamknięta bryła (0 błędów geometrii, `fits` ok) albo nazwana odmowa. Odsetek obrazów z bryłą.
2. **ROOF_AXIS / ROOF_TYPE** — oś kalenicy względem widoku (równoległa/prostopadła do frontu = szczyt frontowy) i typ (GABLE/HIP) zgodne z obrazem; ocena wzrokowa wykonawcy, zapisana jako `VISUAL_JUDGEMENT`, nie liczba ze źródła.
3. **EAVE** — okap w modelu odpowiada okapowi na obrazie (nie kalenicy, nie pasowi tynku): tak/nie.
4. **MAIN_OPENINGS** — widoczne główne drzwi / brama / okna frontu: liczba odzyskanych / liczba widocznych.
5. **FALSE_OPENINGS** — otwory w modelu bez odpowiednika na obrazie (pergola, rośliny, auto, cień): liczba; cel 0.
6. **QUALITY_LEVEL** — `COARSE_INDICATIVE` vs `DETAILS_SUPPORTED`; żaden obraz nie może dostać „details verified” fałszywie.
7. **GEOMETRY** — błędy / ostrzeżenia z audytu domknięcia.
8. **TIME** — ms na 800×600 w Node.
9. **PROVENANCE** — każda wartość `ASSUMED_FOR_RENDERING` / `VISUAL_INFERRED`; nigdy `SOURCE_EXACT`.

## Cel i reguła adopcji

- Cel aspiracyjny: ≥ 3/4 obrazów DEV-N2 z sensowną orientacyjną bryłą, 0 fałszywych „details supported” na obrazach bez czytelnych detali.
- Zmiana jest adoptowana, gdy poprawia sumę wskaźników na 6 obrazach i **nie psuje** DEV-N1 (zdjęcie OWNER-a i A01: ta sama liczba głównych otworów, 0 nowych fałszywych). Odrzucone iteracje są zapisywane.
- Bez reguł zależnych od nazwy, domeny, pliku, hasha, liczby zdjęć ani współrzędnych pikselowych jednego przykładu.
- Obraz bez domu → odmowa z nazwą (test negatywny); obraz nieczytelny → odmowa, nie „typowy dom”.

## Kontrole (bez zmian)

Replay offline: A01 multi-source 1661d4bf (6/7 okien połaciowych, 7. UNRESOLVED), Goździkowce 911456a8, Marcówki cf797743, Cieszynianki e4e56292, Rarytasy G2E 9f5fd342; Rarytasy OWNER = NOT_RUN.
