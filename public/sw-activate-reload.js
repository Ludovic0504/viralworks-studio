/* Mise à jour PWA silencieuse : pas de rechargement forcé ici (géré côté page). */
self.addEventListener("activate", () => {
  // clientsClaim est déjà activé via Workbox.
});
