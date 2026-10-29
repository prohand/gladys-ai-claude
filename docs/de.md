# Claude AI

Diese Integration macht **Claude**, die KI von Anthropic, zum Gehirn des
Gladys-Assistenten. Einmal ausgewählt, beantwortet sie alle KI-Anfragen deiner
Gladys: den Chat (und die Geräte, die er für dich steuert), das Einordnen
deiner Nachrichten, die Szenen-Aktion **KI fragen** und die
Wochenzusammenfassung.

Es ist eine Community-Integration: Sie wird weder von Anthropic erstellt noch
unterstützt.

## Bevor du beginnst

- **Gladys 5.3 oder neuer.**
- **Ein Anthropic-API-Schlüssel.** Erstelle ein Konto auf
  [console.anthropic.com](https://console.anthropic.com), lade Guthaben auf
  oder hinterlege eine Zahlungsmethode, und erstelle dann einen Schlüssel unter
  **Settings → API keys**. Er beginnt mit `sk-ant-`.
- Die Nutzung wird **von Anthropic abgerechnet**, pro Token, zum Preis des
  gewählten Modells. Gladys Plus ist nicht nötig.

Claude läuft in der Cloud (`api.anthropic.com`): Gladys braucht
Internetzugang.

## Konfiguration

1. Installiere die Integration aus dem Katalog und öffne dann ihren Reiter
   **Konfiguration**.
2. Füge deinen **Anthropic-API-Schlüssel** ein und speichere.
3. Klicke auf **Verbindung testen**: Jedes Modell beantwortet eine Ein-Wort-
   Frage, und die benötigte Zeit wird unter der Schaltfläche angezeigt.
4. Gehe zu **Einstellungen → Künstliche Intelligenz** und wähle **Claude AI**
   als KI-Anbieter.

Der Status oben im Konfigurationsbildschirm wird grün, wenn der Schlüssel
akzeptiert wird und die gewählten Modelle für ihn freigegeben sind. Ist er
rot, nennt er den Grund.

## Die Einstellungen

| Einstellung                    | Was sie bewirkt                                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic-API-Schlüssel        | Dein Schlüssel. Er bleibt in Gladys, wird nie wieder angezeigt und nie in die Protokolle geschrieben.                                                                                                          |
| Chat-Modell                    | Beantwortet den Chat, erstellt die Szenen, schreibt die Wochenzusammenfassung. Standard: **Claude Opus 5.5**. Sonnet 5.5 ist schneller und günstiger, Fable 5.1 am stärksten und am teuersten.                 |
| Router-Modell                  | Ordnet jede Nachricht vor der Antwort ein. Gladys wartet höchstens **20 Sekunden** darauf: Behalte ein schnelles Modell, Standard: **Claude Haiku 5.5**.                                                       |
| Denkaufwand                    | Wie viel das Chat-Modell vor der Antwort nachdenkt: niedrig, mittel (Standard), hoch, sehr hoch. Mehr Aufwand hilft bei schwierigen Anfragen (eine Szene erstellen), antwortet aber langsamer und kostet mehr. |
| Maximale Antwortlänge (Tokens) | Das Ausgabebudget einer Antwort, Nachdenken inklusive. Standard: 16.000. Erhöhe es, wenn die Protokolle melden, dass eine Antwort `max_tokens` erreicht hat.                                                   |

## Was Claude sieht

Die Wahl eines KI-Anbieters ist eine Datenschutzentscheidung. Der Anbieter
erhält:

- jede Chat-Nachricht und den Gesprächsverlauf;
- die Beschreibung der Werkzeuge, die Gladys ihm anbietet, und ihre
  Ergebnisse — den Zustand der Geräte, die er abfragt;
- die Bilder, die du im Chat sendest.

Seine Antworten steuern deine Geräte und erstellen deine Szenen. Lies die
[Datenschutzrichtlinie von Anthropic](https://www.anthropic.com/legal/privacy),
bevor du ihn wählst.

## Kosten und Geschwindigkeit

- Der Systemprompt und die Werkzeugliste kommen bei jeder Nachricht wieder:
  Die Integration bittet Anthropic, sie **zwischenzuspeichern**, was sie nach
  der ersten Nachricht zu einem Bruchteil des Preises abrechnet.
- Der Router läuft immer mit niedrigem Aufwand auf dem Router-Modell: Es ist
  die am häufigsten gesendete Anfrage.
- Um weniger auszugeben, wähle **Claude Sonnet 5.5** für den Chat oder senke
  den Aufwand.
- Lehnt Claude eine Anfrage aus Sicherheitsgründen ab, wiederholt Anthropic
  sie im selben Aufruf mit seinem Standard-Ersatzmodell; lehnen alle Modelle
  ab, antwortet der Assistent, dass er nicht helfen kann.

## Fehlerbehebung

- **„Anthropic hat den API-Schlüssel abgelehnt“** — der Schlüssel ist falsch,
  widerrufen oder gehört zu einer Organisation ohne Guthaben. Erstelle einen
  neuen und füge ihn erneut ein.
- **„… ist für diesen API-Schlüssel nicht verfügbar“** — deine
  Anthropic-Organisation hat keinen Zugang zu diesem Modell: Wähle ein anderes.
- **„Anfragelimit erreicht“** — zu viele Anfragen für deine
  Anthropic-Nutzungsstufe: Warte einen Moment oder erhöhe deine Stufe in der
  Anthropic-Konsole.
- **„api.anthropic.com ist nicht erreichbar“** — Gladys hat keinen
  Internetzugang, oder eine Firewall blockiert diese Adresse.
- **Der Assistent meldet, dass der KI-Anbieter nicht verfügbar ist** — öffne
  den Reiter **Protokolle** der Integration: Jede Anfrage schreibt dort eine
  Zeile (Modell, Zeit, Tokens) und jeder Fehler seinen Grund.
