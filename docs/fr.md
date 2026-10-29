# Claude AI

Cette intégration fait de **Claude**, l'IA d'Anthropic, le cerveau de
l'assistant Gladys. Une fois choisie, elle répond à toutes les demandes d'IA de
votre Gladys : le chat (et les appareils qu'il pilote pour vous), le tri de vos
messages, l'action de scène **Demander à l'IA** et le résumé hebdomadaire.

C'est une intégration communautaire : elle n'est ni faite ni maintenue par
Anthropic.

## Avant de commencer

- **Gladys 5.3 ou plus récent.**
- **Une clé d'API Anthropic.** Créez un compte sur
  [console.anthropic.com](https://console.anthropic.com), ajoutez du crédit ou
  un moyen de paiement, puis créez une clé dans **Settings → API keys**. Elle
  commence par `sk-ant-`.
- L'usage est **facturé par Anthropic**, au jeton, au prix du modèle choisi.
  Gladys Plus n'est pas nécessaire.

Claude tourne dans le cloud (`api.anthropic.com`) : Gladys doit avoir accès à
Internet.

## Configuration

1. Installez l'intégration depuis le catalogue, puis ouvrez son onglet
   **Configuration**.
2. Collez votre **clé d'API Anthropic** et enregistrez.
3. Cliquez sur **Tester la connexion** : chaque modèle répond à une question
   d'un mot, et le temps mis s'affiche sous le bouton.
4. Allez dans **Paramètres → Intelligence artificielle** et choisissez
   **Claude AI** comme fournisseur d'IA.

L'état en haut de l'écran de configuration passe au vert quand la clé est
acceptée et que les modèles choisis lui sont ouverts. En rouge, il dit
pourquoi.

## Les réglages

| Réglage                                  | Ce qu'il fait                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clé d'API Anthropic                      | Votre clé. Elle reste dans Gladys, n'est plus jamais affichée ni écrite dans les journaux.                                                                                                                         |
| Modèle du chat                           | Répond au chat, crée les scènes, rédige le résumé hebdomadaire. **Claude Opus 5.5** par défaut. Sonnet 5.5 est plus rapide et moins cher, Fable 5.1 le plus fort et le plus cher.                                  |
| Modèle du routeur                        | Trie chaque message avant la réponse. Gladys l'attend **20 secondes** au plus : gardez un modèle rapide, **Claude Haiku 5.5** par défaut.                                                                          |
| Effort de réflexion                      | Combien le modèle du chat réfléchit avant de répondre : faible, moyen (par défaut), élevé, très élevé. Plus d'effort aide sur les demandes difficiles (créer une scène), mais répond plus lentement et coûte plus. |
| Longueur maximale d'une réponse (jetons) | Le budget de sortie d'une réponse, réflexion comprise. 16 000 par défaut. Augmentez-le si les journaux indiquent qu'une réponse a atteint `max_tokens`.                                                            |

## Ce que Claude voit

Choisir un fournisseur d'IA est une décision de vie privée. Le fournisseur
reçoit :

- chaque message du chat et l'historique de la conversation ;
- la description des outils que Gladys lui propose, et leurs résultats —
  l'état des appareils qu'il consulte ;
- les images envoyées dans le chat.

Ses réponses pilotent vos appareils et créent vos scènes. Lisez la
[politique de confidentialité d'Anthropic](https://www.anthropic.com/legal/privacy)
avant de le choisir.

## Coûts et rapidité

- Le prompt système et la liste des outils reviennent à chaque message :
  l'intégration demande à Anthropic de les **mettre en cache**, ce qui les
  facture une fraction du prix après le premier message.
- Le routeur tourne toujours en effort faible sur le modèle du routeur : c'est
  la requête la plus fréquente.
- Pour dépenser moins, choisissez **Claude Sonnet 5.5** pour le chat ou
  baissez l'effort.
- Quand Claude décline une demande pour des raisons de sécurité, Anthropic la
  relance sur son modèle de repli par défaut dans le même appel ; si tous les
  modèles déclinent, l'assistant répond qu'il ne peut pas aider.

## Dépannage

- **« Anthropic a refusé la clé d'API »** — la clé est fausse, révoquée, ou
  appartient à une organisation sans crédit. Créez-en une nouvelle et
  collez-la à nouveau.
- **« … n'est pas disponible pour cette clé d'API »** — votre organisation
  Anthropic n'a pas accès à ce modèle : choisissez-en un autre.
- **« Limite de requêtes atteinte »** — trop de requêtes pour votre niveau
  d'usage Anthropic : patientez un instant, ou montez de niveau dans la
  console Anthropic.
- **« Impossible de joindre api.anthropic.com »** — Gladys n'a pas accès à
  Internet, ou un pare-feu bloque cette adresse.
- **L'assistant dit que le fournisseur d'IA est indisponible** — ouvrez
  l'onglet **Journaux** de l'intégration : chaque requête y écrit une ligne
  (modèle, temps, jetons) et chaque échec sa raison.
