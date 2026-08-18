import { registerRootComponent } from "expo";

import App from "./App";

// Point d'entrée explicite plutôt que le AppEntry.js d'Expo : dans un monorepo
// npm, les dépendances sont hoistées à la racine, donc le chemin relatif
// "node_modules/expo/AppEntry.js" ne résout pas depuis apps/mobile.
registerRootComponent(App);
