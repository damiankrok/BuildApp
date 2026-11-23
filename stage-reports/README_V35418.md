# v3.54.18 — krótko dla OWNER-a

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V35418.md`. Decyzja architektoniczna:
`docs/ADR-V35418-FACADE-AND-BODY-ARBITRATION.md`. Jak próbę zaplanowano i co z góry obiecano:
`research/source-to-model/v35418/PROTOCOL.md`.

## Co było nie tak

Kolorowe szkice elewacji z Claude API były dobre, a modele 3D ich nie przypominały. Powód nie leżał w API, tylko
w tym, jak aplikacja z niego korzystała: model z analizatora lokalnego był traktowany jak prawda, a odczyt API mógł go
poprawiać tylko po kawałku — i to przez sprawdzian, który sam opierał się na tym błędnym modelu. Znalazłem 11 konkretnych
miejsc, w których dobra informacja ginęła (lista z dowodami w raporcie, §2). Najgorsze trzy:

1. ściana, którą analizator wypełnił zmyślonymi oknami, nie dawała się poprawić w ogóle (Alaska: 21 z 21 poprawek
   okien utknęło);
2. dom, którego analizator nie umiał zbudować, dostawał szarą bryłę bez okien, mimo że szkice były gotowe;
3. okna były w modelu, ale żaden widok ich nie pokazywał, bo ściana kończyła się 30 cm za nisko (Alberto: 14 okien —
   tak samo przed zmianą; wyszło dopiero na obrazkach).

## Co zmieniłem

Model lokalny i odczyt API to teraz dwie hipotezy, a rozstrzyga rysunek wydawcy — na trzech poziomach: pojedyncze okno,
cała elewacja, cała bryła. Czego rysunek nie rozstrzyga, zostaje nazwane, a nie zgadnięte. Doszły okna połaciowe,
strefy wykończenia w kolorze, paleta dla domów budowanych bez analizatora lokalnego i zapis „co się stało z każdym
odczytanym faktem". Progów pomiaru nie poluzowałem w żadnym miejscu.

## Co wyszło — uczciwie

- **Obiecanego progu nie osiągnąłem.** Zapisałem z góry, że liczba „miniatur użytecznych" ma wzrosnąć o 2 na sześciu
  domach rozwojowych i o 1 na trzech nowych, których nie oglądałem do końca. Wyszło: 2 → 2 według mnie, 1 → 2 według
  niezależnego oceniającego; na trzech ślepych 0 → 0.
- **Modele są jednak wyraźnie bliżej oryginałów.** Niezależny oceniający (nie wiedział, który wariant jest „po"):
  w 7 z 9 domów lepszy jest nowy, w 2 bez różnicy, w żadnym gorszy. Poprawnych dużych okien i drzwi: na znanych domach
  4 z 14 → 12 z 14, na nowych rozwojowych 8 z 17 → 11 z 17, na ślepych 4 z 14 → 8 z 14.
- **Ballina** ma komplet okien i drzwi z czterech stron oraz okap. **Alaska** ma cztery osobne okna, okna połaciowe
  i przeszklenie tarasowe zamiast pasów szkła. **Dom pod sakurą**, który wcześniej kończył się brakiem modelu, ma model.
- **Zostały porażki i są w dostawie:** Medulin i Mindelo (zła bryła), G6 (bez żadnej poprawy), Alberto (okna widać, ale
  front jest prawie cały przeszklony), brak drzwi wejściowych na Alasce i Aurorze, dachy czterospadowe wychodzą jako
  dwuspadowe. Dwa domy po zmianie bryły straciły pomieszczenia w środku (Alaska, Ballina).
- Ten sam link potrafi dać inny wynik przy kolejnym świeżym odczycie (Sakura: raz model, raz porażka zadania).

## Co dostajesz

- Aplikacja: nowy APK (numer i sumy w `VERSION.txt` obok pliku) z 10 nowymi scenami — sześć domów rozwojowych, trzy
  ślepe (także nieudane) i Ballina oddana przez host.
- Galeria offline (`gallery.html` po rozpakowaniu paczek do jednego katalogu): dla każdego domu plansza
  źródło | szkic | przed | po, cztery strony z oryginałem, szkicem PNG/SVG, JSON-em i werdyktem wykorzystania,
  perspektywy i rzut bez dachu. Wszystko to prawdziwe rendery z tych samych kamer.
- Koszt etapu i stan księgi: raport §11. Nowej puli nie otwierałem, pułap bez zmian.

## Co dalej (moja rekomendacja, w kolejności)

1. Drzwi wejściowe: drugi, niezależny świadek z rzutu (symbol drzwi w szczelinie ściany) zamiast samego kontrastu na
   elewacji.
2. Bryła ze źródeł o dwóch–trzech skrzydłach z własnymi dachami (Medulin, Mindelo) i dach czterospadowy (Sakura, G6).
3. Przeniesienie pomieszczeń przy zamianie bryły, żeby poprawa zewnętrza nie kosztowała wnętrza.
4. Obrót modelu do stron źródła, gdy elewacje są podpisane o ćwierć obrotu.
