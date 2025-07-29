Je veux créer un SDK JavaScript/TypeScript pour VitaeFlow, un standard open-source permettant d'embarquer des données structurées de CV dans des PDFs pour résoudre les erreurs de parsing des ATS.

## CONTEXTE DU PROJET

### Problème à résoudre
- Les ATS ont 75% d'erreurs en parsant les CVs PDF
- Perte d'informations critiques lors du parsing
- Pas de standard pour données structurées dans PDF

### Solution VitaeFlow
- Embarquer un fichier resume.json dans le PDF (PAS de PDF/A-3 obligatoire)
- Triple niveau de métadonnées pour discovery et intégrité
- Validation par schéma + règles métier versionnées
- Support multi-versions avec migrations chainables
- Fonctionne en Node.js ET navigateur

## ARCHITECTURE DES MÉTADONNÉES (3 niveaux)

### Niveau 1 : XMP (Discovery rapide)
- Métadonnées légères dans le catalog du PDF
- Format XML avec namespace https://vitaeflow.org/ns/1.0/
- Contient : hasStructuredData, specVersion, candidateName, candidateEmail, checksum, lastModified
- Optionnel : resumeId (UUID pour tracking futur)
- NOTE : pdf-lib n'a pas de méthode setMetadata(), il faudra l'implémenter

### Niveau 2 : FileSpec Metadata (Technique)
- Dictionnaire custom /VF_Metadata dans le FileSpec
- Structure EXACTE :
  /VF_Metadata 
    /Type (resume)
    /Spec (org.vitaeflow.v1)
    /Version (1.0.0)
    /Checksum (sha256_hex)
    /Created (2024-01-15T10:00:00Z)
    /Compressed true/false
    /OriginalSize 12345
    /CompressedSize 5678
  >>

### Niveau 3 : Embedded File (Données complètes)
- TOUJOURS nommé "resume.json" (pas de personnalisation)
- Compression automatique si > 500KB (seuil configurable)
- Format JSON avec toutes les données du CV
- Si existe déjà : remplacement automatique sans confirmation

## STRUCTURE DU PROJET
vitaeflow-sdk-js/
├── src/
│   ├── index.ts                 # Exports publics de l'API
│   ├── constants.ts             # CURRENT_VERSION='1.0.0', COMPRESS_THRESHOLD=500*1024, MAX_FILE_SIZE=10MB, RESUME_FILENAME='resume.json', VITAEFLOW_NAMESPACE, CHECKSUM_ALGORITHM='SHA-256'
│   ├── types/                   # Types TypeScript
│   │   ├── resume.ts            # Import types depuis @vitaeflow/spec
│   │   ├── results.ts           # ExtractResult, ValidationResult, MigrationResult
│   │   └── options.ts           # EmbedOptions, ExtractOptions, ValidationOptions (avec maxIssues)
│   ├── pdf/                     # Manipulation PDF
│   │   ├── embed.ts             # Embedding avec triple metadata
│   │   ├── extract.ts           # Extraction avec vérification checksum
│   │   ├── metadata.ts          # Création/parsing /VF_Metadata
│   │   ├── xmp.ts               # Création/parsing XMP + implémentation setXMPMetadata
│   │   └── utils.ts             # loadPDF, compression, helpers
│   ├── validation/              # Validation schéma + règles
│   │   ├── validator.ts         # Classe Validator avec gestion versions
│   │   ├── rules/               # Règles métier core
│   │   │   ├── index.ts         # getCoreRulesForVersion(), filterRulesByVersion()
│   │   │   ├── types.ts         # Rule, VersionedRule, RuleResult interfaces
│   │   │   ├── dates.ts         # dates-chronological, dates-not-future, birth-date-valid
│   │   │   ├── required.ts      # required-experience-or-education
│   │   │   ├── logical.ts       # experience-duration, no-duplicate-entries
│   │   │   └── format.ts        # email-format
│   │   ├── errors.ts            # VitaeFlowError, ErrorCode enum
│   │   └── custom.ts            # Gestion règles custom utilisateur
│   ├── migration/               # Migrations entre versions
│   │   ├── migrator.ts          # Moteur chainable (1.0→1.1→1.2)
│   │   └── migrations/          # Vide pour futures migrations
│   ├── utils/                   # Utilitaires cross-platform
│   │   ├── version.ts           # detectVersion, compareVersions, satisfiesVersion
│   │   ├── compression.ts       # compress/decompress avec pako
│   │   ├── checksum.ts          # SHA-256 avec crypto (Node) ou crypto.subtle (browser)
│   │   ├── dates.ts             # parseDate, compareDates, calculateAge, isFutureDate
│   │   └── xml.ts               # escapeXml, parseXml pour XMP
│   ├── templates/               # Templates pré-remplis
│   │   ├── minimal.ts           # Juste champs obligatoires
│   │   ├── developer.ts         # CV développeur exemple
│   │   ├── designer.ts          # CV designer exemple
│   │   └── index.ts             # Export des templates
│   └── schemas/                 # Import schemas
│       └── index.ts             # Import depuis @vitaeflow/spec (PAS de duplication)
├── tests/
│   ├── unit/                    # Tests par module (>90% coverage requis)
│   ├── integration/             # Tests bout en bout
│   └── fixtures/                # PDFs et JSONs de test
├── examples/
│   ├── node/                    # Exemples Node.js commentés
│   ├── browser/                 # Exemples HTML vanilla
│   └── react/                   # Hook useVitaeFlow et composant
├── docs/
│   ├── API.md                   # Documentation API complète
│   ├── RULES.md                 # Documentation des règles et versioning
│   ├── MIGRATION.md             # Guide migrations entre versions
│   └── BROWSER.md               # Spécificités navigateur
├── scripts/
│   ├── build.js                 # Scripts de build custom
│   └── update-types.js          # Sync types avec @vitaeflow/spec
├── .github/
│   └── workflows/
│       ├── ci.yml               # Tests multi-OS, multi-Node
│       └── release.yml          # Auto-publish NPM sur tag
├── package.json                 # name: @vitaeflow/sdk, dependencies: @vitaeflow/spec, pdf-lib, pako, ajv, semver
├── tsconfig.json                # strict: true, target: ES2020
├── tsconfig.browser.json        # Config spécifique browser
├── jest.config.js               # Config tests avec ts-jest
├── rollup.config.js             # Build UMD pour navigateur
├── .eslintrc.js                 # Lint strict
├── .prettierrc                  # Formatage consistent
├── .gitignore
├── .npmignore
├── README.md                    # Documentation utilisateur
├── CHANGELOG.md                 # Historique versions
├── CONTRIBUTING.md              # Guide contribution
└── LICENSE                      # MIT

## FONCTIONNALITÉS DÉTAILLÉES

### 1. EMBED RESUME - Intégrer des données dans un PDF

**Fonction** : `embedResume(pdf: Buffer | Uint8Array, resume: Resume, options?: EmbedOptions): Promise<Buffer>`

**Objectif** : Attacher des données structurées de CV dans un PDF standard avec validation et triple métadonnées.

**Comportement détaillé** :
1. Vérifier que le PDF n'est pas encrypté (throw ErrorCode.ENCRYPTED_PDF)
2. Valider les données si options.validate !== false
   - Si échec : throw Error avec propriété `validation` contenant le résultat complet
3. Ajouter schema_version = CURRENT_VERSION si absent
4. Calculer checksum SHA-256 sur le JSON AVANT compression
5. Déterminer si compression nécessaire :
   - Si options.compress === true : toujours
   - Si options.compress === false : jamais
   - Si options.compress === 'auto' ou undefined : si > COMPRESS_THRESHOLD
6. Créer embedded file avec :
   - Nom TOUJOURS "resume.json"
   - Filter FlateDecode si compressé
   - Params avec Size original et dates
7. Créer FileSpec avec :
   - /F et /UF = "resume.json"
   - /Desc = "VitaeFlow Resume Data - Structured CV information"
   - /AFRelationship = 'Data' (même sans PDF/A-3)
   - /VF_Metadata avec structure exacte définie
8. Ajouter dans /Names/EmbeddedFiles :
   - Si "resume.json" existe déjà : le remplacer
   - Sinon : ajouter nouvelle entrée
9. Ajouter XMP sauf si options.skipXMP === true :
   - Créer stream Metadata dans catalog
   - Inclure toutes les infos VitaeFlow
10. Retourner PDF modifié

**Options** :
- `validate?: boolean` (défaut: true)
- `validateRules?: boolean` (défaut: true)
- `compress?: boolean | 'auto'` (défaut: 'auto')
- `skipXMP?: boolean` (défaut: false)
- `customMetadata?: Record<string, any>` pour extension future

**Erreurs possibles** :
- ENCRYPTED_PDF : PDF protégé par mot de passe
- VALIDATION_FAILED : Données invalides (avec détails)
- FILE_TOO_LARGE : Dépasse MAX_FILE_SIZE
- CORRUPTED_PDF : Structure PDF invalide

### 2. EXTRACT RESUME - Extraire les données d'un PDF

**Fonction** : `extractResume(pdf: Buffer | Uint8Array, options?: ExtractOptions): Promise<ExtractResult>`

**Objectif** : Extraire, décompresser, vérifier et valider les données VitaeFlow.

**Comportement détaillé** :
1. Charger le PDF (détecter si encrypté)
2. Tenter extraction XMP depuis catalog/Metadata :
   - Parser XML pour extraire infos VitaeFlow
   - Continuer même si échec (XMP optionnel)
3. Chercher "resume.json" dans /Names/EmbeddedFiles
4. Si trouvé :
   - Extraire le stream de données
   - Lire /VF_Metadata pour infos techniques
   - Détecter compression (via VF_Metadata ou Filter)
   - Décompresser si nécessaire
5. Parser JSON et gérer erreurs parsing
6. Calculer checksum et comparer avec VF_Metadata
7. Détecter version via (dans l'ordre) :
   - data.schema_version
   - data.$schema avec regex
   - Structure heuristique
   - Défaut : "1.0.0"
8. Valider selon options.mode :
   - 'strict' : seules versions connues
   - 'compatible' : accepte futures mineures
   - 'lenient' : validation minimale
9. Si options.validateRules !== false :
   - Sélectionner rules selon version
   - Appliquer rules (avec options.skipRules)
10. Si options.migrateToLatest && version != CURRENT_VERSION :
    - Appliquer migrations chainées
    - Conserver info migration
11. Retourner résultat complet

**Options** :
- `mode?: 'strict' | 'compatible' | 'lenient'` (défaut: 'compatible')
- `validateRules?: boolean` (défaut: true)
- `migrateToLatest?: boolean` (défaut: false)
- `includeXMP?: boolean` (défaut: false)
- `skipRules?: string[]` pour ignorer certaines règles

**Résultat ExtractResult** :
- `ok: boolean` : succès global
- `data?: Resume` : données extraites (et migrées si demandé)
- `metadata?: { version, checksum, checksumValid, created, compressed, fileSize }`
- `xmp?: { hasStructuredData, specVersion, candidateName, candidateEmail }` si includeXMP
- `issues: ValidationIssue[]` : tous les problèmes trouvés
- `error?: string` : erreur fatale si ok=false
- `migrated?: boolean` : si migration effectuée
- `migratedFrom?: string` : version originale si migré

### 3. VALIDATE RESUME - Valider des données

**Fonction** : `validateResume(data: any, options?: ValidationOptions): Promise<ValidationResult>`

**Objectif** : Valider données selon schéma ET règles métier versionnées.

**Comportement détaillé** :
1. Détecter version ou utiliser options.version
2. Charger schéma depuis @vitaeflow/spec selon version
3. Compiler et valider avec AJV :
   - allErrors: true pour toutes les erreurs
   - strict: false pour permettre champs additionnels
4. Convertir erreurs AJV en ValidationIssue
5. Si options.validateRules !== false && mode !== 'lenient' :
   - Obtenir rules core via getCoreRulesForVersion(version)
   - Filtrer avec filterRulesByVersion() si rules custom
   - Retirer rules dans options.skipRules
   - Ajouter options.customRules filtrées par version
   - Ajouter règles globales (addCustomRule)
   - Exécuter toutes les rules
6. Limiter issues si options.maxIssues défini
7. Calculer ok = pas d'erreurs (warnings ignorés)

**Options ValidationOptions** :
- `version?: string` : forcer version (sinon auto-detect)
- `mode?: 'strict' | 'lenient'` (défaut: 'strict')
- `validateRules?: boolean` (défaut: true)
- `skipRules?: string[]` : IDs de règles à ignorer
- `customRules?: Rule[]` : règles additionnelles
- `maxIssues?: number` : limite d'issues retournées

**Règles Core v1.0** (via getCoreRulesForVersion) :
1. `dates-chronological` : end_date > start_date (error)
2. `dates-not-future` : pas de futures sauf availability (warning)
3. `birth-date-valid` : 16-100 ans si présent (error/warning)
4. `experience-duration` : max 50 ans par job (warning)
5. `email-format` : regex basique (error)
6. `required-experience-or-education` : au moins un (error)
7. `no-duplicate-entries` : par organisation+position (warning)

**ValidationResult** :
- `ok: boolean` : aucune erreur
- `schemaValid: boolean` : validation schéma seule
- `rulesValid: boolean` : validation rules seule
- `version: string` : version utilisée
- `issues: ValidationIssue[]` : tous les problèmes

### 4. HAS RESUME - Vérification rapide

**Fonction** : `hasResume(pdf: Buffer | Uint8Array): Promise<boolean>`

**Objectif** : Check rapide sans extraction complète.

**Comportement** :
1. Charger PDF (minimal)
2. Vérifier XMP dans catalog/Metadata :
   - Chercher "vf:hasStructuredData>true"
   - Si trouvé : return true
3. Sinon chercher "resume.json" dans embedded files
4. Return true si trouvé, false sinon
5. Gérer erreurs silencieusement (return false)

**Optimisations** :
- Pas de parsing JSON
- Pas de validation
- Lecture minimale du PDF

### 5. CREATE RESUME - Templates

**Fonction** : `createResume(template?: 'minimal' | 'developer' | 'designer'): Resume`

**Objectif** : Créer CV pré-rempli pour démarrer.

**Templates** :
- `minimal` : schema_version + champs obligatoires
- `developer` : exemple complet développeur
- `designer` : exemple créatif/design
- Sans param : template minimal

**Comportement** :
- schema_version = CURRENT_VERSION
- Données cohérentes (dates valides, etc.)
- Passe validation par défaut

### 6. CUSTOM RULES - Règles utilisateur

**Fonctions** :
- `addCustomRule(rule: Rule): void` : ajouter globalement
- `removeCustomRule(ruleId: string): void` : retirer
- Via options.customRules pour une validation

**Format Rule** :
{
id: string                    // Identifiant unique
message: string               // Description erreur
severity?: 'error'|'warning'  // Défaut: 'error'
validate: (resume) => {       // Fonction validation
valid: boolean,
issues: ValidationIssue[]
}
appliesTo?: string           // Pattern semver optionnel
}

**Cas d'usage** :
- Limite nombre d'expériences pour un ATS
- Champs obligatoires spécifiques entreprise
- Validations secteur (santé, finance)
- Contraintes régionales

### 7. MIGRATE RESUME - Migrations

**Fonction** : `migrateResume(data: any, targetVersion?: string): Promise<MigrationResult>`

**Objectif** : Migrer données entre versions de schéma.

**Comportement** :
1. Détecter version source
2. Target = targetVersion ou CURRENT_VERSION
3. Si source === target : return unchanged
4. Construire chemin migration (ex: 1.0→1.1→1.2)
5. Pour chaque étape :
   - Cloner données (immutable)
   - Appliquer migration
   - Gérer erreurs par étape
6. Mettre à jour schema_version
7. Retourner avec historique

**MigrationResult** :
- `ok: boolean`
- `data?: Resume` : données migrées
- `error?: string` : si échec
- `fromVersion: string`
- `toVersion: string`
- `steps: string[]` : étapes appliquées

## GESTION DES ERREURS

### ErrorCode enum
- INVALID_PDF : PDF non valide
- ENCRYPTED_PDF : PDF protégé
- CORRUPTED_PDF : Structure corrompue
- NO_RESUME_FOUND : Pas de resume.json
- INVALID_RESUME_DATA : JSON invalide
- UNSUPPORTED_VERSION : Version inconnue (mode strict)
- VALIDATION_FAILED : Échec validation
- MIGRATION_FAILED : Échec migration
- CHECKSUM_MISMATCH : Données modifiées
- FILE_TOO_LARGE : Dépasse limite

### Patterns d'erreur
- Erreurs avec code pour identification
- Messages explicites pour debug
- Contexte additionnel si pertinent
- Stack traces en dev seulement

## SUPPORT MULTI-PLATEFORME

### Node.js
- crypto natif pour SHA-256
- Buffer pour données binaires
- Minimum version 14.x

### Navigateur
- crypto.subtle pour SHA-256
- Uint8Array pour binaire
- Polyfills inclus si nécessaire
- Global window.VitaeFlow exposé

### Build
- CommonJS pour Node legacy
- ESM pour Node moderne
- UMD bundle pour navigateurs
- Source maps en dev
- < 100KB minifié gzippé

## DÉPENDANCES

### Production (dans bundle)
- @vitaeflow/spec : schémas JSON officiels
- pdf-lib : manipulation PDF (pas de XMP natif)
- pako : compression zlib
- ajv : validation JSON Schema
- semver : comparaison versions

### Development
- TypeScript 5.x avec strict mode
- Jest + ts-jest pour tests
- ESLint + Prettier
- Rollup pour browser build
- @types pour toutes deps

## CONTRAINTES ET EXIGENCES

### Qualité code
- TypeScript strict (no any)
- JSDoc sur API publique
- Tests > 90% coverage
- Lint sans warnings
- Conventional commits

### Performance
- Extraction < 100ms (PDF 5MB)
- Validation < 50ms
- Compression ratio > 50%
- Memory efficient

### Compatibilité
- Node.js >= 14
- Browsers : Chrome/FF/Safari dernières 2 versions
- Edge cases : PDF encrypté, corrompu, vide
- Unicode : noms fichiers et données

### Sécurité
- Validation entrées utilisateur
- Limite tailles (10MB max)
- Pas d'eval ou Function()
- Checksum obligatoire

## PHASES DE DÉVELOPPEMENT

### PHASE 1 : Foundation (5 jours)
1. Setup projet, config, CI
2. Types depuis @vitaeflow/spec
3. Constants et ErrorCode
4. Structure dossiers
5. Tests helpers de base

### PHASE 2 : PDF Core (5 jours)
1. Embed basique sans metadata
2. Extract basique
3. Compression/décompression
4. Gestion erreurs PDF
5. Tests PDF edge cases

### PHASE 3 : Validation (5 jours)
1. Intégration AJV + schémas
2. Règles core v1.0
3. Système rules versionnées
4. Custom rules API
5. Tests toutes règles

### PHASE 4 : Metadata & Security (5 jours)
1. FileSpec /VF_Metadata
2. XMP création/parsing
3. Checksum SHA-256
4. Triple validation
5. Tests sécurité

### PHASE 5 : Features (5 jours)
1. Migration system
2. Templates CV
3. Browser build
4. Exemples complets
5. Documentation

### PHASE 6 : Release (3 jours)
1. API docs finale
2. README et guides
3. CI/CD complet
4. NPM publication prep
5. Annonce v1.0.0

## LIVRABLES FINAUX

### Package NPM @vitaeflow/sdk
- Code TypeScript compilé
- Types definitions
- Browser bundles
- Source maps

### Documentation
- README avec quick start
- API.md référence complète
- RULES.md pour règles
- MIGRATION.md pour upgrades
- Exemples Node/Browser/React

### Qualité
- Badge coverage > 90%
- CI passing
- 0 vulnerabilities
- Bundle size respectée

Le SDK doit être production-ready, bien documenté, et facile à intégrer pour les développeurs de CV builders et d'ATS.