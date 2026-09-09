# Octavi

Octavi est une plateforme de consultation des données de taxi, développée pour l'Agence de mobilité durable de Montréal à partir des données GPS des activités de taxi.

## Installation sous Linux

Octavi est développé en TypeScript dans l'environnement Node.js. Il utilise les bibliothèques communes aux applications de la Chaire Mobilité, qui se trouvent dans le dépôt Transition (https://github.com/chairemobilite/transition).

### Installer Node.js et Corepack sous Linux

Ignorez cette étape si Node.js est déjà installé sur votre système.

```bash
    sudo apt update
    sudo apt install nodejs
    npm install -g corepack
    node -v
```

### Installer PostgreSQL et PostGIS sous Linux

Sous Linux, suivez ces instructions pour installer les dépendances.

```bash
    sudo apt update
    sudo apt install postgresql postgis
    psql --version

    # Définir un mot de passe pour l'utilisateur postgres (facultatif)
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '<Password>'"
```

## Préparer et compiler l'application

Les étapes suivantes expliquent comment préparer et compiler l'application.

- Créez un fichier `.env` à la racine du projet (vous pouvez copier le fichier `.env.example`), puis configurez le projet.
- Dans le fichier `.env`, indiquez la chaîne de connexion à PostgreSQL, ainsi que la clé d'API pour accéder aux données du registre de taxi. Sans cette clé, il ne sera pas possible d'importer les données du registre automatiquement.

```env
    PG_CONNECTION_STRING_PREFIX = "postgres://postgres:<Password>@localhost:5432/"
    BTM_API_KEY=<BTMAPIKEY>
```

- `git submodule init && git submodule update` : récupère le dépôt Transition.
- `yarn install` ou simplement `yarn` : télécharge les paquets nécessaires à l'application.
- `yarn compile` : compile les fichiers TypeScript en JavaScript.
- `yarn setup` : prépare la base de données pour le projet courant.
- `yarn migrate` : met à jour le schéma de la base de données. Cette commande peut être exécutée après une mise à jour du code source.
- Facultatif — `yarn create-user` : crée un nouvel utilisateur dans la base de données, qui pourra ensuite se connecter à l'interface Web. Cette commande peut être exécutée en mode non interactif avec les paramètres suivants : `yarn create-user --username <username> --email <email> --password <clearTextPassword> [--first_name <firstName> --last_name <lastName> --[no-]admin --[no-]valid --[no-]confirmed --prefs <jsonStringOfPreferences>]`. Par exemple, pour créer un compte administrateur dont la langue préférée est le français, exécutez : `yarn create-user --username admin --email admin@example.org --password MyAdminPassword --admin --prefs '{ "lang": "fr" }'`.

## Obtenir des données

La plateforme de consultation nécessite d'importer les activités à partir de points GPS des véhicules. Ces points seront associés à une source de données taxi. Cette source sera créée la première fois que la tâche d'import sera exécutée et peut nécessiter des étapes manuelles, elle doit avoir le shortname de `btm_api` et un nom du choix de l'utilisateur. Les imports subséquents se feront sans intervention. Les commandes suivantes feront l'import initial à partir d'une date et les import subséquents:

```bash
# Importation initiale des données, avec une date de départ
yarn node packages/octavi-backend/lib/tasks/importTaxiPointsFromApi.task.js --dataSource btm_api --start 2026-09-01 --end 2026-09-02
# Les mises à jour subséquentes utiliseront la date de la dernière activité
yarn node packages/octavi-backend/lib/tasks/importTaxiPointsFromApi.task.js --dataSource btm_api
```

*Note: la gestion des zones est appelée à changer dans un futur proche. Cette documentation est temporaire*

Un des filtres disponibles pour la consultation de données est un filtre géographique, sur les secteurs de recensement ou secteurs municipaux. Afin de simplifier ces requêtes, les zones d'origine et destination sont pré-calculées. Pour pouvoir ce faire, il faut d'abord importer les zones dans Octavi avec la commande suivante. Lors de l'import, une source de données devra être créée. Pour l'instant, le shortname de cette source est fixe et doit être `btm_zone`. Le nom n'a pas d'importance. Comme information additionnelle, le shortname pour chaque zone doit être `SR` et le nom `SM_name`.

```bash
yarn node transition/packages/chaire-lib-backend/lib/scripts/zones/importZones.task.js --zones-file examples/demo_octavi/mtl_zones.geojson
```

Une fois les zones et les activités importées, la jointure spatiale se fait avec la commande suivante:

```bash
# Joindre les nouvelles activités de taxi avec la source de données de zones
yarn node packages/octavi-backend/lib/tasks/joinZonesToTaxiActivities.task.js --taxiDs btm_api --zonesDs btm_zone
```

## Exécution l'application

Un fichier de configuration est fourni avec le code source dans `examples/demo_octavi/config.js`. Si le fichier `.env` a été copié du `.env.example`, il pointe déjà vers ce fichier.

Pour compiler la portion client de l'application, exécuter `yarn build:dev` dans un environnement de développement local, pour avoir accès au code source en debug, ou `yarn build:prod` pour une version minimisée de l'application web.

Pour rouler le server, exécuter `yarn start`.

Visiter octavi au http://localhost:8080.

