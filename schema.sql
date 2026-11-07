-- MEME schema. Run in Supabase SQL editor, then create a PRIVATE storage bucket named "media".
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  bio text default '', avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  free_downloads int not null default 6 check (free_downloads >= 0),
  tokens int not null default 0 check (tokens >= 0),
  created_at timestamptz default now());

create table memes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles on delete cascade,
  kind text not null check (kind in ('image','gif','video','song')),
  title text not null, caption text default '', lang text default 'en',
  file_path text not null, likes_count int not null default 0,
  is_removed boolean not null default false, created_at timestamptz default now());

create table downloads (id uuid primary key default gen_random_uuid(), user_id uuid references profiles on delete cascade, meme_id uuid references memes on delete cascade, cost int not null, was_free boolean not null, created_at timestamptz default now(), unique(user_id, meme_id));
create table token_transactions (id uuid primary key default gen_random_uuid(), user_id uuid references profiles on delete cascade, delta int not null, reason text not null, ref text, created_at timestamptz default now());
create table payments (id uuid primary key default gen_random_uuid(), user_id uuid references profiles on delete cascade, provider text not null, provider_txn_id text not null, amount_usd numeric, tokens int not null, status text not null default 'pending', created_at timestamptz default now(), unique(provider, provider_txn_id));
create table likes (user_id uuid references profiles on delete cascade, meme_id uuid references memes on delete cascade, primary key(user_id, meme_id));
create table comments (id uuid primary key default gen_random_uuid(), user_id uuid references profiles on delete cascade, meme_id uuid references memes on delete cascade, body text not null check (char_length(body) <= 500), created_at timestamptz default now());
create table followers (follower_id uuid references profiles on delete cascade, following_id uuid references profiles on delete cascade, primary key(follower_id, following_id), check (follower_id <> following_id));
create table saved_memes (user_id uuid references profiles on delete cascade, meme_id uuid references memes on delete cascade, primary key(user_id, meme_id));
create table reports (id uuid primary key default gen_random_uuid(), reporter_id uuid references profiles on delete cascade, meme_id uuid references memes on delete cascade, reason text not null, resolved boolean default false, created_at timestamptz default now());

create function is_admin() returns boolean language sql security definer stable set search_path = public as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text,1,8))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Atomic, server-trusted download accounting. Returns the storage path.
create function consume_download(p_item uuid) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m memes; p profiles; c int; f boolean := false;
begin
  if uid is null then raise exception 'auth'; end if;
  select * into m from memes where id = p_item and not is_removed;
  if not found then raise exception 'not_found'; end if;
  select * into p from profiles where id = uid for update;
  if exists(select 1 from downloads where user_id = uid and meme_id = p_item) then return m.file_path; end if;
  c := case when m.kind = 'song' then 2 else 3 end;
  if m.kind <> 'song' and p.free_downloads > 0 then
    update profiles set free_downloads = free_downloads - 1 where id = uid; c := 0; f := true;
  else
    if p.tokens < c then raise exception 'insufficient_tokens'; end if;
    update profiles set tokens = tokens - c where id = uid;
    insert into token_transactions(user_id, delta, reason, ref) values (uid, -c, 'download', p_item::text);
  end if;
  insert into downloads(user_id, meme_id, cost, was_free) values (uid, p_item, c, f);
  return m.file_path;
end $$;
revoke all on function consume_download(uuid) from public;
grant execute on function consume_download(uuid) to authenticated;

alter table profiles enable row level security; alter table memes enable row level security; alter table downloads enable row level security;
alter table token_transactions enable row level security; alter table payments enable row level security; alter table likes enable row level security;
alter table comments enable row level security; alter table followers enable row level security; alter table saved_memes enable row level security; alter table reports enable row level security;

-- Users can only edit these profile columns (never role / tokens / free_downloads)
revoke update on profiles from authenticated, anon;
grant update(username, bio, avatar_url) on profiles to authenticated;

create policy "profiles read" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (id = auth.uid());
create policy "memes read" on memes for select using (not is_removed or owner_id = auth.uid() or is_admin());
create policy "memes insert own" on memes for insert with check (owner_id = auth.uid());
create policy "memes delete own/admin" on memes for delete using (owner_id = auth.uid() or is_admin());
create policy "memes admin update" on memes for update using (is_admin());
create policy "downloads own" on downloads for select using (user_id = auth.uid() or is_admin());
create policy "tx own" on token_transactions for select using (user_id = auth.uid() or is_admin());
create policy "payments own" on payments for select using (user_id = auth.uid() or is_admin());
create policy "likes read" on likes for select using (true);
create policy "likes own" on likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments read" on comments for select using (true);
create policy "comments own" on comments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "followers read" on followers for select using (true);
create policy "followers own" on followers for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "saved own" on saved_memes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reports insert" on reports for insert with check (reporter_id = auth.uid());
create policy "reports admin" on reports for select using (is_admin());

-- Placeholder rows (upload real files to the "media" bucket at these paths)
insert into memes(kind,title,file_path,likes_count) values
 ('image','Sample meme 1','sample/1.png',12),('gif','Sample GIF','sample/2.gif',30),('song','Sample meme song','sample/3.mp3',7);
-- Make yourself admin (SQL editor only): update profiles set role='admin' where username='YOU';
