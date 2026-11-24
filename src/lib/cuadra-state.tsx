import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

import type { Availability, Course, Preferences, WeekDay } from "@/lib/cuadra-schedule";

export type CuadraView =
  | "welcome"
  | "availability"
  | "courses"
  | "preferences"
  | "proposals"
  | "schedule"
  | "plan-b"
  | "feedback"
  | "help";

export type FeedbackEntry = { id: string; message: string; createdAt: string };
export type FreeNoteMap = Partial<Record<WeekDay, Record<string, string>>>;

export type CuadraState = {
  view: CuadraView;
  returnView: CuadraView;
  registered: boolean;
  availability: Availability;
  courses: Course[];
  preferences: Preferences;
  proposalIndex: number;
  selectedCourseIds: string[];
  freeNotes: FreeNoteMap;
  saved: boolean;
  feedback: FeedbackEntry[];
};

export const DEMO_COURSES: Course[] = [
  {
    id: "programacion",
    name: "Programación",
    section: "A1",
    days: ["Lun", "Mié"],
    startTime: "18:00",
    endTime: "20:00",
    credits: 3,
    mandatory: true,
    demo: true,
    instructor: "Prof. Ana Torres",
    color: "#4f46e5",
  },
  {
    id: "base-datos",
    name: "Base de Datos",
    section: "B2",
    days: ["Mar", "Jue"],
    startTime: "19:00",
    endTime: "21:00",
    credits: 3,
    mandatory: true,
    demo: true,
    instructor: "Prof. Luis Vega",
    color: "#0891b2",
  },
  {
    id: "redes",
    name: "Redes Informáticas",
    section: "C1",
    days: ["Vie", "Jue"],
    startTime: "19:00",
    endTime: "21:00",
    credits: 3,
    mandatory: false,
    demo: true,
    color: "#16a34a",
  },
  {
    id: "matematica-demo",
    name: "Matemática Discreta",
    section: "D1",
    days: ["Sáb"],
    startTime: "10:00",
    endTime: "12:00",
    credits: 3,
    mandatory: false,
    demo: true,
    color: "#d97706",
  },
  {
    id: "proyecto-demo",
    name: "Proyecto Digital",
    section: "E1",
    days: ["Dom"],
    startTime: "10:00",
    endTime: "12:00",
    credits: 3,
    mandatory: false,
    demo: true,
    color: "#db2777",
  },
];

export const INITIAL_CUADRA_STATE: CuadraState = {
  view: "welcome",
  returnView: "welcome",
  registered: false,
  availability: {
    type: "fijo",
    days: ["Lun", "Mar", "Mié", "Jue", "Vie"],
    startTime: "08:00",
    endTime: "17:00",
    commute: 30,
  },
  courses: DEMO_COURSES,
  preferences: {
    courseCount: 3,
    avoidNights: true,
    freeDays: ["Sáb", "Dom"],
    minimumRest: 2,
  },
  proposalIndex: 0,
  selectedCourseIds: DEMO_COURSES.slice(0, 3).map((course) => course.id),
  freeNotes: {},
  saved: false,
  feedback: [],
};

type Action = { type: "patch"; value: Partial<CuadraState> } | { type: "restore"; value: Partial<CuadraState> };

function reducer(state: CuadraState, action: Action): CuadraState {
  if (action.type === "restore") {
    const storedAvailability = action.value.availability as (Partial<Availability> & { note?: string }) | undefined;
    const { note: oldWorkNote, ...availability } = storedAvailability ?? {};
    let workNotes: Availability["workNotes"] = { ...availability.workNotes };
    if (oldWorkNote && !Object.values(workNotes ?? {}).some((dayNotes) => Object.values(dayNotes).some(Boolean))) {
      const shift = availability.rotatingShifts?.[0];
      const firstWorkDay = shift?.days[0] ?? availability.days?.[0] ?? "Lun";
      const startTime = shift?.startTime ?? availability.startTime ?? "08:00";
      const slotLabel = startTime < "10:00"
        ? "8–10 a. m."
        : startTime < "12:00"
          ? "10–12 m."
          : startTime < "14:00"
            ? "12–2 p. m."
            : startTime < "17:00"
              ? "2–5 p. m."
              : startTime < "20:00"
                ? "6–8 p. m."
                : "8–10 p. m.";
      workNotes ??= {};
      workNotes[firstWorkDay] = { [slotLabel]: oldWorkNote };
    }

    return {
      ...INITIAL_CUADRA_STATE,
      ...action.value,
      availability: { ...INITIAL_CUADRA_STATE.availability, ...availability, workNotes },
      preferences: { ...INITIAL_CUADRA_STATE.preferences, ...action.value.preferences },
    };
  }
  return { ...state, ...action.value };
}

type ContextValue = {
  state: CuadraState;
  update: (value: Partial<CuadraState>) => void;
  demoPassword: string;
  updateDemoPassword: (password: string) => void;
};
const CuadraContext = createContext<ContextValue | null>(null);

export function CuadraProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_CUADRA_STATE);
  const [demoPassword, setDemoPassword] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cuadra-planner-v1");
      if (saved) dispatch({ type: "restore", value: JSON.parse(saved) as Partial<CuadraState> });
    } catch {
      window.localStorage.removeItem("cuadra-planner-v1");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("cuadra-planner-v1", JSON.stringify(state));
  }, [ready, state]);

  const value = useMemo(
    () => ({
      state,
      update: (patch: Partial<CuadraState>) => dispatch({ type: "patch", value: patch }),
      demoPassword,
      updateDemoPassword: setDemoPassword,
    }),
    [state, demoPassword],
  );
  return <CuadraContext.Provider value={value}>{children}</CuadraContext.Provider>;
}

export function useCuadra() {
  const context = useContext(CuadraContext);
  if (!context) throw new Error("useCuadra debe usarse dentro de CuadraProvider");
  return context;
}

export function toggleDay(days: WeekDay[], day: WeekDay): WeekDay[] {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
}