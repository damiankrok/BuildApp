# v3.54.14 R2 — metryka API, szkice, Bakopy i nowy dom: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35414.md`](SOURCE_TO_MODEL_V35414.md). ADR:
`docs/ADR-V35414-METRIC-CONSULTANT-SKETCHES-CHOICE.md`. Hand-off: `research/source-to-model/v35414/HANDOFF.md`.
Tabela wymiarów: `research/source-to-model/v35414/results/dimension-tables.md`. APK: **1345**.

## W siedmiu zdaniach

1. Marcówki: trzy defekty z Twoich zrzutów są usunięte bez ruszania geometrii — nie ma jasnej linii na +3,06,
   drewno i biała rama są ciągłe za balkonem, za balustradą nie ma plam.
2. API czyta wymiary samo (bez podpowiedzi LOCAL), potem sprawdza odczyty LOCAL, a poprawkę przyjmuje tylko ze
   świadkiem; na Bakopach 8 etykiet poszło do modelu (np. LOCAL czytał „0051”, wydrukowane jest „1500”).
3. Na Bakopach wpływ na bryłę jest mały — skala była już pewna — a brakujące 8 cm szerokości to błąd budowy
   obrysu, nie odczytu.
4. Szkice pomogły w formie i w wykończeniu: z trzech przyjętych szkiców model dostał komin i drewno na szczycie
   skrzydła, przy wnęce i na panelach; front był odrzucony (ściśnięty), więc jego ton zostaje.
5. Nowy dom (Lipińscy Ballina): pierwszy bieg na zamrożonym kodzie to odmowa — zostaje w raporcie jako wynik.
6. Po zamrożeniu (jawnie) świadkiem wymiarów API zostało pole zabudowy ze strony; Ballina ma model z obrysem
   13,65 × 8,15 co do centymetra, ze ścianami, otworami i pokojami, ale bez dachu (wysokości podało tylko API).
7. Drugi bieg tego samego adresu na hoście korzysta z zaakceptowanej rewizji — 0 USD, bez żądań.

## Co obejrzeć

- APK 1345: scena 1 „Marcówki — poprawka v3.54.14 (oddany)”, scena 2 „Bakopy — analizator z metryką API i szkicami
  (oddany, DEV)”, scena 3 „Ballina — nowy dom, po zamrożeniu (częściowy, bez dachu)”, dalej sceny z APK 1344.
- Plansze w prywatnym ZIP (`boards/`): ORYGINAŁ | SZKIC | L0 | L-M | L-MS | DELIVERED na czterech stronach, widok
  z góry z czterema aksonometriami, kondygnacje bez dachu.
