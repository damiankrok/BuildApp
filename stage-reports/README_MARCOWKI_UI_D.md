# Runda D — krótko dla OWNER-a (APK 1357)

Pełny raport: `stage-reports/MARCOWKI_UI_D.md`. Model Marcówek bez zmian (hashe zgodne), badania analizatora
wstrzymane, 0 USD.

**Najkrócej.** Siedmiu niezależnych audytorów (ruch, wygląd, użyteczność, dostępność, 3D, kod, przyszłość) przejrzało
wariant C na prawdziwych zrzutach i w kodzie — 115 ustaleń, każde sprawdzone przez osobnego „sceptyka”. Poprawiłem to,
co psuło płynność i sens, dodałem charakter i obrót domu.

## Co zobaczysz

- **Kafle naprawdę się transformują, a nic innego się nie rusza.** Kafel najpierw unosi się w swojej kolumnie, potem
  rośnie w panel; nigdy nie przechodzi przez drugi kafel. Zmiana warstwy, zaznaczenie elementu, podgląd etapu —
  sprawdziłem pomiarem pozycji na emulatorze: drugi kafel, nagłówek i dom stoją w miejscu co do piksela. Klawiatura
  nie rusza już doku ani domu (unosi tylko otwarty panel).
- **Dom ma scenę:** miękki cień pod domem, jaśniejsze tło, ostrzejszy obraz w spoczynku, cienie nie „pływają”.
  Zaznaczony element dostaje miętowy obrys własnych krawędzi (jak reszta aplikacji), a nie niebieską plamę.
- **Kafle mówią, co jest:** „Widok / Cały dom” (albo „Z tyłu · Bez dachu”) i „Etapy / 40% · Ściany”.
- **Etapy otwierają się nisko** — cały dom zostaje widoczny. „Odtwórz budowę” przewija etapy jak film.
  „Zakończ i zacznij: Strop” jednym dotknięciem; szybkie 0/25/50/75/100 %.
- **⋮ → „Obracaj dom, gdy go nie dotykam”** (domyślnie wyłączone): po 5 s bez dotyku dom powoli się obraca, interfejs
  przygasa (tryb salonu). Dotknięcie tylko zatrzymuje — nic nie zaznacza. Nie działa przy wyłączonych animacjach,
  z TalkBack, w oszczędzaniu baterii i na gorącym telefonie; menu mówi dlaczego.
- **Przyjemniej w dłoni:** szybkie przesunięcie ma rozpęd, szczypanie przybliża tam, gdzie są palce, podwójne dotknięcie
  obok domu = Dopasuj, Dopasuj drugi raz = cały dom (ikona zmienia się w domek), lekkie „przysiadanie” kart pod palcem,
  krótkie drgnięcie po zapisie etapu.
- **W poziomie** panele stoją w kolumnie po lewej, dom obok — nigdy pod panelem.
- **Pod elewacjami** cienka linia gruntu, jak na rysunku architekta.

## Funkcje na przyszłość (wnioski)

Następne: odtwarzanie budowy w kafelku (dom cały w kadrze), „przytrzymaj, by porównać” etap z dziś, notatki do etapów,
„Pora dnia” (gotowe wyglądy Ciepło/Zmierzch), zdjęcie domu do udostępnienia, „Historia budowy”, kopia postępu
(do decyzji). Później: widżet, słońce i północ, dziennik zdjęć przy etapach, pomiar, spacer po wnętrzu, AR, terminy,
koszty na etap.

## Proszę sprawdzić na telefonie

1. Płynność morfu i obrotu (emulator rysuje programowo, kilka klatek na sekundę).
2. Rozpęd i szczypanie dwoma palcami.
3. Obrót: włącz, odłóż telefon na 10 s; dotknij — ma tylko stanąć.
4. Poziom i Wstecz na Androidzie 14/15.

## Pliki (osobno)

- `BuildPlan-Model-Preview-1357-arm64-v8a.apk` (ten sam podpis aktualizacji co 1356).
- Plansze przed/po, klatki morfu spowolnionego 20×, obrót domu.
