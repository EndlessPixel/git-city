import { getSupabaseAdmin } from "./supabase";

// ─── Types ───────────────────────────────────────────────────

export interface ShopItem {
  id: string;
  category: "effect" | "structure" | "identity";
  name: string;
  description: string | null;
  price_usd_cents: number;
  price_brl_cents: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PurchaseRecord {
  id: string;
  developer_id: number;
  item_id: string;
  provider: "stripe" | "abacatepay";
  provider_tx_id: string | null;
  amount_cents: number;
  currency: "usd" | "brl";
  status: "pending" | "completed" | "expired" | "refunded";
  created_at: string;
}

export type OwnedItems = string[];

// ─── Helpers ─────────────────────────────────────────────────

export async function getOwnedItems(developerId: number): Promise<string[]> {
  const sb = getSupabaseAdmin();

  const { data } = await sb
    .from("purchases")
    .select("item_id")
    .eq("developer_id", developerId)
    .eq("status", "completed");

  return (data ?? []).map((row) => row.item_id);
}

export async function getOwnedItemsForDevelopers(
  developerIds: number[]
): Promise<Record<number, string[]>> {
  if (developerIds.length === 0) return {};

  const sb = getSupabaseAdmin();

  const { data } = await sb
    .from("purchases")
    .select("developer_id, item_id")
    .in("developer_id", developerIds)
    .eq("status", "completed");

  const result: Record<number, string[]> = {};
  for (const row of data ?? []) {
    if (!result[row.developer_id]) {
      result[row.developer_id] = [];
    }
    result[row.developer_id].push(row.item_id);
  }
  return result;
}
