# PLANER KOSZTÓW BUDOWY / BuildPlan — MASTER PLAN v3.54.1

Data: 16.11.2026. **Po checkpointcie v3.54 aktywny etap v3.54.1 obejmuje żywy pomiar Claude API, integrację obserwacji z geometrią i odbiór finalnych scen wielu wydawców. Bazą produktu pozostaje APK 1339.**

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

**Aktualna decyzja OWNER-a — v3.54.1, 16.11.2026.** Uruchomić płatne porównanie Claude API oraz wdrożyć działającą strategię hybrydową. OWNER udostępnia klucz z limitem 100 EUR do tej próby; obowiązują nowa księga i granice §7. Etap obejmuje kilka powiązanych modułów aż do sceny i rzeczywistej ścieżki aplikacji. Zlecenie v3.54.1 zastępuje wykonane zlecenie v3.54. Nie kończyć na kolejnym harnessie bez konsumenta ani nowej mikropoprawce resolvera.

**Co wykazał checkpoint v3.54.** Według odczytanego pełnego raportu: 30 projektów / 8 wydawców; LOCAL 14 modeli, 7 używalnych według wąskiej miary. Poza ARCHON: 10 modeli / 21 projektów, 3 używalne wąsko; 11 odmów zatrzymuje się na metryce, a podanie skali ujawnia kolejne błędy obrysu. Na tych samych 12 źródłach zapisane odpowiedzi AI dają 10 modeli / 5 używalnych wobec LOCAL 3 / 1; 4 z 10 modeli AI mają błędy rozmiaru 12–30%. To odtworzenie historycznych odpowiedzi, nie ślepy pomiar live. B na ARCHON, kadry C i szkice D nie zostały zmierzone. V1 odzyskał dwa domy DEV bez nowych odmów, lecz nie wykazał transferu; wycofany, łata zachowana. Produkcja pozostaje na bazie 1339. [Raport v3.54](https://github.com/damiankrok/BuildApp/blob/cd173a7af9cec75e2be7a7e937a993f0907d1882/stage-reports/SOURCE_TO_MODEL_V354.md)

**Potwierdzona bariera integracji.** Kod `drawingsWeaknesses` i `describedFollowUp` ocenia słabość modelu na podstawie ograniczonej listy własnych flag; błędny model uznany lokalnie za kompletny może ominąć AI. Opis AI zastępuje model jako całość, bez konsumenta obserwacji w lokalnym obrysie i metryce. Telefon wywołuje `runAnalysis`; czytnik AI jest w `analyseLink`. Sam klucz nie zmienia działania LOCAL. Następny etap musi wykazać drogę źródło → obserwacja → rozstrzygnięcie → element → scena → dostępny tryb aplikacji.

**Strategie i kolejność.** A: zapisany LOCAL. B: live globalny opis oryginałów i obecny builder. C: te same pytania/model plus kadry i pomocnicze warstwy, bez zastępowania źródła. H: te same zapisane odpowiedzi plus wiarygodne obserwacje lokalne i działający konsument hybrydowy. Rozdzielić wpływ przygotowania obrazu od zmiany buildera. Najpierw mały pilot i działający konsument, potem porównanie na znanych 30 projektach oraz końcowy odbiór na nowych rodzinach i odłożonym wydawcy. Rzadką cechę można ocenić dodatkową próbą ukierunkowaną według źródeł, niezależnie od ogólnej.

**Priorytety jakości.** Właściwy wariant/rzut/kondygnacja i orientacja; skala z jawnymi jednostkami; zamknięte wnętrze odróżnione od stref otwartych; topologia i osie dachu; następnie otwory i pokoje. Model z samą zgodnością powierzchni lub bez błędów kompilacji nie jest automatycznie wierną sceną. Ocena per właściwość i per wydawca obejmuje także odmowy. AI może być głównym czytnikiem semantycznym, jeśli wynik to uzasadni, a lokalna geometria zachowuje potwierdzone pomiary.

**Dowody i odbiór.** To samo nieskuteczne OCR albo czytnik długich ścian nie może być jedynym weryfikatorem nowego dowodu. Potwierdzenie korzysta z właściwie przypisanej metryki, źródłowych cech lub innego widoku; kopie tego samego druku nie są niezależnymi pomiarami. Bez mocnej metryki wolno utworzyć jawnie przybliżony podgląd, bez dokładnych ilości. Odbiór kampanii wymaga poprawy finalnych scen na nowych rodzinach u więcej niż jednego wydawcy oraz braku nowych krytycznych regresji. Brak aktywacji rzadkiej reguły oznacza brak dowodu transferu, nie automatyczny dowód błędności; ograniczony pilot może zostać zachowany za flagą bez ogłaszania uniwersalności.

**Aktualna dokumentacja.** Szczegółowe wykonanie określa `BuildPlan_Prompt_Claude_v3.54.1_Hybryda_API.md`. Wykonawca ma umieścić dostarczony Master Plan pod jednym kanonicznym adresem w repozytorium i poprawić odnośnik protokołu. Nie rekonstruować brakujących paragrafów z pamięci. Ta aktualizacja jest przeglądem dokumentów i wskazanych fragmentów kodu; koordynator nie powtarzał przebiegów ani nie sprawdzał prywatnego ZIP v3.54.

### Poprzednie zlecenie v3.54 — kontekst zakończonego checkpointu

**Decyzja OWNER-a z 15.11.2026 — kampania v3.54.** Priorytetem jest audyt i porównanie całego przepływu od źródeł do sceny na różnych wydawcach, zakończone wdrożeniem strategii popartej wynikiem. Dotychczasowy prompt v3.53.15 zostaje zastąpiony zleceniem v3.54. Supertunie i Nad Rzeczką są przypadkami diagnostycznymi w tej kampanii. Bieżący kierunek obejmuje warstwę rozpoznania znaczenia elementów, niezależną metrykę, wspólną interpretację widoków i kontrolę finalnej sceny. Wolno przebudować moduł, którego ograniczenie potwierdzi próba z prawidłowym wejściem.

**Pomiar etapów.** Dla zebrania materiałów, klasyfikacji, rejestracji, obserwacji, metryki, obrysu i pomieszczeń, złożenia domu, kompilacji, kontroli źródłowej i aplikacji ustalić wejście, wyjście, referencję oraz miejsce utraty dowodu. Każdy moduł otrzymuje ocenę zachować, rozszerzyć, wymienić albo brak dowodu. Rozróżnić błąd rozpoznania, reprezentacji, wyboru, przekazania i wykonania. Interwencje diagnostyczne z poprawnymi danymi na granicach modułów mają pokazać, co ogranicza poprawę końcową.

**Strategie do porównania.** Obecna produkcja, oryginały z globalnym strukturalnym opisem AI, ten sam wariant z kadrami i warstwami semantycznymi oraz oryginały ze szkicami, jeżeli dostępne narzędzie i budżet pozwolą je wykonać. Wykorzystać istniejący prototyp czytnika domu. API ma mieć sprawdzony punkt zastosowania w scenie i możliwość wniesienia dowodu, którego lokalny czytnik nie rozpoznał. Jakość podlega niezależnej kontroli, z błędnymi wskazówkami jako kontrpróbą.

**Uogólnienie.** Bieżąca próba ma obejmować kilku wydawców i odmienne konwencje dokumentacji. Roboczy projekt porównania to 24 domy, co najmniej czterech wydawców, podział całymi rodzinami na rozwój i próbę odłożoną, w tym jeden wydawca odłożony w całości. Wykonawca może dostosować liczebność do dostępności źródeł i budżetu, ujawniając zakres wniosków. Wybór ARCHON jako historycznego priorytetu w §3.8 nie wyznacza zakresu tej kampanii. Ocena obejmuje odmowy, obrys, pokoje, otwory, dachy, skalę i fałszywe dodatki per wydawca.

**Odbiór kampanii.** Potrzebne są zmierzone wyniki strategii, uzasadnienie wyboru, wdrożona ścieżka i obrazy finalnych scen wobec źródeł. Nowa reguła i zielone testy są częścią dowodu. Weryfikacja automatycznej sceny na odłożonych projektach rozstrzyga uogólnienie. Rzeczywiste braki danych pozostają jawne i mogą prowadzić do konkretnego pytania użytkownika. Zasady autoryzacji i księgi API określa §7. Dostępne prace lokalne i diagnostyczne postępują także przy braku sekretu.

### Stan potwierdzony przed kampanią v3.54

Poniższe wyniki i kolejność v3.53 opisują bazę oraz wcześniejszy backlog. Aktualną kolejność prac określa decyzja v3.54 powyżej.

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

Dom ma przybliżoną spójną paletę low-poly/stylized, charakterystyczne pasy/okładziny/szczyty i szklenia. Dostępny też widok techniczny na ciemnym tle, kontury, przekrój/półprzezroczystość; fotorealizm nie jest celem. Jasny wariant jest późniejszą opcją. Siatka podłoża należy do prezentacji. Ruch wyjaśnia przejście wyboru, panelu, osi czasu i kontroli, respektuje ustawienia ograniczenia animacji. Nie ma dekoracyjnego bezkresnego ruchu. Dokładne pięć zakładek, clay look, wireframes, tokeny i teksty nie są zatwierdzone samym istnieniem researchu.

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

ARCHON jest bieżącym priorytetem. Inni wydawcy i nieznane strony pozostają wymaganiem przez adapter lub ogólny czytnik publicznych faktów/rysunków albo import pliku użytkownika. Jawnie normalizować także ft/in, sq ft i spadek 8:12; pola o różnym znaczeniu pozostają osobne. Nie mieszać edycji, odbić i płatnych dokumentów, których nie uzyskano.

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

Zachowany kierunek source-fusion: adaptery → źródła/obserwacje → graf dowodów i ograniczenia → hipoteza semantyczna → deterministyczny kompilator → weryfikacja/korekta. To granice odpowiedzialności, nie zakaz porównania innej kolejności wnioskowania. Ręcznie zbudowany model referencyjny pozostaje debug/test/eval, bez runtime gold ani automatycznego zaliczania zgodności. Opcjonalny VisualInterpreter może wnosić maski/keypointy i obserwacje, nie zapisywać bezpośrednio kanonicznej prawdy. Przenośną wartością są matematyka kamer, klasyfikacja źródeł, graf, solvery, ocena widoków i schematy; badawczy web UI nie narzuca platformy produktu.

Niewielka sprzeczność nie ma blokować użytecznego 3D, gdy istnieje sensowna podstawa bryły. Brak rzetelnej skali blokuje dokładny obmiar, nie musi blokować jawnie orientacyjnej hipotezy wizualnej. Nieudana rejestracja jednej właściwości nie kasuje innych widocznych cech.

Powierzchnia pokoju nie określa kształtu, a użytkowe pole poddasza nie określa całego obrysu. Wartość wyliczona lub proporcjonalna nie staje się drukowaną. Wygląd przybliżony i miary do zakupów/kosztów mają różny zakres uprawnień.

### Kierunek wdrożenia po audycie

Zewnętrze traktować jako wspólny semantyczny układ brył, otwartych obszarów, połaci i dodatków, z równoległymi ograniczeniami rzutu. Nie odzyskiwać pomieszczeń przez samo cięcie dowolnego finalnego mesha. Brak poprawnej skali może pozostawić orientacyjną hipotezę topologii, bez prawa do przedmiaru. Hipoteza bez metryki nie jest drugim zaakceptowanym modelem ani siatką udającą metry.

Zasięg dachu, obrys ścian danej kondygnacji i granice użyte do podziału obliczeń mają osobną semantykę. Jeden dach może obejmować kilka zamkniętych części i otwarty podcień. Ściana na granicy podziału potrzebuje dowodu rzeczywistej przegrody. Osobne dachy i wspólne połacie mogą współistnieć. Zachowuj źródło i poziom przypisania dla okapu, kalenicy, połaci i ich styku oraz oznaczaj wartości z konwencji na właściwości, której dotyczą.

Topologia pomieszczeń dotyczy kondygnacji i jej rzeczywistych przegród, otworów, podłogi i pustek. Rozróżniać pokój zamknięty, połączone przejście przez otwór w ścianie i otwartą przestrzeń z kilkoma strefami funkcjonalnymi. Pole geometryczne obliczać z poligonu z odjętymi pustkami według zadeklarowanej metody. Numer, nazwa i pole deklarowane mają własne dowody. Sprzeczność podlega zgłoszeniu przed użyciem pomiaru do kosztów.

Kształt zaobserwowany na obrazie, strona/identyfikacja, kotwica metryczna i zastosowana geometria są oddzielne. Utrata jednej kotwicy nie dowodzi płaskiego dachu ani braku balkonu. Ograniczenie kompilacji/łączenia nie może po cichu zmieniać rozpoznanej architektury na łatwiejszą. Wczesna hipoteza nie zwalnia z kontroli hostów, podpór, skali i źródeł.

C1a/C1b/C2 pozostają bazą o ograniczonym zakresie, nie dowodem pełnego rozumienia domu. Fable wybiera następny wycinek po pomiarze i może przebudować koordynację czytania źródeł. A=obecna kaskada, C=naprawa przekazania, B=C+wczesne zewnętrze to możliwe ramy porównania, a nie obowiązkowy katalog implementacji. Wolno porównać także strukturalny opis z modelu wizyjnego. Wpływ strategii i zmiany OCR rozdzielić w eksperymencie; cały efekt ocenić na finalnym domu. Konieczne reprezentacje można rozszerzyć, zachowując jeden model, jego tożsamość i kompilację. Nie wymagać nowego ogólnego frameworka.

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

## 7. Pomoc AI i kontrola modelu

Udział AI jest wyborem strategii do pomiaru. Wolno zbadać je jako pomoc lub główny czytnik wizyjny, bez z góry przyjętej zależności produktu od płatnej usługi. Jego wynik pozostaje obserwacją/propozycją strukturalnego opisu, nie drugim zaakceptowanym modelem domu. Wykorzystać istniejące sensowne typy i adaptery; można je rozszerzyć dla wykazanego braku. Nie budować osobnego protokołu tam, gdzie wystarczy uzupełnienie.

Oddzielić:
- obserwację źródła bez podpowiadania odpowiedzi;
- review finalnych renderów tej samej rewizji wobec oryginałów;
- propozycję domenową i jej kontrolowane zastosowanie.

Wiadomość AI zawiera wersję kontraktu, requestId, rewizję, źródłowy hash/kadr/transformację, pytanie i alternatywy. Odpowiedź wskazuje obserwację, dowód, alternatywy, niepewność, status oraz zakres propozycji albo powód odmowy/NEED_MORE_EVIDENCE. To kontrolowana propozycja, nie nieograniczone polecenie dla aplikacji. JSON i przepisany hash nie dowodzą prawdziwości. Tylko druga odpowiedź tego samego AI ani zgoda tego samego błędnego czytnika nie stanowią samodzielnego potwierdzenia.

Wariant powstaje na kopii tego samego modelu, przechodzi kompilację i ocenę źródłową oraz regresję, po czym jest przyjęty atomowo lub wycofany. NEED_MORE_EVIDENCE wymaga rzeczywistego pobrania dodatkowych danych przez właściciela pętli, nie tylko pola w schemacie. Ograniczone próby automatyczne przed pytaniem użytkownika; pytanie ma konkretne obrazy i wybór.

Bez sieci/API zachować użyteczny lokalny odczyt/import lub jasny stan ograniczenia; nie oznacza to gwarancji tej samej jakości offline. Lokalność i zdalność wybierać po pomiarze. Klucz usługowy nie trafia do APK/repo/logów. Backend, tożsamość użytkownika, limity i świadomy wybór zdalnej analizy wymagają projektu integracji przed produkcją. Istniejący autoryzowany serwis można wykorzystać; nowy płatny hosting lub rozszerzenie zgody wymaga konkretnej decyzji. Nie zakładać, że samo podanie klucza uruchamia feature.

**Autoryzacja v3.54.1 z 16.11.2026.** OWNER wskazał dostępny klucz Claude API z limitem 100 EUR i zgodę na test tej kampanii. Zastępuje to dawny limit badawczy 5 USD dla nowych wywołań objętych tym zleceniem. Zgoda obejmuje publiczne projekty wybranej próby wielu wydawców, oryginały i potrzebne kadry, rozwój konsumenta i odbiór. Nie obejmuje H2, nieujawnionego prywatnego benchmarku, nowego płatnego hostingu ani odrębnego płatnego generatora obrazów. Klucz wyłącznie jako bezpieczny sekret środowiska; nie do czatu, repo, ZIP, logów lub APK.

**Egzekucja kosztu.** Nie traktować limitu jako salda ani celu wydatkowania. Ustalić dostępny budżet i zakres jego współdzielenia na podstawie dostępnych danych. Pierwsza partia do 5 EUR, rozwój i porównanie docelowo do 20 EUR; dalsza uzasadniona praca może postępować bez pytania o każdy call, w niższym z limitów: dostępne środki i autoryzowane 100 EUR. Zachować rezerwę na retry, przeliczenie/właściwe opłaty i inne użycie. Rezerwować koszt przed żądaniem, kontrolować tokeny i concurrency, uwzględniać nieznane rozliczenie po timeout. API wyceniać w walucie dostawcy, z jawną datą taryfy i przeliczeniem EUR. Osobny workspace jest zalecanym sposobem izolacji, nie obowiązkiem tworzącym nową blokadę, jeśli istniejący zapewnia kontrolę.

CLI pozostaje narzędziem badawczym, nie zależnością telefonu. Sprawdzić bieżący model, transport i cennik przed wywołaniami. Obecność klucza nie oznacza zbudowanego konsumenta ani aktywnej ścieżki telefonu.

Kontrakt rozszerzać o minimum potrzebne do wybranego eksperymentu i działającego konsumenta. Dopuszczalna reprezentacja może obejmować cały strukturalny opis zewnętrza, jeśli to uzasadniony przedmiot porównania. Cztery obecne ProposalOp nie opisują całego złożonego dachu i nie ograniczają przyszłej domeny; sam zapis dodatkowej obserwacji nie gwarantuje zmiany domu. Odpowiedź w pikselach wysłanego kadru adapter przelicza do wspólnej domeny; zachowuje transformacje obrotu/lustra, nie tylko scale+offset.

Jedna pozytywna kontrola nie potwierdza innych zmienionych właściwości. Wszystkie skutki wariantu mają jawne pokrycie; wynik przyjęty tylko dla aktualnej rewizji i źródeł. NEED_MORE rzeczywiście zmienia dowód lub kończy się UNKNOWN. Koszt rezerwowany przed call, z retry i nieznanym rozliczeniem po timeout; maxUsd w schemacie nie jest księgą kosztu. Pierwszy pilot działa na hoście z profilem czytników zgodnym z APK, późniejszy lokalny run korzysta z brokera przechowującego klucz. Nie wdrażać ClaudeCode CLI jako zależności telefonu.

Użyteczna wizualna hipoteza może być jawnie przybliżona bez potwierdzenia przez ten sam nieskuteczny OCR. Dokładny przedmiar wymaga odpowiedniego pochodzenia i kontroli, nie self-confidence AI. Przy braku bazowego modelu można próbować pierwszego kandydata z zachowanego pakietu źródeł, bez żądania renderu nieistniejącego domu.

**Księgi rozdzielone.** S53: 92 wpisy, 2,72807938 USD, `CLI_TOKEN_ESTIMATE`, billing `UNCONFIRMED`, dawny limit 5 USD — zachować jako historię, bez przemianowania na rachunek API. Nowa kampania ma osobny zapis rzeczywistych nowych wywołań i wyceny usage; nierozliczona historia CLI sama nie blokuje nowej zgody. Nie odejmować jej automatycznie od 100 EUR. Dostępny klucz i możliwość egzekucji bieżącego pułapu są warunkami wywołań; brak sekretu blokuje tylko prace od niego zależne. Surowe odpowiedzi zachować i odtwarzać bez ponownego kosztu, kiedy zmienia się sam parser lub builder.

Działanie pętli AI w APK wymaga weryfikacji rzeczywistej ścieżki produktu. Stan pilota jest w § 2 i w repozytoryjnym PROJECT_STATUS.md.

### Porównanie czytania oryginału i przygotowania obrazów

IU-02 na pięciu domach DEV uzyskał 36 odczytów otworów i 15 zarejestrowanych widoków na surowych elewacjach wobec 21 i 11 po zastąpieniu ich czystymi obrazami. Zmieniały się m.in. linia gruntu, sylwetka i sygnał szkła. Oryginał zachowuje geometrię źródła. Maski, kadry i szkice mają własne pochodzenie i przechodzą kontrolę zgodności z oryginałem, zanim wpłyną na model. [Audyt N9-00, § 6](https://github.com/damiankrok/BuildApp/blob/1e41324/stage-reports/STAGE_BUILDPLAN_N9_00_SYSTEM_AUDIT.md#6-dlaczego-imagesketch-pogarszało-analizę)

Porównać na tych samych źródłach bazę lokalną, pytanie z oryginalnym obrazem oraz to samo pytanie z oryginałem i kadrem lub maską. Przygotowanie ma mieć jawny koszt lokalny i zachowaną transformację, a maska niepewności nie może usuwać geometrii ukrytej pod znakiem wodnym. Szkic wygenerowany osobnym narzędziem to odrębny wariant tylko wtedy, gdy jest dostępny w ustalonym zakresie. Zmierzyć przesunięcia konturu, gruntu i otworów, utratę detali, rejestrację i wynik sceny. [Dokumentacja współrzędnych Claude API](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates)

Najpierw rozstrzygać klasę i relację (np. szklenie między ościeżami, słupy otwartego podcienia, logo poza bryłą, linia całkowita). Dla liczb pytać o dosłowny zapis, jednostkę i odniesienie na rysunku. Wymiary w metrach wynikają z potwierdzonej skali i geometrii, a proporcje oszacowane z wizualizacji są wskazówką wizualną. Mierzyć rozpoznanie prawdy, fałszywe propozycje, UNKNOWN, zmianę sceny, koszt i p50/p95 czasu na wystarczającym zbiorze, z jawnym N. Do APK nie trafiają klucze ani prototyp badawczy. Odtwarzalne próby korzystają z hasha źródła, transformacji, pytania, schematu i modelu API.

## 8. Kryteria pomiaru i odbioru

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
| D13 | Opis domu z AI jest pilotem hostowym. Kotwice mają zakres całego domu lub lokalnej bryły | Zakres kotwic sprawdzono w v3.53.2. Żywy SDK, wdrożenie i ścieżka usługi na telefonie czekają |
| D14 | Brak skali blokuje dokładny obmiar, lecz nie musi kasować obserwacji topologii; kandydat nie jest drugim modelem prawdy | Doprecyzowanie istniejącego wymagania |
| D15 | Oddzielne statusy SLICE/CAMPAIGN/VERIFICATION, checkpoint nie kończy kampanii | Ujęte w nowym protokole i promptcie |
| D16 | Role macroF1, kompletne przypisanie i dokładność/pokrycie liczb mają osobne mianowniki; bez zmiany historycznych wyników | Doprecyzowane w § 8 |
| D17 | Wektory, OCR/CV i AI to dostępne narzędzia; wybór i kolejność po rozstrzygającym eksperymencie | Swoboda metody w zleceniu v3.53, bez pierwszeństwa konkretnego czytnika |
| D18 | Powstanie modelu, jakość skali i jakość całego zewnętrza to różne wyniki | Aktywne doprecyzowanie pomiaru ANY-LINK; bez przeliczania starych wyników |
| D19 | Fable prowadzi kampanię pętlą diagnoza/próba/wdrożenie/kontrola/regresja i wybiera dalszą blokadę | Wynik w domu i aplikacji; checkpoint nie zamyka niespełnionego zlecenia |

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

