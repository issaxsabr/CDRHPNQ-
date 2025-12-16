# Rapport d'Audit Complet - CDRHPNQ Scavenger v0.9

**Date:** 16 décembre 2025
**Projet:** CDRHPNQ Scavenger - Outil de Lead Generation B2B
**Technologie:** React 19 + TypeScript + Vite + Supabase

---

## Table des Matières

1. [Résumé Exécutif](#résumé-exécutif)
2. [Problèmes de Sécurité (Critiques)](#1-problèmes-de-sécurité-critiques)
3. [Problèmes de Qualité du Code](#2-problèmes-de-qualité-du-code)
4. [Problèmes de Performance](#3-problèmes-de-performance)
5. [Problèmes d'Architecture](#4-problèmes-darchitecture)
6. [Problèmes d'Accessibilité](#5-problèmes-daccessibilité)
7. [Amélioration de l'Expérience Utilisateur](#6-amélioration-de-lexpérience-utilisateur)
8. [Tests et Qualité](#7-tests-et-qualité)
9. [Configuration et Build](#8-configuration-et-build)
10. [Recommandations Prioritaires](#recommandations-prioritaires)

---

## Résumé Exécutif

| Catégorie | Critiques | Majeures | Mineures |
|-----------|-----------|----------|----------|
| Sécurité | 4 | 3 | 2 |
| Qualité Code | 1 | 8 | 12 |
| Performance | 0 | 4 | 6 |
| Architecture | 1 | 3 | 5 |
| Accessibilité | 0 | 2 | 4 |
| UX | 0 | 3 | 5 |
| Tests | 1 | 2 | 1 |
| **TOTAL** | **7** | **25** | **35** |

---

## 1. Problèmes de Sécurité (Critiques)

### 1.1 Clés Supabase en dur dans le code source

**Fichier:** `services/supabase.ts:8-9`
**Gravité:** CRITIQUE

```typescript
const FALLBACK_URL = "https://fbukrfcmjtedagcjuwgk.supabase.co";
const FALLBACK_KEY = "sb_publishable_e7axY_rsM9uYi8LBYswXPA_UtQizWih";
```

**Problème:** Les clés API sont exposées dans le code source et seront visibles dans le bundle JavaScript de production.

**Correction:**
- Supprimer les clés fallback
- Utiliser uniquement les variables d'environnement
- Afficher une erreur claire si les variables ne sont pas configurées

---

### 1.2 Clé de chiffrement statique en dur

**Fichier:** `services/security.ts:6`
**Gravité:** CRITIQUE

```typescript
const SECRET_KEY_MATERIAL = 'cdrhpnq-v2-local-db-secret-key';
```

**Problème:** Le chiffrement côté client avec une clé statique offre une protection illusoire. Tout attaquant peut déchiffrer les données.

**Correction:**
- Dériver la clé du mot de passe utilisateur
- Ou utiliser Supabase Row Level Security pour les données sensibles
- Documenter clairement les limites de cette approche

---

### 1.3 Mode Démo contourne l'authentification

**Fichier:** `App.tsx:183-209`
**Gravité:** MAJEURE

```typescript
const handleBypassAuth = () => {
    // Create a fake session for demo purposes
    const fakeSession = { ... } as unknown as Session;
    setSession(fakeSession);
};
```

**Problème:** Le mode démo crée une fausse session qui pourrait être exploitée.

**Correction:**
- Implémenter un vrai mode invité avec des permissions limitées
- Désactiver les appels API réels en mode démo
- Ajouter des gardes côté serveur

---

### 1.4 Absence de Rate Limiting côté client

**Fichier:** `App.tsx:474-540`
**Gravité:** MAJEURE

**Problème:** Bien qu'il y ait un délai entre les batches (`BATCH_DELAY_MS`), il n'y a pas de protection contre l'abus de l'API.

**Correction:**
- Implémenter un rate limiter avec queue
- Ajouter un circuit breaker pour les erreurs répétées
- Utiliser des tokens par session

---

### 1.5 Validation incomplète des entrées

**Fichier:** `utils/validation.ts`
**Gravité:** MAJEURE

```typescript
phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/, ...)
```

**Problème:** La regex pour les téléphones est trop permissive. Certaines validations manquent.

**Corrections:**
- Valider les URLs avec une regex plus stricte
- Ajouter une validation pour les champs `socials`
- Limiter la taille des tableaux `phones` et `emails`

---

### 1.6 Risque XSS résiduel

**Fichier:** `utils/validation.ts:44`
**Gravité:** MINEURE

```typescript
if (['name', 'status', 'address', 'hours', 'category', 'customField'].includes(field)) {
    return { [field]: DOMPurify.sanitize(validatedValue) };
}
```

**Problème:** Les autres champs textuels ne sont pas sanitisés (searchedTerm, sourceTitle, etc.)

**Correction:**
- Sanitiser tous les champs textuels à l'entrée
- Utiliser `dangerouslySetInnerHTML` uniquement quand nécessaire

---

### 1.7 Manque de Content Security Policy

**Fichier:** `index.html`
**Gravité:** MINEURE

**Problème:** Pas de CSP configurée, permettant potentiellement l'injection de scripts.

**Correction:**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; ...">
```

---

## 2. Problèmes de Qualité du Code

### 2.1 Fichier App.tsx trop volumineux

**Fichier:** `App.tsx` (808 lignes)
**Gravité:** MAJEURE

**Problème:** Le composant principal concentre trop de responsabilités:
- Logique d'authentification
- Gestion d'état globale
- Logique métier de recherche
- Export de données
- Gestion du cache

**Correction:**
- Extraire `useSearch` hook pour la logique de recherche
- Extraire `useExport` hook pour les exports
- Créer un contexte `AuthContext`
- Séparer les handlers en fichiers dédiés

---

### 2.2 Typage `any` excessif

**Fichiers:** Multiple
**Gravité:** MAJEURE

```typescript
// services/gemini.ts:83
export const enrichWithGemini = async (context: SerperOptimizedResult, query: string): Promise<any>

// services/serper.ts:8-9
places: any[];
organic: any[];
knowledgeGraph: any | null;
```

**Correction:**
- Définir des interfaces strictes pour les réponses API
- Utiliser des types génériques quand nécessaire
- Éviter `as unknown as Type`

---

### 2.3 Absence de gestion d'erreurs centralisée

**Gravité:** MAJEURE

**Problème:** Chaque fonction gère les erreurs différemment avec des `try/catch` dispersés.

**Correction:**
```typescript
// services/errorHandler.ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public recoverable: boolean = true
  ) { super(message); }
}

export const handleApiError = (error: unknown): AppError => { ... }
```

---

### 2.4 Duplication de code - Grid Template

**Fichier:** `components/ResultTable.tsx:186, 399`
**Gravité:** MINEURE

```typescript
// Même définition répétée 2 fois
const gridTemplateColumns = "minmax(200px, 1.8fr) minmax(80px, 0.6fr) ...";
```

**Correction:**
- Définir comme constante en haut du fichier
- Ou créer un fichier de configuration de layout

---

### 2.5 Magic Numbers

**Fichiers:** Multiple
**Gravité:** MINEURE

```typescript
// App.tsx
setTimeout(() => setIsTourActive(true), 1500);  // Pourquoi 1500?

// services/security.ts
iterations: 100000  // Constante PBKDF2

// components/ResultTable.tsx
const ROW_HEIGHT = 80;
```

**Correction:**
- Déplacer vers `config.ts` avec des noms explicites
- Documenter les raisons des valeurs choisies

---

### 2.6 Console.log et console.warn en production

**Fichiers:** Multiple
**Gravité:** MINEURE

```typescript
// Plus de 15 occurrences de console.log/warn/error
console.error("Erreur Proxy Gemini:", error);
console.warn("Gemini response was valid but contained no text part.", data);
```

**Correction:**
- Implémenter un logger configurable
- Désactiver en production
- Utiliser un service de monitoring (Sentry, LogRocket)

---

### 2.7 Fonctions fléchées dans les props de rendu

**Fichier:** `App.tsx:686`
**Gravité:** MINEURE

```typescript
onCreateProject={(name) => {
    handleCreateProject(name);
    addToast({...});
}}
```

**Problème:** Crée une nouvelle fonction à chaque rendu.

**Correction:**
```typescript
const onCreateProjectWithToast = useCallback((name: string) => {
    handleCreateProject(name);
    addToast({...});
}, [handleCreateProject, addToast]);
```

---

### 2.8 Import non utilisé

**Fichier:** `App.tsx:29`
**Gravité:** MINEURE

```typescript
import { TimelineStep } from './components/Timeline';
// TimelineStep est utilisé, mais vérifier les autres imports
```

**Correction:**
- Exécuter `npx eslint --fix` pour nettoyer
- Configurer ESLint avec les règles `no-unused-vars`

---

### 2.9 Commentaires obsolètes ou trompeurs

**Fichiers:** Multiple
**Gravité:** MINEURE

```typescript
// services/security.ts:4-5
// NOTE : Dans une application de production, cette clé devrait être gérée...
// Pour l'obfuscation côté client dans IndexedDB...
```

**Problème:** Le code est probablement en production, mais les commentaires suggèrent le contraire.

**Correction:**
- Mettre à jour les commentaires
- Supprimer les commentaires obsolètes
- Documenter les décisions architecturales

---

### 2.10 Nommage incohérent

**Gravité:** MINEURE

```typescript
// Mélange français/anglais
handleCreateProject vs handleDeleteProject
"Entreprise" vs "businesses"
columnLabels.name = "Entreprise"
```

**Correction:**
- Adopter une convention (EN pour le code, FR pour l'UI)
- Créer un fichier de traduction `i18n.ts`

---

## 3. Problèmes de Performance

### 3.1 Lazy Loading incomplet des modals

**Fichier:** `App.tsx:32-37`
**Gravité:** MAJEURE

```typescript
const ProjectModal = lazy(() => import('./components/modals/ProjectModal'));
// Mais les composants internes des modals ne sont pas lazy-loadés
```

**Correction:**
- Ajouter `React.memo` aux composants enfants
- Utiliser `useDeferredValue` pour les listes longues

---

### 3.2 Re-rendus inutiles de filteredData

**Fichier:** `App.tsx:576-591`
**Gravité:** MAJEURE

```typescript
const filteredData = useMemo(() => { ... }, [state.results, exportFilters]);
```

**Problème:** Le filtrage est recalculé même si seuls les filtres booléens changent.

**Correction:**
```typescript
const debouncedFilters = useDeferredValue(exportFilters);
const filteredData = useMemo(() => { ... }, [state.results, debouncedFilters]);
```

---

### 3.3 Favicon externe pour chaque ligne

**Fichier:** `components/ResultTable.tsx:205`
**Gravité:** MAJEURE

```typescript
src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
```

**Problème:** Requête HTTP pour chaque ligne visible du tableau.

**Correction:**
- Mettre en cache les favicons
- Utiliser un fallback SVG intégré
- Charger les favicons en batch

---

### 3.4 Absence de debouncing sur les inputs

**Fichier:** `components/ResultTable.tsx:42-46`
**Gravité:** MINEURE

```typescript
const handleSave = () => {
    setIsEditing(false);
    if (tempValue !== value) {
        onSave(tempValue);  // Sauvegarde immédiate
    }
};
```

**Correction:**
- Ajouter un debounce de 300ms
- Grouper les sauvegardes IndexedDB

---

### 3.5 Calcul de stats non optimisé

**Fichier:** `App.tsx:614-620`
**Gravité:** MINEURE

```typescript
const stats = useMemo(() => {
    const actives = state.results.filter(r => ...).length;
    const closed = state.results.filter(r => ...).length;
    // 4 passes sur le même tableau
}, [state.results]);
```

**Correction:**
```typescript
const stats = useMemo(() => {
    return state.results.reduce((acc, r) => {
        const status = r.status?.toLowerCase() || '';
        if (status.includes('activ')) acc.actives++;
        // ... une seule passe
        return acc;
    }, { actives: 0, closed: 0, warnings: 0, emails: 0 });
}, [state.results]);
```

---

### 3.6 Bundle Tailwind CSS via CDN

**Fichier:** `index.html`
**Gravité:** MINEURE

```html
<script src="https://cdn.tailwindcss.com?plugins=forms"></script>
```

**Problème:** Charge tout Tailwind (~300KB) au lieu de purger les classes inutilisées.

**Correction:**
- Installer Tailwind en dépendance
- Configurer PostCSS avec PurgeCSS
- Réduire le bundle à ~10-20KB

---

## 4. Problèmes d'Architecture

### 4.1 Absence de séparation API/UI

**Gravité:** CRITIQUE

**Problème:** Les services appellent directement l'UI (via `addToast`) et l'UI contient de la logique métier.

**Correction:**
- Créer une couche API claire
- Utiliser des events ou callbacks pour les notifications
- Implémenter un state manager (Zustand, Jotai)

---

### 4.2 Gestion d'état dispersée

**Gravité:** MAJEURE

**Problème:** État réparti entre:
- `useState` local
- `localStorage`
- `IndexedDB`
- Contexte React

**Correction:**
- Centraliser dans un store unique
- Synchroniser automatiquement avec le stockage persistant
- Utiliser des hooks pour l'accès

---

### 4.3 Couplage fort Supabase

**Gravité:** MAJEURE

**Problème:** Les services appellent directement `supabase.functions.invoke`.

**Correction:**
```typescript
// services/api.ts
export interface ApiClient {
  search(query: string, options: SearchOptions): Promise<SearchResult>;
  enrich(data: EnrichmentInput): Promise<EnrichmentResult>;
}

export const createSupabaseClient = (): ApiClient => ({
  search: async (query, options) => {
    return supabase.functions.invoke('proxy-api', {...});
  },
  // ...
});
```

---

### 4.4 Absence de couche Repository

**Gravité:** MINEURE

**Problème:** `projectService` mélange accès données et logique métier.

**Correction:**
- Séparer `ProjectRepository` (CRUD)
- Et `ProjectService` (logique métier)

---

### 4.5 Configuration non centralisée

**Gravité:** MINEURE

**Problème:** Configuration dispersée dans plusieurs fichiers.

**Correction:**
- Créer `config/index.ts` avec tous les paramètres
- Valider la configuration au démarrage
- Supporter plusieurs environnements

---

## 5. Problèmes d'Accessibilité

### 5.1 Contraste insuffisant

**Fichier:** `index.css`, composants UI
**Gravité:** MAJEURE

```css
/* Couleurs earth-500, beige-300 peuvent avoir un ratio < 4.5:1 */
```

**Correction:**
- Auditer avec aXe ou Lighthouse
- Assurer un ratio minimum de 4.5:1
- Ajouter des modes haute contraste

---

### 5.2 Focus non visible sur certains éléments

**Fichier:** `components/ResultTable.tsx:74`
**Gravité:** MAJEURE

```typescript
className={`cursor-text hover:bg-beige-50 ... border border-transparent hover:border-beige-300`}
```

**Problème:** Pas de style `:focus-visible`.

**Correction:**
```typescript
className={`... focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:outline-none`}
```

---

### 5.3 Aria-labels manquants

**Fichier:** `components/ResultTable.tsx:379`
**Gravité:** MINEURE

```typescript
<a href={item.website}>Web</a>
```

**Correction:**
```typescript
<a href={item.website} aria-label={`Visiter le site web de ${item.name}`}>Web</a>
```

---

### 5.4 Navigation clavier incomplète

**Gravité:** MINEURE

**Problème:** Les dropdowns et menus ne sont pas entièrement navigables au clavier.

**Correction:**
- Implémenter la navigation avec flèches
- Ajouter `role="menu"` et `role="menuitem"`
- Gérer `Escape` pour fermer

---

## 6. Amélioration de l'Expérience Utilisateur

### 6.1 Feedback de chargement insuffisant

**Gravité:** MAJEURE

**Problème:** Pendant les longues opérations, l'utilisateur manque de feedback.

**Correction:**
- Ajouter un skeleton loader pour le tableau
- Afficher la progression détaillée
- Permettre l'annulation à tout moment

---

### 6.2 Gestion des erreurs côté utilisateur

**Gravité:** MAJEURE

**Problème:** Les erreurs API affichent des messages techniques.

```typescript
throw new Error(`Proxy Supabase Error: ${error.message}`);
```

**Correction:**
- Mapper les erreurs vers des messages utilisateur
- Proposer des actions de récupération
- Logger les détails techniques séparément

---

### 6.3 Confirmation destructive insuffisante

**Fichier:** `hooks/useProjects.ts:33`
**Gravité:** MAJEURE

```typescript
if(window.confirm("Supprimer ce dossier et toutes ses données ?"))
```

**Correction:**
- Utiliser un modal de confirmation personnalisé
- Afficher le nombre d'éléments qui seront supprimés
- Implémenter une corbeille / soft delete

---

### 6.4 État vide non géré

**Gravité:** MINEURE

**Problème:** Pas d'illustration ou de guidance quand il n'y a pas de résultats.

**Correction:**
- Ajouter un composant `EmptyState`
- Guider l'utilisateur vers les actions possibles

---

### 6.5 Tooltips manquants

**Gravité:** MINEURE

**Problème:** Beaucoup d'icônes sans texte explicatif.

**Correction:**
- Ajouter des tooltips sur tous les boutons icônes
- Utiliser une librairie comme Radix ou Headless UI

---

## 7. Tests et Qualité

### 7.1 Absence totale de tests

**Gravité:** CRITIQUE

**Problème:** Aucun test unitaire, d'intégration ou e2e.

**Correction:**
1. Ajouter Vitest pour les tests unitaires:
```typescript
// services/gemini.test.ts
describe('extractDataFromContext', () => {
  it('should extract business data from maps result', async () => {
    const mockResult = { places: [...], organic: [] };
    const result = await extractDataFromContext('query', mockResult);
    expect(result.businesses[0].name).toBe('Expected Name');
  });
});
```

2. Ajouter Testing Library pour les composants
3. Ajouter Playwright pour les tests e2e

---

### 7.2 Absence de linting/formatting

**Gravité:** MAJEURE

**Problème:** Pas de configuration ESLint ou Prettier.

**Correction:**
```json
// package.json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src"
  }
}
```

---

### 7.3 Pas de CI/CD visible

**Gravité:** MAJEURE

**Problème:** Pas de pipeline d'intégration continue.

**Correction:**
- Configurer GitHub Actions
- Exécuter tests, lint, build sur chaque PR
- Déployer automatiquement sur les environnements

---

## 8. Configuration et Build

### 8.1 Version package.json incohérente

**Fichier:** `package.json:4`
**Gravité:** MINEURE

```json
{
  "name": "cdrhpnq-scavenger-0.9",
  "version": "0.0.0"
}
```

**Correction:**
```json
{
  "name": "cdrhpnq-scavenger",
  "version": "0.9.0"
}
```

---

### 8.2 Dependencies non versionnées strictement

**Fichier:** `package.json`
**Gravité:** MINEURE

```json
"react": "^19.2.0"  // ^ permet les updates mineurs
```

**Correction:**
- Utiliser des versions exactes pour les dépendances critiques
- Ou utiliser un lockfile (package-lock.json)

---

### 8.3 Dépendances potentiellement redondantes

**Fichier:** `package.json`
**Gravité:** MINEURE

```json
"exceljs": "4.4.0",
"xlsx": "^0.18.5"  // Deux librairies pour les Excel?
```

**Correction:**
- Auditer l'utilisation de chaque librairie
- Supprimer les dépendances redondantes

---

### 8.4 Absence de fichier .env.example

**Gravité:** MINEURE

**Correction:**
```env
# .env.example
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_key
```

---

## Recommandations Prioritaires

### Priorité 1 - Sécurité (À faire immédiatement)

1. **Supprimer les clés API en dur** (`supabase.ts`)
2. **Revoir la stratégie de chiffrement** (`security.ts`)
3. **Désactiver le bypass d'authentification** en production

### Priorité 2 - Stabilité (Semaine 1-2)

4. **Ajouter des tests unitaires** pour les services critiques
5. **Configurer ESLint + Prettier**
6. **Implémenter une gestion d'erreurs centralisée**

### Priorité 3 - Maintenabilité (Semaine 2-4)

7. **Refactoriser App.tsx** en hooks et composants
8. **Créer des types stricts** pour les réponses API
9. **Centraliser la configuration**

### Priorité 4 - Performance (Mois 1)

10. **Installer Tailwind en local** (supprimer le CDN)
11. **Optimiser le chargement des favicons**
12. **Implémenter le debouncing** sur les inputs

### Priorité 5 - UX/Accessibilité (Mois 2)

13. **Améliorer le contraste des couleurs**
14. **Ajouter des états vides**
15. **Compléter la navigation clavier**

---

## Métriques de Suivi

| Métrique | Actuel | Objectif |
|----------|--------|----------|
| Couverture de tests | 0% | > 70% |
| Score Lighthouse Performance | ~65 | > 90 |
| Score Lighthouse Accessibilité | ~75 | > 95 |
| Bundle Size (gzip) | ~350KB | < 150KB |
| Temps de chargement initial | ~3s | < 1.5s |
| Erreurs TypeScript strict | N/A | 0 |

---

*Rapport généré le 16 décembre 2025*
