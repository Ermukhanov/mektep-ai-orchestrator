import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function WAOutboundLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
      if (base.includes('localhost:8787')) {
        const res = await fetch(`${base}/functions/get-wa-logs`);
        const j = await res.json();
        setRows(j.logs || []);
      } else {
        const { data } = await (supabase as any).from('wa_outbound_logs').select('*').order('created_at', { ascending: false }).limit(200);
        setRows(data || []);
      }
    } catch (e) {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Логи исходящих WhatsApp</h1>
        <Button onClick={load} disabled={loading}>{loading ? 'Загрузка...' : 'Обновить'}</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        {rows.length === 0 ? <div className="text-sm text-muted-foreground">Нет записей</div> : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="p-3 bg-background border border-border rounded-lg text-sm">
                <div className="font-medium">{r.chat_id} — {new Date(r.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{r.message}</div>
                {r.response && <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(r.response)}</pre>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
