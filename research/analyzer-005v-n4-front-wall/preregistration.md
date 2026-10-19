# 005V-N4 — preregistracja (zapisana przed zmianą kodu)

Baza `83c41421f6217d6a94ea07689d8f68b4548ec6cc`. Model A01 bazy
`d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2`.

## Metoda (ogólna, bez stałych dla domu)

1. **Kiedy:** tylko gdy obecna rejestracja (`registerElevationV2` na zasięgu sylwetki) odmawia. Rejestracje, które dziś
   przechodzą, nie zmieniają się.
2. **Pas ściany** (oś X, niezależna od nieba, pergoli i nawisu dachu):
   - w wierszach od dolnej krawędzi dachu do połowy wysokości sylwetki szukam najdłuższego ciągu pikseli neutralnych
     (rozpiętość kanałów < 40, dowolna luma), który przecina środek rozpiętości dachu;
   - pas to wspólny przedział tych ciągów;
   - musi się powtarzać: co najmniej 1/4 wierszy pasa w ±3 px tych samych końców, a szerokość ≥ 40 % sylwetki.
     Inaczej odmowa.
3. **Skala:** jedna, X = Y, z rozpiętości ścian w planie: dla FRONT i REAR obwiednia ścian w osi x (`walled`), dla
   boków w osi z. Nawis szczytowy nie wchodzi, bo pas ściany go nie zawiera.
4. **Pion (niezależny od X):**
   - kotwica: wierzchołek sylwetki = rzędna kalenicy (jak dotąd);
   - sprawdzian: dół sylwetki względem rzędnej terenu, z istniejącą tolerancją 0,9 m, niezmienioną;
   - błąd zapisany w rejestracji.
5. **Kontrola niezależna (nie kotwica):** środki czterech otworów frontu na elewacji muszą wypaść w tej samej kolejności
   co na rzucie, każdy z rezydualem u/L ≤ 0,02. Wysokości odczytane z elewacji muszą mieścić się w kondygnacji.

## Tolerancje (przed strojeniem)

| wielkość | próg |
| --- | --- |
| zgodność końców pasa | ±3 px |
| pokrycie wierszy pasa | ≥ 25 % |
| szerokość pasa | ≥ 40 % sylwetki |
| błąd pionu (dół sylwetki − teren) | ≤ 0,9 m (jak w kodzie) |
| rezydual u/L otworów | ≤ 0,02 |
| odbicie lub zmiana kolejności | odmowa |

## Odmowy (negatywy do testów)

- pergola obok bez pasa ściany;
- tylko dach (szczyt bez ściany pod okapem);
- pas ścian krótszy niż 40 %;
- brak rzędnej kalenicy;
- błąd pionu > 0,9 m;
- sylwetka bez wyraźnych końców (gradient).

## Szklenie

Łatka N3 (`glazingDrawn`) wejdzie tylko po rejestracji i tylko w zakresie wykrywania (jasne linie + błąd „mixed min”),
pod warunkiem że:
- 100/220 zachowa wysokość ~2,2 i niski próg;
- 90/210 nie stanie się drzwiami od cudzego łuku;
- 105/210 zostanie wejściem;
- 250/220 nie dostanie parapetu 0,9 z założenia;
- kontrole pozostaną bez regresji.

Inaczej łatka zostaje na następny etap.

## Poprawka po pierwszym pomiarze (post hoc, jawna)

**Wynik reguły jak wyżej**, na prywatnej elewacji FRONT A01 (zasięg sylwetki 210–1071 × 122–616):
- jedyny stabilny pas to dach, x 365–1071 (169 z 346 wierszy);
- pas ściany x 411–1027 zajmuje tylko 49 wierszy (14 %), bo na elewacji okapowej ściana między okapem a nadprożami
  jest niska;
- reguła 25 % wybrałaby dach, a na dachu rejestracja i tak odmawia (błąd pionu 1,51 m);
- elewacja ogrodowa: pas ściany x 286–903 (57 wierszy). Ma też 617 px, czyli tyle samo co front.

**Poprawka:**
- kandydatami są wszystkie powtarzalne pasy neutralne (≥ 10 % wierszy, szerokość ≥ 40 % sylwetki);
- każdy rejestruję na szerokości ścian z planu;
- zostają tylko te, które przechodzą niezmienioną kontrolę pionu (≤ 0,9 m); wybór: najmniejszy błąd.

Kontrola pionu staje się tu **selektorem**, więc nie jest już niezależnym sprawdzianem. Niezależnym sprawdzianem pozostają
rezyduale u/L czterech otworów (≤ 0,02, w kolejności), które nie są kotwicą. Pozostałe progi bez zmian.
