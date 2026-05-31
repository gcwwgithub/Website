create table if not exists public.chinese_quiz_color_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_id text not null, -- CSV ID column for the current game mode.
  color_value integer,
  lose_streak integer not null default 0,
  is_flagged boolean not null default false,
  is_new boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.chinese_quiz_color_progress
  add column if not exists game_mode text;

alter table public.chinese_quiz_color_progress
  add column if not exists lose_streak integer not null default 0;

alter table public.chinese_quiz_color_progress
  add column if not exists is_flagged boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chinese_quiz_color_progress'
      and column_name = 'storage_key'
  ) then
    update public.chinese_quiz_color_progress
    set game_mode = case
      when storage_key = 'chineseQuizNew.englishToChineseColorProgress.v1' then 'english-to-chinese'
      when storage_key = 'chineseQuizNew.csvColorProgress.v1' then 'chinese-to-english'
      when storage_key = 'chineseQuizNew.adverbColorProgress.v1' then 'adverb'
      when storage_key = 'chineseQuizNew.synonymColorProgress.v1' then 'synonym'
      when storage_key = 'chineseQuizNew.sentenceBuilderColorProgress.v1' then 'sentence-builder'
      when storage_key = 'chineseQuizNew.translateColorProgress.v1' then 'translate'
      else coalesce(storage_key, 'unknown')
    end
    where game_mode is null;
  end if;
end $$;

update public.chinese_quiz_color_progress
set game_mode = 'unknown'
where game_mode is null;

alter table public.chinese_quiz_color_progress
  alter column game_mode set not null;

alter table public.chinese_quiz_color_progress
  drop constraint if exists chinese_quiz_color_progress_user_id_storage_key_progress_id_key;

alter table public.chinese_quiz_color_progress
  drop constraint if exists chinese_quiz_color_progress_user_id_game_mode_progress_id_key;

alter table public.chinese_quiz_color_progress
  add constraint chinese_quiz_color_progress_user_id_game_mode_progress_id_key
  unique (user_id, game_mode, progress_id);

alter table public.chinese_quiz_color_progress
  drop column if exists storage_key;

alter table public.chinese_quiz_color_progress
  drop column if exists csv_row_number;

alter table public.chinese_quiz_color_progress
  drop column if exists first_column_word;

alter table public.chinese_quiz_color_progress
  drop column if exists chinese;

alter table public.chinese_quiz_color_progress
  drop column if exists english;

alter table public.chinese_quiz_color_progress
  drop column if exists pinyin;

alter table public.chinese_quiz_color_progress enable row level security;

-- Owner Supabase Auth user UUID. Replace this value if your owner user changes.
drop policy if exists "Only owner can manage color progress"
  on public.chinese_quiz_color_progress;

create policy "Only owner can manage color progress"
  on public.chinese_quiz_color_progress
  for all
  to authenticated
  using (user_id = auth.uid() and auth.uid() = '65bf0dce-0f85-42de-a6b0-00135303778a'::uuid)
  with check (user_id = auth.uid() and auth.uid() = '65bf0dce-0f85-42de-a6b0-00135303778a'::uuid);
