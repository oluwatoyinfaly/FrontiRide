import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 47005,
    // Le serveur de développement refuse par défaut tout nom d'hôte inconnu,
    // donc le domaine que Coolify lui attribue. À restreindre à ce domaine si
    // ce déploiement de test devait durer.
    allowedHosts: true,
  },
});
