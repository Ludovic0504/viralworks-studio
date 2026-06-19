const DRAWER_LOCK_CLASS = "mobile-nav-drawer-lock";

/** Retire tout verrou scroll laissé par le menu burger mobile. */
export function clearMobileNavDrawerScrollLock() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(DRAWER_LOCK_CLASS);
  document.body.classList.remove(DRAWER_LOCK_CLASS, "pwa-drawer-open");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

export function setMobileNavDrawerScrollLock(locked: boolean) {
  if (typeof document === "undefined") return;
  if (locked) {
    document.documentElement.classList.add(DRAWER_LOCK_CLASS);
    document.body.classList.add(DRAWER_LOCK_CLASS, "pwa-drawer-open");
    return;
  }
  clearMobileNavDrawerScrollLock();
}
