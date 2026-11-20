# v3.54.17 — plan żądań na żywo (zapisany PRZED uruchomieniem)

Księgi: 27,812357 USD, pułap 28,854612 USD, pula etapu 1,042255 USD (bez nowej puli; saldo panelu 76,28 USD nie jest limitem).
Klucz wyłącznie z sekretu hosta (`/root/.config/buildplan/campaign-key` → zmienna procesu); nigdy w poleceniach, logach, Git, ZIP, APK.
Każde żądanie rezerwuje najgorszy przypadek przed wysłaniem i jest odrzucane, gdy rezerwacja przekroczyłaby pułap.
Ceny: Opus 5.5 4/20 USD za MTok, Sonnet 5.5 2/10 USD za MTok.

| # | Żądanie | Model | Liczba | Maks. koszt (rezerwacja) | Oczekiwany | Po co |
|---|---|---|---|---|---|---|
| L1 | odczyt obrysu rzutu Layli (`plan-outline/1`) | Opus 5.5 | 1 | 0,09 USD (≈ 3,1 k wej. + 4 000 wyj.) | ≈ 0,02 USD | brakujący czytnik ścieżki bez modelu (BUILD_MASSING); szkice i odczyt metryczny z nagrań v3.54.16 (0 USD) |
| L2 | recenzent na żywo: `continues`/`resolved` i nowe operacje (Alaska, 2 spojrzenia) | Opus 5.5 | ≤ 2 | 0,40 USD | ≈ 0,12 USD | sprawdzenie kontraktu 0.5.0/0.6.0 na prawdziwym recenzencie, transport hosta (strict + fallback, cache 5m) |
| L3 | końcowy host z jednego commita = próba 2 nowych rodzin (wybór zapisany przed analizą) + Alaska | Opus/Sonnet jak w hoście | ≤ 30 | `--max-usd` = pułap; łącznie ≤ 0,52 USD | ≈ 0,45 USD | mechanizm bryły/dachu na hoście, pierwsze wyniki zachowane; powtórka = 0 żądań; brak tokenu = 0 żądań |

Suma maksymalna: 0,09 + 0,40 + 0,52 = 1,01 USD ≤ 1,042255 USD. Jeżeli po L1–L2 reszta puli nie pokryje L3, L3 biegnie
z mniejszą liczbą przypadków (najpierw Alaska, potem rodziny w kolejności wyboru), a brak jest nazwany w raporcie.
