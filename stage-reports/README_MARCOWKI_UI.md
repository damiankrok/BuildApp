# Marcówki i UI — krótko dla OWNER-a (APK 1355)

Pełny raport: `stage-reports/MARCOWKI_UI.md`. Badania analizatora wstrzymane zgodnie z Twoją decyzją; 0 USD.

**Najkrócej.** Aplikacja otwiera teraz „Dom w marcówkach” (dokładnie zamrożona dostawa v3.54.14 — bajty modelu
i sceny bez zmian), opisany uczciwie jako **model demonstracyjny**. 126 scen badawczych nie zniknęło: są w osobnej
**Galerii deweloperskiej** na dole menu, z pełnymi opisami technicznymi. Dom ma więcej miejsca: w poziomie pas na
model jest ok. 2× wyższy. „Postęp nieustawiony” pada raz, a oś mówi, co widzisz: projekt docelowy, podgląd etapu
albo zapisany stan.

**Jak to sprawdziłem.** Na emulatorze z prawdziwą aplikacją (Android 10, ekran jak Pixel 6; bez telefonu): zimny
start, aktualizacja z 1354, restart, obrót, zoom, Dopasuj, cztery strony i dach z góry, bez dachu, parter, poddasze,
wybór elementu i szczegóły, powrót do całości, podgląd etapu (nic się nie zapisuje), zapis postępu w Etapach, wybór
sceny z galerii i jej powrót po restarcie, pion i poziom, czcionka 1,3. Zrzuty przed/po: plansze 01–07 (osobno).
Testy: Android JVM 492 (0 błędów), testy eksportu scen 135 (0 błędów). Audyt impeccable w dwóch rundach;
wszystkie potwierdzone usterki z obu rund poprawione (oprócz kilku nazwanych w raporcie jako poza etapem).

## Co zobaczysz

- Start: „Dom w marcówkach · Model demonstracyjny”. Jeśli kiedyś sam wybrałeś dom z analizy linku — otworzy się on.
  Wersja 1354 zapamiętywała też swój automatyczny wybór (Annę II); ten zapis 1355 pomija.
- Menu: dom pokazowy, Twoje domy z linku, „Dodaj dom z linku”, Etapy, Źródło, Koszty, a na dole „Galeria
  deweloperska”. Scena otwarta z galerii mówi to u góry i ma „wróć do: Dom w marcówkach”.
- Warstwy: po wybraniu np. „Tylko parter” u dołu stoi „Tylko parter · Ukryto dach i poddasze · Pokaż wszystko”.
- Widoki z boku, z góry i rzuty mieszczą cały dom (wcześniej „Z prawej” ucinał go z lewej — znalezione na emulatorze).
- Sceny z galerii są tylko do podglądu: postęp zapisujesz w domu pokazowym albo w swoim domu (wcześniej część
  scen Marcówek dzieliła zapis z domem pokazowym).
- W poziomie nagłówek osi i miarka są w jednym rzędzie.

## Czego nie sprawdziłem (proszę na telefonie)

1. Aktualizacja 1354 → 1355: otwiera się „Dom w marcówkach”?
2. Płynność obrotu, przesuwania i szczypania dwoma palcami.
3. Poziom na Twoim telefonie (gesty / przyciski nawigacji).
4. Wstecz z galerii, menu i szczegółów na Androidzie 14/15.
5. Suwak ukończenia w Etapach: czy przewijanie listy nigdy go nie przesuwa.

## Co zostaje otwarte

- Kominy Marcówek stoją przy „Tylko parter” — tak jest w modelu (zamrożony, nie ruszałem).
- Render co klatkę także w spoczynku (bateria) i odtwarzanie silnika przy zmianie domu — znane, poza tym etapem.
- Suwak ukończenia etapu zapisuje po dotknięciu (to arkusz edycji; jeśli chcesz, dodam „Cofnij”).

## Pliki

- `BuildPlan-Model-Preview-1355-arm64-v8a.apk` — osobno (ten sam podpis aktualizacji co 1354).
- Plansze `01-start-przed-po.png` … `07-kadrowanie-z-prawej.png` — osobno.
