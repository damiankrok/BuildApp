# Wariant C „Minimalny dok” — krótko dla OWNER-a (APK 1356)

Pełny raport: `stage-reports/MARCOWKI_UI_C.md`. Model Marcówek bez zmian (hashe zgodne na początku i końcu).
Badania analizatora wstrzymane, 0 USD.

**Najkrócej.** Dom jest teraz ekranem: duży, wyśrodkowany, na spokojnym grafitowym tle, bez siatki. U góry mała
pigułka „Marcówki · Demo”, Dopasuj i ⋮. U dołu dwa kafle z matowego szkła: „Cały dom” i „Etapy”. Każdy kafel rośnie
w swój panel (Warstwy, Etapy) i wraca do swojego miejsca. Szyny bocznej i dużego panelu postępu już nie ma.

## Co zobaczysz

- **Cały dom → Warstwy:** cztery karty (Cały dom / Bez dachu / Parter / Poddasze), zdanie, co ukryto, „Pokaż
  wszystko” i wiersz „Widok · Perspektywa” z widokami: z przodu, z tyłu, z lewej, z prawej, z góry, aksonometria.
  Kafel zawsze mówi, co widać („Bez dachu”).
- **Etapy:** oś budowy (przesunięcie = tylko podgląd, nic się nie zapisuje), lista etapów. Ukończenie ustawiasz
  przyciskami −5 / +5 i zapisujesz „Zapisz 40%” — **suwaka już nie ma**, więc przewijanie niczego nie zmieni.
  Podgląd etapu widać też na kafelku („Podgląd / Fundamenty”, × wraca).
- **Dom większy:** w pionie zajmuje ok. 90 % szerokości. Wcześniej puste naroże pudełka (taras za garażem)
  zmniejszało go i przesuwało w lewo — teraz kamera kadruje po samym domu.
- **⋮:** siatka pod domem (wyłączona na starcie), wszystkie widoki/warstwy/wygląd, źródło modelu.
- **Bateria:** w spoczynku 3D nie rysuje już nowych klatek (wcześniej rysowało co klatkę).

## Szkło

Matowe, przydymione, z jasną obwódką i cieniem. **Bez rozmycia tego, co pod spodem** — model jest na osobnej
warstwie systemu, której okno nie może rozmyć bez podwójnego renderu; nie udaję tego.

## Jak sprawdziłem

Na emulatorze (Android 10, ekran jak Pixel 6; nie na telefonie): zimny start, aktualizacja z 1355, restart,
warstwy, pięć widoków, Dopasuj, podgląd etapu (nic się nie zapisuje), zapis postępu po restarcie, scena z galerii,
pion i poziom, czcionka 1,3, animacje wyłączone, Wstecz. Dwie rundy porównania z REFERENCE_C. Testy: Android 502
(0 błędów), eksport scen 138 (0 błędów).

## Proszę sprawdzić na telefonie

1. Płynność rozwijania kafli (emulator nagrywa tylko 2–3 klatki na przejście — stąd drugie nagranie spowolnione 10×).
2. Szczypanie i przesuwanie dwoma palcami.
3. Poziom i Wstecz na Androidzie 14/15.

## Pliki (osobno)

- `BuildPlan-Model-Preview-1356-arm64-v8a.apk` (ten sam podpis aktualizacji co 1355).
- Plansze `01`–`10` (1355 → C, referencja obok wyniku, widoki, zapis, klatki morfu), nagrania
  `morph-tempo-rzeczywiste.mp4` i `morph-spowolniony-10x.mp4`.
