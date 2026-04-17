import { getBrowserSupabase } from "./client-navigateur";

export type InformationUtileColor = "cyan" | "violet" | "yellow" | "emerald";

export interface InformationUtileItem {
  id: string;
  section_id: string;
  title: string;
  content: string;
  example: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InformationUtileSection {
  id: string;
  slug: string;
  title: string;
  icon_name: string;
  color: InformationUtileColor;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: InformationUtileItem[];
}

export function slugifyInformationsUtiles(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "categorie";
}

/**
 * Charge les catégories puis les fiches en requête séparée (plus fiable que l’embed PostgREST).
 * Les visiteurs ne voient que les catégories actives ; le RLS filtre les fiches.
 */
export async function fetchInformationsUtiles(forAdmin: boolean): Promise<InformationUtileSection[]> {
  const supabase = getBrowserSupabase();

  let sectionsQuery = supabase
    .from("informations_utiles_sections")
    .select("*")
    .order("sort_order", { ascending: true });

  if (!forAdmin) {
    sectionsQuery = sectionsQuery.eq("is_active", true);
  }

  const { data: sections, error: secErr } = await sectionsQuery;

  if (secErr) {
    console.error("Erreur chargement sections informations utiles:", secErr);
    return [];
  }

  if (!sections?.length) {
    return [];
  }

  const sectionIds = sections.map((s) => s.id);

  const { data: items, error: itemErr } = await supabase
    .from("informations_utiles_items")
    .select("*")
    .in("section_id", sectionIds);

  if (itemErr) {
    console.error("Erreur chargement fiches informations utiles:", itemErr);
  }

  const bySection = new Map<string, InformationUtileItem[]>();
  for (const row of items || []) {
    const it = row as InformationUtileItem;
    const list = bySection.get(it.section_id) ?? [];
    list.push(it);
    bySection.set(it.section_id, list);
  }

  return sections.map((s) => ({
    ...(s as InformationUtileSection),
    items: [...(bySection.get(s.id) ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function createInformationUtileSection(payload: {
  slug: string;
  title: string;
  icon_name: string;
  color: InformationUtileColor;
  sort_order: number;
  is_active?: boolean;
}): Promise<{ success: boolean; data?: InformationUtileSection; error?: string }> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("informations_utiles_sections")
    .insert({
      slug: payload.slug,
      title: payload.title,
      icon_name: payload.icon_name,
      color: payload.color,
      sort_order: payload.sort_order,
      is_active: payload.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création section informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function updateInformationUtileSection(
  id: string,
  updates: Partial<
    Pick<
      InformationUtileSection,
      "slug" | "title" | "icon_name" | "color" | "sort_order" | "is_active"
    >
  >
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_sections").update(updates).eq("id", id);

  if (error) {
    console.error("Erreur mise à jour section informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function upsertInformationUtileSection(payload: {
  id: string;
  slug: string;
  title: string;
  icon_name: string;
  color: InformationUtileColor;
  sort_order: number;
  is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_sections").upsert(
    {
      id: payload.id,
      slug: payload.slug,
      title: payload.title,
      icon_name: payload.icon_name,
      color: payload.color,
      sort_order: payload.sort_order,
      is_active: payload.is_active ?? true,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Erreur upsert section informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteInformationUtileSection(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_sections").delete().eq("id", id);

  if (error) {
    console.error("Erreur suppression section informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function createInformationUtileItem(payload: {
  section_id: string;
  title: string;
  content: string;
  example: string | null;
  sort_order: number;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_items").insert({
    section_id: payload.section_id,
    title: payload.title,
    content: payload.content,
    example: payload.example || null,
    sort_order: payload.sort_order,
  });

  if (error) {
    console.error("Erreur création entrée informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function updateInformationUtileItem(
  id: string,
  updates: Partial<Pick<InformationUtileItem, "title" | "content" | "example" | "sort_order">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_items").update(updates).eq("id", id);

  if (error) {
    console.error("Erreur mise à jour entrée informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function upsertInformationUtileItem(payload: {
  id: string;
  section_id: string;
  title: string;
  content: string;
  example: string | null;
  sort_order: number;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_items").upsert(
    {
      id: payload.id,
      section_id: payload.section_id,
      title: payload.title,
      content: payload.content,
      example: payload.example ?? null,
      sort_order: payload.sort_order,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Erreur upsert entrée informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteInformationUtileItem(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("informations_utiles_items").delete().eq("id", id);

  if (error) {
    console.error("Erreur suppression entrée informations utiles:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
