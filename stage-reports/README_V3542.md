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

**Po potwierdzeniu (rozwój, oznaczony osobno; te 4 domy nie są już próbą potwierdzającą)**
- **Kontrola zasięgu** w przyjęciu: model, którego zasięg nie zgadza się z odczytanym wymiarem całkowitym, jest cofany. Fałszywe przyjęcie sp318422 znika; domy DEV bez zmian.
- **Poprawka składania planu** (pierwszy wymiar łańcucha musi zgadzać się ze skalą z konsultacji):
  - Aksamitki po raz pierwszy składają się w model 12,32 × 8,82 m (NEAR, szerokość −6,8 %, IoU 0,881, kalenica ✓) — powtarzalnie, bez nowych wywołań API;
  - sp318422 ma głębokość +15 % zamiast +67 % i nadal jest cofany.
- **Tolerancję kontroli zasięgu (10 %) wybrałem po obejrzeniu Aksamitek.** To jest strojenie, nie dowód.
- Dwie kolejne poprawki (sp318422 dokładnie, Supertunie IoU 0,897) są przygotowane, ale niewdrożone: potrzebują nowych, niewidzianych domów do sprawdzenia.

**Android: nowe wyglądy domu 3D** (drugi agent, równolegle; tylko wygląd, geometria bez zmian):
- Przytulny, Wieczór, W słońcu, Techniczny, Prześwietlenie (przezroczysta bryła) i Światłokopia;
- panel Wygląd pogrupowany;
- propozycje dalszych zmian w `apps/android/LOOKS_PROPOSAL.md`.

Testy wyglądów zielone; 4 starsze błędy testów scen nie mają z nimi związku. Na urządzeniu **NOT_VERIFIED**; nowego APK nie ma (brak miejsca na dysku sesji).

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V3542.md`.
