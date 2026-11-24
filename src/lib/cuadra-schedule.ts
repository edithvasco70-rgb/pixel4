export const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type Course = {
  id: string;
  name: string;
  section: string;
  days: WeekDay[];
  startTime: string;
  endTime: string;
  credits: number;
  mandatory: boolean;
  demo?: boolean;
  instructor?: string;
  note?: string;
  color?: string;
};

export type RotatingShift = {
  week: "A" | "B";
  days: WeekDay[];
  startTime: string;
  endTime: string;
};

export type Availability = {
  type: "fijo" | "rotativo" | "variable";
  days: WeekDay[];
  startTime: string;
  endTime: string;
  commute: number;
  workNotes?: Partial<Record<WeekDay, Record<string, string>>>;
  rotatingShifts?: RotatingShift[];
};

export type Preferences = {
  courseCount: number;
  avoidNights: boolean;
  freeDays: WeekDay[];
  minimumRest: number;
};

export type ScheduleConflict = {
  courseId: string;
  day: WeekDay;
  reason: "trabajo" | "traslado-descanso";
};

export type CourseOverlap = {
  courseIds: [string, string];
  day: WeekDay;
};

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function hasWorkConflict(
  course: Pick<Course, "startTime" | "endTime">,
  availability: Availability,
  preferences: Preferences,
  day?: WeekDay,
): "trabajo" | "traslado-descanso" | null {
  const classStart = toMinutes(course.startTime);
  const classEnd = toMinutes(course.endTime);
  const shifts = availability.type === "rotativo" && availability.rotatingShifts?.length
    ? availability.rotatingShifts.filter((shift) => !day || shift.days.includes(day))
    : [{ startTime: availability.startTime, endTime: availability.endTime }];

  for (const shift of shifts) {
    const workStart = toMinutes(shift.startTime);
    const workEnd = toMinutes(shift.endTime);
    if (classStart < workEnd && classEnd > workStart) return "trabajo";

    const rest = preferences.minimumRest * 60;
    const commute = availability.commute;
    if (classStart < workEnd + commute + rest && classStart >= workEnd) {
      return "traslado-descanso";
    }
    if (classEnd <= workStart && classEnd + rest > workStart) {
      return "traslado-descanso";
    }
  }
  return null;
}

/** Devuelve los cruces de horario entre cursos (mismo día, horas que se pisan). */
export function findCourseOverlaps(courses: Course[]): CourseOverlap[] {
  const overlaps: CourseOverlap[] = [];
  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      const a = courses[i]!;
      const b = courses[j]!;
      const timesOverlap =
        toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
      if (!timesOverlap) continue;
      for (const day of a.days) {
        if (b.days.includes(day)) overlaps.push({ courseIds: [a.id, b.id], day });
      }
    }
  }
  return overlaps;
}

export function evaluateSchedule(
  courses: Course[],
  availability: Availability,
  preferences: Preferences,
) {
  const conflicts: ScheduleConflict[] = [];
  const nightClasses: { courseId: string; day: WeekDay }[] = [];
  const freeDayClasses: { courseId: string; day: WeekDay }[] = [];

  for (const course of courses) {
    for (const day of course.days) {
      if (availability.days.includes(day)) {
        const reason = hasWorkConflict(course, availability, preferences, day);
        if (reason) conflicts.push({ courseId: course.id, day, reason });
      }
      if (preferences.avoidNights && toMinutes(course.endTime) > 21 * 60) {
        nightClasses.push({ courseId: course.id, day });
      }
      if (preferences.freeDays.includes(day)) {
        freeDayClasses.push({ courseId: course.id, day });
      }
    }
  }

  const overlaps = findCourseOverlaps(courses);

  const countPenalty = Math.abs(preferences.courseCount - courses.length) * 10;
  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        conflicts.length * 22 -
        overlaps.length * 22 -
        nightClasses.length * 10 -
        freeDayClasses.length * 8 -
        countPenalty,
    ),
  );

  return { conflicts, overlaps, nightClasses, freeDayClasses, score };
}

export function generateCourseCombinations(courses: Course[], desiredCount: number): Course[][] {
  if (desiredCount < 1 || desiredCount > courses.length) return [];
  const required = courses.filter((course) => course.mandatory);
  if (required.length > desiredCount) return [];

  const combinations: Course[][] = [];
  const choose = (start: number, picked: Course[]) => {
    if (picked.length === desiredCount) {
      if (required.every((course) => picked.some((item) => item.id === course.id))) {
        combinations.push(picked);
      }
      return;
    }
    for (let index = start; index < courses.length; index += 1) {
      choose(index + 1, [...picked, courses[index]!]);
    }
  };
  choose(0, []);
  return combinations;
}

export type ScheduleProposal = {
  courses: Course[];
  score: number;
  conflicts: ScheduleConflict[];
  overlaps: CourseOverlap[];
  nightClasses: { courseId: string; day: WeekDay }[];
  freeDayClasses: { courseId: string; day: WeekDay }[];
};

export function generateProposals(
  courses: Course[],
  availability: Availability,
  preferences: Preferences,
  limit = 3,
): ScheduleProposal[] {
  const savedCourses = courses.some((course) => !course.demo)
    ? courses.filter((course) => !course.demo)
    : courses;
  const requiredCount = savedCourses.filter((course) => course.mandatory).length;
  const courseCount = Math.max(requiredCount, Math.min(preferences.courseCount, savedCourses.length));
  const evaluated = generateCourseCombinations(savedCourses, courseCount).map((selection) => ({
    courses: selection,
    ...evaluateSchedule(selection, availability, preferences),
  }));
  const withoutCourseOverlaps = evaluated.filter((proposal) => proposal.overlaps.length === 0);
  const conflictFree = withoutCourseOverlaps.filter((proposal) => proposal.conflicts.length === 0);

  return (conflictFree.length > 0 ? conflictFree : withoutCourseOverlaps)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}