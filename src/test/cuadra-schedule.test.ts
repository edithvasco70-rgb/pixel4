import { describe, expect, it } from "vitest";

import {
  evaluateSchedule,
  generateCourseCombinations,
  hasWorkConflict,
  type Availability,
  type Course,
  type Preferences,
} from "@/lib/cuadra-schedule";

const availability: Availability = {
  type: "fijo",
  days: ["Lun", "Mar", "Mié", "Jue", "Vie"],
  startTime: "08:00",
  endTime: "17:00",
  commute: 30,
};
const preferences: Preferences = {
  courseCount: 3,
  avoidNights: true,
  freeDays: ["Sáb", "Dom"],
  minimumRest: 2,
};

describe("Cuadra schedule rules", () => {
  it("flags the 19:00 class because work, 30 minutes of travel, and two hours of rest end at 19:30", () => {
    expect(
      hasWorkConflict({ startTime: "19:00", endTime: "21:00" }, availability, preferences),
    ).toBe("traslado-descanso");
  });

  it("allows a class starting at 19:30 after a 17:00 shift with 30 minutes travel and two hours rest", () => {
    expect(
      hasWorkConflict({ startTime: "19:30", endTime: "21:00" }, availability, preferences),
    ).toBeNull();
  });

  it("requires the full two-hour rest after the 30-minute commute", () => {
    expect(
      hasWorkConflict({ startTime: "19:00", endTime: "20:00" }, availability, preferences),
    ).toBe("traslado-descanso");
    expect(
      hasWorkConflict({ startTime: "19:29", endTime: "20:30" }, availability, preferences),
    ).toBe("traslado-descanso");
    expect(
      hasWorkConflict({ startTime: "19:30", endTime: "20:30" }, availability, preferences),
    ).toBeNull();
  });

  it("flags classes that overlap an 08:00–17:00 working day", () => {
    expect(
      hasWorkConflict({ startTime: "10:00", endTime: "12:00" }, availability, preferences),
    ).toBe("trabajo");
  });

  it("checks both alternating work shifts without applying them to days off", () => {
    const rotating: Availability = {
      ...availability,
      type: "rotativo",
      days: ["Lun"],
      rotatingShifts: [
        { week: "A", days: ["Lun"], startTime: "08:00", endTime: "16:00" },
        { week: "B", days: ["Lun"], startTime: "16:00", endTime: "22:00" },
      ],
    };

    expect(hasWorkConflict({ startTime: "19:00", endTime: "20:00" }, rotating, preferences, "Lun")).toBe("trabajo");
    expect(hasWorkConflict({ startTime: "19:00", endTime: "20:00" }, rotating, preferences, "Mar")).toBeNull();
    const course: Course = {
      id: "evening",
      name: "Curso nocturno",
      section: "A1",
      days: ["Lun"],
      startTime: "19:00",
      endTime: "20:00",
      credits: 3,
      mandatory: false,
    };
    expect(evaluateSchedule([course], rotating, { ...preferences, courseCount: 1 }).conflicts).toEqual([
      { courseId: "evening", day: "Lun", reason: "trabajo" },
    ]);
  });

  it("keeps only three-course combinations that include every mandatory course", () => {
    const courses: Course[] = [
      { id: "p", name: "Programación", section: "A1", days: ["Lun"], startTime: "20:00", endTime: "21:00", credits: 3, mandatory: true },
      { id: "b", name: "Base de Datos", section: "B2", days: ["Mar"], startTime: "20:00", endTime: "21:00", credits: 3, mandatory: true },
      { id: "r", name: "Redes", section: "C1", days: ["Vie"], startTime: "19:00", endTime: "21:00", credits: 3, mandatory: false },
      { id: "m", name: "Matemática", section: "D1", days: ["Sáb"], startTime: "10:00", endTime: "12:00", credits: 3, mandatory: false },
      { id: "x", name: "Proyecto", section: "E1", days: ["Dom"], startTime: "10:00", endTime: "12:00", credits: 3, mandatory: false },
    ];

    const combinations = generateCourseCombinations(courses, 3);
    expect(combinations).toHaveLength(3);
    expect(combinations.every((group) => group.length === 3)).toBe(true);
    expect(combinations.every((group) => group.some((course) => course.id === "p"))).toBe(true);
    expect(combinations.every((group) => group.some((course) => course.id === "b"))).toBe(true);
  });

  it("scores weekend classes on the selected free days below an otherwise clear schedule", () => {
    const weekendCourse: Course = {
      id: "weekend",
      name: "Taller",
      section: "F1",
      days: ["Sáb"],
      startTime: "10:00",
      endTime: "12:00",
      credits: 3,
      mandatory: false,
    };
    const score = evaluateSchedule([weekendCourse], availability, { ...preferences, courseCount: 1 }).score;
    expect(score).toBe(92);
  });

  it("prioritizes an option that keeps the preferred free days and avoids late classes", async () => {
    const { generateProposals } = await import("@/lib/cuadra-schedule");
    const required: Course[] = [
      { id: "p", name: "Programación", section: "A1", days: ["Lun"], startTime: "20:00", endTime: "21:00", credits: 3, mandatory: true },
      { id: "b", name: "Base de Datos", section: "B2", days: ["Mar"], startTime: "20:00", endTime: "21:00", credits: 3, mandatory: true },
    ];
    const options: Course[] = [
      { id: "r", name: "Redes", section: "C1", days: ["Sáb"], startTime: "21:00", endTime: "22:00", credits: 3, mandatory: false },
      { id: "m", name: "Matemática", section: "D1", days: ["Mié"], startTime: "20:00", endTime: "21:00", credits: 3, mandatory: false },
    ];
    const proposals = generateProposals([...required, ...options], availability, preferences);
    expect(proposals[0]?.courses.map((course) => course.id)).toEqual(["p", "b", "m"]);
    expect(proposals[0]?.freeDayClasses).toHaveLength(0);
    expect(proposals[0]?.nightClasses).toHaveLength(0);
  });
});
describe("Cruces entre cursos", () => {
  const base = { section: "A1", credits: 3, mandatory: false } as const;

  it("detecta dos cursos que se pisan el mismo día", async () => {
    const { findCourseOverlaps } = await import("@/lib/cuadra-schedule");
    const redes: Course = { ...base, id: "r", name: "Redes", days: ["Vie", "Jue"], startTime: "19:00", endTime: "21:00" };
    const bd: Course = { ...base, id: "b", name: "Base de Datos", days: ["Mar", "Jue"], startTime: "19:00", endTime: "21:00" };
    expect(findCourseOverlaps([redes, bd])).toEqual([{ courseIds: ["r", "b"], day: "Jue" }]);
  });

  it("no marca cruce si un curso empieza cuando el otro termina o si los días difieren", async () => {
    const { findCourseOverlaps } = await import("@/lib/cuadra-schedule");
    const a: Course = { ...base, id: "a", name: "A", days: ["Lun"], startTime: "18:00", endTime: "20:00" };
    const b: Course = { ...base, id: "b", name: "B", days: ["Lun"], startTime: "20:00", endTime: "22:00" };
    const c: Course = { ...base, id: "c", name: "C", days: ["Mar"], startTime: "18:00", endTime: "20:00" };
    expect(findCourseOverlaps([a, b, c])).toEqual([]);
  });

  it("solo devuelve propuestas sin cruces entre cursos", async () => {
    const { generateProposals } = await import("@/lib/cuadra-schedule");
    const mk = (id: string, day: Course["days"][number], start: string, end: string, mandatory = false): Course =>
      ({ ...base, id, name: id, days: [day], startTime: start, endTime: end, mandatory });
    const courses = [
      mk("p", "Lun", "20:00", "21:00", true),
      mk("choca", "Lun", "20:00", "21:00"),
      mk("libre", "Mar", "20:00", "21:00"),
    ];
    const proposals = generateProposals(courses, availability, { ...preferences, courseCount: 2 });
    expect(proposals[0]?.courses.map((c) => c.id)).toEqual(["p", "libre"]);
    expect(proposals[0]?.overlaps).toHaveLength(0);
    expect(proposals).toHaveLength(1);
  });

  it("devuelve las mejores opciones sin cruces entre cursos cuando todas chocan con la jornada", async () => {
    const { generateProposals } = await import("@/lib/cuadra-schedule");
    const required: Course = {
      id: "required",
      name: "Curso obligatorio",
      section: "A1",
      days: ["Lun"],
      startTime: "18:00",
      endTime: "20:00",
      credits: 3,
      mandatory: true,
    };

    const proposals = generateProposals([required], availability, { ...preferences, courseCount: 1 });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.courses).toEqual([required]);
    expect(proposals[0]?.conflicts).toEqual([
      { courseId: "required", day: "Lun", reason: "traslado-descanso" },
    ]);
    expect(proposals[0]?.overlaps).toEqual([]);
  });

  it("uses added courses instead of demo examples and adapts to the number actually added", async () => {
    const { generateProposals } = await import("@/lib/cuadra-schedule");
    const demo: Course = {
      id: "demo",
      name: "Curso de ejemplo",
      section: "A1",
      days: ["Lun"],
      startTime: "10:00",
      endTime: "12:00",
      credits: 3,
      mandatory: true,
      demo: true,
    };
    const added: Course = {
      id: "added",
      name: "Curso agregado",
      section: "B1",
      days: ["Sáb"],
      startTime: "10:00",
      endTime: "12:00",
      credits: 3,
      mandatory: false,
    };

    const proposals = generateProposals([demo, added], availability, preferences);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.courses).toEqual([added]);
  });
});
