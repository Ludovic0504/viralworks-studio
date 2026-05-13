/** Plafond affiché « solde / cap » après un ajout de crédits workflow (pack, abo, rattrapage). */
export function nextVideoDisplayCap(params: {
  balanceBefore: number;
  oldCap: number | null | undefined;
  purchaseQty: number;
  balanceAfter: number;
}): number {
  const B = Math.max(0, Math.floor(params.balanceBefore));
  const Q = Math.max(0, Math.floor(params.purchaseQty));
  const A = Math.max(0, Math.floor(params.balanceAfter));
  const C_old = params.oldCap == null ? 30 : Math.max(0, Math.floor(Number(params.oldCap)));
  const C_new = B === 0 || B === C_old ? Q : B + Q;
  return Math.max(C_new, A);
}
