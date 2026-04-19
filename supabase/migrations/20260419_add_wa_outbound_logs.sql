-- Migration: add wa_outbound_logs table for tracing outbound WhatsApp messages

create table if not exists wa_outbound_logs (
  id uuid default gen_random_uuid() primary key,
  chat_id text,
  message text,
  response jsonb,
  skipped boolean default false,
  created_at timestamptz default now()
);

create index if not exists wa_outbound_logs_chat_idx on wa_outbound_logs(chat_id);
