import * as XLSX from "xlsx";

interface Slot {
  class_name: string;
  period: number;
  subject: string;
  teacher: string;
  room: string;
}

interface PeriodMeta { period_number: number; time_label: string; }

export function exportScheduleXlsx(opts: {
  day_of_week: string;
  slots: Slot[];
  periods: PeriodMeta[];
  fileName?: string;
}) {
  const { day_of_week, slots, periods } = opts;
  const classes = Array.from(new Set(slots.map((s) => s.class_name))).sort();
  const periodNums = Array.from(new Set(slots.map((s) => s.period))).sort((a, b) => a - b);
  const periodMap = new Map(periods.map((p) => [p.period_number, p.time_label]));

  // Sheet 1: by class (rows=periods, cols=classes)
  const grid: any[][] = [];
  grid.push(["№ урока", "Время", ...classes]);
  for (const p of periodNums) {
    const row: any[] = [p, periodMap.get(p) || ""];
    for (const c of classes) {
      const s = slots.find((x) => x.period === p && x.class_name === c);
      row.push(s ? `${s.subject}\n${s.teacher}\nкаб.${s.room}` : "");
    }
    grid.push(row);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(grid);
  ws1["!cols"] = [{ wch: 8 }, { wch: 14 }, ...classes.map(() => ({ wch: 22 }))];
  // Wrap text in cells
  const range = XLSX.utils.decode_range(ws1["!ref"]!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws1[addr]) ws1[addr].s = { alignment: { wrapText: true, vertical: "top" } };
    }
  }

  // Sheet 2: by teacher
  const teachers = Array.from(new Set(slots.map((s) => s.teacher))).sort();
  const tGrid: any[][] = [];
  tGrid.push(["№ урока", "Время", ...teachers]);
  for (const p of periodNums) {
    const row: any[] = [p, periodMap.get(p) || ""];
    for (const t of teachers) {
      const s = slots.find((x) => x.period === p && x.teacher === t);
      row.push(s ? `${s.class_name} • ${s.subject}\nкаб.${s.room}` : "");
    }
    tGrid.push(row);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(tGrid);
  ws2["!cols"] = [{ wch: 8 }, { wch: 14 }, ...teachers.map(() => ({ wch: 24 }))];

  // Sheet 3: by room
  const rooms = Array.from(new Set(slots.map((s) => s.room))).sort((a, b) => Number(a) - Number(b));
  const rGrid: any[][] = [];
  rGrid.push(["№ урока", "Время", ...rooms.map((r) => `Каб. ${r}`)]);
  for (const p of periodNums) {
    const row: any[] = [p, periodMap.get(p) || ""];
    for (const r of rooms) {
      const s = slots.find((x) => x.period === p && x.room === r);
      row.push(s ? `${s.class_name} • ${s.subject}\n${s.teacher}` : "");
    }
    rGrid.push(row);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(rGrid);
  ws3["!cols"] = [{ wch: 8 }, { wch: 14 }, ...rooms.map(() => ({ wch: 22 }))];

  // Sheet 4: flat list
  const flat = [["День", "Период", "Время", "Класс", "Предмет", "Учитель", "Кабинет"]];
  for (const s of slots.sort((a, b) => a.period - b.period || a.class_name.localeCompare(b.class_name))) {
    flat.push([day_of_week, String(s.period), periodMap.get(s.period) || "", s.class_name, s.subject, s.teacher, s.room]);
  }
  const ws4 = XLSX.utils.aoa_to_sheet(flat);
  ws4["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 24 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "По классам");
  XLSX.utils.book_append_sheet(wb, ws2, "По учителям");
  XLSX.utils.book_append_sheet(wb, ws3, "По кабинетам");
  XLSX.utils.book_append_sheet(wb, ws4, "Список");

  const fileName = opts.fileName || `Расписание_${day_of_week}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
