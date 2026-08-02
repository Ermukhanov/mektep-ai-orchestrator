import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Attendance() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const useMock = (import.meta as any).env.VITE_USE_MOCK === 'true';
      if (useMock) {
        const base = String((import.meta as any).env.VITE_MOCK_BASE || 'http://localhost:8787');
        const res = await fetch(`${base}/functions/get-attendance`);
        const j = await res.json();
        const ev = j.events || [];
        // Ensure there are some recognizable demo entries
        if (!ev.length) {
          ev.push({ id: 'demo-1', uid: 'amirtay-erasyl-9A', student_id: '9A-erasyl', name: 'Амиртай Ерасыл', class_name: '9A', teacher: 'Нурия Орынбасаровна', created_at: new Date().toISOString() });
          ev.push({ id: 'demo-2', uid: 'sample-2', student_id: '5B-ivanov', name: 'Иванов Иван', class_name: '5B', teacher: 'Гульмира', created_at: new Date().toISOString() });
        }
        setEvents(ev);
      } else {
        const { data, error } = await (supabase as any).from('nfc_events').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        setEvents(data || []);
      }
    } catch (e: any) { toast.error(e.message || 'Ошибка'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Посещаемость (NFC)</h1>
        <div className="flex gap-2">
          <Button onClick={load} disabled={loading}>{loading ? 'Загрузка...' : 'Обновить'}</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        {events.length === 0 && <div className="text-sm text-muted-foreground">Нет записей</div>}
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="p-3 border rounded-md flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.name || `UID: ${e.uid}`}</div>
                  <div className="text-xs text-muted-foreground">Класс: {e.class_name || e.student_id || '—'}</div>
                  <div className="text-xs text-muted-foreground">Кл. рук.: {e.teacher || '—'}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              </div>
          ))}
        </div>
      </div>
    </div>
  );
}
