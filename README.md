# Projet_interpr-teur
Theme 1 : interpréteur (NodeJS/deno/Bun) + TypeScript :

    TS : détails et expertise
    Node : marché, évolution

Construction du TP
Phase 1 : Choix et préparation

    Indiquer son nom, les IA choisies, le méta-framework choisi et l'interpréteur choisi.
    Expliquer sa thématique

Phase 2 : Développement

    Commencer par une maquette Figma et la transformer en interface fidèle et accessible.
    Gérer l'accéssibilité (tests avec Lighthouse)
    Choisir l'interpréteur ECMAScript (NodeJS/deno/Bun)
    Choisir un méta-framework (NextJS, NuxtJS, SvelteKit) et TypeScript pour le FrontEnd
    Utiliser le backEnd intégré au framework pour gérer une API simple.
    Utiliser les capacités d'une PWA (mode déconnecté, notifs push, ...)

Phase 3 : Tests et performances

    Implémenter une même page en CSR, SSR et SSG, comparer les Web Vitals.
    Améliorer son score Lighthouse selon WCAG 2.2
    Mise en place de tests completes (unitaires, fonctionnels, end-to-end) via un framework.

Phase 4 : Sécurité et performances

    Mise en place de la sécurité (Content Security Policy, gestion des secrets, protections XSS et CSRF)

Phase 5 : Mise en production

    Mise en production via docker

Evaluation :

    analyse du projet, test de performance et d'accessibilité
    prestation orale de l'élève

---

## Phase 1 : choix et préparation

- **Nom** : Quentin Durant
- **IA utilisées** :
  - Claude Code (Claude Sonnet 5.5, Anthropic) : guide de la démarche, aide à l'écriture du code et des tests ;
  - Claude Design (Anthropic) : maquettes de l'interface ;
  - ministral-3:3b (Mistral AI), servi en local par Ollama : IA de démonstration de l'application.
- **Méta-framework** : Next.js (App Router) avec TypeScript.
- **Interpréteur** : Bun. Node et Deno sont comparés dans l'application.
- **Thématique** : une page de discussion avec une IA locale. Un sélecteur en haut de la page choisit quel interpréteur (Bun, Node ou Deno) fait tourner le serveur qui relaie la conversation, chacun dans son conteneur Docker. L'application affiche des mesures (délai avant le premier token, tokens par seconde, surcoût du serveur, mémoire) et montre que la vitesse du modèle ne dépend pas de l'interpréteur, contrairement au surcoût, à la mémoire et au démarrage. Elle illustre « TypeScript : détails et expertise » (TypeScript effaçable, types partagés entre trois interpréteurs) et « Node : marché, évolution » (Node face à Bun et Deno). Le projet s'appuie sur IA Locale, une plateforme de déploiement et de suivi d'IA privées développée par l'auteur, dont l'identité visuelle est reprise dans les maquettes.
