# v3.54.17 — diagnoza pierwszej straty (DEV: Layla, Alaska Studio Atrium)

Uruchomienie: `npx vite-node research/source-to-model/v35417/diagnose.ts -- --url <url> --cache <katalog> --out <katalog>`
(LOCAL, zamrożone bajty z cache, 0 USD, bez klucza). Wyniki poza repo: `/home/user/rd/v35417/diag/{layla,alaska}/`.

Łańcuch: źródło? → odczytane? → związane? → konsument? → zbudowane? → bloker.

## Layla (ARCHON, `projekt-willa-layla-g2ae`)

| Ogniwo | Stan | Dowód |
|---|---|---|
| źródło | TAK | 8 ramek rzutu, przekroje i elewacje w cache; fakty strony: zabudowa 184,87 m², wysokość 6,95 m, dach 168,37 m², garaż 39,87 m² |
| odczytane | TAK (skala) | skala 2,991 cm/px STRONG/CONFIRMED, 8 niezależnych świadków, 77 pasm ścian, obwiednia zamknięta |
| związane | NIE | 35 komórek, 14 zamkniętych, 4 regiony zabudowy, 3 masy; najlepszy odczyt daje 91,03 m² dolnej kondygnacji wobec 184,87 m² (−50,8 %) |
| konsument | — | `PLAN_LAYOUT_REJECTED / STRUCTURAL_LAYOUT`, bramka `FOOTPRINT_AREA_WRONG` |
| zbudowane | NIE | brak modelu |
| bloker | **kompozycja obrysu z regionów rzutu** | dane wymiarowe są (skala potwierdzona); Layla nie jest „domem bez wymiarów". Brakuje drugiego skrzydła/garażu w złożeniu masy. |

Wniosek: brakujący jest konsument „obrys → bryła” niezależny od dekompozycji LOCAL; potrzebny obrys (z rzutu
w skali, którą LOCAL zmierzył) i sylwetki elewacji. To mechanizm BUILD_MASSING (v3.54.17).

## Alaska (Studio Atrium, `Alaska,1612`)

| Ogniwo | Stan | Dowód |
|---|---|---|
| źródło | TAK | 2 rzuty 1211×891 px, elewacje, przekrój |
| odczytane | CZĘŚCIOWO | 2 etykiety wymiarowe na 2 liniach; hipotezy skali 3,71 / 2,95 / 1,91 cm/px, żadna niezależna |
| związane | NIE (LOCAL) | `METRIC_RESOLUTION_INCONCLUSIVE / PLAN_NO_DIMENSION_FRAME`; 40 zamkniętych komórek, 7 regionów, masy 0 |
| konsument | — | brak skali → brak kompozycji |
| zbudowane | z odczytem API metrycznym (próba v3.54.16): model 2 × 2,8 m, `roofs: []` | widoki POSITIONS_ONLY, wysokości odrzucone → dach niezbudowany |
| bloker | **dach z sylwetki elewacji bez rejestracji LOCAL** | szkice 4 elewacji istnieją (pas dachu, linia gruntu), ale żaden konsument nie zamienia ich na dach bez `facadeAlignment.views` z wysokościami |

Wniosek: brakujący jest konsument „sylwetka zarejestrowana z rzutu → dach na wskazanej bryle” (SET_ROOF),
rejestrujący elewację przez szerokość obrysu (nie przez dach modelu), bez pętli rejestracja ↔ korekta.
