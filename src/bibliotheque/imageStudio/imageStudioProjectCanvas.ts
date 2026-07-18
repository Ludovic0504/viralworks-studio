import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { resolveAuthenticatedUserId } from "@/bibliotheque/supabase/authSession";
import { touchImageStudioProject } from "./imageStudioProjects";

export type ImageStudioProjectNode = {
  id: string;
  project_id: string;
  user_id: string;
  history_id: string | null;
  image_url: string;
  prompt: string | null;
  pos_x: number;
  pos_y: number;
  created_at: string;
};

export type ImageStudioProjectEdgeStyle = "arrow" | "solid" | "dashed";

export type ImageStudioProjectEdge = {
  id: string;
  project_id: string;
  user_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
  edge_style: ImageStudioProjectEdgeStyle;
  created_at: string;
};

export type ImageStudioProjectCanvas = {
  nodes: ImageStudioProjectNode[];
  edges: ImageStudioProjectEdge[];
};

export async function loadImageStudioProjectCanvas(
  projectId: string,
): Promise<ImageStudioProjectCanvas> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return { nodes: [], edges: [] };

  const [nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("image_studio_project_nodes")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", uid)
      .order("created_at", { ascending: true }),
    supabase
      .from("image_studio_project_edges")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", uid)
      .order("created_at", { ascending: true }),
  ]);

  if (nodesRes.error) console.error("loadProjectNodes:", nodesRes.error);
  if (edgesRes.error) console.error("loadProjectEdges:", edgesRes.error);

  return {
    nodes: (nodesRes.data ?? []) as ImageStudioProjectNode[],
    edges: (edgesRes.data ?? []) as ImageStudioProjectEdge[],
  };
}

export async function createImageStudioProjectNode(params: {
  projectId: string;
  imageUrl: string;
  prompt?: string | null;
  historyId?: string | null;
  posX: number;
  posY: number;
}): Promise<ImageStudioProjectNode | null> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("image_studio_project_nodes")
    .insert({
      project_id: params.projectId,
      user_id: uid,
      image_url: params.imageUrl,
      prompt: params.prompt ?? null,
      history_id: params.historyId ?? null,
      pos_x: params.posX,
      pos_y: params.posY,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createImageStudioProjectNode:", error);
    throw new Error(error.message || "Impossible d'ajouter l'image au projet.");
  }

  await touchImageStudioProject(params.projectId, params.imageUrl);
  return data as ImageStudioProjectNode;
}

export async function updateImageStudioProjectNodePosition(
  nodeId: string,
  posX: number,
  posY: number,
): Promise<void> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return;

  const { error } = await supabase
    .from("image_studio_project_nodes")
    .update({ pos_x: posX, pos_y: posY })
    .eq("id", nodeId)
    .eq("user_id", uid);

  if (error) {
    console.error("updateImageStudioProjectNodePosition:", error);
  }
}

export async function deleteImageStudioProjectNode(nodeId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return false;

  const { error } = await supabase
    .from("image_studio_project_nodes")
    .delete()
    .eq("id", nodeId)
    .eq("user_id", uid);

  if (error) {
    console.error("deleteImageStudioProjectNode:", error);
    throw new Error(error.message || "Impossible de supprimer l'image.");
  }
  return true;
}

export async function createImageStudioProjectEdge(params: {
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  edgeStyle?: ImageStudioProjectEdgeStyle;
}): Promise<ImageStudioProjectEdge | null> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return null;

  if (params.sourceNodeId === params.targetNodeId) return null;

  const edgeStyle = params.edgeStyle ?? "arrow";

  const { data, error } = await supabase
    .from("image_studio_project_edges")
    .insert({
      project_id: params.projectId,
      user_id: uid,
      source_node_id: params.sourceNodeId,
      target_node_id: params.targetNodeId,
      source_handle: params.sourceHandle ?? null,
      target_handle: params.targetHandle ?? null,
      edge_style: edgeStyle,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    console.error("createImageStudioProjectEdge:", error);
    throw new Error(error.message || "Impossible de créer le lien.");
  }

  await touchImageStudioProject(params.projectId);
  return data as ImageStudioProjectEdge;
}

export async function updateImageStudioProjectEdgeStyle(
  edgeId: string,
  edgeStyle: ImageStudioProjectEdgeStyle,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return false;

  const { error } = await supabase
    .from("image_studio_project_edges")
    .update({ edge_style: edgeStyle })
    .eq("id", edgeId)
    .eq("user_id", uid);

  if (error) {
    console.error("updateImageStudioProjectEdgeStyle:", error);
    throw new Error(error.message || "Impossible de modifier le style du lien.");
  }
  return true;
}

export async function deleteImageStudioProjectEdge(edgeId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const uid = await resolveAuthenticatedUserId();
  if (!uid) return false;

  const { error } = await supabase
    .from("image_studio_project_edges")
    .delete()
    .eq("id", edgeId)
    .eq("user_id", uid);

  if (error) {
    console.error("deleteImageStudioProjectEdge:", error);
    throw new Error(error.message || "Impossible de supprimer le lien.");
  }
  return true;
}

export async function addImageToImageStudioProject(params: {
  projectId: string;
  imageUrl: string;
  prompt?: string | null;
  historyId?: string | null;
  posX?: number;
  posY?: number;
}): Promise<ImageStudioProjectNode | null> {
  const canvas = await loadImageStudioProjectCanvas(params.projectId);
  const positions = nextNodePositions(1, null, canvas.nodes.length);
  const pos = {
    posX: params.posX ?? positions[0].posX,
    posY: params.posY ?? positions[0].posY,
  };
  return createImageStudioProjectNode({
    projectId: params.projectId,
    imageUrl: params.imageUrl,
    prompt: params.prompt ?? null,
    historyId: params.historyId ?? null,
    posX: pos.posX,
    posY: pos.posY,
  });
}

/** Place new nodes in a row to the right of a source node (or at origin). */
export function nextNodePositions(
  count: number,
  source?: { pos_x: number; pos_y: number } | null,
  existingCount = 0,
): Array<{ posX: number; posY: number }> {
  const baseX = source ? source.pos_x + 280 : 80 + (existingCount % 4) * 40;
  const baseY = source ? source.pos_y : 80 + Math.floor(existingCount / 4) * 40;
  const positions: Array<{ posX: number; posY: number }> = [];
  for (let i = 0; i < count; i += 1) {
    positions.push({
      posX: baseX + (i % 2) * 220,
      posY: baseY + Math.floor(i / 2) * 260,
    });
  }
  return positions;
}
