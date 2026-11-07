"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dict, Lang } from "@/lib/i18n";

type Item = { id: string; title: string; kind: string; likes_count: number; created_at: string };
type Tab = "memes" | "songs" | "all";
type Sort = "popular" | "oldest" | "newest";
type Wallet = { free_downloads: number; tokens: number };

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [signup, setSignup] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const t = dict[lang];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session?.access_token ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadWallet() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setWallet(null); return; }
    const { data } = await supabase.from("profiles").select("free_downloads,tokens").eq("id", u.user.id).maybeSingle();
    setWallet(data as Wallet | null);
  }
  useEffect(() => { if (session) loadWallet(); else setWallet(null); }, [session]);

  useEffect(() => {
    setLoading(true);
    let query = supabase.from("memes").select("id,title,kind,likes_count,created_at").eq("is_removed", false).limit(48);
    if (tab === "memes") query = query.in("kind", ["image", "gif", "video"]);
    if (tab === "songs") query = query.eq("kind", "song");
    if (q.trim()) query = query.ilike("title", `%${q.trim().replace(/[%_]/g, "")}%`);
    query = sort === "popular" ? query.order("likes_count", { ascending: false }) : query.order("created_at", { ascending: sort === "oldest" });
    query.then(({ data, error }) => { setItems(error ? [] : ((data as Item[]) ?? [])); setLoading(false); });
  }, [tab, sort, q]);

  async function auth() {
    setMsg("");
    if (!email.includes("@") || password.length < 8 || (signup && username.length < 3)) { setMsg(t.error); return; }
    const res = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (res.error) setMsg(res.error.message);
  }

  async function download(id: string) {
    setMsg("");
    if (!session) { setMsg(t.needLogin); return; }
    const r = await fetch("/api/download", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` }, body: JSON.stringify({ itemId: id }) });
    if (r.status === 402) { setMsg(t.noTokens); return; }
    if (!r.ok) { setMsg(t.error); return; }
    const { url } = await r.json();
    await loadWallet();
    window.location.href = url;
  }

  const input = "rounded-xl bg-black/30 px-3 py-2 outline-none focus:ring-2 ring-purple-500";
  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="glass sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <span className="bg-gradient-to-br from-neon to-purple-900 bg-clip-text text-2xl font-black text-transparent">MEME</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className={`min-w-[140px] flex-1 ${input}`} />
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={input}>
          <option value="en">EN</option><option value="uz">UZ</option><option value="ru">RU</option>
        </select>
        {wallet && <span className="text-sm">{t.free}: {wallet.free_downloads} · {t.tokens}: {wallet.tokens}</span>}
        {session && <button className="rounded-xl bg-neon/80 px-3 py-2" onClick={() => supabase.auth.signOut()}>{t.logout}</button>}
      </header>

      <h1 className="my-8 text-center text-4xl font-black">{t.hero}</h1>

      {!session && (
        <div className="glass mx-auto mb-8 flex max-w-sm flex-col gap-2 rounded-2xl p-4">
          {signup && <input placeholder={t.username} value={username} onChange={(e) => setUsername(e.target.value)} className={input} />}
          <input placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <input type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          <button onClick={auth} className="rounded-xl bg-neon px-3 py-2 font-bold">{signup ? t.register : t.login}</button>
          <button onClick={() => setSignup(!signup)} className="text-sm underline">{signup ? t.login : t.register}</button>
        </div>
      )}
      {msg && <p className="mb-4 text-center text-amber-300">{msg}</p>}

      <div className="mb-4 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">{(["memes", "songs", "all"] as Tab[]).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 ${tab === k ? "bg-neon" : "glass"}`}>{t[k]}</button>))}</div>
        <div className="flex gap-2">{(["popular", "oldest", "newest"] as Sort[]).map((k) => (
          <button key={k} onClick={() => setSort(k)} className={`rounded-full px-3 py-2 text-sm ${sort === k ? "bg-neon" : "glass"}`}>{t[k]}</button>))}</div>
      </div>

      {loading ? <p>{t.loading}</p> : items.length === 0 ? <p className="py-16 text-center opacity-70">{t.empty}</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((m) => (
            <div key={m.id} className="glass flex flex-col gap-2 rounded-2xl p-3">
              <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-purple-700/50 to-amber-900/40 text-3xl">{m.kind === "song" ? "🎵" : "😂"}</div>
              <p className="truncate font-semibold">{m.title}</p>
              <button onClick={() => download(m.id)} className="rounded-xl bg-neon/80 py-1.5 text-sm">{t.download}</button>
            </div>))}
        </div>)}
    </main>
  );
}
