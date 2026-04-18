
-- ============================================
-- ITERATION 3: Multi-channel chats + AI Memory
-- ============================================

-- 1. AI Memory: stores director's past decisions so AI learns patterns
CREATE TABLE public.ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL, -- 'absence_substitution', 'incident_assignment', 'task_routing', 'communication_style'
  pattern_key TEXT NOT NULL,  -- e.g. "physics_teacher_absent" or "broken_furniture"
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT, -- 'approved' | 'rejected' | 'modified'
  director_note TEXT, -- optional free-form note from director
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_memory_pattern ON public.ai_memory(pattern_type, pattern_key);
CREATE INDEX idx_ai_memory_recent ON public.ai_memory(last_used_at DESC);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_memory director" ON public.ai_memory FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "ai_memory read auth" ON public.ai_memory FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. Add channel-tracking fields to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_room TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON public.chat_messages(chat_room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_source ON public.chat_messages(source);

-- 3. Chat rooms registry (for grouping by class / department / channel)
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'telegram' | 'whatsapp'
  external_chat_id TEXT, -- telegram chat_id or whatsapp group id
  member_role app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms read all" ON public.chat_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms director manage" ON public.chat_rooms FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

INSERT INTO public.chat_rooms (slug, name, description, source) VALUES
  ('general', 'Общий чат школы', 'Главный канал для всех сотрудников', 'internal'),
  ('teachers', 'Учительская', 'Чат педагогического состава', 'internal'),
  ('directors', 'Администрация', 'Дирекция и завучи', 'internal'),
  ('telegram-staff', 'Telegram: Сотрудники', 'Зеркало Telegram-группы', 'telegram'),
  ('whatsapp-parents', 'WhatsApp: Родители', 'Чат с родителями', 'whatsapp');

-- 4. Schedule overrides for live changes (cancellations, "windows", room changes)
CREATE TABLE public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  override_date DATE NOT NULL DEFAULT CURRENT_DATE,
  override_type TEXT NOT NULL, -- 'cancelled' | 'free_period' | 'room_change' | 'teacher_change' | 'merged'
  new_teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  new_room TEXT,
  note TEXT,
  created_by UUID,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  related_substitution_id UUID REFERENCES public.substitutions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_overrides_date ON public.schedule_overrides(override_date, slot_id);

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overrides read" ON public.schedule_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "overrides director" ON public.schedule_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));
CREATE POLICY "overrides ai insert" ON public.schedule_overrides FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_memory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_overrides;
