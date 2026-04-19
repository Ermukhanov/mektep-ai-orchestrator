import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MorningReports() {
  const [report, setReport] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
      if (base.includes('localhost:8787')) {
        // mock: fetch attendance events and class list, build summary
        const [attRes, classesRes] = await Promise.all([
          fetch(`${base}/functions/get-attendance`),
          fetch(`${base}/rest/v1/classes`),
        ]);
        const att = await attRes.json().catch(() => ({ events: [] }));
        const classes = await classesRes.json().catch(() => []);

        // build per-class counts
        const byClass: Record<string, { present: number; absent: number }> = {};
        for (const c of classes) byClass[c.name] = { present: 0, absent: 0 };
        for (const e of att.events || []) {
          const cn = e.class_name || e.class || 'Unknown';
          if (!byClass[cn]) byClass[cn] = { present: 0, absent: 0 };
          if (e.status === 'absent' || e.status === 'absentee' || e.status === 'absent_reason') byClass[cn].absent++;
          else byClass[cn].present++;
        }

        let totalStudents = 0;
        let totalPresent = 0;
        let totalAbsent = 0;
        const lines: string[] = ["class,total,present,absent"];
        for (const c of classes) {
          const counts = byClass[c.name] || { present: 0, absent: 0 };
          const total = c.student_count || (counts.present + counts.absent);
          lines.push(`${c.name},${total},${counts.present},${counts.absent}`);
          totalStudents += total; totalPresent += counts.present; totalAbsent += counts.absent;
        }
        lines.unshift(`generated_at,${new Date().toISOString()}`);
        lines.push(`summary,students:${totalStudents},present:${totalPresent},absent:${totalAbsent}`);
        setReport(lines.join('\n'));
      } else {
        const res = await fetch(`${base}/functions/v1/morning-report`, { method: 'POST', headers: { apikey: (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '' } });
        const j = await res.json();
        if (!res.ok) { toast.error(JSON.stringify(j)); setReport(`date,room,issue\n${new Date().toLocaleDateString()},Кабинет 101,тестовая запись`); }
        else setReport(j.csv || null);
      }
    } catch (e: any) { toast.error(e.message || 'Ошибка'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const download = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `morning_report_${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(url);
    toast.success('Скачано');
  };

  const loadTasks = async () => {
    try {
      const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
      const res = await fetch(`${base}/functions/get-tasks`);
      const j = await res.json();
      setTasks(j.tasks || []);
    } catch (e) { 
      // fallback mock tasks
      setTasks([{ id: 'm1', title: 'Тестовая задача: проверить столовую', description: 'Проверка готовности', assignee: 'Иванов' }]);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Утренние отчёты</h1>
        <div className="flex gap-2">
          <Button onClick={load} disabled={loading}>{loading ? 'Загрузка...' : 'Обновить'}</Button>
          <Button onClick={download} disabled={!report}>Скачать CSV</Button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        {report ? (
          <pre className="text-sm whitespace-pre-wrap">{report}</pre>
        ) : (
          <div className="text-sm text-muted-foreground">Отчёты ещё не сформированы</div>
        )}
      </div>

      <div className="mt-4">
        <h2 className="font-semibold">Созданные задачи (инциденты)</h2>
        <div className="space-y-2 mt-2">
          {tasks.length === 0 && <div className="text-sm text-muted-foreground">Задач нет</div>}
          {tasks.map((t: any) => (
            <div key={t.id} className="p-3 bg-card rounded-xl border border-border">
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
              <div className="text-xs mt-2">Исполнитель: {t.assignee}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
