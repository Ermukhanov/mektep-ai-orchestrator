import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function TeacherSchedule() {
  const [teacher, setTeacher] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from('staff').select('full_name').order('full_name');
      setTeachers((t||[]).map((x:any)=>x.full_name));
    })();
  }, []);

  const load = async () => {
    if (!teacher) return;
    const { data } = await supabase.from('generated_schedules').select('*').order('created_at', { ascending: false }).limit(10);
    const filtered = (data||[]).map((rec:any)=>({ ...rec, slots: (rec.grid?.slots||[]).filter((s:any)=>s.teacher===teacher) })).filter((r:any)=>r.slots.length>0);
    setSchedules(filtered);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Расписание преподавателя</h1>
        <div className="flex gap-2">
          <select value={teacher} onChange={(e)=>setTeacher(e.target.value)} className="rounded-lg border p-2">
            <option value="">Выберите преподавателя</option>
            {teachers.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
          <Button onClick={load} disabled={!teacher}>Показать</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        {schedules.length===0 ? <div className="text-sm text-muted-foreground">Нет расписаний</div> : (
          <div className="space-y-3">
            {schedules.map((s:any)=> (
              <div key={s.id} className="p-3 bg-background border border-border rounded-lg">
                <div className="font-medium">{s.for_date} — {s.day_of_week}</div>
                <div className="text-xs mt-2">
                  {s.slots.map((slot:any, i:number)=>(
                    <div key={i} className="mb-1">{slot.period}. {slot.class_name} — {slot.subject} ({slot.room})</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
