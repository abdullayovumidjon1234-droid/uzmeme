import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "auth" }, { status: 401 });
  const now = Date.now();
  const recent = (hits.get(token) ?? []).filter((t) => now - t < 60000);
  if (recent.length >= 20) return NextResponse.json({ error: "rate" }, { status: 429 });
  hits.set(token, [...recent, now]);

  const { itemId } = await req.json().catch(() => ({ itemId: "" }));
  if (typeof itemId !== "string" || !/^[0-9a-f-]{36}$/i.test(itemId)) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await userClient.rpc("consume_download", { p_item: itemId });
  if (error) {
    const poor = error.message.includes("insufficient");
    return NextResponse.json({ error: poor ? "insufficient_tokens" : "failed" }, { status: poor ? 402 : 400 });
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const signed = await admin.storage.from("media").createSignedUrl(data as string, 60);
  if (signed.error) return NextResponse.json({ error: "storage" }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl });
}
