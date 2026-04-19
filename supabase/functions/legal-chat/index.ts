// MEKTEP AI — Legal Document Generator
// Generates school orders/documents based on Kazakhstani Ministry templates
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates for common Kazakhstani school orders
const ORDER_TEMPLATES: Record<string, any> = {
  "130": {
    title: "Приказ о присвоении квалификационной категории педагогу",
    number_prefix: "130",
    fields: ["teacher_full_name", "position", "category", "date", "school_name", "director_name", "basis"],
    template: `ПРИКАЗ №____
от {date} года

О присвоении квалификационной категории

На основании {basis}, протокола аттестационной комиссии:

ПРИКАЗЫВАЮ:

1. Присвоить {teacher_full_name}, занимающему(-ей) должность {position}, квалификационную категорию «{category}».

2. Бухгалтерии произвести соответствующие расчёты надбавки к должностному окладу с {date}.

3. Контроль за исполнением настоящего приказа оставляю за собой.

Директор {school_name}: _____________ {director_name}

С приказом ознакомлен(а): _____________ {teacher_full_name}
Дата: _____________`,
  },
  "76": {
    title: "Приказ об утверждении учебного плана",
    number_prefix: "76",
    fields: ["school_name", "academic_year", "director_name", "date", "curriculum_type"],
    template: `ПРИКАЗ №____
от {date} года

Об утверждении учебного плана на {academic_year} учебный год

В целях обеспечения государственного стандарта образования:

ПРИКАЗЫВАЮ:

1. Утвердить учебный план {school_name} на {academic_year} учебный год по типу: {curriculum_type}.

2. Завучу по учебной части обеспечить выполнение учебного плана в полном объёме.

3. Настоящий приказ вступает в силу с {date}.

Директор: _____________ {director_name}`,
  },
  "110": {
    title: "Приказ об организации образовательного процесса",
    number_prefix: "110",
    fields: ["school_name", "academic_year", "start_date", "end_date", "director_name", "date"],
    template: `ПРИКАЗ №____
от {date} года

Об организации образовательного процесса на {academic_year} учебный год

ПРИКАЗЫВАЮ:

1. Установить начало учебного года — {start_date}, окончание — {end_date}.

2. Утвердить режим работы учреждения: 5-дневная учебная неделя.

3. Классным руководителям провести родительские собрания до {start_date}.

4. Учителям предоставить рабочие программы до {start_date}.

Директор {school_name}: _____________ {director_name}`,
  },
  "absence": {
    title: "Приказ о временном отсутствии педагога и назначении замены",
    number_prefix: "ОД",
    fields: ["absent_teacher", "substitute_teacher", "date_from", "date_to", "reason", "school_name", "director_name", "date"],
    template: `ПРИКАЗ №____
от {date} года

О временном замещении

В связи с {reason} педагога {absent_teacher}:

ПРИКАЗЫВАЮ:

1. Возложить обязанности по проведению уроков временно отсутствующего педагога {absent_teacher} на {substitute_teacher} с {date_from} по {date_to}.

2. Оплату за замещение произвести согласно действующему законодательству.

3. {substitute_teacher} ознакомиться с тематическим планированием замещаемого педагога.

Директор {school_name}: _____________ {director_name}

С приказом ознакомлены:
{absent_teacher}: _____________
{substitute_teacher}: _____________`,
  },
  "discipline": {
    title: "Приказ о нарушении дисциплины",
    number_prefix: "ДИ",
    fields: ["student_name", "class_name", "violation", "measure", "date", "school_name", "director_name"],
    template: `ПРИКАЗ №____
от {date} года

О мерах дисциплинарного воздействия

Рассмотрев материалы о нарушении дисциплины учащимся {student_name}, класс {class_name}:
{violation}

ПРИКАЗЫВАЮ:

1. Применить к {student_name}, учащемуся {class_name} класса, меру воздействия: {measure}.

2. Классному руководителю усилить контроль за поведением учащегося.

3. Психологу провести беседу с учащимся и его родителями.

Директор {school_name}: _____________ {director_name}`,
  },
};

const SYSTEM_PROMPT = `Ты — MEKTEP AI, помощник директора казахстанской школы.
Твоя задача — генерировать официальные школьные приказы и документы.

При генерации:
1. Заполняй все поля шаблона реальными данными из запроса
2. Если данных нет — используй разумные defaults для казахстанской школы
3. Соблюдай официальный деловой стиль
4. Дата в формате "ДД.ММ.ГГГГ"
5. Номер приказа генерируй автоматически

Возвращай ТОЛЬКО tool call generate_document.`;

function buildDocTools() {
  return [{
    type: "function",
    function: {
      name: "generate_document",
      description: "Generate an official school document/order",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          order_type: { type: "string" },
          title: { type: "string" },
          order_number: { type: "string" },
          date: { type: "string" },
          content: { type: "string", description: "Full document text" },
          filled_fields: { type: "object", additionalProperties: { type: "string" } },
          summary: { type: "string", description: "Brief 1-sentence summary in Russian" },
          legal_basis: { type: "string", description: "Referenced law/order" },
        },
        required: ["order_type", "title", "order_number", "date", "content", "filled_fields", "summary"],
      },
    },
  }];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, order_type, language, school_info, corrections } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get existing legal orders from DB for context
    const { data: orders } = await supabase
      .from("legal_orders")
      .select("number, title, summary, bullets")
      .limit(10);

    // Get school info
    const { data: staffDirector } = await supabase
      .from("staff")
      .select("full_name")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const detectedType = order_type || detectOrderType(prompt || "");
    const template = ORDER_TEMPLATES[detectedType] || ORDER_TEMPLATES["absence"];

    const schoolName = school_info?.name || "КГУ «Гимназия Ақбөбек»";
    const directorName = school_info?.director || staffDirector?.full_name || "____________";

    const userPrompt = `Запрос директора: "${prompt}"
Тип документа: ${detectedType} (${template.title})
${corrections ? `Правки от директора: "${corrections}"` : ""}

Школа: ${schoolName}
Директор: ${directorName}
Дата: ${new Date().toLocaleDateString("ru-RU")}

Шаблон документа:
${template.template}

Поля для заполнения: ${template.fields.join(", ")}

${orders?.length ? `Контекст (действующие приказы МОН РК):\n${orders.map(o => `- Приказ №${o.number}: ${o.title}`).join("\n")}` : ""}

Сгенерируй официальный документ, заполнив все поля из запроса. Язык: ${language || "ru"}.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // Fast model for doc generation
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: buildDocTools(),
        tool_choice: { type: "tool", name: "generate_document" },
      }),
    });

    if (!aiRes.ok) {
      // Fallback to Lovable gateway
      const fallback = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [{ type: "function", function: buildDocTools()[0].function }],
          tool_choice: { type: "function", function: { name: "generate_document" } },
        }),
      });

      if (!fallback.ok) throw new Error("AI unavailable");
      const fbj = await fallback.json();
      const call = fbj.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) throw new Error("No tool call");
      const doc = JSON.parse(call.function.arguments);
      return new Response(JSON.stringify({ ok: true, document: doc, template_type: detectedType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolUse = aiJson.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse) throw new Error("No tool use in response");

    const doc = toolUse.input;

    // Save to legal_documents table
    await supabase.from("legal_documents").insert({
      order_number: doc.order_number || `${detectedType}-${Date.now()}`,
      title: doc.title,
      category: detectedType,
      template: doc.content,
      required_fields: template.fields,
    }).select().maybeSingle();

    return new Response(
      JSON.stringify({ ok: true, document: doc, template_type: detectedType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("generate-legal-doc fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function detectOrderType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("130") || t.includes("категор") || t.includes("аттестац")) return "130";
  if (t.includes("76") || t.includes("учебный план") || t.includes("стандарт")) return "76";
  if (t.includes("110") || t.includes("образовательный процесс") || t.includes("режим")) return "110";
  if (t.includes("замен") || t.includes("заболел") || t.includes("отсутств")) return "absence";
  if (t.includes("дисципл") || t.includes("нарушен") || t.includes("взыскан")) return "discipline";
  return "absence";
}
