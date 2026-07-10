/**
 * Script de boot injecté dans index.html à chaque build.
 * S'exécute avant le bundle React — redirection canonique, purge SW obsolète.
 */
export function buildVwsBootScript(buildId, canonicalOrigin = "") {
  return `(function(){var BUILD_ID=${JSON.stringify(buildId)};var CANONICAL=${JSON.stringify(canonicalOrigin)};var BUILD_KEY="vws_build_id";var RELOAD_KEY="vws_boot_reloading";function redirectToCanonicalIfNeeded(){if(!CANONICAL)return;try{var host=location.hostname;if(host==="localhost"||host==="127.0.0.1")return;if(/\\.netlify\\.app$/i.test(host)||location.origin!==CANONICAL){location.replace(CANONICAL+location.pathname+location.search+location.hash)}}catch(e){}}function clearReload(){try{sessionStorage.removeItem(RELOAD_KEY)}catch(e){}}function markReload(){try{sessionStorage.setItem(RELOAD_KEY,"1")}catch(e){}}function isReloading(){try{return sessionStorage.getItem(RELOAD_KEY)==="1"}catch(e){return false}}function isFreshArrival(){try{var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(nav&&(nav.type==="navigate"||nav.type==="reload"))return true}catch(e){}try{var q=new URLSearchParams(location.search);var payment=q.get("payment");if(payment==="success"||payment==="cancelled")return true;if(q.get("confirmed")==="1")return true}catch(e){}return false}function purgeAndReload(){if(isReloading()){clearReload();return}markReload();var finish=function(){location.reload()};if(!("serviceWorker"in navigator)){finish();return}navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister()}))}).then(function(){if(!("caches"in window))return;return caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k)}))})}).then(function(){try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}finish()}).catch(finish)}redirectToCanonicalIfNeeded();if(isReloading()){clearReload();try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}return}var stored=null;try{stored=localStorage.getItem(BUILD_KEY)}catch(e){}if(stored&&stored!==BUILD_ID&&isFreshArrival()){purgeAndReload();return}if(!stored){try{localStorage.setItem(BUILD_KEY,BUILD_ID)}catch(e){}}if(!("serviceWorker"in navigator))return;navigator.serviceWorker.getRegistration("/").then(function(reg){if(!reg)return;void reg.update();if(reg.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"})}})})();`;
}

export function vwsBuildBootPlugin(buildId, canonicalOrigin = "") {
  const bootScript = buildVwsBootScript(buildId, canonicalOrigin);
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
