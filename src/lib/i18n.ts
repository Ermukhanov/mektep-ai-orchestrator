import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const common = (extra: any) => ({
  appName: "MEKTEP AI", continue: "Continue", back: "Back", next: "Next", finish: "Done", cancel: "Cancel", save: "Save", loading: "Loading...",
  selectLanguage: "Select your language", languageHint: "You can change this anytime",
  ...extra,
});

const resources = {
  en: { translation: common({
    tagline: "AI Orchestrator for Aqbobek school",
    auth: { welcome: "Welcome back", createAccount: "Create your account", login: "Sign in", register: "Sign up", schoolId: "School ID", schoolIdHint: "e.g. AQB-2026", email: "Email", password: "Password", fullName: "Full name", loginCta: "Sign in", registerCta: "Create account", switchToRegister: "No account? Create one", switchToLogin: "Have an account? Sign in", invalidSchoolId: "Invalid School ID", checkEmail: "Account created! Check your email." },
    onboarding: { step: "Step {{n}} of 2", profile: "Tell us about yourself", profileSub: "We'll personalize your dashboard", role: "What's your role?", roleSub: "This shapes the tools you see", director: "Director", teacher: "Teacher", getStarted: "Open dashboard" },
    nav: { dashboard: "Dashboard", inbox: "Inbox", schedule: "Schedule", legal: "Legal AI", notifications: "Alerts", logout: "Sign out" },
    roles: { director: "Director", teacher: "Teacher", staff: "Staff" },
    dashboard: { greeting: "Good day, {{name}}", subtitle: "Here's what's happening at Aqbobek today", attendance: "Attendance", incidents: "Incidents", substitutions: "Substitutions", pendingApprovals: "Pending AI", aiProposals: "Awaiting decision", openIncidents: "Open", today: "Today", classes: "classes", liveFeed: "Live Chat Feed", liveFeedSub: "Real-time messages", attendanceTable: "Today's Attendance", attendanceSub: "Auto-parsed from chat", class: "Class", present: "Present", absent: "Absent", reportedBy: "Reported by", noReports: "Waiting for first report…", feedEmpty: "No messages yet" },
    inbox: { title: "AI Inbox", subtitle: "Chat with your school. The AI reads everything and proposes actions.", chatTitle: "School Chat", chatSub: "Teachers, parents, AI — all here", placeholder: "Type a message (try: '7A — 22 пришли, 3 нет')", empty: "No messages yet — write the first one!", parsing: "AI reading…", pendingTitle: "AI Proposals", pendingSub: "Awaiting your decision", noProposals: "AI has nothing for you to approve right now ✨", approve: "Approve", reject: "Reject", approved: "Approved & executed", rejected: "Rejected", directorOnly: "Only director can approve",
      action: { mark_teacher_absent: "Mark teacher absent + suggest substitutes", create_incident: "Create incident", create_task: "Create task", send_chat_reply: "Send AI reply", log_attendance: "Attendance logged" } },
    schedule: { title: "Schedule", subtitle: "Real timetable — 13 classes, 5 days", class: "Class", period: "Period", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" },
    legal: { title: "Legal Assistant", subtitle: "Ministry of Education orders, simplified by AI", orders: "Orders", simplify: "Ask AI", chatPlaceholder: "Ask about an order…", emptyChat: "Ask AI to explain any order in plain language.", thinking: "Thinking…", noOrders: "No orders uploaded yet" },
    notifications: { title: "Notifications", subtitle: "Recent alerts and updates", markAllRead: "Mark all read", empty: "You're all caught up" },
    voice: { button: "Voice → Task", listening: "Listening…", processing: "Processing…", created: "Task created", example: "Try: \"Aigerim, prepare the assembly hall\"", micError: "Microphone error", fallbackPrompt: "Type your command:" },
  })},
  ru: { translation: common({
    tagline: "AI-оркестратор школы «Ақбөбек»",
    auth: { welcome: "С возвращением", createAccount: "Создать аккаунт", login: "Войти", register: "Регистрация", schoolId: "ID школы", schoolIdHint: "напр. AQB-2026", email: "Эл. почта", password: "Пароль", fullName: "ФИО", loginCta: "Войти", registerCta: "Создать аккаунт", switchToRegister: "Нет аккаунта? Создать", switchToLogin: "Уже есть аккаунт? Войти", invalidSchoolId: "Неверный ID школы", checkEmail: "Аккаунт создан! Проверьте почту." },
    onboarding: { step: "Шаг {{n}} из 2", profile: "Расскажите о себе", profileSub: "Персонализируем панель", role: "Ваша роль?", roleSub: "От этого зависят инструменты", director: "Директор", teacher: "Учитель", getStarted: "Открыть панель" },
    nav: { dashboard: "Панель", inbox: "Чат AI", schedule: "Расписание", legal: "Юр. AI", notifications: "Уведомления", logout: "Выйти" },
    roles: { director: "Директор", teacher: "Учитель", staff: "Сотрудник" },
    dashboard: { greeting: "Здравствуйте, {{name}}", subtitle: "Что происходит в «Ақбөбек» сегодня", attendance: "Посещаемость", incidents: "Инциденты", substitutions: "Замены", pendingApprovals: "AI ожидает", aiProposals: "Ждут решения", openIncidents: "Открыто", today: "Сегодня", classes: "классов", liveFeed: "Лента чата", liveFeedSub: "Сообщения в реальном времени", attendanceTable: "Посещаемость сегодня", attendanceSub: "AI распознаёт из чата", class: "Класс", present: "Пришло", absent: "Нет", reportedBy: "Сообщил", noReports: "Ждём первый отчёт…", feedEmpty: "Сообщений пока нет" },
    inbox: { title: "AI Чат", subtitle: "Пишите как в WhatsApp — AI читает и предлагает действия", chatTitle: "Чат школы", chatSub: "Учителя, родители, AI — всё здесь", placeholder: "Напишите (напр.: «7А — 22 пришли, 3 нет»)", empty: "Сообщений пока нет — напишите первое!", parsing: "AI читает…", pendingTitle: "Предложения AI", pendingSub: "Ждут вашего решения", noProposals: "Нет предложений на одобрение ✨", approve: "Одобрить", reject: "Отклонить", approved: "Одобрено и выполнено", rejected: "Отклонено", directorOnly: "Одобряет только директор",
      action: { mark_teacher_absent: "Отметить учителя отсутствующим + замены", create_incident: "Создать инцидент", create_task: "Создать задачу", send_chat_reply: "Отправить ответ AI", log_attendance: "Посещаемость зафиксирована" } },
    schedule: { title: "Расписание", subtitle: "Реальная сетка — 13 классов, 5 дней", class: "Класс", period: "Урок", mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт" },
    legal: { title: "Юридический AI", subtitle: "Приказы Минобразования РК — простыми словами", orders: "Приказы", simplify: "Спросить AI", chatPlaceholder: "Спросите о приказе…", emptyChat: "Попросите AI объяснить любой приказ простыми словами.", thinking: "Думаю…", noOrders: "Приказы пока не загружены" },
    notifications: { title: "Уведомления", subtitle: "Последние оповещения", markAllRead: "Прочитать всё", empty: "Всё прочитано" },
    voice: { button: "Голос → Задача", listening: "Слушаю…", processing: "Обработка…", created: "Задача создана", example: "Пример: «Айгерим, подготовь актовый зал»", micError: "Ошибка микрофона", fallbackPrompt: "Введите команду:" },
  })},
  kz: { translation: common({
    tagline: "«Ақбөбек» мектебіне арналған AI оркестратор",
    auth: { welcome: "Қайта оралуыңызбен", createAccount: "Аккаунт құру", login: "Кіру", register: "Тіркелу", schoolId: "Мектеп ID", schoolIdHint: "мыс. AQB-2026", email: "Эл. пошта", password: "Құпиясөз", fullName: "Аты-жөні", loginCta: "Кіру", registerCta: "Аккаунт құру", switchToRegister: "Аккаунт жоқ па? Құру", switchToLogin: "Аккаунтыңыз бар ма? Кіру", invalidSchoolId: "Қате мектеп ID", checkEmail: "Аккаунт құрылды! Поштаңызды тексеріңіз." },
    onboarding: { step: "{{n}}/2 қадам", profile: "Өзіңіз туралы", profileSub: "Панельді жекелендіреміз", role: "Рөліңіз?", roleSub: "Құралдар осыған байланысты", director: "Директор", teacher: "Мұғалім", getStarted: "Панельді ашу" },
    nav: { dashboard: "Панель", inbox: "AI чат", schedule: "Кесте", legal: "Заң AI", notifications: "Хабарлама", logout: "Шығу" },
    roles: { director: "Директор", teacher: "Мұғалім", staff: "Қызметкер" },
    dashboard: { greeting: "Қайырлы күн, {{name}}", subtitle: "Бүгінгі «Ақбөбек» жаңалықтары", attendance: "Қатысым", incidents: "Оқиғалар", substitutions: "Алмастырулар", pendingApprovals: "AI күтеді", aiProposals: "Шешім күтуде", openIncidents: "Ашық", today: "Бүгін", classes: "сынып", liveFeed: "Чат таспасы", liveFeedSub: "Нақты уақыттағы хабарлар", attendanceTable: "Бүгінгі қатысым", attendanceSub: "AI чаттан оқиды", class: "Сынып", present: "Қатысты", absent: "Жоқ", reportedBy: "Хабарлаған", noReports: "Бірінші есеп күтілуде…", feedEmpty: "Хабар жоқ" },
    inbox: { title: "AI чат", subtitle: "WhatsApp сияқты жазыңыз — AI оқып, әрекет ұсынады", chatTitle: "Мектеп чаты", chatSub: "Мұғалімдер, ата-аналар, AI", placeholder: "Жазыңыз (мыс.: «7А — 22 келді, 3 жоқ»)", empty: "Хабар жоқ — алғашқысын жазыңыз!", parsing: "AI оқып жатыр…", pendingTitle: "AI ұсыныстары", pendingSub: "Шешіміңіз күтілуде", noProposals: "Қазір ұсыныс жоқ ✨", approve: "Растау", reject: "Қабылдамау", approved: "Расталып орындалды", rejected: "Қабылданбады", directorOnly: "Тек директор растайды",
      action: { mark_teacher_absent: "Мұғалімді жоқ деп белгілеу + алмастырушы", create_incident: "Оқиға құру", create_task: "Тапсырма құру", send_chat_reply: "AI жауабын жіберу", log_attendance: "Қатысым тіркелді" } },
    schedule: { title: "Кесте", subtitle: "Нақты кесте — 13 сынып, 5 күн", class: "Сынып", period: "Сабақ", mon: "Дс", tue: "Сс", wed: "Ср", thu: "Бс", fri: "Жм" },
    legal: { title: "Заң көмекшісі", subtitle: "ҚР Білім министрлігі бұйрықтары — қарапайым тілде", orders: "Бұйрықтар", simplify: "AI-дан сұрау", chatPlaceholder: "Бұйрық туралы сұраңыз…", emptyChat: "AI-дан кез келген бұйрықты түсіндіруді сұраңыз.", thinking: "Ойлануда…", noOrders: "Бұйрықтар әлі жүктелмеген" },
    notifications: { title: "Хабарландырулар", subtitle: "Соңғы ескертулер", markAllRead: "Барлығын оқу", empty: "Барлығы оқылды" },
    voice: { button: "Дауыс → Тапсырма", listening: "Тыңдап тұрмын…", processing: "Өңдеуде…", created: "Тапсырма құрылды", example: "Мысал: «Айгерім, мәжіліс залын дайында»", micError: "Микрофон қатесі", fallbackPrompt: "Команданы теріңіз:" },
  })},
};

const stored = typeof window !== "undefined" ? localStorage.getItem("mektep_lang") : null;
i18n.use(initReactI18next).init({ resources, lng: stored || "ru", fallbackLng: "ru", interpolation: { escapeValue: false } });

export default i18n;
