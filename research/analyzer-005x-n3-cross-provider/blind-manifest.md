# 005X-N3 — BLIND-N3 (zamrożony przed pierwszym biegiem; piksele nieoglądane do końcowej ewaluacji)

Kod zamrożony przed biegiem: `e63d7ae` (czytnik jednego zdjęcia `single-image.ts` **bez zmian** względem 005X-N2 —
ścieżka `Photo…` nie była w N3 modyfikowana; segmentator nie jest wpięty w produkcję).

Reguła wyboru (ustalona przed pobraniem, bez oglądania): Wikimedia Commons API `list=categorymembers`,
`Category:Houses_in_Poland` (kategoria nieużywana w N1/N2), kolejność zwracana przez API; pierwsze 4 pliki JPEG z
„dom” albo „house” w tytule (całe słowo), licencja CC BY / CC BY-SA / CC0 / PD — wszystkie 4 pierwsze spełniły warunek
licencji. Miniatura: największa standardowa szerokość miniatur Commons nie większa od oryginału (960 / 500 / 330 px) —
dopisek techniczny po odpowiedziach HTTP 429/„use standard thumbnail sizes” serwera, bez oglądania treści.
Pobrane 2026-10-20, przechowywane wyłącznie poza repozytorium (`/home/user/work005xn3/blind/`).

| id | tytuł na Commons | licencja | autor (wg Commons) | SHA-256 pobranej miniatury | rozmiar |
|---|---|---|---|---|---|
| n1 | File:A modern polish house.jpg | CC BY-SA 3.0 | Polishbook | ae7d82c457ebabb6e5aa213a4bbce7a889bb2636845e5c45fe086d565067399d | 330×245 |
| n2 | File:Dom betonowy.JPG | CC BY-SA 3.0 | Szlomo Lejb | f29c9c6262422f60d7111249da7b7de7f8beeafa8f83ed5ef1ab9d0e69a38772 | 960×640 |
| n3 | File:Dom pasywny wśród drzew.jpg | CC BY-SA 3.0 | Inżynierowie.środowiska | 43e5694839194d0fa62c35035efb45160b0b1242d31e9b2bf3a884a8c56688ba | 500×336 |
| n4 | File:Dom typu Bliźniak.JPG | CC BY-SA 4.0 | Ananas96 | c3d8b9d35aff2a27579596ee0e2fadb1404f79331050902836dd749b1c234de9 | 500×375 |

Oceniane po biegu (patrz raport): dach vs tło, ściany, główne okna i wejście, typ dachu, brak fałszywego modelu,
poprawność odmowy. Uruchamiane jeden raz. Dodatkowo, w tym samym biegu, wizualizacje TeA (nowy wydawca, przypadek
testowy, nie do strojenia).
