# ADR v3.54.14 — metryka API ze świadkami, szkice z kontrolą proporcji, wybór per właściwość, zaakceptowane rewizje konsultanta

Status: przyjęte (v3.54.14 R2). Kontekst: Master Plan v3.54.14, prompt R2 §§ 6–11.

## Decyzje

1. **Odczyt wymiarów przez API jest niezależny od LOCAL.** Najpierw API czyta każdy rzut i przekrój bez niczego od
   analizatora (`DimensionObservation` 1.0.0, stabilne id z ramy, literału i pozycji). Dopiero potem sprawdza etykiety
   LOCAL na ponumerowanych wycinkach. Odczyt, który widział odpowiedź LOCAL, nie jest niezależny.
2. **Resolver jest deterministyczny i poprawia tylko ze świadkiem** (`METRIC_RESOLVER_VERSION`): `CHAIN` (łańcuch
   zamyka się na wymiarze całkowitym tylko z wartością API), `SCALE` (skala ustalona przez inne etykiety, etykieta nie
   jest jedyną kotwicą), od 1.1.0 `FOOTPRINT` (iloczyn dwóch wydrukowanych wymiarów całkowitych = pole zabudowy ze
   strony, jedna skala obrazu, LOCAL nie pasuje). Bez świadka `UNRESOLVED` i zostaje LOCAL. Ten sam czytnik dwa razy
   (odczyt + kontrola) nie jest świadkiem. Wynik idzie do warstwy metrycznej analizatora jako `ConsultedReading` /
   `ConsultedSpan` — model buduje analizator, nie API.
3. **Szkic jest danymi, nie obrazem z API.** API zwraca typowane kontury w pikselach oryginału; lokalny renderer
   rysuje je w stałej palecie. Kontrola proporcji używa własnej skali szkicu (końce ścian vs rzut) i rzędnych
   uzgodnionych przez dwa czytniki; anizotropię wykrywa okap i linia terenu. Odrzucony szkic nie jest naciągany.
   Przyjęty szkic czyta czytnik kształtu (forma) i konsument wyglądu (wykończenie).
4. **Wybór per właściwość** (`choose.ts`): geometria z kandydata formy, gdy przeszedł `judgeForm`; ton ściany zmienia
   się tylko po stronie, której szkic przeszedł kontrolę; regiony wykończeń z przyjętych stron. Nigdy „API jest lepsze”.
5. **Zaakceptowana rewizja konsultanta** (`accepted-consult.ts`): odpowiedzi dostawcy zapisane pod hashem żądania i
   wiązaniem (pakiet źródła, wersje analizatora i konsultanta, modele, ustawienia). Ten sam URL pod tym samym
   wiązaniem odtwarza je bez żądania i bez rezerwacji; brakująca odpowiedź nie jest wysyłana. `reanalyse` czyta od nowa.
6. **Zamrożenie przed nowym domem; pierwszy wynik zostaje.** Zmiana po zamrożeniu jest dopuszczalna tylko jawnie,
   z nazwaną przyczyną z pierwszego wyniku i regresją na domu DEV.

## Konsekwencje

- Odczyt API może poprawić model tylko tam, gdzie istnieje niezależny świadek; na rysunkach małej rozdzielczości
  (Ballina 800 × 714 px) świadkiem bywa jedynie tekst strony.
- Szkice nie pomogą, dopóki rzędne ma tylko jeden czytnik (Ballina): następnym świadkiem może być kąt dachu ze strony.
- Kandydat formy nadal zmienia tony globalnie — wybór per stronę naprawia skutek, nie przyczynę.
