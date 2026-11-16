# v3.54.2 dla OWNER-a: krótko

**Co zrobiono**
- Claude API działa jako **konsultant** analizatora: nie opisuje domu, tylko odczytuje to, czego analizator nie umiał. Odczytuje:
  - wskazane etykiety wymiarów;
  - wymiary całkowite, łącznie ze stopami i calami oraz metrami z przecinkiem.
- Analizator sam mierzy, sprawdza i buduje model.
- Przebieg: 10 domów (6 roboczych + 4 potwierdzające od 4 wydawców), 50 zapytań na żywo, **1,99 USD** (księgi narastająco 6,24 USD z limitu 100 USD).

**Co API zobaczyło dobrze**
- Każdy sprawdzony odczyt był poprawny, np. 690 zamiast 640, 15,98, 46'-0", 1322 / 882.
- Bezbłędnie mówiło „tu nie ma liczby” (meble, armatura) i „na tym rzucie nie ma wymiarów całkowitych”.
- Samo oznaczało niepewność tam, gdzie strzałki nie obejmowały budynku.
- Po budowie trafnie znajdowało wady: brak garażu, taras zbudowany jako zamknięta bryła, zamienione elewacje. Na poprawnym domu (Kukliki) nie zgłosiło fałszywego alarmu.

**Co analizator naprawdę zmienił**
- Ustalił poprawną skalę rzutu w 5 domach, w których jej nie miał.
- W Kuklikach model jest ten sam, ale skala jest teraz potwierdzona dwoma wymiarami.

**Co się nie poprawiło**
- Żaden dom nie ma lepszego kształtu, rozmiaru ani dachu.
- Przy prawdziwej skali analizator najczęściej i tak **nie składa planu**: Supertunie, Aksamitki, Madera (pokrycie 49 %).
- W jednym domu potwierdzającym (sp318422) z odmowy powstał model ze złą głębokością (+67 %). Reguła przyjęcia sprawdzała tylko skalę — do poprawienia.

**Co rekomenduję**
1. Zostawić konsultanta za flagą (domyślnie wyłączony).
2. Dodać do przyjęcia warunek zgodności zasięgu z wymiarami.
3. Następną pracę skierować na **składanie planu przy zweryfikowanej skali** w analizatorze, nie na kolejne narzędzia API.

**Pytanie do OWNER-a.** Gdy prawdziwa skala ujawnia, że analizator nie umie złożyć domu (Madera): pokazywać zły model dopasowany do pola, jak dziś, czy uczciwą odmowę z pytaniem?

**Android:** bez zmian, bez nowego APK (NOT_VERIFIED).

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V3542.md`.
