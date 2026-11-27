# Przegląd „taste” wyglądu (skill frontend-design) — APK 1358

Skill o nazwie „taste” nie istnieje w tej sesji ani w katalogu OWNER-a; OWNER wybrał najbliższy, `frontend-design`
(wyczucie estetyczne, kierunek, typografia, unikanie szablonowego wyglądu). Kierunek C z DESIGN.md zostaje: grafit,
mięta tylko dla wybranego i zmierzonego, matowe szkło w jednej warstwie, model bez zmian.

## Diagnoza (czym wygląd zdradzał szablon)

1. **Roboto** — krój każdej aplikacji na Androida; nic w literach nie mówiło „budowa”.
2. **Złączenia kropką środkową** („Z tyłu · Bez dachu”, „40% · Ściany”, „Z analizy linku · model gotowy”) — typowy
   ślad wygenerowanego interfejsu; po polsku fakty łączy przecinek, kropka albo dwukropek.
3. **Myślnik ze spacjami** w zdaniach („to tylko podgląd”).
4. Grafit z jednym jasnym akcentem to blisko domyślnego „ciemne tło + kwaśny akcent”, ale ten kierunek wybrał OWNER
   (wariant C) — zostaje; charakter idzie w litery, nie w nową paletę.

## Co zmieniono (jedna odważna decyzja, reszta cicha)

- **Barlow jako krój słów** (Regular / Medium / SemiBold, OFL, z polskimi znakami, `res/font/`, licencja w
  `assets/licenses/barlow-OFL.txt`): niskokontrastowy grotesk z oznakowania dróg i placów budowy. Razem z Barlow
  Condensed dla liczb to jedna rodzina w dwóch szerokościach — procent i jego podpis są „spokrewnione”, ale różne.
- **Liczba po nazwie bez separatora**: kafel Etapy „Ściany 40%” — nazwa się skraca, liczba (mięta, Barlow Condensed)
  nigdy; TalkBack czyta „Ściany, 40%”.
- **Język**: „Z tyłu, bez dachu”; „Postęp wg etapów 2%. Zapisano …”; „Model z linku jest gotowy”; „Analizuję link: 40%”;
  „W toku: 40%”; „Przeciągnij, by obrócić. Dwa palce przesuwają i przybliżają.”; „… by obejrzeć etap. Nic się nie
  zapisze.” Gęste listy diagnostyczne analizatora zostają z kropkami (to dane, nie zdania).
- DESIGN.md: sekcja Typography i nowa reguła „Plain Join”.

## Sprawdzenie

JVM 518 zielonych + 3 pominięte; lint bez nowych błędów (stary `DescribingPanel.kt:88`); emulator `emulator-5570`
(Android 10): start, Widok, Etapy w Barlow — bez obcięć przy czcionce 1,0. APK 1358: ten sam podpis, scena 680a3f4b…
bez zmian. Do obejrzenia na telefonie: czcionka 1,3 i kafel Etapy z zapisanym etapem.
