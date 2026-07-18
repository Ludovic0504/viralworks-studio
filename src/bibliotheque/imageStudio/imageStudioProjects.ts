import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { resolveAuthenticatedUserId } from "@/bibliotheque/supabase/authSession";

export type ImageStudioProject = {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function listImageStudioProjects(): Promise<ImageStudioProject[]> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("image_studio_projects")
    .select("*")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listImageStudioProjects:", error);
    return [];
  }
  return (data ?? []) as ImageStudioProject[];
}

export async function createImageStudioProject(
  name: string,
): Promise<ImageStudioProject | null> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return null;

  const trimmed = name.trim() || "Nouveau projet";
  const { data, error } = await supabase
    .from("image_studio_projects")
    .insert({ user_id: uid, name: trimmed })
    .select("*")
    .single();

  if (error) {
    console.error("createImageStudioProject:", error);
    throw new Error(error.message || "Impossible de créer le projet.");
  }
  return data as ImageStudioProject;
}

export async function renameImageStudioProject(
  projectId: string,
  name: string,
): Promise<ImageStudioProject | null> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("image_studio_projects")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", uid)
    .select("*")
    .single();

  if (error) {
    console.error("renameImageStudioProject:", error);
    throw new Error(error.message || "Impossible de renommer le projet.");
  }
  return data as ImageStudioProject;
}

export async function deleteImageStudioProject(projectId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return false;

  const { error } = await supabase
    .from("image_studio_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", uid);

  if (error) {
    console.error("deleteImageStudioProject:", error);
    throw new Error(error.message || "Impossible de supprimer le projet.");
  }
  return true;
}

export async function touchImageStudioProject(
  projectId: string,
  coverUrl?: string | null,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (coverUrl !== undefined) {
    patch.cover_url = coverUrl;
  }

  const { error } = await supabase
    .from("image_studio_projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", uid);

  if (error) {
    console.error("touchImageStudioProject:", error);
  }
}

export async function getImageStudioProject(
  projectId: string,
): Promise<ImageStudioProject | null> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("image_studio_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.error("getImageStudioProject:", error);
    return null;
  }
  return data as ImageStudioProject | null;
}
