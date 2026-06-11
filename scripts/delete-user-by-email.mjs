/**
 * Suppression complète d'un utilisateur (auth + données liées).
 * Requiert SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node scripts/delete-user-by-email.mjs --email jeanlmt.pro@gmail.com --confirm
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TARGET_EMAIL = String(
  process.argv.includes("--email")
    ? process.argv[process.argv.indexOf("--email") + 1]
    : ""
)
  .trim()
  .toLowerCase();

const CONFIRM = process.argv.includes("--confirm");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => String(x.email || "").toLowerCase() === email);
    if (u) return u;
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function countRows(supabase, table, column, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, userId);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.message?.includes("does not exist"))
      return null;
    throw error;
  }
  return count ?? 0;
}

async function deleteRows(supabase, table, column, userId) {
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq(column, userId);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || error.message?.includes("does not exist"))
      return null;
    throw error;
  }
  return count ?? 0;
}

async function deleteCommunityPrivateData(supabase, userId) {
  const report = [];

  const { data: participantRows, error: pErr } = await supabase
    .from("community_private_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  if (pErr && pErr.code !== "42P01") throw pErr;

  const convoIds = [...new Set((participantRows ?? []).map((r) => r.conversation_id).filter(Boolean))];

  const { data: convoRows, error: cErr } = await supabase
    .from("community_private_conversations")
    .select("id")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (cErr && cErr.code !== "42P01") throw cErr;

  for (const row of convoRows ?? []) {
    if (row?.id) convoIds.push(row.id);
  }
  const uniqueConvos = [...new Set(convoIds)];

  if (uniqueConvos.length) {
    const { count: msgDel, error: mErr } = await supabase
      .from("community_private_messages")
      .delete({ count: "exact" })
      .in("conversation_id", uniqueConvos);
    if (mErr && mErr.code !== "42P01") throw mErr;
    report.push({ table: "community_private_messages", deleted: msgDel ?? 0 });
  } else {
    const n = await deleteRows(supabase, "community_private_messages", "user_id", userId);
    if (n !== null) report.push({ table: "community_private_messages", deleted: n });
  }

  for (const [table, col] of [
    ["community_private_participants", "user_id"],
    ["community_private_hidden", "user_id"],
  ]) {
    const n = await deleteRows(supabase, table, col, userId);
    if (n !== null) report.push({ table, deleted: n });
  }

  const { count: convoDel, error: cdErr } = await supabase
    .from("community_private_conversations")
    .delete({ count: "exact" })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (cdErr && cdErr.code !== "42P01") throw cdErr;
  if (convoDel !== null) report.push({ table: "community_private_conversations", deleted: convoDel ?? 0 });

  return report;
}

async function deleteAvatarStorage(supabase, userId) {
  const { data: files, error: listErr } = await supabase.storage.from("avatars").list("", {
    limit: 1000,
  });
  if (listErr) return { table: "storage.avatars", deleted: 0, note: listErr.message };

  const toRemove = (files ?? [])
    .map((f) => f.name)
    .filter((name) => name.startsWith(`${userId}-`) || name.startsWith(`${userId}.`));

  if (!toRemove.length) return { table: "storage.avatars", deleted: 0 };

  const { error: remErr } = await supabase.storage.from("avatars").remove(toRemove);
  if (remErr) throw remErr;
  return { table: "storage.avatars", deleted: toRemove.length };
}

async function main() {
  if (!TARGET_EMAIL || !TARGET_EMAIL.includes("@")) {
    console.error("Usage: node scripts/delete-user-by-email.mjs --email <email> --confirm");
    process.exit(2);
  }
  if (!CONFIRM) {
    console.error("Ajoute --confirm pour exécuter la suppression (irréversible).");
    process.exit(2);
  }

  const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey =
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await findUserByEmail(supabase, TARGET_EMAIL);
  if (!user) {
    console.log(JSON.stringify({ email: TARGET_EMAIL, found: false, message: "Aucun utilisateur auth." }, null, 2));
    return;
  }

  const userId = user.id;
  console.log(JSON.stringify({ email: TARGET_EMAIL, userId, step: "identified" }, null, 2));

  const userIdTables = [
    "profiles",
    "user_credits",
    "credit_transactions",
    "user_credit_buckets",
    "subscription_credit_cycles",
    "stripe_customers",
    "stripe_payments",
    "stripe_subscriptions",
    "history",
    "video_pipeline_24_checkpoints",
    "welcome_gift_shipments",
    "community_public_messages",
  ];

  const before = {};
  for (const table of userIdTables) {
    const n = await countRows(supabase, table, "user_id", userId);
    if (n !== null) before[table] = n;
  }
  before["credit_transactions.created_by"] = await countRows(
    supabase,
    "credit_transactions",
    "created_by",
    userId
  );
  before["admin_notifications.actor_user_id"] = await countRows(
    supabase,
    "admin_notifications",
    "actor_user_id",
    userId
  );

  const deleted = [];

  deleted.push(...(await deleteCommunityPrivateData(supabase, userId)));

  for (const table of userIdTables) {
    const n = await deleteRows(supabase, table, "user_id", userId);
    if (n !== null) deleted.push({ table, deleted: n });
  }

  const createdByDel = await deleteRows(supabase, "credit_transactions", "created_by", userId);
  if (createdByDel !== null) deleted.push({ table: "credit_transactions.created_by", deleted: createdByDel });

  const actorDel = await deleteRows(supabase, "admin_notifications", "actor_user_id", userId);
  if (actorDel !== null) deleted.push({ table: "admin_notifications.actor_user_id", deleted: actorDel });

  const nouveautesDel = await deleteRows(supabase, "nouveautes", "created_by", userId);
  if (nouveautesDel !== null) deleted.push({ table: "nouveautes.created_by", deleted: nouveautesDel });

  deleted.push(await deleteAvatarStorage(supabase, userId));

  const { error: authDelErr } = await supabase.auth.admin.deleteUser(userId);
  if (authDelErr) throw authDelErr;
  deleted.push({ table: "auth.users", deleted: 1 });

  const stillThere = await findUserByEmail(supabase, TARGET_EMAIL);

  console.log(
    JSON.stringify(
      {
        email: TARGET_EMAIL,
        userId,
        before,
        deleted,
        authUserRemoved: !stillThere,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
