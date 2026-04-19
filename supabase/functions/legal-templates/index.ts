// Return built-in legal templates for frontend consumption
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORDER_TEMPLATES: Record<string, any> = {
  "130": { title: "Приказ о присвоении квалификационной категории педагогу", fields: ["teacher_full_name", "position", "category", "date", "school_name", "director_name", "basis"] },
  "76": { title: "Приказ об утверждении учебного плана", fields: ["school_name", "academic_year", "director_name", "date", "curriculum_type"] },
  "110": { title: "Приказ об организации образовательного процесса", fields: ["school_name", "academic_year", "start_date", "end_date", "director_name", "date"] },
  "absence": { title: "Приказ о временном отсутствии педагога и назначении замены", fields: ["absent_teacher", "substitute_teacher", "date_from", "date_to", "reason", "school_name", "director_name", "date"] },
  "discipline": { title: "Приказ о нарушении дисциплины", fields: ["student_name", "class_name", "violation", "measure", "date", "school_name", "director_name"] },
};

Deno.serve(() => new Response(JSON.stringify(ORDER_TEMPLATES), { headers: { ...corsHeaders, "Content-Type": "application/json" } }));
