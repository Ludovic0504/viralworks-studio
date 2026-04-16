const WORKFLOW_QUOTA_KEY = "vws_workflow_quota_v1";

export const WORKFLOW_LIMITS = {
  scriptAttempts: 1,
  imageGenerations: 3,
  imageModifications: 5,
  videoAttempts: 2, // final + 1 variant
} as const;

type WorkflowUsage = {
  scriptAttemptsUsed: number;
  imageGenerationsUsed: number;
  imageModificationsUsed: number;
  videoAttemptsUsed: number;
  videoCreditDebited: boolean;
};

type WorkflowQuotaState = {
  monthKey: string;
  usage: WorkflowUsage;
};

function nowMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function createDefaultUsage(): WorkflowUsage {
  return {
    scriptAttemptsUsed: 0,
    imageGenerationsUsed: 0,
    imageModificationsUsed: 0,
    videoAttemptsUsed: 0,
    videoCreditDebited: false,
  };
}

function createDefaultState(): WorkflowQuotaState {
  return {
    monthKey: nowMonthKey(),
    usage: createDefaultUsage(),
  };
}

function readState(): WorkflowQuotaState {
  try {
    const raw = localStorage.getItem(WORKFLOW_QUOTA_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as WorkflowQuotaState;
    if (!parsed || typeof parsed !== "object") return createDefaultState();
    if (parsed.monthKey !== nowMonthKey()) return createDefaultState();
    return {
      monthKey: parsed.monthKey,
      usage: {
        ...createDefaultUsage(),
        ...(parsed.usage || {}),
      },
    };
  } catch {
    return createDefaultState();
  }
}

function writeState(state: WorkflowQuotaState) {
  localStorage.setItem(WORKFLOW_QUOTA_KEY, JSON.stringify(state));
}

export function getWorkflowUsage() {
  return readState().usage;
}

export function resetWorkflowUsage() {
  const state = readState();
  state.usage = createDefaultUsage();
  writeState(state);
}

export function canUseScript() {
  const usage = getWorkflowUsage();
  return usage.scriptAttemptsUsed < WORKFLOW_LIMITS.scriptAttempts;
}

/**
 * Autorise une génération « Script gagnant » : quota local (1 essai / cycle) OU,
 * si l’utilisateur est connecté et a encore assez de crédits serveur (Stripe, admin, etc.),
 * on ne bloque pas — le coût est déjà contrôlé par `hasEnoughCredits` côté appelant.
 * Réinitialise le quota local si une vidéo a déjà été entamée sur ce cycle (comportement existant).
 */
export function canProceedWithScriptGeneration(
  hasSession: boolean,
  hasServerCreditsForStep: boolean
): boolean {
  if (canUseScript()) return true;
  const usage = getWorkflowUsage();
  if (usage.videoAttemptsUsed >= 1) {
    resetWorkflowUsage();
    return true;
  }
  return Boolean(hasSession && hasServerCreditsForStep);
}

export function consumeScriptAttempt() {
  const state = readState();
  state.usage.scriptAttemptsUsed += 1;
  writeState(state);
}

export function canUseImageGeneration() {
  const usage = getWorkflowUsage();
  return usage.imageGenerationsUsed < WORKFLOW_LIMITS.imageGenerations;
}

export function consumeImageGeneration() {
  const state = readState();
  state.usage.imageGenerationsUsed += 1;
  writeState(state);
}

export function canUseImageModification() {
  const usage = getWorkflowUsage();
  return usage.imageModificationsUsed < WORKFLOW_LIMITS.imageModifications;
}

export function consumeImageModification() {
  const state = readState();
  state.usage.imageModificationsUsed += 1;
  writeState(state);
}

export function canUseVideoAttempt() {
  const usage = getWorkflowUsage();
  return usage.videoAttemptsUsed < WORKFLOW_LIMITS.videoAttempts;
}

export function shouldDebitVideoCredit() {
  return !getWorkflowUsage().videoCreditDebited;
}

export function consumeVideoAttempt({ debitedCredit }: { debitedCredit: boolean }) {
  const state = readState();
  state.usage.videoAttemptsUsed += 1;
  if (debitedCredit) {
    state.usage.videoCreditDebited = true;
  }
  writeState(state);
}

/** Appelé au « Valider et enregistrer » vidéo : le crédit serveur est débité une seule fois par workflow. */
export function markVideoWorkflowCreditConsumed() {
  const state = readState();
  state.usage.videoCreditDebited = true;
  writeState(state);
}
