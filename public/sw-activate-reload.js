/* Recharge tous les onglets quand un nouveau service worker prend le relais (post-déploiement). */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && "navigate" in client) {
          void client.navigate(client.url);
        }
      }
    }),
  );
});
