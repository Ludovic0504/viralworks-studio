/**
 * Script de boot injecté dans index.html à chaque build.
 * S'exécute avant le bundle React — détecte un nouveau déploiement et purge le SW obsolète.
 */
export function buildVwsBootScript(buildId) {
  return `(function(){var BUILD_ID=${JSON.stringify(buildId)};var BUILD_KEY="vws_build_id";var RELOAD_KEY="vws_boot_reloading";function clearReload(){try{sessionStorage.removeItem(RELOAD_KEY)}catch(e){}}function markReload(){try{sessionStorage.setItem(RELOAD_KEY,"1")}catch(e){}}function isReloading(){try{return sessionStorage.getItem(RELOAD_KEY)==="1"}catch(e){return false}}function isFreshArrival(){try{var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(nav&&(nav.type==="navigate"||nav.type==="reload"))return true}catch(e){}try{var q=new URLSearchParams(location.search);if(q.get("payment")==="success")return true}catch(e){}return false}function purgeAndReload(){if(isReloading()){clearReload();return}markReload();var finish=function(){location.reload()};if(!("serviceWorker"in navigator)){finish();return}navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister()}))}).then(function(){if(!("caches"in window))return;return caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k)}))})}).then(function(){try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}finish()}).catch(finish)}if(isReloading()){clearReload();try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}return}var stored=null;try{stored=localStorage.getItem(BUILD_KEY)}catch(e){}if(stored&&stored!==BUILD_ID&&isFreshArrival()){purgeAndReload();return}if(!stored){try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}}if(!("serviceWorker"in navigator))return;navigator.serviceWorker.getRegistration("/").then(function(reg){if(!reg)return;void reg.update();if(reg.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"})}})})();`;
}

export function vwsBuildBootPlugin(buildId) {
  const bootScript = buildVwsBootScript(buildId);
  return {
    name: "vws-build-boot",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const injection = [
          `<meta name="vws-build" content="${buildId}" />`,
          `<script>${bootScript}</script>`,
        ].join("\n    ");
        return html.replace("<head>", `<head>\n    ${injection}`);
      },
    },
  };
}
