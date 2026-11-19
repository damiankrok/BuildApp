# PLANER KOSZTÓW BUDOWY / BuildPlan — MASTER PLAN v3.54.16

Data: 19.11.2026. **Aktywny etap v3.54.16: domknięcie wykonalnej pętli API → operacja na elemencie → model → niezależny pomiar źródłowy → ponowna recenzja. Decyzja OWNER-a po audycie Council kodu 5d4321c / HEAD 24aee28. Wykorzystać istniejący model, komendy i szersze konsumenci z house/review, zachować kolorowe szkice, usunąć bramki mylące źródło z obecną bazą. Zlecenie implementacyjne, nie wykonana już poprawka.**

Pełny v3.47 pozostaje osobnym archiwum. Bieżącą kolejność prac określa § 2. Dawne NEXT/CURRENT i opisy konkretnej dostawy zachowują kontekst historyczny.

## 1. Cel i hierarchia informacji

BuildPlan to aplikacja Android do prowadzenia budowy i rzeczywistych kosztów. Rozpoznawalny, edytowalny dom jest przestrzennym indeksem pomieszczeń, elementów, etapów, kosztów, dokumentów i zdjęć. Sukces nie kończy się na wygenerowaniu siatki.

OWNER ustala produkt i priorytety. Koordynator audytuje, uzgadnia wiedzę i przygotowuje zlecenia; wykonawca samodzielnie wybiera i wdraża rozwiązanie w ich zakresie. Reguła pracy: READ → RECONCILE → UPDATE → VALIDATE → PLAN → PROMPT.

Dokumenty mają odrębne role:
- ten Master Plan: obowiązujące wymagania, zakres i decyzje;
- repozytoryjny PROJECT_STATUS.md: bieżący stan kodu, dostaw i weryfikacji;
- BuildPlan_Aktualny_Stan_v3.53.2.md: zapis checkpointu do APK 1329;
- BuildPlan_Plan_Audytu_v3.51.0.md: zakres i wynik zakończonego audytu;
- raporty: pomiary i dowody na przypiętych rewizjach;
- historia/archiwum: poprzednie decyzje, pomysły i wyniki, bez automatycznego obowiązywania.

Nowsze jawne polecenie OWNER-a rozstrzyga sprzeczność starszego zlecenia. Brak rozstrzygnięcia należy nazwać. Nie dopisywać kolejnej kopii całego planu do aktualnego dokumentu.

## 2. Aktualny priorytet

**Decyzja OWNER-a po Council.** Zamiast kolejnej serii dopasowań do oglądanych domów wykonać spójny mechanizm korekty. Sukcesem jest zamknięty cykl: AI rozpoznało konkretny defekt → źródłowo uzasadniona, wspierana operacja → zmiana właściwego elementu i zależności → niezależne sprawdzenie w scenie → recenzja nowej rewizji. Sama lista braków, więcej pól JSON lub techniczny E2E nie wystarczają.

**Checkpoint v35415 i zakres audytu.** Kod końcowy 5d4321cd7a5e749e8122f2de4767ab953c1e2ee7, raport HEAD 24aee28cd3a259d2a267cb08c5b36c29f2dd6647, APK 1346. Koordynator zweryfikował 641 wpisów manifestu prywatnej dostawy fc330ecd127ef2fef7aad3c06e62772c71626dcacf056ca65a03d35eef2635c5 oraz przeprowadził trzy recenzje i mikrotesty rzeczywistych funkcji. Nie wdrażał produkcji ani nie wykonywał płatnych wywołań. Raporty Council i kod przypięty do rewizji są w paczce START. Nie znaleziono w zbadanych funkcjach warunków po nazwie domu; wykazano wąską gramatykę danych, uprzywilejowanie istniejącej bazy i brak integracji operacji. Nie jest to dowód uniwersalnego działania.

**Przyczyna zapętlenia.** Finalny host Balliny ma ISSUE_FOUND, brakujące okno LEFT i NO_CONSUMER, kończy NO_CHANGE, a ACCEPTED_NOW zapisuje wynik do reuse. Aktywny konsultant wykonuje w tej części zasadniczo ROOF_FEATURE/lukarny, choć recenzent proponuje więcej rodzajów zmian. W repo istnieją już cutOpening/placeWindow/moveFeature/resizeFeature/setProperty/removeFeature i starszy house/review z korektami otworów, dachów, przypisania stron, cech i materiałów. Cel to wspólny adapter i wykonawca na istniejącym modelu/obserwacjach, nie trzeci konkurencyjny dokument ani ponowne generowanie całego słabszego H.

**Źródło rozstrzyga kandydatów.** Obecny LOCAL jest hipotezą; chronić fakty potwierdzone źródłem, nie każdy jego parametr. Wygląd-only nadal chroni geometrię, lecz korekta geometrii może prawidłowo usunąć fałszywy lub przesunąć błędny otwór. Nie odrzucać poprawki tylko za różnicę >0,30 m lub zmianę obrysu >0,05 m wobec niezweryfikowanej bazy. Nie usuwać ochrony bez zastąpienia jej pomiarem źródła, hosta i zależności. W mikrotestach końcowa bramka odrzuca korektę X40cm, a akceptuje szerokość 8m wobec2m i pion +3m; odtworzyć i naprawić cały sens kontroli, nie tylko liczby progów.

**Wykonalny zakres.** Rejestr operacji wspólny dla promptu, walidatora, wykonawcy i recenzji: przypisanie/rejestracja widoku; wymiar/poziom/parametr dachu powiązany z hostem; ADD/UPDATE/REMOVE otworu (w tym kontur skośny); wspierany niezależny element (minimum komin); materiał/region na powierzchni. Każda deklarowana operacja ma rzeczywisty konsument i pomiar; nie pytamy o naprawę jak o dostępną, jeśli istnieje tylko nazwa. Realne ograniczenia kernela pozostają jawne, ale NO_CONSUMER dla operacji objętej tym etapem nie zamyka implementacji jako kompletnej.

**Transakcje i zależności.** Bezstratny odczyt/zapis istniejącego LOCAL, zachowanie ID, wnętrz i relacji niezwiązanych ze zmianą. Każdy patch wiąże source observation, revision, target/host, parametry z jednostkami i dowód. Walidacja, wykonanie, przeliczenie zależności, pomiar i commit/rollback dotyczą komponentu; poprawny komin nie znika przez błędną propozycję okna. Potrzebna jest mała rzeczywista mapa zależności wspieranych zmian, nie pozorny trace z globalnego diffu. Zmiana skali/dachu/ściany wymaga ponownego rozliczenia zależnych otworów, rejestracji i wnętrza.

**Dane i szkice przed gotowym modelem.** Odczyt oryginalnych rzutów, przekrojów i czterech elewacji oraz kanoniczne obserwacje mają działać także przy częściowym/brakującym modelu i niezarejestrowanej stronie. Brak kalibracji pozostaje jawnym stanem, nie znika źródło. Nie wymuszać pełnej rekonstrukcji bez dostatecznych danych. Minimalistyczny PNG/SVG to widok tych samych semantycznych obserwacji; znany komin/otwór nie musi zostać ponownie zgadnięty z pikseli. Zachować i porównać użyteczność rasteru, bez gubienia JSON-a jako informacji maszyny. Kalenice/okapy i role są powiązane z bryłą/dachem/poziomem, nie globalnym workiem wszystkich wysokości.

**Jakość i zatrzymanie.** Osobno REVIEW_COMPLETED, SOURCE_VERIFIED_IN_SCOPE, RECOGNIZABLE_PARTIAL, NEEDS_EVIDENCE, UNSUPPORTED_OPERATION, NO_IMPROVEMENT, BUDGET_OR_ROUND_LIMIT i CAN_REUSE. Finalny recenzent obejmuje formę, istotne otwory, kolory/głębię oraz deklarowany zakres wnętrz z odpowiednich źródeł. AI MATCHES nie unieważnia sprzecznego wymiaru. Reuse zachowuje status i otwarte defekty; nie zamienia ich w sukces jakości. Wszystkie obserwowane defekty są rozliczone nawet bez propozycji operacji.

**Dowody odbioru i ogólność.** Po bezstratnym round-tripie wykazać: dodanie brakującego źródłowego okna; poprawienie kontrolowanego złego położenia/rozmiaru/typu otworu; przyjęcie poprawnego komina i odrzucenie niezależnej błędnej zmiany okna. Operacje ogólne, na kontrolowanych danych i różnych realnych pakietach, bez warunków po nazwie i bez ręcznej wartości referencji w produkcji. Udowodnić ekstrakcję obserwacji przy braku modelu. Następnie zamrozić kod/prompty/miarę i wykonać małą z góry wybraną próbę nowych publicznych źródeł w pozostałej puli. Pierwsze wyniki zachować. Nie nazywać trzech mikrotestów uniwersalnością ani kończyć na poprawieniu jednego domu.

**Rozliczenie danych.** Naprawić błąd ADMITTED→REFUSED w fact-trace i przypisywanie dowolnego globalnego diffu do każdego wymiaru. Warianty L0/L-M/L-MS na jednym finalnym commicie i tych samych faktach; stały mianownik, pokrycie osobno, brak MANUAL opisany jako nieocenione. Brak obsługi ROOM/AREA/ft-in nie jest automatycznie brakiem źródła; jawnie odróżnić brak faktu, niejednoznaczność i brak możliwości wiązania. Powierzchnie same nie wyznaczają kształtu, miniatura nie staje się obmiarem.

**Budżet i dostawa.** Raportowane 26,811717 USD na końcu v35415, dotychczasowy wspólny pułap 28,854612 USD: pozostaje 2,042895 USD minus późniejsze rezerwacje/koszty, bez nowych 5 USD. Najpierw implementacja i replay, potem celowane live/finalny host i niewielka zamrożona kontrola. Zachować cache/reuse i koszt modelu/TTL. Rzeczywisty APK osobno i w końcowym ZIP-ie; cztery osobne szkice ocenianych domów z JSON/SVG i źródłami, także odrzucone; galeria i plansze przed/po. Host i jakość mają oddzielne warunki odbioru. Pełny raport, ADR, status i hand-off. claude/new-session-3kzcgh, [skip ci], bez merge/PR; ForgeShape read-only; prywatny H2 poza zakresem; katalog produktu §3 bez zmian.

### Checkpointy v3.54.1–v3.54.2 — kontekst historyczny

v3.54.1 naprawiło globalny czytnik AI i pokazało lepsze pokrycie przy istotnych wadach skali/geometrycznych; H1 nie aktywował scalania na FINAL. Ten generator nie jest kierunkiem aktualnej kampanii. v3.54.2 rozwinęło odczyt etykiet i wymiarów oraz diagnostykę modelu. Jego późniejszy dodatek dał częściowy model Aksamitek, bez dowodu przeniesienia. Nie łączyć tych wyników w jedną statystykę skuteczności konsultacyjnych korekt.

Weryfikacja scorera v3542 rozdzieliła zgodność głównej kalenicy od artefaktów reprezentacji i skorygowała porównania IoU do wspólnej ramy. Wcześniejsze średnie z różnych mianowników albo dopasowania przez obrót nie są aktualną miarą całej jakości. Raportować wersję scorera, grupę, N i zakres cech. Historyczne pierwsze wyniki pozostają zachowane.

Źródła checkpointu: [pełny raport i dodatek v3542](https://github.com/damiankrok/BuildApp/blob/258a3a9/stage-reports/SOURCE_TO_MODEL_V3542.md), [brakujące możliwości](https://github.com/damiankrok/BuildApp/blob/258a3a9/stage-reports/artifacts/v3542/CAPABILITY_GAPS.md), [składanie planu](https://github.com/damiankrok/BuildApp/blob/258a3a9/stage-reports/artifacts/v3542/PLAN_COMPOSITION.md). Nowy etap jest zleceniem; koordynator nie twierdzi, że wykonał już jego implementację lub testy.

### Poprzednie zlecenie v3.54 — kontekst zakończonego checkpointu

**Decyzja OWNER-a z 15.11.2026 — kampania v3.54.** Priorytetem jest audyt i porównanie całego przepływu od źródeł do sceny na różnych wydawcach, zakończone wdrożeniem strategii popartej wynikiem. Dotychczasowy prompt v3.53.15 zostaje zastąpiony zleceniem v3.54. Supertunie i Nad Rzeczką są przypadkami diagnostycznymi w tej kampanii. Bieżący kierunek obejmuje warstwę rozpoznania znaczenia elementów, niezależną metrykę, wspólną interpretację widoków i kontrolę finalnej sceny. Wolno przebudować moduł, którego ograniczenie potwierdzi próba z prawidłowym wejściem.

**Pomiar etapów.** Dla zebrania materiałów, klasyfikacji, rejestracji, obserwacji, metryki, obrysu i pomieszczeń, złożenia domu, kompilacji, kontroli źródłowej i aplikacji ustalić wejście, wyjście, referencję oraz miejsce utraty dowodu. Każdy moduł otrzymuje ocenę zachować, rozszerzyć, wymienić albo brak dowodu. Rozróżnić błąd rozpoznania, reprezentacji, wyboru, przekazania i wykonania. Interwencje diagnostyczne z poprawnymi danymi na granicach modułów mają pokazać, co ogranicza poprawę końcową.

**Strategie do porównania.** Obecna produkcja, oryginały z globalnym strukturalnym opisem AI, ten sam wariant z kadrami i warstwami semantycznymi oraz oryginały ze szkicami, jeżeli dostępne narzędzie i budżet pozwolą je wykonać. Wykorzystać istniejący prototyp czytnika domu. API ma mieć sprawdzony punkt zastosowania w scenie i możliwość wniesienia dowodu, którego lokalny czytnik nie rozpoznał. Jakość podlega niezależnej kontroli, z błędnymi wskazówkami jako kontrpróbą.

**Uogólnienie.** Bieżąca próba ma obejmować kilku wydawców i odmienne konwencje dokumentacji. Roboczy projekt porównania to 24 domy, co najmniej czterech wydawców, podział całymi rodzinami na rozwój i próbę odłożoną, w tym jeden wydawca odłożony w całości. Wykonawca może dostosować liczebność do dostępności źródeł i budżetu, ujawniając zakres wniosków. Wybór ARCHON jako historycznego priorytetu w §3.8 nie wyznacza zakresu tej kampanii. Ocena obejmuje odmowy, obrys, pokoje, otwory, dachy, skalę i fałszywe dodatki per wydawca.

**Odbiór kampanii.** Potrzebne są zmierzone wyniki strategii, uzasadnienie wyboru, wdrożona ścieżka i obrazy finalnych scen wobec źródeł. Nowa reguła i zielone testy są częścią dowodu. Weryfikacja automatycznej sceny na odłożonych projektach rozstrzyga uogólnienie. Rzeczywiste braki danych pozostają jawne i mogą prowadzić do konkretnego pytania użytkownika. Zasady autoryzacji i księgi API określa §7. Dostępne prace lokalne i diagnostyczne postępują także przy braku sekretu.

### Stan potwierdzony przed kampanią v3.54

Poniższe wyniki i kolejność v3.53 opisują bazę oraz wcześniejszy backlog. To historyczny backlog; aktualną kolejność prac określa §2.

**Baza produkcyjna.** APK 1339 arm64 z `459cc2d`, kod `5240d7e`. Solver 2.43.0, topologia wymiarów 1.6.0, solver metryczny 1.8.0, resolver planu 1.6.0, usługa 1.11.0. Etap v3.53.14 (`226c9ac`) zamknięto jako diagnozę. Kryterium wydania wymaga zaobserwowanej poprawy normalnej ścieżki aż do sceny, więc obowiązuje 1339. Bilans 67/80 modeli, 13 odmów i 99/169 pomieszczeń pochodzi z v3.53.13. Macierzy, sprawdzania typów, pełnej regresji ani świeżej próby nie powtarzano w v3.53.14. [Raport v3.53.14](https://github.com/damiankrok/BuildApp/blob/226c9ac/stage-reports/SOURCE_TO_MODEL_V35314.md)

**Zastosowanie zmian w LOCAL.** Torenie 3 i Wrotycze E przechodzą z OCR uruchomionym z bundla 1339 na hoście w konfiguracji Node 18.20.4 bez ICU. Dowody metryczne i modele mają te same skróty co przebiegi produkcyjne. Dowód dotyczy tych dwóch domów i bundla. Android UI pozostaje NOT_VERIFIED. Odtworzono osiem brakujących rekordów dowodów metrycznych, w tym dwa rekordy bazy zgodne bajtowo z zachowanymi oryginałami. Wszystkie osiem domów zachowuje wynik produkcji.

**Supertunie 2 E.** Drugi czytnik stabilnie odczytuje `690` i podaje go jako konkurenta `640` na pełnej rozpiętości 305 px. Poprzedni opis zbyt wcześnie przypisał blokadę odczytowi OCR. `690` pozostaje alternatywą wiązania, więc nie występuje jako własny świadek skali. Druga kopia tego samego druku ma już potwierdzoną skalę i także nie tworzy obwiedni. Diagnostyka D2 na pierwszej kopii z metryką potwierdzoną w obu osiach kończy się `PLAN_NO_WALLED_ENVELOPE`. Dom zamyka przeszklenie `530/405` między krótkimi narożnymi filarami, a boczny pas tuszu łączy ścianę z żaluzją tarasu i roślinnością. W D2b ręczna obwiednia daje `PLAN_LAYOUT_REJECTED` i 66,4 z 93,56 m². Siatka wybiera lica wewnętrzne, dolne okno `200/140` nie domyka obrysu, a dolny pas staje się osobną bryłą. Przeniesienie dowodu do sceny wymaga rozwiązania kolejnych decyzji obrysu. Nad Rzeczką 2 E ma podobną geometrię przeszklonych granic przy osobnej blokadzie skali.

**Inne sprawdzone decyzje.** Calandivy korzystają w scenie z kopii z wymiarami, która już wcześniej miała mocną skalę. Poprawę na drugiej kopii wykazano w odczycie, scena zachowuje ten sam model. W Nolanach 2 G2E wymiar garażu `700` jest poprawnie związany i skala jest prawidłowa. Obrys 6,49 m wynika z uznania pasa prawej ściany z drzwiami za zewnętrze. Torenie 3 mają skalę około 3,128 cm/px oraz 81,62 z 99,16 m², z brakującymi pomieszczeniami 1 i 7 oraz ilościami LIMITED. Wrotycze nadal korzystają z odzyskanego łańcucha `1620`. [Raport v3.53.13](https://github.com/damiankrok/BuildApp/blob/06fc6dd/stage-reports/SOURCE_TO_MODEL_V35313.md)

| Priorytet | Zakres | Wynik oczekiwany |
| --- | --- | --- |
| **1. v3.53.15 — obrys przy przeszklonej elewacji** | Supertunie 2 E i Nad Rzeczką 2 E. Granica wnętrza bez długiego pasa muru, w tym przeszklenie między krótkimi filarami i cofnięte przeszklenie. | Z dowodu na rzucie odzyskać właściwe lica i ciągłość wnętrza. Taras i otwarta loggia pozostają na zewnątrz. Potwierdzić skutek w normalnej scenie i sprawdzić przeniesienie na nowej rodzinie. |
| **2. Niepełne obrysy i pozostałe odmowy** | Pas prawej ściany garażu Nolan 2, pomieszczenia 1 i 7 Torenii, głębokość Calandivy (15,59 wobec 16,80 m), Goldstary 2, Bazylie 5, Pod Krzewuszką 2, Plumerie 2 i Kliwie 10. | Ustalić pierwszą decyzję o licu, skali albo otwartej strefie i weryfikować wspólną przyczynę na arkuszach. |
| **3. Otwory, dach i jakość obmiaru** | Stellarie, Anodach, Nigelle, Malwina, Lulo 3, Ofelia 2, Layla 2, otwarte naroża i dachy Karmazynów, Telim i Wrotycz. | Pod właściwą skalą poprawiać przypisanie widoków, otworów i połaci oraz wskazywać wiarygodność ilości. |
| **4. Pomoc API przy niejednoznacznych miejscach** | Pytania B/C, zapisane żądania i odtwarzanie v3.53.11. | Przy dostępnym sekrecie i rozliczeniu zmierzyć trafność, koszt i wpływ na scenę z oryginału i kadru. |
| **5. Przegrody, etykiety i ewentualna korekta 005Q** | Przegrody, identyfikacja pomieszczeń i osobne rozstrzygnięcie lica. | Zachować N1a, podgląd częściowy, cienkie dobudówki i nazwane strefy. |

Globalny V-MARK pozostaje odrzucony. Surowy odczyt, przyjęty dowód i zastosowanie w wybranej kopii nadal śledzimy osobno. Próba API B/C pozostaje niezmierzona. Księga 2,72807938 USD z 5 USD, 92 wpisy, billing UNCONFIRMED. Prywatne plansze ŹRÓDŁO | PRZED | PO zachowują wspólną kamerę i skalę. [Instrukcja próby API](https://github.com/damiankrok/BuildApp/blob/36ff6f2/research/source-to-model/s5311/evidence-questions/README.md)

## 3. Pełny zakres produktu i opisy działania

### 3.1 Dom jako indeks i trwały projekt

Model prowadzi do spraw związanych z prawdziwą budową: element → jego ilości, koszt, dokumenty, zdjęcia, wykonawca i historia prac. Pierwsze MVP ma jeden budynek w projekcie. Kondygnacje są uporządkowane, pokoje mają stabilną tożsamość, wspólna ściana jest jednym elementem z powiązaniami do wielu pokoi. Element może dotyczyć całego budynku albo kondygnacji; członkostwo w pokojach jest osobną relacją 0..N. Element piętra odwołuje się do pokoi tego piętra; element całego budynku może łączyć pokoje różnych kondygnacji. Nie kopiować elementu tylko dlatego, że występuje w dwóch kontekstach.

Zaakceptowana rewizja semantycznego domu jest podstawą. Geometria/render są pochodne; utrata cache lub renderera nie usuwa domeny, kosztów i relacji. Rewizje, niezmienne wersje elementów, delty/checkpointy, oryginał, adaptacja, zaakceptowane korekty i stan zbudowany pozostają rozróżnialne. Reimport pokazuje porównanie i merge, zamiast nadpisywać projekt. Dokumenty/zdjęcia zachowują historyczne powiązania. Nie oznacza to obowiązku budowania pełnego BIM ani tabeli dla każdego nazwanego pojęcia.

### 3.2 Praca z modelem i docelowy ekran

Obrót, zoom, pan, wybór i podświetlenie elementu, wybór/ukrycie kondygnacji i dachu, izolacja pokoju lub elementu. Przykład: **Piętro → Łazienka → Ściany** centruje kamerę, wygasza otoczenie, podświetla ściany i otwiera powierzchnie oraz powiązane koszty. Ukrycie dachu i poddasza pozostawia parter tego samego domu; filtrowanie widoczności nie zmienia zapisanej domeny.

Zachowany kierunek UX: 3D zajmuje użyteczne płótno, sterowanie jest przy krawędziach, na dole oś czasu, inspektor/panele kontekstowe otwierają się przy wyborze; UI ustępuje interakcji z domem. Bez dominującej zaokrąglonej karty ograniczającej model i stosu prostokątnych kart. Oszczędne półprzezroczyste chrome, czytelny kontrast i cele dotykowe. Aktywne pytanie wskazuje ten sam region na źródle i w modelu. To zachowany kierunek, nie deklaracja zweryfikowanego obecnego UI.

Dom ma przybliżoną spójną paletę low-poly/stylized, charakterystyczne pasy/okładziny/szczyty i szklenia. Dostępny też widok techniczny na ciemnym tle, kontury, przekrój/półprzezroczystość; fotorealizm nie jest celem. Jasny wariant pozostaje dopuszczoną opcją/prototypem prezentacji; nie został wybrany jako obowiązkowy styl. Siatka podłoża należy do prezentacji. Ruch wyjaśnia przejście wyboru, panelu, osi czasu i kontroli, respektuje ustawienia ograniczenia animacji. Nie ma dekoracyjnego bezkresnego ruchu. Dokładne pięć zakładek, clay look, wireframes, tokeny i teksty nie są zatwierdzone samym istnieniem researchu.

### 3.3 Koszt rzeczywiście poniesiony

Szybki wpis obejmuje nazwę, kwotę brutto / faktycznie zapłaconą, datę, typ, kategorię, etap i opcjonalny cel/notatkę. Typy: materiał, robocizna, usługa, transport, wynajem, formalności, inne. Cele: cała budowa, kondygnacja, pokój, element; etap klasyfikuje wydatek, nie dopisuje go drugi raz do sumy. Koszty ogólne są pełnoprawne: projekt, geodeta, kierownik, pozwolenia, przyłącza, sprzęt, transport, kontener, ogrodzenie, droga dojazdowa.

Money jest dokładne w najmniejszych jednostkach z jawną walutą; bez Float/Double, z odmową overflow i niejawnego mieszania walut. Data kosztu oznacza dzień (LocalDate), nie przypadkową strefę czasową. Pierwszy rynek Polska/PLN, polskie formaty dokumentów i regiony/województwa, z możliwością i18n. Jednostki jawne: mm/cm/m, m²/m³, szt., kg/t/l, nie dowolne napisy.

Późniejszy koszt może być rozdzielony między kilka celów. Ręczne udziały są kierunkiem pierwszego rozwiązania; finalna semantyka alokacji i ujemnych kwot/refundów nadal wymaga rozstrzygnięcia przed właściwą funkcją. Istniejące typy techniczne nie zamykają decyzji. Metoda podziału nie jest pewnością kwoty. Wydatek 1000 PLN przy etapie Dach i alokacji do dachu nadal sumuje się jako 1000 PLN. Netto/VAT i tryb firmowy to późniejsze dodatkowe fakty/widoki, które nie zmieniają po cichu kanonicznej sumy brutto.

Ilość, koszt, wycena, umowa, faktura, płatność i rozliczenie są różnymi faktami. Rzeczywista oferta/umowa/faktura/płatność użytkownika ma pierwszeństwo nad benchmarkiem. Brak ceny to UNKNOWN/QUOTE_REQUIRED, nie zero. Stare przykładowe ceny nie są aktualnym cennikiem.

### 3.4 Budżet i statystyki FREE

Pełne statystyki własnej budowy są w FREE: łączny koszt; materiały/robocizna/usługi/transport; etapy, kondygnacje, pokoje, elementy i kategorie; wydatki w czasie, największe pozycje, filtry, wykresy i zestawienia. Koszt/m² wskazuje podstawę powierzchni, bez mieszania pola użytkowego i obrysu.

Budżet docelowo: całość, etap i kategoria; wydane, pozostało, procent, przekroczenie i plan vs wykonanie. Spent wynika z dziennika, nie z drugiej niezależnej sumy. Obliczenia mogą obejmować pola podłóg/ścian/sufitów/elewacji/dachu, długości ścian i liczbę pomieszczeń, tylko w zakresie prawidłowych miar. Z nich wynikają koszty per m²/pokój/piętro/element/etap. Przybliżenie wyglądu nie wystarcza do zakupowego obmiaru.

### 3.5 Oś czasu, etapy i wiedza budowlana

Timeline łączy dziennik, etapy, historię i koszty. Użytkownik dodaje, usuwa, zmienia i porządkuje etapy. Starter może prowadzić od działki/projektu/formalności i przygotowania terenu przez fundamenty, ściany, strop, dach, stolarkę, elektrykę, hydraulikę, ogrzewanie, tynki, wylewki, elewację i wykończenie do ogrodu. To edytowalny punkt startu.

Relacje są dwukierunkowe: wpis o więźbie podświetla dach; wybór dachu pokazuje daty, koszty materiału/robocizny, dokumenty i wykonawców. Odhaczenie zadania zmienia stan powiązanego elementu/pokoju/strefy/kotwicy źródła, jeśli ta semantyka istnieje; nie tworzy fikcyjnej geometrii instalacji.

Wiedza pomaga osobie bez doświadczenia: co zrobić, w jakiej kolejności, kiedy zdecydować, co sprawdzić przed zakryciem, gdzie potrzebny odbiór/protokół i jakie zdjęcia zatrzymać. Zachowane pomysły: graf zależności, terminy decyzji, punkty kontroli/hold points, moduły warunkowe, zadanie↔koszt/dokument/zdjęcie/3D i deterministyczne **„Co teraz?”**. Stan techniczny, płatność i odbiór pozostają osobnymi faktami.

Definicje wiedzy i wykonane zadania użytkownika mają osobne wersjonowanie; aktualizacja zaleceń nie kasuje historii. Research 120 zadań jest biblioteką, nie gotowym schematem lub ekranem MVP. Zachowana rekomendacja pierwszego wycinka: około 8–12 makroetapów, 40–60 wybranych zadań, 10–15 kluczowych zależności/kontroli i 5–8 modułów warunkowych. To orientacja do uzgodnienia, nie twarde liczby produktu. Nie utrwalać „sześciu zadań na etap”,11 statusów, pełnego MEP ani silnika rozumowania prawnego. Proste rekomendowane stany: nie rozpoczęto, w toku, oczekuje kontroli, gotowe, problem, nie dotyczy; gotowość jest obliczana, zamówienie należy do zakupów. Krytyczne treści prawne/bezpieczeństwa wymagają aktualizacji i fachowej oceny przed użyciem jako blokada.

### 3.6 Dokumenty, aparat i późniejsza automatyzacja

Lokalna biblioteka: projekty, faktury, paragony, umowy, wyceny, gwarancje, zdjęcia, protokoły. Dokument może być powiązany z projektem, etapem, kosztem, wykonawcą, pokojem i elementem. Aparat/import pliku są podstawowym przepływem dokumentów. Pliki są poza DB w zarządzanym magazynie; DB przechowuje stabilne ID aplikacji, metadane, storage key/handle i relacje. Android URI jest sposobem dostępu, nie tożsamością.

Późniejszy OCR rachunku próbuje odczytać sprzedawcę, numer dokumentu, datę, pozycje, ilości, jednostki, netto, VAT, brutto i sumę. Pozycja może zostać oddzielnym kosztem z odnośnikiem do dokumentu. Oryginalna nazwa produktu zostaje zawsze; normalizacja np. różnych nazw płyt G-K dodaje wspólną kategorię, bez usunięcia źródłowego zapisu. Automatyczne przypisanie i rozdział kosztu następują po działających dokumentach i rozstrzygnięciu alokacji. To odrębny program od OCR wymiarów domu.

### 3.7 LINK, PROJECT, jedno zdjęcie i AS-BUILT

LINK daje rozpoznawalne zewnętrze z publicznego projektu: główna bryła, garaż/skrzydła, kondygnacje, dach, okna/drzwi, duże szklenia, balkony, loggie/wnęki, słupy/kolumny, zadaszenia/portale, kominy, rooflights i charakterystyczne elewacje. Rozróżniać taras, balkon, balustradę, canopy, carport, pergolę, schody zewnętrzne, słupy i belki; nie każdy cover to dach i nie każdy otwarty obszar to bryła. UNKNOWN_ASSEMBLY pozostaje poprawnym wynikiem. LINK nie obiecuje pełnego BIM ani niewidocznej konstrukcji; nie zabrania wnętrz popartych dostępnym rzutem.

PROJECT: **„Mam pliki projektu”** prowadzi przez inwentaryzację → rewizję/wariant → pokrycie → analizę → minimalne konkretne pytania → częściowy/zaakceptowany model. Kandydaci źródeł: IFC/BIM, DWG/DXF, wektorowy PDF, rastrowy PDF, PNG/JPG/skany, zestawienia stolarki, konstrukcja, instalacje, XLS/XLSX/ATH/przedmiary i wizualizacje. Wykorzystywać istniejące wektory/semantykę zamiast zawsze rasteryzować. PDF z napisami jako ścieżkami może wymagać OCR cyfr przy zachowaniu wektorowej geometrii. Format nie rozstrzyga aktualności, autorstwa i znaczenia miary. DWG wymaga sprawdzenia licencji/kosztu Androida; IFC jest możliwe, nie wymagane do pierwszego pilota. Lista wejść nie jest deklaracją gotowych parserów.

PROJECT może rozszerzyć wynik o dokładniejszy obrys, grubości, pokoje, schody/stropy/otwory/poziomy/dach, stolarkę, konstrukcję/fundamenty/MEP i przedmiary z połączeniem quantity/cost. Wektorowy PDF i XLSX/BOQ pozostają zachowanymi kierunkami pilota; obecny priorytet LINK ich nie kasuje.

Jedno zdjęcie to późniejszy fallback wizualny: rzeczywisty obracany, zamknięty model zewnętrzny z pustym wnętrzem, widoczna bryła i jawnie hipotetyczne niewidoczne strony. Nie wymyśla tylnych okien jako obserwacji ani dokładnych metrów bez skali. Nie odzyskuje dawnego pierwszeństwa przed wspólnym odczytem otworów z technicznych źródeł. AS-BUILT rozwija tę samą tożsamość domu: oryginał → adaptacja → zaakceptowane korekty → zmiany budowy → stan zbudowany, wraz z pochodzeniem i historią.

### 3.8 Neutralność źródeł, kamera i korekty

ARCHON jest głównym źródłem historycznego korpusu, ale aktualna kampania wymaga wielu wydawców. Inni wydawcy i nieznane strony pozostają wymaganiem przez adapter lub ogólny czytnik publicznych faktów/rysunków albo import pliku użytkownika. Jawnie normalizować także ft/in, sq ft i spadek 8:12; pola o różnym znaczeniu pozostają osobne. Nie mieszać edycji, odbić i płatnych dokumentów, których nie uzyskano.

Oryginał obrazu i jego rama są źródłem; maska, szkic, segmentacja i OCR to obserwacje pomocnicze. Perspektywa, ortogonalna elewacja, rzut i przekrój mają różne transformacje. Ściana, okap, drzewa, przezierna balustrada i podcień nie są zamiennymi obrysami. Rejestracja dotyczy osi/właściwości. Kopie i skorelowane widoki nie są niezależnymi dowodami.

Użytkownik wskazuje wymiar/końce, koryguje ścianę, przesuwa/zmienia otwór, potwierdza dach, kondygnację i mapowanie źródła. Przed akceptacją widzi źródło i skutek; działa undo i **„Nie wiem”**. Korekta propaguje po zależnościach, bez konieczności rzeźbienia siatki trójkątów. Weryfikuje się przyczynę raz: wysokość→pola/objętości, otwór→odliczenia, tożsamość pokoju→przypisania. Nie zadawać setek pytań o pochodne wiersze ilości.

Decyzja użytkownika jest warstwą na niezmiennym snapshotcie analizy, nie nadpisaniem dowodu. Zachować źródłową wartość, korektę, powód, stan weryfikacji i wynik przeliczenia. Tylko rzeczywista akcja użytkownika nadaje USER_CONFIRMED; sam analizator lub AI nie mogą. Pytania porządkuje wpływ: blokady geometrii, tożsamość/sąsiedztwo, duże ilości, widoczne korekty, niski wpływ. Brak odpowiedzi nie jest potwierdzeniem. Aktywne pytanie wiąże region 3D i kadr źródła w kompaktowym panelu/rail/sheet z zachowaniem kontekstu.

### 3.9 Trwałość, recovery i platforma

Pełny edytowalny wynik, stan korekt i relacje przetrwają restart. Izolacja projektów, jawne migracje i brak destructive migration jako skrótu. Money pozostaje exact po zapisie; nieznany token schematu nie jest cicho mapowany na dowolną wartość. Przed poleganiem na ważnych danych potrzebny sprawdzony backup/restore: prosty eksport/import, backup systemowy albo inny jawny kontrakt. Backup nie oznacza automatycznie cloud sync.

Android native jest platformą startową. Core danych, Money, ID, jednostki i reguły nie zależą od Compose/Context/URI ani adnotacji bazy. Geometria ma metry, lokalny układ Y-up i plan XZ, identyfikację BuildingElementId niezależną od renderera. Jeden element może mieć wiele prymitywów/połaci. Scope/room links należą do domeny; widoczność nie jest stanem trwałym. iOS/Windows/KMP są zachowanym kierunkiem portowalności, bez uruchamiania portu i bez deklaracji gotowości.

### 3.10 Współpraca, wykonawcy i rynek

Późniejsza książka wykonawców: firma, osoba kontaktowa, telefon/e-mail, zakres, wycena, umowy/dokumenty i wykonane etapy. Marketplace/wyszukiwanie firm to osobna późniejsza funkcja po książce kontaktów i decyzji biznesowej. Konta/backend/cloud sync i role OWNER/EDITOR/VIEWER pojawiają się przy realnej potrzebie współdzielenia, bez odbierania użyteczności lokalnego rdzenia. Audit trail może zapisywać zmiany budżetu, kosztu i przypisania dokumentów.

PRO pomaga przed wydaniem pieniędzy: ceny/oferty, jednostkowe benchmarki według regionu, czasu, typu/powierzchni/technologii domu i materiału, prognozy, alerty wysokiego kosztu, rekomendacje i monitoring cen. Dane mogą łączyć dobrowolne agregaty, oferty, publiczne cenniki i legalne źródła partnerów. Nie publikować pojedynczych danych ani małych grup pozwalających identyfikować użytkownika. Potrzebne zgoda i możliwość wyłączenia. Dawne ceny badawcze są kontekstem, nie aktualną prognozą budżetu.

FREE zachowuje projekt, 3D, ręczne koszty, lokalne dokumenty/aparat, podstawowy timeline, pełne własne statystyki, budżet i podstawowe obliczenia. Nie przenosić tych funkcji do PRO przy porządkowaniu roadmapy.

### 3.11 Import/eksport, bezpieczeństwo i utrzymanie

Późniejszy import CSV/XLSX, banku i innych planerów; eksport PDF/CSV/XLSX. Minimum recovery można przyspieszyć niezależnie od całego programu integracji. Logi błędów, identyfikatory żądań, podstawowe metryki i błędy parserów pomagają utrzymać produkt bez logowania pełnych danych wrażliwych. Przy backendzie: kontrola dostępu, walidacja serwera, protected endpoints, limity rozmiaru/MIME i bezpieczne przyjmowanie plików. Finalne applicationId pozostaje decyzją przed wydaniem.

### 3.12 Zachowane pomysły z nazwanymi ID

| ID z historii | Zachowane znaczenie, status i warunek powrotu |
| --- | --- |
| IDEA-3D-ROOF-TILE-001 | Lekki powtarzalny relief dachówek/łusek przez instancing/procedural zamiast ciężkiego obiektu każdej dachówki. Znika z ukryciem dachu, nie zmienia obmiaru/kształtu, współpracuje z wyborem i dekompozycją. Statyczne wdrożenie raportowano w 013F; obecne zachowanie sprawdzić przy powrocie do renderera. Dawny zakaz koloru nie ogranicza nowej palety. |
| IDEA-3D-ROOF-MOTION-001 | Późniejszy subtelny ruch istniejącej pokrywy w shaderze/GPU, bez encji per dachówkę; zachować picking/dekompozycję, roof-off usuwa całość. Zachowany seam facet/row/column/ordinal i faza UV są opcją techniczną. Pomysł opcjonalny, nie aktywne zadanie. |
| IDEA-UI-MOBBIN-001 | Inspiracje mobilną hierarchią, odstępami, grupowaniem kontroli, stanami pustymi i nawigacją; bez kopiowania ekranu 1:1. Brak konkretnej usługi nie zatrzymuje rozsądnego audytu. Dokładny wygląd do akceptacji. |
| IDEA-COST-NETVAT-001 | Późniejsze netto/VAT/tryb firmowy przy zachowaniu kanonicznej sumy brutto. |
| IDEA-LIGHT-THEME-001 | Jasne tło/temat jako opcja prezentacji, nie zmiana geometrii. |
| IDEA-PLAN-PHOTO-ANALYZER-001 | Wbudowana interpretacja planów, wizualizacji i braków ze źródłowym pochodzeniem. Program aktywny; dojrzałości nie gwarantuje stary status 005Q/005R. |
| IDEA-AI-PACK-001 | Opcjonalny pobierany, hashowany i usuwalny lokalny pakiet, po pomiarze jakości/licencji/pamięci/czasu. Wielkość sama nie rozstrzyga. Większy cloud teacher/distillation też jest możliwością, nie produkcyjną decyzją. Nie ma wieczystego zakazu po wyniku jednego dawnego VLM. |
| IDEA-VISUAL-REFEREE-SERVER-001 | Opcjonalny silniejszy model dla trudnego kadru i kontroli końcowego wyniku, bez domyślnego uploadu całego projektu. Retencja, prywatność, szyfrowanie, limity i koszt wymagają kontraktu. Badanie nie oznacza funkcji APK; projekt integracji w etapie 3. |
| IDEA-SYNTHETIC-REFEREE-DATA-001 | Własny legalny korpus planów/ścian/otworów/garaży/wykuszy/tarasów/pergoli i relacji pięter z hard negatives, lustrami/obrotami/stylami i UNKNOWN. Możliwe szkolenie/distylacja po usunięciu skrótów klas; syntetyka nie zastępuje realnej kontroli. |
| IDEA-WALL-MODEL-CHALLENGER-001 | Mały model ścian/otworów jako rywal/weto błędnych połączeń, gdy realny niezależny korpus otwartych boków wykaże powtarzalną istotną wadę i bezpieczny zysk. Hipoteza odwołalna, nie przywilej własnego UNet nad biblioteką. |
| IDEA-VISUAL-ASSET-ROUTER-001 | Rola i region obrazu, wariant, kondygnacja, strona/odbicie i alternatywy; odseparowanie wnętrz. Wersjonowane propozycje region/role/evidence/confidence/abstention. Klasyfikator nie jest automatycznie detektorem architektury. |
| IDEA-PLAN-ELEVATION-OPENING-FUSION-001 | Cztery elewacje przypięte do konkretnych lic ścian, rzutów, poziomów, okapu i otworów. CANOPY/PERGOLA/CARPORT/TERRACE/BALCONY/ENTRANCE/balustrady przez wspólny model/DSL/kompilator, jawne przybliżenie i UNKNOWN. |
| IDEA-VISUAL-REAL-TRUTH-AND-ROUTING-001 | Rzeczywiste niezależne etykiety przed deklarowaniem skuteczności, izolacja wariantów i negatywy. Dawny jednorazowy workflow 34/60 pytań jest historią, nie dzisiejszym obowiązkiem OWNER-a. |
| IDEA-BACKUP-001 | Minimum przywracania ważnych danych przed regularnym użyciem, bez czekania na chmurę. |
| IDEA-PORTABILITY-001 | Neutralny core i jawne adaptery; przyszłe porty dopiero po decyzji i dowodzie. |

### 3.13 Otwarte decyzje i kolejność

Finalna alokacja, ujemne kwoty/refundy, applicationId, minimum backupu, zakres cloud/AI pack i niejasna retencja dawnych cudzych materiałów pozostają widoczne. Nie blokują dopuszczonego audytu. Priorytet jest w §2. Po ustabilizowaniu analizy, tożsamości i trwałości wracają realne koszty, budżet, zadania/dokumenty i pętla budowy. Nie czekamy na idealny detal każdego domu, ale nie opieramy rozliczeń na niestabilnych obiektach i fikcyjnie dokładnych miarach. PROJECT, AS-BUILT, OCR rachunków/normalizacja/autoalokacja, import/eksport, sync/role, wykonawcy i rynek/PRO pozostają roadmapą. Zachowanie pomysłu nie zleca automatycznej implementacji teraz.


Koszty, dokumenty i etapy pozostają użyteczne przy częściowym modelu. Minimalna beta LINK nie oznacza ukończenia publicznego MVP z ciągłością LINK/PROJECT i pętlą budowy.

## 4. Jak ma działać analiza domu

LINK MODE: z publicznych materiałów właściwego projektu powstaje rozpoznawalny, użyteczny model przy jawnych ograniczeniach. PROJECT MODE: dokumentacja zakupiona/adaptowana pozwala na bogatszą geometrię i miary. AS-BUILT rozwija tę samą tożsamość domu. Jedno zdjęcie jest planowanym fallbackiem wizualnym z hipotetycznymi niewidocznymi stronami, bez prawa do dokładnego obmiaru bez skali.

Docelowy LINK obejmuje nieznanych wydawców zgodnie z § 3.8, bez hardcode konkretnego domu. Neutralność wydawcy nie jest deklaracją gotowego uniwersalnego czytnika. Nazwany adapter formatu jest dopuszczalny; kopiowanie rekonstrukcji per domena nie jest kierunkiem.

Analizator:
1. Ustala dokładny projekt, wariant, edycję i odbicie oraz dostępne źródła. Nie miesza ich dla wygodnej zgodności.
2. Odróżnia dokument, projekcję, kondygnację, region i widoczną stronę. Wnętrze nie jest widokiem do obmiaru zewnętrza; przekrój nie jest boczną elewacją, a perspektywa nie jest rzutem dachu.
3. Łączy odpowiednie rzuty, przekroje, elewacje, wizualizacje i opisy przez obiekty/relacje. Same proporcje prostokąta nie rozstrzygają zawsze przodu/tyłu/odbicia ani geografii.
4. Odczytuje napis z jednostką, symbolem, linią i końcami/licami oraz określa, czego dotyczy. DET, REC, parsowanie, znaczenie i skala są różnymi decyzjami.
5. Zachowuje źródłowe obserwacje i konkurencyjne hipotezy, także gdy model nie umie jeszcze zbudować elementu. Brak zbudowania balkonu nie dowodzi braku balkonu w źródle.
6. Rozróżnia posadzkę, podłogę–podłogę, górę/spód stropu, okap, kalenicę, teren i ściankę kolankową. Nie zamienia każdej rzędnej lub pionowego wymiaru w poziom kondygnacji.
7. Buduje właściwe bryły/uskoki, garaż i skrzydła, komplet połączonych dachów, ściany, otwory, balkony i balustrady, zadaszenia/podpory, lukarny oraz pozostałe cechy definiujące projekt.
8. Zachowuje charakterystyczne strefy elewacji i przybliżone kolory w spójnym low-poly/stylized. Nie kopiuje ogrodu, cieni i odbić jako architektury.
9. Sprawdza SOURCE→MODEL oraz MODEL→SOURCE, pominięcia, dodatki i fizyczne relacje. Późniejsza korekta ma wskazać dowód i powód zastąpienia poprzedniej wartości.
10. Pozwala wskazać źródło/element, poprawić wynik, zobaczyć skutek i wycofać korektę.

Kontrakt kamer do wdrożenia i pomiaru: rozróżniać ORTHOGRAPHIC_TECHNICAL, PERSPECTIVE_PINHOLE, PERSPECTIVE_SHIFTED, PLANAR_DIAGRAM i UNKNOWN. Per widok przechowywać parametry wewnętrzne/zewnętrzne, principal-point shift, kotwice, residual reprojekcji, ocenę sylwetki/krawędzi/widoczności i confidence. Dopuszczać top-K, jeśli źródło nie rozstrzyga. Jedna wspólna hipoteza budynku ma osobną kamerę dla każdego renderu. Po korekcie ponownie dopasować dotknięte kamery i zachować silniejsze źródła. Nie stosować liniowego przeliczenia pikseli perspektywy na metry przed oceną kamery.

**Aktualna rola API (§2 i §7).** API opisuje źródłowo cały budynek lub jego części i proponuje obserwacje/hipotezy, a analizator je uzgadnia i buduje. Wspólny dokument obejmuje obserwacje, geometrię i weryfikację, ze śladem aż do sceny. Błędny LOCAL można zastąpić lepiej udokumentowanym kandydatem; niezależne poprawne własności zachowują ochronę. Wymiary drukowane, wyliczone, oszacowania i niewiadome pozostają rozdzielone. Nowa rewizja przelicza zależności i jest porównywana ze źródłami po kompilacji.

Zachowany kierunek source-fusion: adaptery → źródła/obserwacje → graf dowodów i ograniczenia → hipoteza semantyczna → deterministyczny kompilator → weryfikacja/korekta. To granice odpowiedzialności, nie zakaz porównania innej kolejności wnioskowania. Ręcznie zbudowany model referencyjny pozostaje debug/test/eval, bez runtime gold ani automatycznego zaliczania zgodności. Opcjonalny VisualInterpreter może wnosić maski/keypointy i obserwacje, nie zapisywać bezpośrednio kanonicznej prawdy. Przenośną wartością są matematyka kamer, klasyfikacja źródeł, graf, solvery, ocena widoków i schematy; badawczy web UI nie narzuca platformy produktu.

Niewielka sprzeczność nie ma blokować użytecznego 3D, gdy istnieje sensowna podstawa bryły. Brak rzetelnej skali blokuje dokładny obmiar, nie musi blokować jawnie orientacyjnej hipotezy wizualnej. Nieudana rejestracja jednej właściwości nie kasuje innych widocznych cech.

Powierzchnia pokoju nie określa kształtu, a użytkowe pole poddasza nie określa całego obrysu. Wartość wyliczona lub proporcjonalna nie staje się drukowaną. Wygląd przybliżony i miary do zakupów/kosztów mają różny zakres uprawnień.

### Kierunek wdrożenia po audycie

Zewnętrze traktować jako wspólny semantyczny układ brył, otwartych obszarów, połaci i dodatków, z równoległymi ograniczeniami rzutu. Nie odzyskiwać pomieszczeń przez samo cięcie dowolnego finalnego mesha. Brak poprawnej skali może pozostawić orientacyjną hipotezę topologii, bez prawa do przedmiaru. Hipoteza bez metryki nie jest drugim zaakceptowanym modelem ani siatką udającą metry.

Zasięg dachu, obrys ścian danej kondygnacji i granice użyte do podziału obliczeń mają osobną semantykę. Jeden dach może obejmować kilka zamkniętych części i otwarty podcień. Ściana na granicy podziału potrzebuje dowodu rzeczywistej przegrody. Osobne dachy i wspólne połacie mogą współistnieć. Zachowuj źródło i poziom przypisania dla okapu, kalenicy, połaci i ich styku oraz oznaczaj wartości z konwencji na właściwości, której dotyczą.

Topologia pomieszczeń dotyczy kondygnacji i jej rzeczywistych przegród, otworów, podłogi i pustek. Rozróżniać pokój zamknięty, połączone przejście przez otwór w ścianie i otwartą przestrzeń z kilkoma strefami funkcjonalnymi. Pole geometryczne obliczać z poligonu z odjętymi pustkami według zadeklarowanej metody. Numer, nazwa i pole deklarowane mają własne dowody. Sprzeczność podlega zgłoszeniu przed użyciem pomiaru do kosztów.

Kształt zaobserwowany na obrazie, strona/identyfikacja, kotwica metryczna i zastosowana geometria są oddzielne. Utrata jednej kotwicy nie dowodzi płaskiego dachu ani braku balkonu. Ograniczenie kompilacji/łączenia nie może po cichu zmieniać rozpoznanej architektury na łatwiejszą. Wczesna hipoteza nie zwalnia z kontroli hostów, podpór, skali i źródeł.

C1a/C1b/C2 pozostają bazą o ograniczonym zakresie, nie dowodem pełnego rozumienia domu. Wolno przebudować koordynację czytania źródeł oraz rozszerzyć reprezentację i builder potrzebne do całego ocenianego zewnętrza, bez nieuzasadnionego przepisywania kernela. Historyczne A/C/B i globalny strukturalny opis domu były wariantami porównawczymi; aktualny zakres API wyznacza §7. Wpływ odczytu, arbitrażu, konsumenta i kompilacji rozdzielać w eksperymencie, a cały efekt oceniać na finalnym domu. Zachować jeden model, jego tożsamość i deterministyczną kompilację; nie wymagać nowego ogólnego frameworka.

## 5. Co ma być trwałe, co wolno wymienić

Trwałe:
- jeden zaakceptowany model semantyczny, stabilne ID i edytowalne zależności;
- geometria/render z tego modelu, bez alternatywnej „prawdy” UI;
- źródła, surowe dane i niepewność sprawdzalne per właściwość;
- brak odpowiedzi benchmarku w runtime i brak wyjątków po tożsamości projektu;
- trwałość danych budowy, prywatność i poprawność finansów.

Odwołalne po pomiarze:
- konkretny OCR, detektor, ensemble i pierwszeństwo czytnika;
- wybór rejestracji/skali, dekompozycji, kolejności hipotez i sposobu rozwiązania;
- podział funkcji i bibliotek, progi heurystyk oraz strategia AI;
- starsza ścieżka kompatybilności, jeśli jej konsumentów można bezpiecznie zmigrować.

Źródłowo zaobserwowany element, jego interpretacja semantyczna i finalnie skompilowany obiekt są różnymi stanami: observed → interpreted → built. Relacja z balkonem może być dowodem rodzaju otworu, ale brak wcześniejszej reprezentacji płyty w częściowym modelu nie dowodzi braku balkonu w źródle. Obecna faza step-out używa tej wcześniejszej reprezentacji semantycznej; nie należy opisywać jej jako kontroli udanej finalnej kompilacji mesha.

Pochodzenie i uprawnienia należą do każdej właściwości: elevation, height, wallTop, ridge, sill, head i width osobno. Wydrukowana rzędna nie nadaje statusu PRINTED/SOURCE_EXACT konwencjonalnej wysokości. Różnica dwóch wydrukowanych poziomów jest wartością wyliczoną, z odnośnikami do obu przesłanek. Zachować oddzielnie surową obserwację, przyjętą interpretację i wymiar rzeczywiście zastosowany po dopasowaniu; późniejsza korekta nie może zostawić śladu deklarującego inną przyjętą liczbę.

„Jedna produkcyjna ścieżka” oznacza jeden sprawdzalny wynik i kontrakt aplikacji, nie zakaz porównywania lub zastępowania algorytmów. Hipotezy i warianty na kopii są dozwolone. Renderer i koszt nie dostają równoległych niespójnych modeli.

Własny OCR nie ma zagwarantowanego pierwszeństwa. Drugi silnik nie jest obowiązkiem samym w sobie. Lokalizację tekstu, rozpoznanie i geometrię wybierać według pomiaru konkretnego zadania, kosztu i zasobów. Otwarte CAD/CV/OCR są dopuszczalne po ocenie przydatności/licencji/integracji; nie pisać od nowa tylko z przywiązania do własnej implementacji.

Nie zmieniać przy okazji modelu biznesowego, finansów, docelowej platformy ani zasad wysyłki danych. Rzeczywistą konieczność takiej zmiany uzasadnić konkretnym wynikiem.

## 6. Źródła, inspekcja i podgląd na żywo

Źródło jest identyfikowane przez dokładne bajty/hash i ramę/kadr. Nakładka używa tych samych współrzędnych i mapy co analizator, bez ponownego pobrania innego wariantu.

Podczas trwania analizy ma być widoczny rzeczywiście czytany obraz i badany fragment/linia. Sekcja inspekcji po ukończeniu nie zastępuje tego warunku. Nie wymagamy fikcyjnej animacji każdej operacji ani drugiego modelu.

Odczyt pokazuje oryginalny napis, wartość przyjętą, rodzaj/pochodzenie, host lub brak przypisania oraz zastosowanie/odmowę. Liczniki kandydatów OCR, miar, hipotez i fizycznych elementów są oddzielne. Ten sam otwór w kilku widokach nie staje się kilkoma oknami.

UNKNOWN jest dozwolone przy braku podstaw. Odrzucenie wszystkich czytelnych źródeł nie jest sukcesem. Konflikty zachowują obie przesłanki. Odmowa weryfikacji nie oznacza zgodności ani braku elementu.

### 6.1 Prototypy wyglądu — zachowany zakres v3.54.2

Stan v3.54.3: poniższe wymagania zachowują kierunek i kryteria prezentacji. Nie zlecają ponownie budowania nowych wariantów w bieżącej kampanii analizatora. Raportowane style Androida pozostają bez weryfikacji na urządzeniu; podgląd z osobnego programu nie potwierdza ich działania.

Przygotować porównanie czterech stylów na jednym rzeczywistym modelu: (A) granatowy techniczny z krawędziami i opcjonalnym X-ray, (B) jasna pracownia z matową bryłą, (C) ciepła stylizowana makieta, (D) grafitowy widok z wyraźnym wyborem elementu. Propozycje mają różnić się także hierarchią i organizacją paneli; nie zatwierdzono jednego stylu. Geometria, źródła i rewizja są wspólne.

Rozróżnić siatkę podłoża, wireframe/krawędzie architektoniczne i przezroczystość powierzchni. Gęsta triangulacja to diagnostyka, nie domyślny wygląd. Pozostawić pełną bryłę do oceny sylwetki; umożliwić ukrywanie dachu, wybór kondygnacji i izolację elementu bez zmiany domeny. Półprzezroczystość nie może zasłaniać otworów i powodować plątaniny linii. Typ materiału, wybór i niepewność mają odrębne oznaczenia.

Każdy wariant pokazuje ekran domu/wybranego elementu i ekran analizy źródło–model, najpierw na telefonie w pionie. Zachować duże płótno, dostęp do kosztów i etapów oraz czytelny arkusz z badanym fragmentem. Odtwarzanie zapisanych zdarzeń oznaczyć jako demonstrację, nie bieżącą analizę. Jeśli prototyp wykorzystuje rendery zamiast prawdziwego 3D, zakres interakcji musi być jawny.

Analizator i viewer mogą rozwijać się oddzielnie przez wspólny kontrakt modelu, ID, rewizji, diagnostyki i zdarzeń. Separacja modułów nie dowodzi zgodności integracji. Style nie modyfikują geometrii analizatora; nowa rewizja odświeża właściwy widok. Do kontroli API i metryk zachować jeden neutralny profil renderowania; widok przezroczysty jest dodatkiem diagnostycznym. Nie zmieniać profilu pomiaru razem ze zmianą algorytmu.

Dostawa obejmuje klikalny podgląd, planszę czterech propozycji, czytelne ujęcia obu stanów, instrukcję i spis interakcji. Produkcyjny wygląd wymaga późniejszego wyboru OWNER-a; prototyp nie oznacza wydania Androida. Raport rozdziela preferencje wizualne, zgodność danych, zmierzoną wydajność w danym środowisku i nieweryfikowane zachowanie telefonu. Zakres produktu z §3 pozostaje zachowany.

## 7. Pomoc AI, wspólny opis domu i kontrola modelu

**Obowiązujący kontrakt v3.54.11.** API może odczytywać i opisywać cały dom, podawać wymiary ze źródeł oraz proponować pełną hipotezę semantyczną. Analizator waliduje, uzgadnia, buduje i kompiluje. Poprzedni zakaz pełnego opisu z D20 jest zastąpiony D29. Surowy opis nie jest automatycznie prawdą, a stary swobodny HouseDescription nie zastępuje bez kontroli wyniku LOCAL. Nie uruchamiać dwóch konkurencyjnych czytników płatnych niejawnie w jednym jobie.

### 7.1 Wspólny dokument i pochodzenie

Jeden wersjonowany house.json zawiera: (1) źródła, obserwacje, relacje i ograniczenia; (2) uzgodnioną geometrię semantyczną; (3) wynik weryfikacji i stan użycia. Adapter wiąże go z istniejącą domeną i kompilatorem, zamiast tworzyć drugi rozbieżny dom. Zachować ID i relacje kosztów, dokumentów, historii i korekt użytkownika.

Per parametr zapisywać jednostkę, znaczenie, obiekt/poziom/lica, źródło i region, rewizję, pochodzenie, zależności oraz niepewność. API może odczytać 1682 cm i zapisać 16,82 m; literalny tekst i konwersja pozostają. PRINTED, DERIVED, ESTIMATED, DEFAULT, UNKNOWN nie są zamienne. Brak nie jest zerem, a default wizualny nie staje się danymi do zakupowego obmiaru. Wymiary całkowite, korpusu, dachu, podcienia i powierzchnie o różnych definicjach są oddzielne.

Schemat obejmuje poziomy, wieloboki kondygnacji i pustki, bryły/skrzydła/wykusze, ściany z licami, otwory z hostem i rzędną, połacie/kalenice/okapy/spadki, lukarny różnych rodzajów, balkony/portyki/podpory/kominy oraz istniejące wnętrza. Zakres odczytu, zbudowania i sprawdzenia każdej rodziny jest jawny. CAPABILITY_MISSING w aktywnym zakresie oznacza niedokończony konsument, nie sukces.

### 7.2 Pozyskanie i wspólny odczyt źródeł

Orchestrator pobiera materiały konkretnego projektu, wariantu i rewizji, zachowuje bajty/hash oraz identyfikuje role widoków. URL sam nie daje API dostępu do obrazów. Miniatury innych projektów, wnętrza, roślinność, cienie i odbicia nie są architekturą domu.

Pierwszy odczyt źródłowy nie sugeruje błędnego modelu LOCAL. Rzuty, przekrój i elewacje mogą być czytane w kilku krokach, ale uzupełniają ten sam graf. Następnie lokalne obserwacje i hipoteza API są uzgadniane; kontrola po budowie ogląda konkretną finalną rewizję. Nie wymagamy jednej ogromnej odpowiedzi ani wypełnienia wszystkich pól domysłem.

Kadry mają kontekst i odwracalną transformację. Oryginał jest źródłem; maski i szkice są pomocnicze. Szkic generatywny nie daje dokładniejszych liczb samym uproszczeniem obrazu i nie jest wymaganiem tej kampanii. Strony domu nie są automatycznie stronami świata. Rzut z góry modelu nie zastępuje nieistniejącego źródłowego rzutu dachu.

### 7.3 Rejestracja i arbitraż

Uzgodnić wariant/lustro, układ Y-up i plan XZ, poziomy, relacje brył oraz elewacje przypisane do konkretnych odcinków ścian. Jedna elewacja może pokazywać kilka brył na różnych głębokościach. Okluzja nie dowodzi braku elementu.

Nie dopasowywać elewacji przez niezależne rozciągnięcie X/Y do starego błędnego domu. Rzut, przekrój i elewacje dostarczają ograniczeń wspólnej geometrii. Weryfikować kotwice nieużyte do dopasowania. Perspektywa wymaga właściwego modelu kamery; przy jego braku pozostawić ocenę topologii/proporcji lub UNKNOWN. Nie tworzyć metrów z niekalibrowanej perspektywy.

API nie wygrywa dzięki confidence, a LOCAL dzięki własnej etykiecie STRONG. Nowy niezależny dowód może podważyć lokalną skalę, orientację lub obrys. Nie wymagaj, by ten sam nieskuteczny czytnik rozpoznał ponownie fakt wskazany przez API. Wymagaj sprawdzalnego źródła, właściwego wiązania i spójności niezależnych ograniczeń. Powtórzenie AI, kopia tego samego druku i pochodna już użytej skali nie są niezależnymi świadkami.

### 7.4 Konsument, budowa i pętla

Snapshot → walidacja → uzgodniony kandydat → przeliczenie zależności → budowa → kompilacja → kontrola źródłowa → accept/rollback. Pole dokumentu ma wskazanego konsumenta i ślad do finalnego parametru oraz geometrii. Legacy heurystyka nie może po cichu nadpisać zaakceptowanych danych. Wartości pochodne starej rewizji przelicza się; surowe obserwacje pozostają.

Kolejność zatwierdzania: tożsamość/wariant, orientacja/metryka, komplet brył/poziomy, dachy, otwory, cechy zależne i detale. Zbierać obserwacje wolno wcześniej. Znana wada hosta wstrzymuje zależną cechę, nie wszystkie niezależne fakty całego domu. Zebrane propozycje zachowuje się do ponownego związania po naprawie gospodarza.

Obrys jakościowy porównuje końcową geometrię właściwego obiektu i poziomu z równoważnym źródłem, nie tylko obrys pośredni rzutu. Równy bbox nie dowodzi garażu ani właściwego kształtu. Otwór musi należeć do właściwej ściany, lukarna do właściwego dachu; nie używać łatwiejszego prymitywu bez jawnego przybliżenia.

Narzędzia: spis/kadry źródeł, kontekst pomiaru, inspekcja elementu i jego decyzji, strukturalny opis/hipoteza domu, rozwiązanie kandydata z konfliktami, widoki rewizji, korekta i ocena. Rozwijać istniejące interfejsy. API nie wykonuje kodu i nie edytuje referencji ani księgi. Potrzebne krótkie uzasadnienie źródłowe, nie prywatny tok myślenia.

Domyślnie dwie rundy korekt po odczycie, do czterech dodatkowych kadrów na rundę, jedno retry transportowe; DEV może mieć jawne dodatkowe eksperymenty w budżecie. ID, source hash i baseRevision są obowiązkowe. Stara propozycja wymaga ponownego związania; operacje są idempotentne. Brak nowego dowodu, konflikt, koszt/czas lub anulowanie kończą pętlę z uczciwym częściowym wynikiem.

### 7.5 Obmiar i monitorowanie

Przyjęcie obserwacji, kandydata i dopuszczenie ilości są osobne. Rollback nie kasuje poprawnego faktu. Podgląd częściowy może pozostać dostępny, ale sprzeczna skala, brak skrzydła czy niezweryfikowana wysokość ograniczają odpowiednie ilości. COMPLETED nie oznacza wiernej sceny, ACCEPT nie oznacza poprawnego całego domu.

Claude Code zapisuje: rzeczywiście wysłane źródła → raw/parsed odpowiedź → wiązanie → konsument → finalna liczba/obiekt → mesh → ocena. Rozróżnia błędny odczyt, wiązanie, brak konsumenta, nadpisanie, starą pochodną, ograniczenie reprezentacji, konflikt kompilacji i brak informacji w źródle.

Ręcznie sprawdzony opis służy diagnostyce buildera przez te same interfejsy; nie jest produkcyjnym fallbackiem ani dowodem automatycznego rozpoznania. Referencje ocen nie trafiają do API. Replay potwierdza deterministyczność konsumenta, a świeży bieg bada wariancję. Recenzja tego samego API nie zastępuje niezależnej kontroli sceny.

### 7.6 Budżet i dostęp

**Kontynuacja v3.54.16 po Council.** Nie otwierać nowej puli. Dotychczasowy limit 5 USD nad końcem v35413 (23,854612 USD) daje jeden wspólny pułap 28,854612 USD. Raportowana księga po v35415 wynosi 26,811717 USD; pozostaje nominalnie 2,042895 USD przed późniejszymi kosztami/rezerwacjami. Na wejściu uzgodnić je z faktycznymi zapisami. Stare pułapy 24,11036 USD i panelowe saldo 76,28 USD są kontekstem historycznym, nie bieżącą zgodą na większy wydatek.

Najpierw bridge, walidator i replay zapisanych odpowiedzi; płatne odczyty dopiero po działającym wykonawcy. Zarezerwować część puli na finalny host i małą zamrożoną kontrolę nowych źródeł. Każdy retry i naprawa odpowiedzi w planie kosztu. Zachować działający prompt cache i reuse, rozliczając model/TTL/input/cache write/read/output; historycznych wpisów nie przepisywać. Usage nie jest fakturą ani aktualnym saldem dostawcy.

Klucz tylko na hoście z istniejącego sekretu, nigdy w Git, APK, logach, JSON i ZIP. Pilot za flagą/tokenem do pomiaru. Brak sekretu blokuje live, nie kod i replay; faktyczny brak dowodu jawny. Nie kupować nowej usługi obrazowej. Statusy integracji hosta, jakości domu, assetów APK i UI urządzenia odrębne. Koordynator nie wydał płatnego Claude API podczas audytu ani przygotowania paczki START.

### 7.7 Kompletność elewacji i dokładność otworów — v3.54.5

Każdy wymagany dostępny widok ma sourceId/hash, rolę, wariant, transformację i stan wysłania, odczytu, przypisania oraz zbudowania. Rozróżniać brak źródła, brak odpowiedzi, nieczytelność i faktyczną ślepą ścianę. Program porównuje inwentarz z odpowiedzią i celowanie uzupełnia braki. Cztery rekordy tej samej strony nie zaliczają czterech elewacji. UNKNOWN nie jest sukcesem ani poleceniem skasowania istniejących elementów.

Otwór ma własny host/poziom/typ, środek lub zakres, szerokość, wysokość i dolną rzędną, z pochodzeniem każdej wartości. Panele i skrzydła nie są automatycznie osobnymi wycięciami. Nie wolno cicho zmniejszać otworu, by usunąć konflikt kompilacji. Mała korekta numeryczna ma tolerancję i ślad; większa wymaga dowodu lub jawnego przybliżenia. Powiązane zmiany są atomowo walidowane na całym kandydacie, z baseRevision i idempotencją. Końcowy wymiar i rzeczywiste wycięcie w ścianie są sprawdzane po kompilacji.

LOCAL i H podlegają tym samym źródłowym ograniczeniom. Znak z przekroju nie wymaga obecności publishedHeight na stronie, ale wymaga poprawnego znaczenia i wiązania. Wysokość nad terenem, rzędna względem ±0,00, poziom stropu i kalenica są oddzielne. Licznik brakujących detali nie może zachować sprzecznej wysokości jako poprawnej. Rollback nie kasuje nowego faktu ani nie nadaje staremu błędowi statusu zgodności.

Zastąpienie zewnętrza nie usuwa po cichu wnętrz, stabilnych ID, kosztów i dokumentów. Przed użyciem starych wnętrz w nowym obrysie trzeba sprawdzić zgodność; w razie konfliktu zachować wcześniejszą rewizję i wskazać zakres nieprzeniesiony. Uniwersalny merge części modeli nie jest warunkiem tej kampanii.

### 7.8 Sprawdzanie oddanej sceny i powtarzalność

Dla każdego ważnego rozjazdu zachować źródło i region, wysłany materiał, odczyt, interpretację, przypisanie, parametry buildera, wynik kompilacji i wersję oddaną. Raportować miejsce pierwszej utraty. Do izolowania modułów używać zapisanych odpowiedzi i pojedynczego sprawdzonego podstawienia. Licznik obserwacji, udana operacja i zmiana rzeczywistej geometrii wymagają osobnych dowodów.

Weryfikować oba skompilowane modele tymi samymi ograniczeniami dla porównywalnych źródeł. Po zmianie przypisania bryły lub ściany przeliczyć geometrię zależną. Ostateczną geometrię sprawdzić po ostatniej decyzji i po wczytaniu. Jeśli zarejestrowanie elewacji jest niemożliwe, zachować powód i stan niepewności.

Spójność zapisu dla kolejnej analizy wiąże wariant, odcisk pakietu i wersje będące częścią kontraktu geometrii. Ponowne użycie zaakceptowanej rewizji w granicach uprawnień ma odtwarzać zapisany dom. Świeży odczyt może dać inny wynik, który zapisuje się jako osobnego kandydata. Uprawnienia i rozdzielenie prywatnych edycji obowiązują także w ścieżce ponownego użycia.

### 7.9 Recenzja elewacji i potwierdzenie naprawy

Dla każdej dostępnej strony zapisać skojarzenie obrazu ze sceną, rewizję i sposób rejestracji. Porównanie obejmuje kształt brył, wnęki i elementy charakterystyczne, kształt oraz przypisanie otworów, a osobno materiał i kolor. Wada ma region i dowód. Jej rozstrzygnięcie wskazuje nową obserwację lub korektę z adresatem, potrzebne zbliżenie albo ograniczenie. Jeśli źródło i zakres pozwalają na naprawę, zastosować ją do programu, odbudować geometrię i sprawdzić efekt na tej samej elewacji. Nierozwiązana ważna wada wpływa na status oddanej sceny. Zmieniony hash i komentarz recenzenta są pośrednim dowodem.

Dla braku otworu na odrzuconej ścianie zacząć od poprawnego hosta. Wyznaczyć ciągłość ramy szczytowej, przebieg lica i cofnięcie loggii przed doborem jej stropu, szklenia i balustrady. Nie nadawać nieudokumentowanej głębokości ani podpór. Elementy cienkie, grube i wykończenie mogą mieć podobny kolor, ale mają różne skutki dla geometrii. Porównać kandydatów po kompilacji oraz rewizję oddaną po selekcji. Zapis zaakceptowanej rewizji przechowuje też status jakości i powody ograniczeń.

### 7.10 Zgodność parametrów z geometrią

Dla ważnej cechy odczytanej ze źródła śledzić wartość surową, znaczenie i jednostkę, pole po parsowaniu, geometrię uzgodnioną, parametr programu i wartość zbudowaną. Domyślna wartość nie przesłania obserwacji. Dane nieobsługiwane zachować z powodem. Typ balustrady, niezależny zakres nóg, kontury ramy i rzędne głowic są przykładami parametrów wymagających rzeczywistego konsumenta.

Obecność elementu jest jednym z pomiarów. Poprawna rama wymaga kontroli wewnętrznego i zewnętrznego konturu, szerokości pasów, styków i zakończeń. Poprawna loggia wymaga właściwego zakresu, cofnięcia i relacji z elementami na innych wysokościach. Poprawna balustrada uwzględnia wypełnienie. Pomiar regionalny recenzji odpowiada właściwości wskazanej w wadzie. Nowa recenzja używa aktualnej rewizji i renderu, a ślad odróżnia wykonanie operacji od wykazanej poprawy geometrii.

### 7.11 Wspólne ograniczenia metryczne i dokładne kontury — v3.54.9

Raw obserwacje API pozostają oddzielone od uzgodnionej geometrii house.json. Przed przyjęciem geometrii kontrolować jednostki, obiekt i lica wymiaru, końce, sumy łańcuchów, skale widoków oraz zasięgi. Wymiary korpusu, całego domu, wysunięć, dachu i działki mają odrębną semantykę. Wymiar działki nie kalibruje osobnej grafiki rzutu. Odcinek wyliczony proporcjonalnie ze skalibrowanego rzutu jest DERIVED z wzorem i niepewnością. Wysunięcie przed lico, szerokość widoczna i wysokość nie są zamiennymi wymiarami.

Odczyt semantyczny wskazuje właściwy kontur, a lokalizacja w oryginalnym rastrze może go doprecyzować. Zachować odwracalną transformację crop/resize, właściwe krawędzie i niepewność rastra. Krawędź cienia, szkła, otworu i ramy wymaga rozróżnienia. Nie wytwarzać metryki przez dowolne rozciągnięcie osi ani z niekalibrowanej perspektywy. Kotwice niewykorzystane do dopasowania sprawdzają wynik, jeżeli są dostępne.

Skośne przeszklenie ma host, poziom, lokalny układ ściany i poligon; oba końce głowicy, jej kąt i kierunek są mierzone po kompilacji. Zgodność z parametrem operacji i zgodność parametru ze źródłem mają osobne dowody. IMPROVED może nadal oznaczać błąd poza tolerancją. Recenzja MATCHES nie podnosi jakości wbrew kontroli końcowej; defekt pozostaje otwarty. Poprawne wejście diagnostyczne obejmuje wszystkie oceniane współrzędne, zanim rozstrzygnie się błąd buildera lub odczytu.

### 7.12 Wszystkie kondygnacje i rzeczywiste wnętrza — v3.54.9

Dostępny rzut każdej kondygnacji ma sourceId/hash, skalę i poziom oraz stan pobrania, wysłania, odczytu i budowy. Brak miejsca w requestcie nie jest brakiem źródła. Wspólny house.json obejmuje obrys, przegrody z grubością/licami, poligony pokoi i stref, drzwi/przejścia, schody, pustki i otwory stropowe, z pochodzeniem i niepewnością. Numery/nazwy/pola deklarowane są oddzielne od geometrii. Otwarta strefa nie dostaje nieistniejącej przegrody, a pustka podłogi.

Istniejące poprawne wnętrza mają ochronę i stabilne ID. Ich przeniesienie do poprawionego zewnętrza wymaga sprawdzonego wariantu, lustra, poziomu, skali i zgodności lic. Niezgodne wnętrze podlega naprawie z rzutu, a nie wklejeniu według bbox. Brak wnętrz LOCAL przy dostępnych planach wymaga odczytu i konsumenta; zapis etykiet w JSON nie jest zbudowaniem pomieszczeń. Weryfikacja obejmuje każdy poziom przy ukrytym dachu, nakładkę na rzut, topologię przejść i przekrój schodów/pustek. Recenzja zewnętrza nie weryfikuje wnętrza.

### 7.13 Jednoznaczny kontrakt i fizyczna semantyka stolarki — v3.54.10

Kontrakt narzędzi API, lokalna walidacja, typy i adaptery mają wspólną wersjonowaną semantykę. Warianty dostawcy i fallback nie mogą niejawnie usuwać aktywnych pól. Dane raw zachowują niezmienność; normalizacja i migracje mają ślad. Kolejność kluczy i niepowiązanych obiektów nie zmienia interpretacji ani tożsamości. Kolejność punktów wieloboku pozostaje semantyczna. Źródła, hosty i operacje wiążą się stabilnym ID, nie samą pozycją na liście czy lokalnym numerem picture.

Otwór konstrukcyjny, zewnętrzny kontur stolarki, widoczne szkło i zasłonięcie są odrębne. Oznaczenie drukowane ma rolę wielkości, jednostkę i związany obiekt. Nie przenosi się jego wymiaru wprost na światło szkła. Profile, panele i sposób otwierania są odczytane albo jawnie konwencjonalne. Skośne kontury zachowują pełny kształt i lokalny układ ściany; balustrada przed szkleniem nie wyznacza automatycznie parapetu. Wymiary z rzutów, przekrojów i elewacji są uzgadniane według właściwego znaczenia, z niepewnością.

Świeży odczyt API może różnić się percepcją. Przyjęty, walidowany dokument na przypiętych wersjach daje deterministyczny model. Nowe obserwacje tworzą nowego kandydata. Różnicę pomiaru odróżniać od błędu formatu, hosta, jednostki, indeksu i układu. Powtórzenie odpowiedzi nie daje niezależnego dowodu prawdy.

### 7.14 Strefy elewacji i spójny styl — v3.54.10

API odczytuje granice i role materiałowych stref elewacji, a deterministyczny profil prezentacji mapuje je na spójną uproszczoną paletę. Zachować źródłowe jasne/ciemne/drewniane podziały, dach, ramy i szkło. Jednolity styl nie oznacza jednokolorowego domu ani kopiowania fotograficznych cieni i odbić. Ocena obejmuje poprawność regionu i jego przypisania, nie exact RGB wizualizacji. Kolor nie zastępuje fizycznej geometrii wysunięcia.

Strefa ma host i lokalny kontur z odjętymi otworami oraz źródło/niepewność. Przypisanie materiału nie zmienia obrysu, geometrii stolarki, pokoi i ilości konstrukcji. Dane wykończeń i ich relacje do kosztów pozostają rozróżnione od stylu renderowania. Ważna strefa ma realnego konsumenta i drogę korekty. Test zapisu/wczytania zachowuje przypisanie. Kontrola geometrii korzysta ze stałego neutralnego światła; widok produktowy pokazuje docelowy spójny low-poly.

### 7.15 LOCAL wspomagany warstwami obrazu — v3.54.11

Obok H dostępny jest eksperymentalny wariant API→obserwacje/maski→lokalne przetwarzanie obrazu→LOCAL. API nie dostarcza w nim gotowej metrycznej geometrii domu. Oryginał pozostaje źródłem, pochodna ma hash, pochodzenie, transformację i maskę ważności. Zachować widoczne krawędzie architektury, kreski wymiarowe, tekst i rzeczywiste podziały szkła. Nie odtwarzać zaobserwowanej ściany w regionie okluzji. Syntetyczna granica maski nie staje się dowodem muru. Nie usuwać logo przez zamazanie zachodzących na nie prawdziwych linii bez oceny dowodu.

Porównywać A oryginały, B uproszczony raster i C oryginały z osobnymi kanałami semantycznymi. Ta sama metryka, materiały wejściowe i wersja LOCAL, osobne cache. Ręczne maski badają możliwość metody i mają MANUAL_DIAGNOSTIC; replay i automatyczny nowy odczyt są odrębne. Pochodna ma własną kontrolę zachowania geometrii, a model ocenia się względem oryginalnych źródeł. Nie obiecywać uniwersalnego transferu na podstawie DEV.

Claude Vision wnosi interpretację i współrzędne; edytowany raster tworzy ograniczone narzędzie. Generatywny szkic może być osobnym badanym wariantem tylko z dostępnym narzędziem i budżetem, po sprawdzeniu zmian proporcji, dodanych/usuniętych otworów i linii. Nie zastępuje oryginału ani wiarygodnego obmiaru. Kontrakt współrzędnych uwzględnia także faktyczny resize/padding modelu dostawcy. Perspektywa wymaga właściwej kamery, nawet po uproszczeniu tła.

### 7.16 Materiał na właściwej powierzchni i APK do porównania — v3.54.11

Strefa wykończenia wiąże się z faktycznym elementem i powierzchnią, a nie automatycznie najbliższą ścianą. Czoło/spód/powrót portalu, rama, ściana cofnięta, płyta i krawędź dachu są osobnymi adresatami. Materiał elementu wystarcza dla jednolitej bryły; różne wykończenia powierzchni wymagają odpowiedniej reprezentacji. Nie tworzy się nowej konstrukcji dla plamy koloru ani nie maluje wszystkich członków jednej technicznej roli tak samo. Poprawność przypisania, granic, fizycznej geometrii i zapis/odczyt mają własne dowody.

Instalator OWNER-a ma rzeczywiste zapieczętowane H oraz oddany LOCAL jako osobne podpisane sceny, dostępne offline. Rewizje i hashe modeli/scen są sprawdzane w assetach wyciągniętych z APK. Nie podmieniać starego modelu nowym podpisem tekstowym. Pokazać istniejące sterowanie piętrami/dachem i materiałami; klucz nie trafia na telefon. Host, eksport scen, pakiet instalacyjny oraz UI na urządzeniu mają odrębne statusy. APK i paczka są przekazywane jako rzeczywiste załączniki, sama lokalna ścieżka nie jest dostawą.

### 7.17 Kontury wyglądu i arbitraż właściwości — v3.54.13

Odczyt wykończenia przechowuje kontur/maske, klasę, źródło, właściwy układ i niepewność. Region o wspólnej granicy między piętrami nie jest kilkoma niezależnymi prostokątami bez kontroli styku. Lico, czoło, spód, rama i płyta mają odrębne hosty. Kontur wizualny nie zmienia automatycznie geometrii obmiaru; nowa powierzchnia renderująca może zmieniać siatkę wyglądu przy identycznym fingerprint geometrii użytkowej.

Przy zastosowaniu pomocniczego obrazu zachować właściwe, potwierdzone parametry źródłowe. Zmiana jednostki, hosta, zakresu lub rewizji wymaga ponownego uzgodnienia; kolor sam nie zastępuje wysokości otworu albo kierunku zawiasu. Jeśli szkic ujawnia błąd niepewnego LOCAL, powstaje sprawdzany kandydat, nie automatyczny zakaz korekty. Kanoniczna obserwacja i wersja kodu dają powtarzalny model; nowy odczyt AI ma osobną rewizję i nie nadpisuje przyjętego wyniku w cache.

### 7.18 Wykończenie pod zasłonięciem — v3.54.14

Źródłowa obserwacja widoczności oraz fizyczna powierzchnia do wykończenia są odrębne. Dopuszczalne mapowanie warstw/głębi zachowuje materiał prętów i balustrady, a głębsza ściana ma własny ciągły region. Nie wystarczy ignorować szkło: pręty też mogą wycinać komórki najbliższego trafienia. Nie wolno jednak pomijać dowolnego pełnego muru, przenosić koloru przez otwory ani zabarwiać najdalszej przypadkowej powierzchni. Sprawdzać widok po obrocie i ujawnieniu ściany.

Kontynuacja materiału w obszarze zasłoniętym wymaga tego samego hosta i poparcia źródłem; ma jawny status wywnioskowania. Rzeczywista granica za balkonem nie jest automatycznie wygładzana. Krawędź płyty może wymagać osobnego wykończenia bez zmiany jej formy. Przykład znanego domu służy przyczynie i regresji; zakres uogólnienia ustala kolejna próba na innych źródłach.

### 7.19 Metryka przed i po LOCAL — v3.54.14 R2

Wersjonowana obserwacja wymiaru przechowuje tekst drukowany, wartość/jednostkę, obraz i hash, końce wymiaru, kondygnację, zakres (całość/korpus/pomieszczenie/otwór), odniesienie do lica/osi i jawne pochodzenie PRINTED/DERIVED/ESTIMATED/UNKNOWN. API najpierw czyta źródło bez podglądu wartości LOCAL. Druga kontrola dostaje tabelę LOCAL i oznaczone źródłowe linie, zwraca wynik per parametr i dowód; nie zatwierdza całego domu jednym MATCHES. Resolver i finalny pomiar sceny rozliczają każdą przyjętą korektę.

Odczyt proporcjonalny wymaga właściwej płaszczyzny, skali i kotew; wymiar działki lub perspektywa fotografii nie kalibrują automatycznie wszystkich elementów budynku. Jedna skala dla rysunku metrycznego, z kontrolą zniekształceń; jawne, oddzielne rejestracje źródeł. Niepewna hipoteza nie nadpisuje potwierdzonego wymiaru. Uzgodniona korekta skali unieważnia zależne pomiary i rejestracje, które trzeba przeliczyć. Wspólna wartość użyta do skali i jej własnej kontroli nie jest niezależnym potwierdzeniem.

### 7.20 Kolorowe szkice jako pomoc formie i test nowej rodziny — v3.54.14 R2

L0, L-M i L-MS używają tych samych źródeł; L-MS zachowuje pakiet metryczny L-M, by oddzielić efekt szkiców. Kontury API w oryginalnej ramie są renderowane lokalnie do czterech uproszczonych elewacji, sprawdzane na kotwach i dużych elementach. Wariant L-MS przekazuje je lub ich równoważną semantykę do rzeczywistego czytnika formy oraz wykończeń. Brak konsumenta kształtu to nazwana luka implementacji, nie pozytywny wynik samych kolorów. Testy rozróżniają brak ramy, przesunięcie otworu, inną paletę i złą proporcję. Oryginały i metryka są zachowane.

Bakopy są DEV. Nowy prosty dom dobiera się przed wynikami według kompletności źródeł i braku udziału rodziny w rozwoju; nie według poprawności pierwszego modelu. Zamrożony pierwszy wynik stanowi ograniczony test uogólnienia, nie szeroki dowód transferu. Rozpoznawalna miniatura dopuszcza drobne uproszczenia, lecz jawnie odróżnia pomiar rzeczywisty, przybliżenie i brak. Wnętrze z oryginalnych rzutów pozostaje niezależnym zadaniem; cztery dobre elewacje go nie potwierdzają.

### 7.21 Kontrakt odczytu i brak utraty danych — v3.54.15

Składnia odpowiedzi, jej kanoniczna postać i prawdziwość źródłowa są trzema oddzielnymi kontrolami. Stosować wspierane wymuszanie schematu dostawcy i niezależną pełną walidację lokalną. Historyczna jednoznaczna krotka może być normalizowana z wersją i śladem; nieznany format wymaga naprawy albo odmowy, nie zniknięcia faktu. Wyłączenie domyślnych retries dostawcy nie zastępuje zaplanowanej obsługi brakującej/uciętej odpowiedzi w aplikacji. Niepełny obiekt zachowuje informację o brakach, nie staje się pełną obserwacją przez walidację dopiero po odfiltrowaniu pól.

Rejestr zdolności przechodzi od źródła do finalnej sceny: wspierany odczyt, kontrakt, resolver, model, konsument, pomiar. Fakty geometryczne i prezentacyjne mają odrębne zastosowania. Każde przyjęcie istotnego faktu wymaga efektu lub nazwanej odmowy w modelu; NOT_CONSUMED nie znika w ogólnym MATCHES. Uzupełnić rzeczywiście brakujące informacje potrzebne do formy i wnętrza, zamiast wymagać od API coraz dłuższego luźnego opisu.

### 7.22 Uzgodnienie niepewności według właściwości — v3.54.15

Wystarczające świadectwo pochodzi z faktów i relacji źródła, nie z samej liczby czytników. Rozróżniać LENGTH, LEVEL, ANGLE, AREA, zakres bryły, otwór konstrukcyjny i widoczne szkło; dodać konsumentów do zależnych parametrów. Forma dachu, oś kalenicy, rozpiętość i właściwy poziom okapu warunkują wyprowadzenie wysokości z kąta. Zgodne niezależne fakty umożliwiają korektę tam, gdzie LOCAL nie ma odpowiedzi, lecz sprzeczność pozostaje jawna. Nie wybierać najwyższego napisu jako kalenicy bez semantyki i nie stosować reguły prostokąta/pola do domu o niepotwierdzonym obrysie.

Zmiana parametru przelicza zależności, hosty, geometrię i wnętrze. Niepewność części dachu nie blokuje wszystkich obserwacji koloru, jeśli kolor ma zweryfikowany host i rejestrację; niepewna rejestracja nie jest jednak pomijana. Zły format, brak źródła, brak konsumenta, sprzeczny pomiar i zła proporcja mają różne reason codes i różne dalsze działania. Miniatura nadal dopuszcza przybliżenie, obmiar wymaga własnej jakości.

### 7.23 Szkice jako sprawdzalna dostawa i informacja formy — v3.54.15

Nie porzucać minimalistycznych kolorowych elewacji. Cztery widoki zachowują uproszczoną tożsamość domu i duże kształty, bez drzew, odbić, tekstur i przypadkowych cieni. API kontury renderowane lokalnie mają jawne pochodzenie. Ocena obejmuje pełne kontury i istotne pozycje/kąty otworów; sama liczba elementów/bbox nie wystarcza. Rzeczywisty otwór pominięty przez LOCAL może zostać dodany z dowodem — nie wymagać zgodności ze złą bazą. Każdy finalny ZIP zawiera osobne obrazy szkiców wszystkich ocenianych stron, oryginalne źródła lub ich jednoznaczny pakiet odniesienia, wersję surową/kanoniczną, decyzje i czytelną galerię. Odrzucone i niepełne szkice również widoczne, nie zastąpione dobrymi ręcznymi rysunkami.

### 7.24 Prompt cache i koszt — v3.54.15

Wdrożyć cache stabilnego prefiksu w rzeczywistym transporcie API, zgodnie ze wsparciem modelu i SDK; stałe tools/system/schema przed zmiennymi obrazami, cropami i ID rund. Nie powiększać promptu sztucznie dla wyniku hit-rate. Różne obrazy nie stają się jednym trafieniem przez podobieństwo. Mierzyć cache creation/read, zwykły input, output, TTL, model i latencję; próba cold/warm oraz zmiana prefiksu mają kontrolowany koszt. Wygasły cache lub zbyt krótki prefiks nie jest błędem geometrii. Reuse aplikacji to osobny zapis wyniku bez API; nie wolno używać starej odpowiedzi jako recenzji zmienionej sceny.

### 7.25 Jeden wykonawca wspieranych korekt — v3.54.16

Wykorzystać istniejący model kanoniczny, komendy oraz semantykę korekt house/review w aktualnej ścieżce konsultanta. Wspólny rejestr capabilities generuje dopuszczalne operacje promptu, walidację i dispatch do rzeczywistych konsumentów. Nie przełączać dobrego LOCAL na pełny gorszy opis H tylko po to, żeby skorzystać z jego operacji; adapter musi zachować ID, wnętrze, relacje i parametry niezwiązane z poprawką. Nie budować trzeciego konkurencyjnego modelu danych. Obserwacje źródłowe i zbudowany model pozostają oddzielne, ale powiązane ID/dowodem.

### 7.26 Korekta komponentu względem źródła — v3.54.16

Patch ma baseRevision, target/host, klasę operacji, parametry/jednostki, pochodzenie i warunki. Walidator porównuje ze źródłem i ograniczeniami, kernel wykonuje poprawkę na kopii, przelicza zależności, a pomiar sprawdza efekt i ochronę niezwiązanych faktów. Poprawki niezależne mogą być przyjmowane osobno; zależne tworzą jawną grupę transakcyjną. Zmiana źródłowo uzasadniona może poprawić błędną geometrię LOCAL, także poza dawną tolerancją zgodności z bazą. Obiekty szkicu mają bezpośredni semantyczny kanał do operacji, nie jedynie stratne narysowanie i ponowne rozpoznanie.

### 7.27 Jakość niezależna od ukończenia i reuse — v3.54.16

CAN_REUSE nie znaczy SOURCE_VERIFIED. REVIEW_COMPLETED nie znaczy MATCHES. Częściowy model może być użyteczny, ale status i lista defektów pozostają na scenie, zapisie i ponownym użyciu. NO_CONSUMER dla krytycznej operacji w uzgodnionym zakresie nie kończy etapu jako implementacji kompletnej. Recenzja i miara kontrolują finalną rewizję, zakres formy, kolorów/głębi i wnętrz jest jawny. Zatrzymanie pętli przy braku postępu lub limicie jest nazwanym wynikiem, nie pozorną zgodą AI.

### 7.28 Odbiór mechanizmu i uczciwa próba — v3.54.16

Warunkiem live jest wykazany pełny cykl trzech klas korekt oraz bezstratny round-trip bazowego modelu. Kontrolowane błędy mają niezależną prawdę źródłową i kontrpróby błędnej propozycji API. Sprawdzić także brakujący model/rejestrację w fazie ekstrakcji. Dopiero potem zamrozić kod i miarę oraz z góry wybrać niewielki zróżnicowany pakiet publicznych nowych źródeł. Współczynniki nie są dostrajane po obejrzeniu próby; warianty porównywane na tej samej rewizji. Przybliżenie miniatury, dokładność metryczna i nieocenione cechy rozliczane osobno.

## 8. Kryteria pomiaru i odbioru

**Aktywny odbiór v3.54.16.** Aktywny konsultant wykonuje zadeklarowane typowane korekty poprzez istniejący model/komendy i adapter bezstratny dla niezwiązanych części LOCAL. Działający pełny cykl dodania źródłowego okna, naprawy kontrolowanego złego otworu i niezależnego przyjęcia poprawnego komina przy odrzuceniu złego patcha okna; poprawne źródło może wygrać z błędną bazą. Istotne parametry/hosty mają rzeczywisty trace, ADMITTED i przyczynowość naprawione. Ekstrakcja obserwacji nie wymaga gotowego modelu; szkice pozostają osobną dostawą i nie gubią JSON-a. Końcowy recenzent i miernik sprawdzają nową rewizję w zadeklarowanym zakresie; statusy jakości, częściowości i reuse rozdzielone. Kontrolowane błędy/kontrpróby, różne realne dane, zamrożona niewielka nowa próba i finalny host na jednym kodzie. E2E integracji i test jakości osobne. Rzeczywisty APK oraz ZIP ze szkicami i źródłami. Brak jednej krytycznej operacji tego etapu albo brak dowodu finalnego efektu oznacza wynik częściowy, nie IMPLEMENTATION_COMPLETE. Pułap księgi nadal 28,854612 USD.

**Historyczny odbiór v3.54.11.** Trzy osobne wyniki: (1) dostarczony APK arm64 z rzeczywistym H v35410 i oddanym LOCAL, poprawnym podpisem/wersją i hashami scen oraz jawnym statusem weryfikacji UI; (2) sprawdzone przypisanie i granice materiałów fizycznych elementów, szczególnie czoła/spodu portalu, oraz rozstrzygnięty konflikt scorera z geometrią; (3) porównanie LOCAL A/B/C na tych samych źródłach, z kontrolą zachowania geometrii obrazów, błędnych dodatków i kosztów. Zdolność prymitywu, odczyt z obrazu i efekt finalnego modelu są odrębne. Podbitka i podpory mają pomiar źródłowy albo jawny brak; nietypowa forma nie jest dopowiadana z konwencji. Historyczne wyniki pozostają zapisane, poprawiony scorer nie zalicza naprawy modelu. Jakość H i modelu oddanego osobno. Brak nowej próby ogranicza dowód transferu.

Statusy IMPLEMENTATION_COMPLETE, SOURCE_FLOOR_COVERAGE_VERIFIED, INTERIOR_GEOMETRY_VERIFIED, FACADE_COVERAGE_VERIFIED, OPENING_GEOMETRY_VERIFIED, SELECTION_VERIFIED, HOST_INTEGRATION_VERIFIED, QUALITY_GAIN, TRANSFER_EVIDENCE i ANDROID_VERIFIED mają własne dowody. Brak transferu nie nakazuje usunięcia działającej implementacji za flagą, ale nie uzasadnia powszechnego rollout. Model ze znanym istotnym brakiem pozostaje częściowy, nawet gdy ogólna tolerancja zasięgu jest spełniona. Metryki dachu obejmują charakterystyczne cechy, hosty i połączenia, nie tylko oś głównej kalenicy.

Sprawdzić mierniki przed oceną: reprezentacje kalenicy roofs/roofPlanes/roofEdges, osie/lustro, jednostki, semantyka obrysu oraz zgodność grup porównania. Korekta błędnej referencji/scorera jest osobnym wynikiem, nie poprawą analizatora. Pełna recenzja czterech stron nie potwierdza niepokazanych wnętrz. Sama liczba otworów, zgodny bbox lub dobry kolor nie zaliczają ich położenia i geometrii. Metryki użyte do przyjęcia poprawki nie mogą być jej jedynym niezależnym testem końcowym.

Najpierw referencje ze źródeł, zakres, niepewność i podział całymi projektami/rodzinami. Transformacje i kopie rozdzielczości nie są niezależnymi domami. Zbiór wykorzystany do strojenia nie pozostaje ślepym testem; pierwszy wynik zachować.

Pomiar oddziela:
- raw OCR, normalizację/korektę i jednostkę;
- tekst→linia→końce/lica→obiekt/host/poziom;
- element i relację źródłową, stan zbudowania i poprawność sceny;
- mapę/skale na niezależnych punktach niewykorzystanych do jej wyznaczenia;
- pominięcia, dodatki, UNKNOWN, brak modelu, czas/pamięć i koszt.

Jednoznaczne przypisanie i rzeczywista tożsamość elementu są obowiązkowe. Sam zbiór poprawnych liczb na arkuszu, równość wysokości lub zgodna suma pól nie zaliczają mapowania. Round-trip i skorelowana drabina nie potwierdzają bezwzględnego zera.

Dotychczasowe progi pozostają, z rozdzielonymi definicjami: role widoków — macroF1≥95% na zadeklarowanych klasach; kompletne poprawne przypisanie —≥95% zamrożonych referencji one-to-one, z poprawnym tekstem/znaczeniem i wymaganymi dla danego rodzaju odczytu linią/końcami/hostem oraz finalnym zastosowaniem; liczby — exact-match≥98% w pokrytych przy≥90% pokryciu czytelnych referencji. JawneN, klasy, abstention i NO_MODEL pozostają w odpowiednim mianowniku. Coarse FRONT/REAR/SIDE nie zalicza dokładnegoL/R lub regionów. Historyczne wyniki/scorery zachować bez zmiany; doprecyzowanie nazwy metryki nie przelicza historii. To cele umiejętności, nie obietnica każdej dokumentacji lub blokada każdej lokalnej poprawki. Nie obniżać progów po porażce i nie zaliczać pełnego zakresu wąskim proxy.

W LINK osobno podawać: dostępność/pobranie źródła; powstanie kandydata; poprawność skali; poprawność obrysu i relacji brył; dachy i poziomy; pokrycie charakterystycznych elementów. Do kontroli jakości używać referencji niezależnych od danych, którymi dopasowano model. Dopasowana powierzchnia lub szerokość nie potwierdza sama siebie. Wynik 6/18 z 1327 oznacza wygenerowanie modeli w pierwszych ślepych przebiegach, nie 6 poprawnych domów. Istotne naruszenie grafu, zła skala i nieuzasadniona wnęka nie mogą zniknąć pod pozytywnym licznikiem modelu. Grupa testowa przestaje być ślepa po obejrzeniu jej błędów.

Dla pomieszczeń sprawdzać obrysy źródłowe i finalne poligony w tej samej ramie kondygnacji. Raport obejmuje brakującą i nadmiarową powierzchnię obrysu ścian, odchylenia charakterystycznych narożników, dopasowanie poligonów pokojów, błędy pola poprawnie dopasowanych pokoi oraz brakujące, błędnie scalone i podzielone pokoje. Przypisanie numerów i nazw oraz geometria są osobnymi kryteriami. Zgodność sumy m² nie potwierdza podziału. Porównywać tylko równoważne definicje pola, uwzględniając rzeczywiste przegrody, podcienia i pustki.

### Oczekiwane wyniki analizatora

| Obszar | Oczekiwanie | Dowód |
| --- | --- | --- |
| Materiał i rejestracja | Poprawny projekt, wariant, odbicie, kondygnacja i rodzaj widoku. Wspólna rama rzutu, elewacji i przekroju tam, gdzie dane na to pozwalają. | Trafność klas, rejestracja na niezależnych kotwicach, lista brakujących i sprzecznych widoków. |
| Wymiary i poziomy | Liczba z jednostką i właściwym znaczeniem jest powiązana z licem, obiektem i kondygnacją. | Odczyt, kompletne przypisanie i błąd w scenie mierzone oddzielnie. Weryfikacja wymiarów, które nie ustaliły skali. |
| Bryły, ściany, podłogi | Wszystkie poparte źródłem zamknięte części mają poprawne lica i podłogę. Podcień, taras i pustka zachowują właściwy typ. | Nakładka na rzut, brakująca i nadmiarowa powierzchnia, przesunięcia lic, pokrycie kondygnacji i przyczyny odmów. |
| Pomieszczenia | Właściwe poligony i topologia przejść. Strefa otwarta może mieć kilka etykiet ze wspólną geometrią i jednokrotnie policzonym polem. | Osobno zgodne poligony, strefy otwarte, scalenia, podziały, braki, nadmiary, błąd pola, poprawny numer i przypisanie. |
| Otwory i połączenia | Typ, ściana, pozycja, szerokość, wysokość, próg lub parapet wynikają z właściwych źródeł. | Porównanie każdego zmienionego otworu po kompilacji i kontrpróby zachowania otworów przy korekcie lica. |
| Dach, elewacje i dodatki | Właściwy zasięg połaci i ich styki, kalenice, garaż, uskoki, podpory, wnęki, podcienia i balkony. | Widok z góry i elewacje ze sceny, porównanie poziomów oraz wskazanie braków, dodatków i konfliktów kompilacji. |
| Wiarygodność i użycie | Obserwacja, pochodzenie, założenie i zastosowana geometria są jawne. Wiarygodność obmiaru jest oceniona dla konkretnego elementu i pola. | Rejestr niepewności i odmów, porównanie modeli, czas/pamięć, odrębny status hosta i Androida. |
| Zakres uogólnienia | Reguły geometryczne działają na różnych układach. Deklaracja zakresu odpowiada formatom, kondygnacjom i rodzinom faktycznie sprawdzonym. | Zamrożone referencje, próby świeże i kontrpróby, pierwsze wyniki zachowane, odmowy w mianowniku pokrycia. |

Wynik „model się wczytał”, wynik „wierna geometria” i wynik „wystarcza do obmiaru” wymagają własnych dowodów. Kontroluj tożsamość i kształt przed zaliczeniem pola. Punkt w poligonie z podobną liczbą m² jest przydatnym wskaźnikiem, którego zakres należy nazwać. Tolerancje geometrii ustal przed oceną z uwzględnieniem skali, jakości źródła i znaczenia cechy.

Wynik techniczny przebiegu, pokrycie modelu i przydatność do obmiaru są osobnymi osiami. Dla pominiętej zamkniętej części, niezweryfikowanej skali, sprzeczności źródeł lub błędów kompilacji udostępniać odbiorcy stan i powód w zakresie dostępnego dowodu. Przebieg może się ukończyć z modelem częściowym. Raportować jakość per model i właściwość, także gdy pole ogłoszone pasuje do obrysu.

Odbiór EXTERIOR-COMPLETE porównuje cztery strony, górę i perspektywy finalnej sceny z właściwymi źródłami. W zakresie jawnej próby brak znanych istotnych pominięć, nieuzasadnionych dodatków, odmów budowy architektury i ERROR kompilatora pomijających cechy. Bazowy błąd nie jest usprawiedliwieniem gotowości. Cały dom, nie punktowy wynik starej sprawdzarki, jest celem.

## 9. Praca, testy i dostawy

Prompty zlecają wynik i granice, nie listę obowiązkowych funkcji do edycji. Wykonawca może zakwestionować diagnozę na dowodzie. Refaktor zachowujący zachowanie i zmiana jakości rozpoznania mają osobne kryteria: byte-identical nie jest celem poprawki semantycznej.

Testy adekwatne do zmiany i szybkie próby częściej; pełna macierz na spójnym checkpointcie. Nie uruchamiać pełnego install/test/build/e2e po każdym drobnym kroku bez potrzeby. Testy architektury chronią trwałe własności, nie wieczne pierwszeństwo konkretnego OCR lub zestaw dawnych literałów.

Tryb pracy ustala aktualne zlecenie: ograniczony etap albo kampania. Dostawa częściowa do próby ma WORK_IN_PROGRESS. Limit sesji to checkpoint z kodem, wynikami, aktualnymi hipotezami i następnym działaniem. Nie wymagać nieskończonej sesji i nie kończyć po samym nazwaniu naprawialnej przyczyny.

Zgodność natywnych bibliotek, pakowania i rzeczywistego runtime sprawdzać na aktualnym artefakcie, zwłaszcza po zmianie zależności. Stary test Filament/rozmiaru strony nie potwierdza wszystkich późniejszych APK; aktualne wymagania platformy i sklepu wymagają świeżej weryfikacji przed wydaniem.

Kolejna istotna dostawa dla OWNER-a ma większy versionCode od ostatnio wydanego, zgodny versionName, podpis aktualizacji i osadzony analizator. Wersje, hashe, program/model, diagnostyka, sceny i źródła są identyfikowalne. Test hosta nie jest testem telefonu; bez urządzenia Android UI pozostaje NOT_VERIFIED.

W repo BuildApp pracujemy na zleconej gałęzi; bez merge/PR, dopóki nie zmieni tego OWNER. ForgeShape pozostaje wyłącznie do odczytu w tym audycie. Nie kopiować stosu renderowania tylko po to, by rozwiązać problem odczytu planu.

### Plansze odbioru i ciągłość sesji

Dostawa zmieniająca geometrię zawiera prywatny ZIP i planszę na dom z czytelnymi kolumnami **ŹRÓDŁO | PRZED | PO**. Na jednej planszy pokazać rzut z obrysem i zaznaczeniem fragmentów dodanych albo utraconych oraz ten sam widok 3D po obu stronach. Dla zmienionego dachu lub otworu dołączyć odpowiednią elewację albo widok góry. Zachować kadry, skalę rysunku, kamerę i render. Wyznaczyć kadr 3D wspólnie dla obu scen i zachować te same parametry kamery, projekcji i skali. Wyłączyć osobne automatyczne dopasowanie. Obok ocenianych widoków 3D zamieścić właściwe elewacje źródłowe lub przekrój, jeśli są dostępne. W miejscu odmowy wpisać jej przyczynę w kolumnie PRZED lub PO. Dać plansze dla istotnie zmienionych przypadków DEV, każdego świeżego przypadku zaliczonego jako przeniesienie i reprezentatywnej kontroli, a spis wyników dla wszystkich domów. Indeks zawiera projekt, rewizje, wersje solvera, skróty wejścia i modelu, werdykt oraz nierozwiązane wady. Git może zawierać generator plansz, manifest, metryki i syntetyczne przykłady. Materiały wydawców i plansze z nimi przekazać prywatnie.

Mało dysku i mało kontekstu to dwie sytuacje. Przed sprzątaniem wykonać spis rozmiarów, zapisać krótki handoff i sprawdzić, które dane są odtwarzalne. Usuwać tylko zidentyfikowane, zużyte produkty przebiegów i odtwarzalne cache, mierząc zysk. Zachować zapieczętowane źródła potrzebne do porównań, referencje, pierwsze ślepe wyniki, wydania, prywatny ZIP, księgę wydatków i podpis aktualizacji. Handoff ma wskazać rewizje, ścieżki, zablokowane sprawy i kolejny krok. Nowa lub skompaktowana sesja wczytuje handoff i potrzebne fragmenty raportów, dzięki czemu duże logi i obrazy nie zajmują całego kontekstu.

## 10. Rejestr aktualnych decyzji

Zachowane dawne ID: **DEC-SOURCE-PROVIDER-AGNOSTIC-001** (§ 3.8), **DEC-SINGLE-IMAGE-FALLBACK-002** (§ 3.7), **DEC-UNIVERSAL-OPENING-CORE-003** (§ 3.7 i § 4). Fallback ze zdjęcia nie odzyskuje dawnego pierwszeństwa; wspólny odczyt zwykłych okien/drzwi/przeszkleń/rooflights pozostaje wymaganiem wielu źródeł. Terminy starych zleceń są historyczne.


| ID | Decyzja | Status |
| --- | --- | --- |
| D01 | Model/polecenia/kompilator zachować jako bazę | Podtrzymana |
| D02 | Strategia OCR i kolejność wnioskowania są odwołalne po porównaniu | Doprecyzowana audytem 1 |
| D03 | Audyt 1–4 zakończony; v3.53 uruchomiono, v3.52 nie uruchamiano | S53 jest checkpointem aktywnej kampanii; kontynuacja nie zastępuje całego zlecenia |
| D04 | C1a/C1b/C2 o ograniczonym zakresie; dalszy wycinek i kolejność według pomiaru | Brak obowiązku SVG-first; wspólna hipoteza zewnętrza dopuszczona bez perfekcyjnego OCR |
| D05 | Nie usuwać kodu jako „martwy” bez sprawdzenia entrypointów i konsumentów | Aktywna |
| D06 | Aktualny plan bez osadzonej pełnej historii; historia osobno | Aktywna decyzja porządkowa |
| D07 | Krótkie CLAUDE, workflow w AGENT_PROTOCOL, produkt w APP_SPEC, semantyka wjednym kontrakcie | Krótkie CLAUDE potwierdzone w 1370a1d; przegląd 1327 nie certyfikuje zgodności wszystkich instrukcji |
| D09 | Pomysły i opisy działania są w bieżącym katalogu; link archiwum nie zastępuje ich znaczenia | Przywrócone w v3.49 na prośbę OWNER-a |
| D10 | Każda właściwość ma własne pochodzenie; konwencja nie dziedziczy etykiety wydruku od innej rzędnej | Doprecyzowanie istniejącej zasady, dowód audytu 2 |
| D11 | Wspólne dopuszczenie korekty, per-param provenance i jawne capabilities | Wdrożone w ograniczonym zakresieC1/C2; braki dostępu/balkonu i pozostałych rodzin pozostają |
| D08 | Dokładne L/R, mixed regions, ściany/słupy/balkony/lukarny nadal wymagają miernika | Otwarte |
| D12 | Utrzymać istniejący kernel; ForgeShape przede wszystkim jako wzorzec stabilnych refs, port dopiero po mierzalnym problemie geometrii | Rekomendacja audytu 3 |
| D13 | Swobodny HouseDescription z v3.54.1 jest historycznym wariantem; nie ma bezwarunkowego pierwszeństwa nad LOCAL | Aktualny pełny opis źródłowy i jego walidacja według D29; Android nadal niepotwierdzony |
| D14 | Brak skali blokuje dokładny obmiar, lecz nie musi kasować obserwacji topologii; kandydat nie jest drugim modelem prawdy | Doprecyzowanie istniejącego wymagania |
| D15 | Oddzielne statusy SLICE/CAMPAIGN/VERIFICATION, checkpoint nie kończy kampanii | Ujęte w nowym protokole i promptcie |
| D16 | Role macroF1, kompletne przypisanie i dokładność/pokrycie liczb mają osobne mianowniki; bez zmiany historycznych wyników | Doprecyzowane w § 8 |
| D17 | Wektory, OCR/CV i AI to dostępne narzędzia; wybór i kolejność po rozstrzygającym eksperymencie | Swoboda metody w zleceniu v3.53, bez pierwszeństwa konkretnego czytnika |
| D18 | Powstanie modelu, jakość skali i jakość całego zewnętrza to różne wyniki | Aktywne doprecyzowanie pomiaru ANY-LINK; bez przeliczania starych wyników |
| D19 | Claude Code prowadzi diagnozę, implementację i pomiar, koordynator otrzymuje raport decyzyjny | v3.54.6: debugowanie, naprawy i sprawdzenie powtarzalności |
| D20 | Historyczne ograniczenie API do lokalnych odczytów i korekt v3.54.2–v3.54.3 | Zastąpione D29; analizator nadal buduje i waliduje |
| D21 | Każda korekta ma rewizję, dowód, konsumenta, przeliczenie i accept/rollback; monitoring ujawnia nadpisanie lub brak efektu | Obowiązkowy dowód integracji, nie tylko poprawnej odpowiedzi API |
| D22 | Sześć DEV i cztery potwierdzające było protokołem v3542 | Zakończony checkpoint; aktualny podział i kryteria określa §2 |
| D23 | Nowa metryka unieważnia i przelicza zależne łańcuchy/rejestracje/geometrię | Wymaganie v3.54.3; surowe obserwacje i niezależne fakty pozostają |
| D24 | Przyjęcie korekty jest zależne od poprawianej cechy, nie wyłącznie od pewności skali | Dach/otwór może się poprawić przy tej samej prawidłowej metryce |
| D25 | Kontrola modelu ma prowadzić do ograniczonej, walidowanej korekty i nowego renderu | Główny wynik kampanii; CAPABILITY_MISSING nie jest ukończonym konsumentem |
| D26 | Znane braki geometrii pozostają jawne, bez ukrywania progiem zasięgu | Osobno podgląd częściowy, zgodność źródłowa i użycie ilości |
| D27 | Rozwój na znanych domach, potem jedna zamrożona próba wielu wydawców | Brak obowiązku nowej próby po każdym roboczym wariancie; pierwszy wynik zachowany |
| D28 | Pełny raport tekstowy w repo, prywatne plansze i źródła poza Git | Link do przypiętego commitu i raportu wystarcza do przekazania koordynatorowi |
| D29 | API może opisać cały dom, wymiary i relacje ze źródeł; uzgodniony house.json prowadzi do istniejącego modelu i kompilatora | Decyzja OWNER-a 17.11.2026; zastępuje zakaz z D20 |
| D30 | Najpierw sprawdzenie buildera ręcznym źródłowym opisem, potem ten sam przepływ automatyczny | MANUAL_DIAGNOSTIC nie liczy się jako automatyczne rozpoznanie |
| D31 | Metry z wydruku dozwolone dla API, pochodzenie i znaczenie per parametr obowiązkowe | LOCAL STRONG i confidence AI nie są samodzielnym arbitrem |
| D32 | Kontrola finalnej geometrii oraz zależności hosta przed przyjęciem cechy | Brak zmiany rozmiaru/utraty modelu nie dowodzi braku szkody |
| D33 | Wspólna rejestracja rzutów, przekrojów i elewacji bez dopasowania do błędnego modelu | Otwory, poziomy, bryły i dachy mają jedną spójną ramę |
| D34 | Każda dostępna wymagana elewacja ma rozliczenie od wysyłki do finalnej geometrii; brak odpowiedzi nie oznacza ślepej ściany | Aktywna v3.54.5 |
| D35 | Dokładność otworu obejmuje host, poziom, pozycję i rozmiar po kompilacji; konflikt nie uzasadnia cichego zwężania | Aktywna v3.54.5 |
| D36 | Wybór LOCAL/H respektuje źródłowe sprzeczności także bez publishedHeight; znany błąd nie staje się poprawny po rollback | Aktywna v3.54.5 |
| D37 | Powiązane korekty otworów są walidowane atomowo, bez utraty ID i relacji projektu | Aktywna v3.54.5 |
| D38 | Wybór LOCAL/H porównuje skompilowane modele tym samym dostępnym dowodem. Końcowa kontrola obejmuje oddaną rewizję | Aktywna v3.54.6 |
| D39 | Ten sam zaakceptowany wariant i przypięta rewizja dają tę samą geometrię uprawnionym zadaniom. Świeży odczyt daje osobnego kandydata | Aktywna v3.54.6 |
| D40 | Ważne różnice elewacji mają obszar i dowód oraz prowadzą do sprawdzonej naprawy albo jawnego ograniczenia oddanej sceny | Aktywna v3.54.7 |
| D41 | Wynik jakości obejmuje formę charakterystyczną, wnęki i kształt otworów po kompilacji. LOCAL i H są oceniane również osobno | Aktywna v3.54.7 |
| D42 | Odczytana właściwość aktywnego zakresu ma ślad do parametru i geometrii. Domyślna wartość nie przesłania obserwacji | Aktywna v3.54.8 |
| D43 | Recenzja weryfikuje geometrię i relacje właściwe dla wady. Istnienie elementu i zmiana hasha są pomiarami częściowymi | Aktywna v3.54.8 |
| D44 | Wymiary mają zakres i lica; proporcje po kalibracji są DERIVED. Wysunięcie pasa wymaga źródła właściwego dla głębokości | Aktywna v3.54.9 |
| D45 | Każda dostępna kondygnacja jest rozliczana od źródła do zbudowanego wnętrza w tym samym modelu, z ochroną poprawnych ID i relacji | Aktywna v3.54.9 |
| D46 | Wykonanie, poprawa, tolerancja i niezależna zgodność źródłowa są odrębne; MATCHES nie unieważnia błędu końcowego pomiaru | Aktywna v3.54.9 |
| D47 | Zmiana schematu ma kompatybilność/migrację; niezmieniona selekcja nie zalicza utraty poprawki w replay. Ochrona rewizji pozostaje | Aktywna v3.54.9 |
| D48 | Jeden wersjonowany kontrakt semantyczny łączy API/walidację/adapter; jednostki, układy i ID są jawne. Kolejność kluczy nie zmienia wyniku | Aktywna v3.54.10 |
| D49 | Otwór konstrukcyjny, zewnętrzna rama, szkło i zasłonięcie mają odrębne kontury/miary; oznaczenie stolarki wiąże się z właściwą rolą | Aktywna v3.54.10 |
| D50 | Źródłowe strefy elewacji są budowane w spójnej uproszczonej palecie; fizyczna forma i materiał mają odrębne kontrole | Aktywna v3.54.10 |
| D51 | Wnętrze z LOCAL nie zalicza odczytu planów API. Brak modelu LOCAL nie oznacza braku dokumentacji. Aktywny zakres obejmuje konsumenta | Aktywna v3.54.10 |
| D52 | APK ma rzeczywisty zapieczętowany H i oddany LOCAL jako odrębne sceny offline; zgodność assetów z modelem sprawdzana po wyciągnięciu z instalatora | Aktywna v3.54.11 |
| D53 | Wykończenie ma właściwy element i powierzchnię: czoło, spód i powrót są różnymi hostami, nie tylko plamą na ścianie | Aktywna v3.54.11 |
| D54 | Porównywać LOCAL na oryginałach i pomocniczych pochodnych/warstwach; oryginał źródłem metryki, okluzja nie jest odtworzoną obserwacją | Aktywna v3.54.11 |
| D55 | Istnienie prymitywu podbitki/słupa/ramy nie dowodzi jego odczytu; miernik wskazuje konkretny element finalnej geometrii | Aktywna v3.54.11 |
| D56 | Rozpoznawalna przybliżona miniatura i wiarygodność obmiaru mają osobne oceny; drobne różnice nie blokują miniatury ani nie stają się pomiarem | Decyzja OWNER-a, aktywna v3.54.12 |
| D57 | Kolorowe przerysowanie całej elewacji jest odrębnym wariantem od maski tła; test przez LOCAL na rzeczywistych obrazach, z jawnymi transformacjami i źródłem metryki | Aktywna v3.54.12 |
| D58 | Oceniać pełne istotne granice wykończeń, ich hosty i ciągłość; komplet poprawnych próbek koloru nie potwierdza całego konturu | Aktywna v3.54.13 |
| D59 | Pomocniczy wygląd nie usuwa potwierdzonych parametrów geometrii; arbitraż per właściwość ma trace i kontrolę źródeł/rewizji | Aktywna v3.54.13 |
| D60 | Kontury/klasy czterech elewacji mają wersjonowany kontrakt; JSON/SVG to oddzielna metoda od generatywnej edycji rastra, z własnym pomiarem i kosztem | Aktywna v3.54.13 |
| D61 | Materiał należy do powierzchni fizycznej także pod balustradą; widoczność jednej kamery nie wycina wykończenia głębszej ściany | Aktywna v3.54.14, wywnioskowane obszary jawne |
| D62 | Marcówki: ograniczona naprawa; Bakopy: znany DEV; po pracach ogólnych zamrozić kod i wykonać pierwszy wynik nowej prostej rodziny | Uzupełnienie OWNER-a, v3.54.14 R2 |
| D63 | Strategia pełnego opisu, konsultanta metryki, generatywnego szkicu i konturów + LOCAL mają osobne wyniki; dobry kolor nie zalicza złej bryły | Aktywna v3.54.14 |
| D64 | API czyta metrykę niezależnie przed LOCAL, potem kontroluje konkretne parametry ze źródłem; resolver i finalna scena rozliczają korektę | OWNER, v3.54.14 R2 |
| D65 | Porównanie L0/L-M/L-MS oddziela wpływ metryki od kolorowych szkiców użytych również do formy; proporcje kontrolowane na oryginałach | OWNER, v3.54.14 R2 |
| D66 | Nowa prosta rodzina wybierana przed wynikami, bez udziału w rozwoju i bez prywatnego H2; pierwszy wynik zachowany, bez zmiany tolerancji po ocenie | Aktywna v3.54.14 R2 |
| D67 | 5 USD nowych wywołań to jeden łączny limit v35414, obejmuje koszty przed R2; stare 0,255748 USD nie blokuje, 76,28 USD nie jest zgodą na wydanie całości | Aktualizacja budżetu OWNER-a |
| D68 | Naprawa komunikacji i zastosowania danych jest ogólna; Ballina to regresja przyczyny, nie wzorzec specjalnych reguł | OWNER, v3.54.15 |
| D69 | Surowy schemat, jawna normalizacja i semantyka osobno; przyjęta informacja nie może znikać w pustych tablicach bez wyniku | Aktywna v3.54.15 |
| D70 | Świadkowie to niezależne fakty źródła; brak odczytu LOCAL nie blokuje z definicji pomocy API; LEVEL/ANGLE mają realnych konsumentów | Aktywna v3.54.15 |
| D71 | Cztery minimalistyczne kolorowe szkice każdego ocenianego domu jako osobne obrazy w ZIP-ie i galerii, także gdy odrzucone | OWNER, v3.54.15 |
| D72 | Prompt cache wdrożony, zmierzony i rozliczony oddzielnie od reuse; kontynuacja w pozostałej części wcześniejszej puli | Aktywna v3.54.15 |
| D73 | Jedna aktywna ścieżka wykonuje realne operacje przez istniejące model/komendy i sprawdzony adapter; nie tworzyć trzeciego modelu ani podmieniać dobrego LOCAL całym H | OWNER po Council, v3.54.16 |
| D74 | O korekcie rozstrzyga źródło; ochrona potwierdzonych faktów nie czyni każdego wyniku LOCAL autorytetem | Aktywna v3.54.16 |
| D75 | Patche i rollback per komponent/zależna grupa; dobra niezależna poprawka nie znika z odrzuceniem innej | Aktywna v3.54.16 |
| D76 | REVIEW_COMPLETED, SOURCE_VERIFIED_IN_SCOPE, wynik częściowy i CAN_REUSE to osobne stany; brak konsumenta krytycznej operacji nie jest sukcesem jakości | Aktywna v3.54.16 |
| D77 | Najpierw pełny mechanizm korekty i kontrpróby na różnych danych, następnie zamrożona nowa kontrola; szkice i semantyczny JSON pozostają równoległymi widokami | OWNER, v3.54.16 |

Etapy 1–4 dały plan i prompt; po nich wdrożono ograniczoneC1/C2 i rozszerzano źródła. Ostateczny wybór strategii inference nadal wymaga pomiaru. Przegląd 1327 nie wdraża nowego kodu. Lokalne sprzeczności podczas retencji rozstrzygnięto jawnie: brutto pozostaje zatwierdzone, paleta zastępuje dawny zakaz koloru, aktualne zlecenie zastępuje dawne NEXT i blokady technologii. Szczegóły w rejestrze retencji.

## 11. Archiwum i ciągłość

[Pełny Master Plan v3.47 — niezmienione archiwum](https://chatgpt.com/library?file_id=libfile_c667bfde9d088191aed727c52f31eec3&account_id=personal), 1 137 546 B, SHA-256 `b0fcc6c0bc71d4cbe6498a52f0711ddcc7b518a38684122a62394260f3b42dfe`.

Archiwum zachowuje raporty, historyczne brzmienie i poprzednie plany. Pomysły i opisy działania są również przywrócone w § 3–7; nie odsyłamy po ich podstawowe znaczenie wyłącznie do archiwum. Jednocześnie nie każemy wykonawcy traktować 15 wersji tego samego rozdziału jako 15 równoczesnych poleceń. Dotknięte wymaganie w razie wątpliwości uzgodnić ze źródłową decyzją i wpisać rozstrzygnięcie w rejestrze.

To porządkowanie dokumentacji i audyt, nie dostawa nowego APK ani zmiana produkcyjna.


## 12. Kontrola retencji v3.49

Porównano pełny v3.47 (1 137 546 B) i skrót v3.48 (18 137 B). Obawa OWNER-a była zasadna: skrót zachował listę dziedzin, lecz zwinął wiele scenariuszy i pomysłów; część redukcji rozpoczęła się już w krótkiej warstwie v3.47. Przywrócono 36 grup opisów, wszystkie 15 nazwanych IDEA z dawnego katalogu i trzy decyzje rozszerzające wejścia/fallback/uniwersalny odczyt otworów.

BuildPlan_Retencja_Pomyslow_v3.49.0.md wskazuje źródłowe linie i mapę P01–P36 do nowego planu oraz rozstrzygnięcia historycznych sprzeczności. Dowody zawierają wierne wyciągi starych rozdziałów bez rekurencyjnego osadzania całego archiwum. Mechaniczny check ID nie jest dowodem równoważności każdego zdania. Zewnętrzne research/wireframes i brakujące fizyczne v3.27/v3.28 nie zostały odtworzone z domysłu. Nie dopisano niepotwierdzonego osobnego modułu magazynu materiałów.

Przy kolejnej redakcji wymaganie otrzymuje miejsce/status albo jawne rozstrzygnięcie. Mniejsza liczba bajtów nie jest kryterium sukcesu. Raport dostawy nie zastępuje katalogu produktu. Przyszły pomysł nie znika bez decyzji OWNER-a i nie staje się automatycznie aktualnym zadaniem.


### Kontrola aktualizacji v3.51

Cały § 3, jego 19458 B oraz 15nazwanych IDEA, jest identyczny bajtowo z v3.50 (i z zachowaną częściąv 3.49). Trzy dawne IDDEC w § 10 i ich powiązania pozostają; rejestrP01–P36v3.49 nadal mapuje pomysły do opisu. Archiwumv 3.47 bez zmian. Uaktualniono tylko status audytu, kolejność wdrożenia, definicje metryk i decyzje; nie usunięto roadmapy produktu.

Wymagania poza § 3 także zachowano: semantyczny indeks budowy, pełne zewnętrze i paleta, kamery/topK, surowe/przyjęte/zastosowane, podgląd na żywo, korekty/undo, offline/prywatność, miary i koszty, neutralność wydawcy i przyszłe wejścia. Zmiany są jawnie opisane w raporcie i kontroli retencji. Nie wklejono raportów ani całych poprzednich planów. Nie deklaruje się odtworzenia niedostępnych dawnych wireframes lub pełnej równoważności każdego zdania wszystkich historycznych wersji.

Audyt zakończony w jego zakresie; nowe umiejętności analizatora, skutecznośćB, wybór OCR i żywa integracja API wymagają dopiero implementacji/pomiaru. Nie powstał nowy APK, wynik benchmarku ani wywołanie płatne.


### Kontrola aktualizacji v3.52

Zachowano cały § 3 identycznie bajtowo z v3.51: 19458 B,15 IDEA i opisy działania, oraz trzy historyczne DEC w § 10. Rejestr retencjiP01–P36 i pełne archiwum pozostają. Uaktualniono stan wdrożenia i zakres ANY-LINK, oddzielono powstanie modelu od jakości, doprecyzowano następne porównanie SVG/AI i istniejącą księgę budżetową. Zdanie o wcześniejszym priorytecie ARCHON w nieedytowanym katalogu rozstrzyga jawnie nowszy § 2. Historia kontroliv 3.51 opisuje ówczesny audyt, nie aktualny stan implementacji.

Nie usunięto kosztów, dokumentów, PROJECT/AS-BUILT, modelu low-poly, kamer, podglądu, korekt, backupu, współpracy, portowalności ani pozostałych pomysłów. Nie wklejono pełnej historii ani nowych raportów do planu. Ten przegląd jest tylko odczytem kodu i aktualizacją dokumentów; nie tworzy nowego APK i nie wykonuje API.


### Kontrola aktualizacji v3.53

Zmiana wynika z doprecyzowania OWNER-a 10.11.2026: poprzedni prompt nie został uruchomiony; wykonawca ma mieć pole do samodzielnego rozumowania, wyboru i wdrażania rozwiązań aż do sprawdzonego wyniku. Zastąpiono aktywny porządek SVG-first kampanią z rozstrzygającymi eksperymentami i odbiorem całego domu oraz aplikacji. AI nie jest obowiązkowe; jego rolę wolno rozszerzyć w badaniu po pomiarze, w istniejących granicach danych i budżetu. Rozszerzenie potrzebnej domeny jest dozwolone bez migracji wszystkiego dla samej migracji.

Cały katalog §3, 19458 B i 15 nazwanych IDEA zachowano identycznie bajtowo z v3.52; trzy historyczne DEC i retencja P01–P36 pozostają. Nie usunięto kosztów, dokumentów, PROJECT/AS-BUILT, wyglądu, kamer, korekt, podglądu, backupu, współpracy ani portowalności. Poprzednie kontrole wersji są historią, a bieżącą kolejność określa §2. Zmieniono dokumenty, nie kod; nie uruchomiono eksperymentu, API ani budowy APK.


### Kontrola aktualizacji v3.53.1

Uzgodniono raport checkpointu S53 z kodem i własną próbą ochrony limitu. Zaktualizowano stan uruchomienia zlecenia i księgę, nie nowy zakres produktu lub budżet. Główny promptv 3.53 pozostaje aktywny; osobna kontynuacja określa następne sprawdzalne prace. Nie zakupiono hostingu, nie wykonano API i nie zmieniono repo produkcyjnego.

Cały §3 ma nadal 19458 B, identyczne bajty,15 IDEA i opisy przyszłych funkcji jak w v3.53.0. Trzy historyczne DEC i mapaP01–P36 pozostają. Historia kontroli poprzednich wersji nie jest aktualnym statusem implementacji. Raporty i dowody nie są wklejane do katalogu produktu.


### Kontrola aktualizacji v3.53.2

Zaktualizowano stan po checkpointcie 5ad 2dd 5 i własnych próbach: zamknięto wcześniejsze trzy usterki licznika w sprawdzonym zakresie, dodano odtworzony kontrprzypadek kotwicy obrysu częściowego. Kontynuacja nadal jest częścią głównego zlecenia v3.53. Klient i testy replay mogą być rozwijane przed żywą usługą. Nie zakupiono hostingu, nie wykonano płatnego żądania i nie zmieniono produkcji.

Cały katalog§3 zachowano identycznie bajtowo z v3.53.1: 19458 B,15 IDEA i opisy przyszłych funkcji. Trzy historyczne DEC i mapaP01–P36 pozostają. Starsze kontrole wersji są historią, nie aktualnym NEXT. Budżet 5 USD i granice benchmarków pozostają bez zmian.


### Kontrola aktualizacji v3.53.4

§ 2 odzwierciedla dostawy 1330 i 1331 oraz kolejność dalszych prac. § 4 doprecyzowuje relację dachu, ścian i technicznego podziału. Cały katalog § 3 (19458 B i 15 nazwanych IDEA) jest bajtowo identyczny z v3.53.2. Zachowano trzy historyczne DEC, wcześniejsze kontrole retencji i mapę P01–P36.


### Kontrola aktualizacji v3.53.5

Dodano stan APK 1332 i zakres potwierdzenia w § 2. Obrys ścian i pomieszczenia mają priorytet przed rozszerzeniem dachów wielokondygnacyjnych. § 4 i § 8 doprecyzowują geometrię i pomiar pomieszczeń. Cały § 3 (19458 B i 15 IDEA) pozostaje bajtowo identyczny z v3.53.4. Zachowano mapę P01–P36, trzy historyczne DEC, poprzednie kontrole retencji i pełne archiwum.


### Kontrola aktualizacji v3.53.6

§ 2 uzgodniono z APK 1333 i zleceniem audytu, § 8 uzupełniono o oczekiwania per obszar. Cały § 3 (19458 B i 15 IDEA) jest bajtowo identyczny z v3.53.5. Zachowano mapę P01–P36, trzy historyczne DEC i wcześniejsze kontrole retencji.


### Kontrola aktualizacji v3.53.7

§ 2 uzgodniono z audytem na b1c67ad, § 8 doprecyzowuje trzy osie wyniku. Cały § 3 (19458 B i 15 IDEA) jest bajtowo identyczny z v3.53.6. Zachowano poprzednie kontrole retencji. Zlecenie v3.53.8 zawiera wyciąg § 2, § 4 i § 8 do bezpośredniego użycia.


### Kontrola aktualizacji v3.53.8

§ 2 uzgodniono z APK 1334 i wynikami v3.53.8. Ujęto korektę diagnozy Azolli, 18 nieodzyskanych odmów, naprawę ścianek i zakres pola measurement. Cały § 3 (19458 B i 15 IDEA) oraz pozostałe wymagania zachowano bajtowo. Zlecenie v3.53.9 zawiera aktualne § 2, § 4 i § 8.

### Kontrola aktualizacji v3.53.9

§ 2 uzgodniono z raportem na `39da59d` i APK 1335. Udokumentowano dwie odmowy mniej, trzy odsłonięte błędy kompilacji Anodach, świeży dowód przeniesienia dla bramy oraz ograniczony zakres szklenia. Kolejny priorytet dotyczy zasięgu odczytu ścian na konkretnym boku. Cały § 3 (19458 B i 15 IDEA) zachowano bajtowo. Zlecenie v3.53.10 zawiera aktualne § 2, § 4 i § 8.

### Kontrola aktualizacji v3.53.10

W § 2 uwzględniono wyniki APK 1336, zakres DEV, brak przeniesienia i wady Stellarii. § 7 określa porównanie oryginału, pytania i warstw pomocniczych, a § 9 przywraca prywatne plansze PRZED/PO oraz zapis ciągłości sesji. Cały § 3 (19458 B, 15 IDEA) oraz sekcje 1, 4–6, 8, 10 i 11 zachowano bajtowo.

### Kontrola aktualizacji v3.53.11

§ 2 uzgodniono z APK 1337, raportem na `36ff6f2` i sprawdzoną paczką prywatną. W § 9 doprecyzowano wspólny kadr 3D i widoki źródłowe. Cały § 3 (19458 B, 15 IDEA) oraz sekcje 1, 4–8, 10 i 11 zachowano bajtowo.

### Kontrola aktualizacji v3.53.12

§ 2 uzgodniono z raportem i prywatną paczką 1338. Oddzielono etapy przesiewu i pełnych przebiegów, odzyskanie Wrotycz i kompletność sceny oraz wskazano niejasność kontroli skalą 980. § 3 (19458 B i 15 IDEA) i pozostałe sekcje 1 i 3–11 zachowano bajtowo.

### Kontrola aktualizacji v3.53.13

§ 2 uzgodniono z raportem na `06fc6dd` i prywatnym ZIP-em 1339. Rozdzielono efekty V-SEL, V-TOR i V-JOIN oraz zakres próby Calandivy. Uwzględniono korekty interpretacji 690, odłożenia 980 i 26 niewykonanych testów. § 3 (19458 B i 15 IDEA) oraz sekcje 1 i 3–11 zachowano bajtowo.

### Kontrola aktualizacji v3.53.14

§ 2 uzgodniono z raportem `226c9ac` i sprawdzoną paczką prywatną. Doprecyzowano ścieżkę bundla LOCAL, przyjęcie `690` jako alternatywy oraz granice dowodu D2 i D2b. Priorytetem jest odtworzenie rzeczywistego obrysu przy przeszkleniu z zachowaniem otwartej loggii. § 3 (19458 B i 15 IDEA) oraz sekcje 1 i 3–11 zachowano bajtowo.
### Kontrola aktualizacji v3.54

Na polecenie OWNER-a rozszerzono aktywny zakres z lokalnego obrysu do kampanii całego analizatora i porównania strategii między wydawcami. W §2 zapisano pierwszeństwo nowego zakresu przed historycznym priorytetem ARCHON i backlogiem v3.53. Zachowano pełny katalog produktu oraz wcześniejsze wyniki i ograniczenia. Rozpisano etapy w osobnej analizie architektury. Ta aktualizacja dokumentacji nie oznacza wykonania płatnej próby ani wdrożenia nowego APK.

### Kontrola aktualizacji v3.54.1

Uzgodniono pełny raport v3.54 i mapę modułów z fragmentami aktualnej bramki AI i wejścia LOCAL. W §2 dodano checkpoint i większy etap integracji hybrydowej, w §7 zastąpiono historyczną blokadę 5 USD nową zgodą OWNER-a na próbę przy limicie 100 EUR, z oddzielnym rozliczeniem. Nie wykonano nowych wywołań ani zmian produkcyjnych. §1, cały §3 (19458 B, 15 IDEA) oraz §4–6 i §8–11 pozostają identyczne bajtowo. Historyczne instrukcje budżetowe w opisach poprzednich etapów są historią; obowiązuje bieżący §7.


### Kontrola aktualizacji v3.54.2

+Zmieniono aktywny kierunek zgodnie z korektą OWNER-a: API konsultuje analizator i porównuje źródła z modelem, nie tworzy całego domu. Uzgodniono stan v3.54.1, rozdzielono historyczny globalny opis, odczyt i korektę, dodano pilot narzędzi oraz obszerny raport decyzyjny. Poprawiono walutę autoryzowanego limitu na USD. §3 pozostaje identyczny bajtowo z v3.54.1; zachowano katalog produktu, 15 IDEA i historyczne decyzje. Zmieniono §2, odpowiednie fragmenty §4, §7, początek §8 oraz D13/D19 i dodano D20–D22. Nie uruchomiono w ramach aktualizacji dokumentów API, nie zmieniono kodu produkcyjnego ani nie zbudowano APK. Starsze zapisy o 100 EUR i globalnych strategiach w rozdziałach historii opisują wcześniejsze zlecenia; aktualne rozstrzygnięcie określają §2 i §7.

### Dopisek do v3.54.2 — warianty wyglądu

+Dodano prototyp przejrzystej siatki/krawędzi i trzy inne kierunki wyglądu wraz z ekranem domu i analizą na żywo/replay. Doprecyzowano granicę analizator–viewer i stały profil obrazów do API. Główne zlecenie pilota konsultanta pozostaje bez zmiany. Cały §3 zachowano bajtowo; rozszerzenie prototypowania jasnego wariantu opisano jawnie w §2 i §6.1. To aktualizacja zlecenia, nie wykonany prototyp ani test Androida.

### Kontrola aktualizacji v3.54.3

Uzgodniono raport v3542 wraz z dodatkiem na 258a3a9 i ograniczenia kodu konsultanta. Zmieniono aktywny priorytet, budżet kontynuacji, porównania i kryteria odbioru. Dodano kontrakt spójnych zależności metrycznych, przyjmowanie per właściwość i obowiązek pełnej pętli geometrii; Aksamitki są przypadkiem DEV, a próg 10% nie jest dowodem walidacji. Zachowano produkt, koszty FREE, timeline, dokumenty, PROJECT/AS-BUILT, portowalność, źródłową neutralność i ograniczenie API do konsultacji. Historyczne zlecenia nie zastępują aktywnego zakresu. Zachowano propozycje wyglądu bez ponownego zlecania redesignu. Dokument stanowi plan; implementacja v3.54.3 nie została wykonana przez koordynatora.


### Kontrola aktualizacji v3.54.4 — 17.11.2026

Zaktualizowano aktywny priorytet §2, rolę API w §4, kontrakt §7, odbiór §8 i decyzje D13/D19/D20/D29–D33. Zakaz pełnego opisu zastąpiono źródłowym opisem całego domu, z walidacją i deterministycznym budowaniem. Zmieniono budżet nominalny według raportu v3543, bez zwiększenia pułapu. Wprowadzono diagnostykę poprawny opis→builder, obowiązek śladu wysokości Gracji i ocenę geometrii po kompilacji.

Cały katalog produktu §3 zachowano bajtowo względem v3.54.3: koszty, dokumenty, timeline, PROJECT/AS-BUILT, FREE/PRO, stabilne ID, recovery, neutralność wydawców i pomysły. Zachowano §5–6, §9 i dotychczasowy rejestr historii od §11. Historyczne kontrole opisują dawne wersje, nie nowe wyniki. Ta aktualizacja jest zleceniem i planem, nie dowodem implementacji, uruchomienia API, poprawy modeli ani wydania APK.

### Kontrola aktualizacji v3.54.5 — 17.11.2026

Po ocenie raportu i paczki BuildPlan-V3544-Private.zip OWNER zatwierdził poprawki kompletności elewacji, wyboru LOCAL/H i dokładności otworów. Uzgodniono checkpoint v3544, ograniczenia szerokiego scorera, późniejsze dopytanie i zakres starego host E2E. Zmieniono aktywny §2, budżet §7.6, dodano §7.7, zaktualizowano odbiór §8 i decyzje D19/D34–D37. Pełny katalog produktu §3, §1, §4–6 i §9 pozostają bajtowo identyczne z v3.54.4; starsza historia jest zachowana. Nie wykonano tu zmian kodu produkcyjnego, wywołań API ani wydania APK. Wdrożenie i pomiar zleca prompt v3.54.5.


### Kontrola aktualizacji v3.54.6 — 17.11.2026

Po audycie paczki v3545 zapisano decyzję o debugowaniu i naprawie ścieżki od źródła do oddanej sceny. Skorygowano opis obserwacji 6,71 m w Pliszce na podstawie zapisów BASE_H, NEW_H i replay. Zamrożone wyniki zachowano. Zmieniono §2, §7.6, odbiór §8 oraz D19 i dodano §7.8 oraz D38–D39. Zachowano §1, §3–6, §9 i wcześniejsze wpisy historii.


### Kontrola aktualizacji v3.54.7 — 17.11.2026

Uzgodniono raport v3546, plansze i surowe recenzje Marcówek. Zaktualizowano priorytet, budżet i odbiór. Dodano §7.9 oraz D40–D41. Poprzednie wymagania produktu oraz wcześniejsza historia są zachowane.


### Kontrola aktualizacji v3.54.8 — 17.11.2026

Po ocenie raportu i paczki v3547 OWNER zatwierdził naprawę przekazywania parametrów API do geometrii. Uzgodniono utratę rodzaju balustrady, ograniczenia miernika 16 cech oraz zależności ramy, portalu, loggii i szklenia. Zmieniono §2, §7.6 i aktywny odbiór §8, dodano §7.10 oraz D42–D43. Katalog produktu i wcześniejsza historia są zachowane. Dokument jest zleceniem kolejnej implementacji i pomiaru.


### Kontrola aktualizacji v3.54.9 — 18.11.2026

Po raporcie i paczce v3548 oraz uwagach OWNER-a o wymiarach, braku wnętrza H i kątach tylnych okien zaktualizowano §2, §7.6 i aktywny odbiór §8, dodano §7.11–7.12 oraz D44–D47. Rozdzielono LIVE1 z zapisanym PLAN od świeżego finalnego hosta, wskazano niepełny zakres ręcznej próby głowic i różnicę między IMPROVED a osiągnięciem celu. Księgę zaktualizowano bez zwiększenia pułapu. §1, pełny katalog produktu §3, §4–6, §9, §11 i dotychczasowa historia pozostają bajtowo zgodne z v3.54.8. Przygotowano zlecenie implementacji; nie wykonano tu zmian produkcyjnych, testów analizatora, wywołań API ani APK.


### Kontrola aktualizacji v3.54.10 — 18.11.2026

Po raporcie v3549, tablicach kondygnacji/elewacji i sprawdzeniu kodu 39fec90 OWNER zlecił dopracowanie API na Marcówkach, rozmiaru i kąta okien, materiałowych stref elewacji oraz normalizacji danych. Zmieniono §2, §7.6 i aktywny odbiór §8; dodano §7.13–7.14 i D48–D51. Jawnie rozdzielono import wnętrz LOCAL od niezaimplementowanego jeszcze odczytu wnętrz API, kontury otworu/ramy/szkła i format od wariancji percepcji. Zachowano pułap kosztów. §1, katalog produktu §3, §4–6, §9, §11 i wcześniejsza historia pozostają bajtowo zgodne z v3.54.9. Przygotowano zlecenie implementacji i pomiaru; nie wykonano tu zmian produkcyjnych ani wywołań API.


### Kontrola aktualizacji v3.54.11 — 18.11.2026

Po audycie końcowej paczki v35410 i poleceniu OWNER-a dodano APK do przeglądu, wiązanie wykończeń z powierzchniami elementów oraz eksperyment LOCAL z warstwami obrazu. Wykryto jasny materiał FASCIA i ograniczenie stref do ścian oraz niezgodność historycznego pomiaru spodu portalu z zapisanymi bryłami; rozstrzygnięcie scorera jest zadaniem wykonawcy. Zmieniono §2, §7.6 i aktywny odbiór §8; dodano §7.15–7.16 i D52–D55. §1, katalog produktu §3, §4–6, §9, §11 i wcześniejsza historia pozostają bajtowo zgodne z v3.54.10. Zachowano H oraz wymagania wnętrz, neutralność wydawców i pułap kosztów. Dokument zleca implementację; nie oznacza zbudowanego tutaj APK ani nowych wywołań API.


### Uzgodnienie v3.54.12 — rozpoznawalna miniatura i wznowienie z kompletem wejść

Po doprecyzowaniu celu przez OWNER-a i raporcie przygotowań 41eb90a zaktualizowano §2, aktywny odbiór §8 oraz D56–D57. Dołączono istniejące cztery obrazy do jednej paczki z pełnym planem i promptem. Rozdzielono podobieństwo miniatury od obmiaru; zachowano historię i katalog produktu §3 bajt w bajt. Koordynator sprawdził 52 wpisy manifestu paczki wynikowej oraz self-test narzędzia rejestracji. Nie wykonał tutaj eksperymentu LOCAL, zmian produkcyjnych, nowego APK ani wywołań API.


### Uzgodnienie v3.54.13 — pełne granice materiałów i zachowanie dowodu

Po audycie paczki v35412-REAL i akceptacji OWNER-a zaktualizowano priorytet §2, dodano §7.17, aktywny odbiór §8 i D58–D60. Sprawdzono 1144 wpisy manifestu i porównano modele A/B-both; dane ujawniają prostokątne strefy wyznaczane oddzielnie per piętro oraz utratę korekty bramy 2,20 → 2,75. Pełny katalog produktu §3 pozostał bajtowo zgodny. Zlecono implementację i ograniczony pilot w istniejącej puli, nie podniesiono budżetu. Koordynator nie zmienił produkcji i nie wykonał nowego wywołania API ani budowy APK.


### Uzgodnienie v3.54.14 — warstwy balkonu i drugi przypadek

Po uwagach OWNER-a do stropu i ścian za balustradą dodano zakres ograniczonej poprawki, a następnie zamrożony test znanych Bakop. Uzgodniono §2, §7.6, nowy §7.18, aktywny odbiór §8 i D61–D63. Koordynator przeczytał visibility.ts i consumer.ts na e52d2e8; jednopoziomowa mapa widoczności oraz niepomijane pręty są tropem do potwierdzenia, nie wynikiem testu renderu. Katalog produktu §3 zachowano bajtowo. Nie wykonano tutaj implementacji analizatora, nowej analizy Bakop, wywołań API ani budowy APK.


### Uzgodnienie v3.54.14 R2 — metryka API, proporcje i nowa rodzina

OWNER dostarczył dwa screenshoty z telefonu i rozszerzył cel o realny odczyt i sprawdzenie wymiarów przez API oraz jeden nowy prosty projekt obok znanych Bakop. Zaktualizowano §2, §7.6, dodano §7.19–20, odbiór i D64–67; D62 uzgodniono z nową kolejnością. Włączono wcześniejszy dopisek budżetowy: jeden limit 5 USD na całą v35414, bez zerowania już poniesionych kosztów. Katalog produktu §3 zachowano identycznie bajtowo. Nowe screenshoty są dowodem uwag z urządzenia, nie źródłem wymiarów. Koordynator przygotował zlecenie i paczkę R2; nie zmienił analizatora, nie uruchomił Bakop ani nowej rodziny, nie wydał API ani nie zbudował nowego APK. Wcześniejsze sekcje historyczne zachowują stare budżety jako historię, a bieżący zakres określa R2.


### Uzgodnienie v3.54.15 — ogólna komunikacja, nie jeden dom

OWNER zatwierdził dalsze prace, podkreślając ogólne luki między API i analizatorem oraz obowiązkowe kolorowe szkice w kolejnej paczce. Uzgodniono §2, §7.6, nowe §7.21–24, odbiór i D68–72. Audyt koordynatora zweryfikował 60 wpisów ZIP-a v35414, hash APK i trzy nowe assety, reuse hosta oraz surowe odpowiedzi i kod 228f693. Ujawniono format krotkowy z utratą dwóch ścian i okna, niepełną ścieżkę wysokości/kątów, bramkę zależną od LOCAL i zerowy cache w 14 badawczych odpowiedziach. Raportowane poprawki Marcówek i wyniki pełnych testów pozostają dowodem wykonawcy, nie ponownym uruchomieniem przez koordynatora. Katalog produktu §3 zachowano identycznie bajtowo. Nowa paczka zawiera osiem rzeczywistych szkiców v35414 jako baseline (w tym wadliwy), wzorce stylu OWNER-a i źródłowe dowody. Nie zawiera nowych wyników ani nowego APK; nie wykonano tu implementacji produkcyjnej lub płatnych wywołań Claude API.


### Uzgodnienie v3.54.16 — po Council: wykonawca i kryterium źródłowe

OWNER zatwierdził domknięcie pętli korekt po audycie kodu/danych v35415. Uzgodniono §2, §7.6, nowe §7.25–28, odbiór i D73–77. Audyt potwierdził NO_CONSUMER brakującego okna w finalnym hostowym wyniku, nieprawidłowy cel i niepełny zakres bramek otworów, stratny kanał semantyka→PNG→LOCAL, błędy trace i zbyt szerokie odczytywanie technicznego PASS jako jakości. Wskazał też istniejące operacje w szerszej ścieżce house, więc zlecono integrację zamiast nowego modelera. Katalog produktu §3 zachowano identycznie bajtowo. Koordynator przygotował plan i START, bez nowych poprawek produkcji, budowy APK lub wydatków Claude API. Historyczne wyniki i zamrożenia pozostają; bieżący zakres stanowi to zlecenie.
