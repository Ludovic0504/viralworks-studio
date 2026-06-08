import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Récupérer le token d'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer le client Supabase avec le token utilisateur
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Vérifier que l'utilisateur est admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier le rôle admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer le client admin pour accéder à auth.users
    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Récupérer toutes les données nécessaires
    const [
      { data: profiles, error: profilesError },
      { data: credits, error: creditsError },
      { data: creditBuckets, error: creditBucketsError },
      { data: subscriptions, error: subscriptionsError },
      { data: payments, error: paymentsError },
      { data: transactions, error: transactionsError },
      { data: history, error: historyError },
      { data: adminNotifications, error: adminNotificationsError },
      { data: authUsers, error: authUsersError },
    ] = await Promise.all([
      supabaseAdminClient.from("profiles").select("user_id, email, full_name, first_name, last_name, created_at, role, is_tester").order("created_at", { ascending: false }),
      supabaseAdminClient.from("user_credits").select("user_id, credits"),
      supabaseAdminClient.from("user_credit_buckets").select("user_id, text_generation, image_generation, image_modification, video_generation"),
      supabaseAdminClient.from("stripe_subscriptions").select("*").order("created_at", { ascending: false }),
      supabaseAdminClient.from("stripe_payments").select("*").order("created_at", { ascending: false }),
      supabaseAdminClient.from("credit_transactions").select("*").order("created_at", { ascending: false }),
      supabaseAdminClient.from("history").select("*").order("created_at", { ascending: false }),
      supabaseAdminClient.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdminClient.auth.admin.listUsers(),
    ]);

    if (profilesError) {
      console.error("Erreur récupération profils:", profilesError);
    }
    if (creditsError) {
      console.error("Erreur récupération crédits:", creditsError);
    }
    if (creditBucketsError) {
      console.error("Erreur récupération crédits dédiés:", creditBucketsError);
    }
    if (subscriptionsError) {
      console.error("Erreur récupération abonnements:", subscriptionsError);
    }
    if (paymentsError) {
      console.error("Erreur récupération paiements:", paymentsError);
    }
    if (transactionsError) {
      console.error("Erreur récupération transactions:", transactionsError);
    }
    if (historyError) {
      console.error("Erreur récupération historique:", historyError);
    }
    if (adminNotificationsError) {
      console.error("Erreur récupération notifications admin:", adminNotificationsError);
    }
    if (authUsersError) {
      console.error("Erreur récupération utilisateurs auth:", authUsersError);
    }

    // Combiner les données
    const usersWithAuth = (profiles || []).map((profile) => {
      const authUser = authUsers?.users?.find((u) => u.id === profile.user_id);
      const userCredits = credits?.find((c) => c.user_id === profile.user_id);
      const userBuckets = creditBuckets?.find((b) => b.user_id === profile.user_id);
      return {
        ...profile,
        credits: userCredits?.credits || 0,
        credits_text_generation: userBuckets?.text_generation || 0,
        credits_image_generation: userBuckets?.image_generation || 0,
        credits_image_modification: userBuckets?.image_modification || 0,
        credits_video_generation: userBuckets?.video_generation || 0,
        email_verified: authUser?.email_confirmed_at ? true : false,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        created_at_auth: authUser?.created_at || null,
      };
    });

    // Calculer les statistiques
    const activeSubscriptions = (subscriptions || []).filter((s) => s.status === "active").length;
    const recentSignups = (usersWithAuth || []).filter((u) => {
      const signupDate = new Date(u.created_at_auth || u.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return signupDate >= weekAgo;
    }).length;

    const verifiedEmails = (usersWithAuth || []).filter((u) => u.email_verified).length;

    const unreadAdminNotifications = (adminNotifications || []).filter((n) => !n.read_at).length;

    // Enrichir les paiements avec les informations du client
    const paymentsWithClient = (payments || []).map((payment) => {
      const clientProfile = usersWithAuth.find((u) => u.user_id === payment.user_id);
      return {
        ...payment,
        client_email: clientProfile?.email || "Client inconnu",
        client_name: clientProfile?.full_name || clientProfile?.first_name || null,
      };
    });

    // Enrichir les transactions avec les informations du client
    const transactionsWithClient = (transactions || []).map((transaction) => {
      const clientProfile = usersWithAuth.find((u) => u.user_id === transaction.user_id);
      return {
        ...transaction,
        client_email: clientProfile?.email || "Client inconnu",
        client_name: clientProfile?.full_name || clientProfile?.first_name || null,
      };
    });

    // Enrichir les abonnements avec les informations du client
    const subscriptionsWithClient = (subscriptions || []).map((subscription) => {
      const clientProfile = usersWithAuth.find((u) => u.user_id === subscription.user_id);
      return {
        ...subscription,
        client_email: clientProfile?.email || "Client inconnu",
        client_name: clientProfile?.full_name || clientProfile?.first_name || null,
      };
    });

    // Enrichir l'historique avec les informations du client et les crédits utilisés
    const historyWithClient = (history || []).map((historyItem) => {
      const clientProfile = usersWithAuth.find((u) => u.user_id === historyItem.user_id);
      
      // Trouver la transaction de débit correspondante pour récupérer les crédits utilisés
      // On cherche une transaction de débit créée dans les 5 minutes après la génération
      const historyDate = new Date(historyItem.created_at);
      const matchingTransaction = transactions?.find((t) => {
        if (t.user_id !== historyItem.user_id || t.type !== "debit" || t.amount >= 0) return false;
        
        const transactionDate = new Date(t.created_at);
        const diffMinutes = Math.abs((historyDate.getTime() - transactionDate.getTime()) / 1000 / 60);
        
        // Vérifier que le reason correspond au type de génération
        const reasonMatch = 
          (historyItem.kind === "prompt" && t.reason === "prompt_generation") ||
          (historyItem.kind === "image" && t.reason === "image_generation") ||
          (historyItem.kind === "video" && t.reason === "video_generation");
        
        return diffMinutes <= 5 && reasonMatch;
      });
      
      const creditsUsed = matchingTransaction ? Math.abs(matchingTransaction.amount) : null;
      
      return {
        ...historyItem,
        client_email: clientProfile?.email || "Client inconnu",
        client_name: clientProfile?.full_name || clientProfile?.first_name || null,
        credits_used: creditsUsed,
      };
    });

    return new Response(
      JSON.stringify({
        stats: {
          totalUsers: usersWithAuth.length,
          activeSubscriptions,
          recentSignups,
          verifiedEmails,
          totalPayments: payments?.length || 0,
          totalTransactions: transactions?.length || 0,
          totalHistory: history?.length || 0,
          unreadAdminNotifications,
        },
        users: usersWithAuth,
        subscriptions: subscriptionsWithClient,
        payments: paymentsWithClient,
        transactions: transactionsWithClient,
        history: historyWithClient,
        adminNotifications: adminNotifications || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur admin dashboard:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
