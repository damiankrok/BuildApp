# v3.54.17 — próba zamrożona: reguła zapisana przed jakimkolwiek przebiegiem próby (2026-11-20)

**Co jest zamrażane najpierw.** Próba biegnie wyłącznie na commicie, który zamraża kod, prompty (kontrakt 0.5.0,
prompt 0.6.0, rejestr 1.1.0, wykonawca 1.2.0, bramka źródła 1.2.0, resolver 1.0.0, massing 1.0.0, ops 1.0.0,
plan-outline/1), transport (hosta: Sonnet 5.5 dla szkiców i przeglądu, Opus 5.5 dla odczytu metrycznego i obrysu,
cache promptu 5 min, strict + fallback) i miary (stany jakości, rozliczenia defektów, rekordy wykonawcy). Nic nie jest
strojone po wyniku próby: zmiana po spojrzeniu na wynik jest DEV, a pierwszy wynik zostaje wynikiem.

**Dwie rodziny, dwóch wydawców** (co najmniej jedna spoza dominującego wydawcy ARCHON): ARCHON (`archon-pool.txt`) i
Studio Atrium (`studioatrium-pool.txt`) — te same publiczne listy co w v3.54.16 (tylko adresy tekstowe).

**Kolejność.** seed = sha256(`<commit zamrożenia>:V35417-TRIAL:<wydawca>`); start = seed mod rozmiar puli; przejście od startu.

**Wykluczenia.** Rodzina (nazwa strony bez końcówek wariantu) obecna w badaniach repozytorium lub w prywatnych
rekordach (`seen-families.txt`, uzupełnione o rodziny v3.54.16: willa-layla, alaska, alabaster, aladyn) jest pomijana.
Prywatny holdout H2 / OWNER nie jest otwierany.

**Przyjęcie kandydata (tylko na pobranym pakiecie, przed analizą).** Strona się pobiera (publiczna, dozwolony host);
ma rzut parteru; co najmniej trzy elewacje FRONT, REAR, SIDE_LEFT/SIDE_RIGHT (lub bok nieokreślony); rozmiar pakietu w
budżecie dysku. Pierwszy przyjęty kandydat każdej puli jest rodziną próby. Każdy otwarty kandydat i powód trafia do
`selection.json`; najwyżej 12 otwartych na pulę.

**Co jest uruchamiane i zachowane.** Każda rodzina raz przez hosta z jednego końcowego commita (ta sama ścieżka co w
produkcie), pierwszy wynik zachowany (wyniki, modele, sceny, szkice, rekordy wykonawcy). Brak modelu LOCAL → ścieżka
BUILD_MASSING (obrys rzutu + elewacje). Koszt w granicach `LIVE_PLAN.md`.
