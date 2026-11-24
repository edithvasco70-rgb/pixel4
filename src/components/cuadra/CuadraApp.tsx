import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  GraduationCap,
  Headphones,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Star,
  StickyNote,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  evaluateSchedule,
  findCourseOverlaps,
  generateProposals,
  hasWorkConflict,
  toMinutes,
  WEEK_DAYS,
  type Availability,
  type Course,
  type Preferences,
  type WeekDay,
} from "@/lib/cuadra-schedule";
import { INITIAL_CUADRA_STATE, toggleDay, useCuadra, type CuadraView, type FeedbackEntry } from "@/lib/cuadra-state";
import studentArtwork from "@/assets/cuadra-estudiante.jpg";

const STEPS: { view: CuadraView; title: string }[] = [
  { view: "availability", title: "Disponibilidad" },
  { view: "courses", title: "Cursos" },
  { view: "preferences", title: "Preferencias" },
  { view: "proposals", title: "Propuestas" },
];

function formatTime(value: string) {
  const [rawHours, minutes] = value.split(":").map(Number);
  const hours = rawHours ?? 0;
  const suffix = hours < 12 ? "a. m." : "p. m.";
  const clock = hours % 12 || 12;
  return `${String(clock).padStart(2, "0")}:${String(minutes ?? 0).padStart(2, "0")} ${suffix}`;
}

function timeOptions() {
  return Array.from({ length: 33 }, (_, index) => {
    const total = 6 * 60 + index * 30;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-primary">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="text-[15px] font-extrabold tracking-[0.14em]">CUADRA</span>
    </span>
  );
}

function DayButtons({
  selected,
  onToggle,
  label,
}: {
  selected: WeekDay[];
  onToggle: (day: WeekDay) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label={label}>
      {WEEK_DAYS.map((day) => (
        <Button
          key={day}
          type="button"
          variant={selected.includes(day) ? "default" : "outline"}
          size="sm"
          aria-pressed={selected.includes(day)}
          onClick={() => onToggle(day)}
          className="min-w-12 rounded-xl"
        >
          {day}
        </Button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}

function TimePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className="h-11 bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {timeOptions().map((time) => (
          <SelectItem value={time} key={time}>
            {formatTime(time)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TopBar() {
  const { state, update } = useCuadra();
  // El logo e "Inicio" siempre llevan a la portada, aunque ya estés registrado.
  const goHome = () => update({ view: "welcome" });
  const goMySpace = () => update({ view: state.saved ? "schedule" : "availability" });
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:flex sm:justify-between sm:px-8">
        <Button variant="ghost" className="h-auto justify-start px-0 hover:bg-transparent" onClick={goHome} aria-label="CUADRA, ir al inicio">
          <Brand />
        </Button>
        <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={goHome} className="px-2 sm:px-3">
            Inicio
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update({ returnView: state.view, view: "help" })} className="px-2 sm:px-3">
            Ayuda
          </Button>
          {state.registered && (
            <Button variant="ghost" size="sm" onClick={goMySpace} className="hidden gap-1.5 border-l border-border pl-3 text-xs font-medium text-muted-foreground sm:inline-flex">
              <CheckCircle2 className="size-4 text-success" /> Mi espacio
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function Progress({ view }: { view: CuadraView }) {
  const current = view === "schedule" || view === "plan-b" ? 4 : Math.max(0, STEPS.findIndex((step) => step.view === view) + 1);
  const isComplete = view === "schedule";
  return (
    <nav aria-label="Progreso del horario" className="mx-auto mb-9 w-full max-w-3xl px-2">
      <ol className="grid grid-cols-4">
        {STEPS.map((step, index) => {
          const complete = isComplete || index + 1 < current;
          const active = !isComplete && index + 1 === current;
          return (
            <li key={step.view} className="relative flex flex-col items-center gap-2 text-center">
              {index > 0 && (
                <span className={`absolute right-1/2 top-[15px] h-px w-full ${complete || active ? "bg-primary" : "bg-border"}`} />
              )}
              <span className={`relative z-10 grid size-[30px] place-items-center rounded-full border text-xs font-bold ${complete || active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>
                {complete ? <Check className="size-4" /> : index + 1}
              </span>
              <span className={`text-[11px] font-medium sm:text-xs ${active || complete ? "text-foreground" : "text-muted-foreground"}`}>
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Welcome() {
  const { state, update, demoPassword, updateDemoPassword } = useCuadra();
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const start = () => update({ registered: true, view: "availability" });
  const logout = () => {
    if (window.confirm("Se cerrará tu sesión y se borrarán los datos guardados en este dispositivo. ¿Continuar?")) {
      updateDemoPassword("");
      update({ ...INITIAL_CUADRA_STATE });
    }
  };
  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) return;
    updateDemoPassword(password);
    setEmailOpen(false);
    start();
  };
  const submitPasswordChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (demoPassword && currentPassword !== demoPassword) {
      setPasswordError("La contraseña actual no coincide.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    updateDemoPassword(newPassword);
    setPasswordError("");
    setPasswordUpdated(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <section className="mx-auto grid min-h-[calc(100svh-64px)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-12">
        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] bg-class-soft shadow-panel ring-1 ring-border/50">
          <img
            src={studentArtwork}
            alt="Estudiante organizando sus clases junto a un calendario y un reloj"
            width={1280}
            height={1024}
            fetchPriority="high"
            className="aspect-[1.25/1] w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-background/95 px-4 py-2.5 text-xs font-semibold text-primary shadow-panel sm:bottom-6 sm:left-6 sm:text-sm">
            <CalendarDays className="size-4" /> Tus semanas, mejor organizadas
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center lg:items-start lg:text-left">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground">
            <CalendarDays className="size-4" /> Menos estrés, semanas más claras
          </span>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            Que tu trabajo no frene tus estudios
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Cuadra tus clases con tu jornada, tu traslado y el descanso que necesitas.
          </p>
          <div className="mt-6 grid w-full grid-cols-3 gap-2 text-left">
            {[
              ["01", "Cuéntanos cuándo trabajas"],
              ["02", "Agrega tus cursos"],
              ["03", "Elige tu mejor semana"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4">
                <span className="grid size-7 place-items-center rounded-full bg-class-soft text-[11px] font-extrabold text-primary">{number}</span>
                <p className="mt-2 text-[11px] font-semibold leading-4 text-foreground sm:text-xs">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 grid w-full gap-3">
            {state.registered ? (
              <>
                <Button className="h-12 w-full" onClick={() => update({ view: "availability" })}>
                  <Plus /> Agregar horario
                </Button>
                <Button variant="outline" className="h-12 w-full" disabled={!state.saved} onClick={() => update({ view: "schedule" })}>
                  <CalendarDays /> Ver mi horario
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    className="h-10"
                    onClick={() => {
                      setPasswordOpen(true);
                      setPasswordError("");
                      setPasswordUpdated(false);
                    }}
                  >
                    <LockKeyhole /> Cambiar contraseña
                  </Button>
                  <Button variant="ghost" className="h-10" onClick={() => update({ returnView: "welcome", view: "feedback" })}>
                    <MessageSquareText /> Comentarios
                  </Button>
                </div>
                <Button variant="outline" className="h-12 w-full" onClick={logout}>
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <>
                {state.saved && (
                  <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => update({ view: "schedule" })}>
                    <CalendarDays /> Ver mi horario
                  </Button>
                )}
                <Button className="h-13 w-full rounded-2xl text-base shadow-md shadow-primary/20" onClick={() => update({ view: "availability" })}>
                  Empezar a organizar mi horario <ArrowRight />
                </Button>
                <details className="group rounded-2xl border border-border/70 bg-card/75 px-4 py-3 text-left">
                  <summary className="cursor-pointer list-none text-center text-sm font-semibold text-muted-foreground marker:hidden">
                    <span>¿Quieres usar un perfil de prueba?</span>
                    <ChevronDown className="ml-1 inline-block size-4 text-primary transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2">
                    <Button variant="outline" className="google-signin h-11 w-full justify-center gap-2" onClick={start}>
                      <GoogleMark /> Probar con Google
                    </Button>
                    <Button variant="outline" className="h-11 w-full" onClick={() => setEmailOpen(true)}>
                      <Mail className="size-4" /> Probar con correo
                    </Button>
                  </div>
                </details>
              </>
            )}
          </div>
          <p className="mt-4 flex items-center gap-2 text-center text-xs leading-5 text-muted-foreground">
            <LockKeyhole className="size-3.5 shrink-0" /> Modo demostración: tu horario se guarda en este dispositivo. No necesitas crear una cuenta.
          </p>
        </div>
      </section>
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear perfil de demostración</DialogTitle>
            <DialogDescription>Este perfil es local y no se conecta a una cuenta real. No uses una contraseña que tengas en otro servicio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEmail} className="grid gap-4">
            <Field label="Correo electrónico">
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" />
            </Field>
            <Field label="Contraseña (mínimo 6 caracteres)">
              <Input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">Crear cuenta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Simulación de prototipo: esta contraseña solo se conserva en memoria durante esta sesión y no protege una cuenta real.
            </DialogDescription>
          </DialogHeader>
          {passwordUpdated ? (
            <div className="grid gap-4">
              <p role="status" className="rounded-md border border-success/20 bg-success-soft p-4 text-sm font-medium text-success">
                Contraseña de demostración actualizada para esta sesión.
              </p>
              <DialogFooter>
                <Button onClick={() => setPasswordOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submitPasswordChange} className="grid gap-4">
              <Field label="Contraseña actual">
                <Input
                  type="password"
                  required={Boolean(demoPassword)}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </Field>
              <Field label="Nueva contraseña (mínimo 6 caracteres)">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              {passwordError && <p role="alert" className="text-sm text-conflict">{passwordError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
                <Button type="submit">Actualizar contraseña</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function PageFrame({ children, view, eyebrow, title, description }: {
  children: React.ReactNode;
  view: CuadraView;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <main className="mx-auto min-h-[calc(100svh-64px)] max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      {view !== "welcome" && view !== "help" && view !== "feedback" && <Progress view={view} />}
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 rounded-[1.75rem] border border-border/70 bg-card/75 px-5 py-5 shadow-sm sm:px-7">
          <p className="mb-2 inline-flex items-center rounded-full bg-class-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">{eyebrow}</p>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

function AvailabilityStep() {
  const { state, update } = useCuadra();
  const work = state.availability;
  const updateWork = (patch: Partial<typeof work>) => update({ availability: { ...work, ...patch }, saved: false });
  const rotatingShifts = work.rotatingShifts ?? (["A", "B"] as const).map((week) => ({
    week,
    days: work.days,
    startTime: work.startTime,
    endTime: work.endTime,
  }));
  const updateRotatingShift = (week: "A" | "B", patch: Partial<(typeof rotatingShifts)[number]>) => {
    const shifts = rotatingShifts.map((shift) => shift.week === week ? { ...shift, ...patch } : shift);
    updateWork({ rotatingShifts: shifts, days: [...new Set(shifts.flatMap((shift) => shift.days))] });
  };
  return (
    <PageFrame view="availability" eyebrow="Paso 1 de 4 · Tu trabajo" title="¿Cuándo estás trabajando?" description="Marca tus días y horas. Usaremos esto para evitar clases que choquen con tu jornada.">
      <div className="grid gap-6 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-panel sm:p-7">
        <div className="grid gap-2">
          <h2 className="text-sm font-semibold">Tipo de horario</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              ["fijo", "Horario fijo", CalendarDays],
              ["rotativo", "Rotativo", Clock3],
              ["variable", "Variable", ShieldCheck],
            ] as const).map(([value, label, Icon]) => (
              <Button
                key={value}
                type="button"
                variant={work.type === value ? "default" : "outline"}
                onClick={() => updateWork({
                  type: value,
                  ...(value === "rotativo" && !work.rotatingShifts ? { rotatingShifts } : {}),
                })}
                aria-pressed={work.type === value}
                className="h-auto min-h-14 justify-start gap-3 rounded-2xl py-3 sm:justify-center"
              >
                <Icon className="size-4" /> {label}
              </Button>
            ))}
          </div>
        </div>
        {work.type === "rotativo" ? (
          <section aria-label="Turnos rotativos" className="grid gap-4">
            <div>
              <h2 className="text-sm font-semibold">Así funciona tu turno rotativo</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Configura una semana A y otra B. Cuadra marcará como posible conflicto cualquier clase que coincida con alguno de tus turnos.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {rotatingShifts.map((shift) => (
                <div key={shift.week} className="grid gap-4 rounded-2xl border border-border bg-background/80 p-4">
                  <h3 className="text-sm font-semibold">Semana {shift.week}</h3>
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Días que trabajas</p>
                    <DayButtons
                      selected={shift.days}
                      label={`Días de trabajo, semana ${shift.week}`}
                      onToggle={(day) => updateRotatingShift(shift.week, { days: toggleDay(shift.days, day) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Entrada, semana ${shift.week}`}>
                      <TimePicker value={shift.startTime} ariaLabel={`Hora de entrada, semana ${shift.week}`} onChange={(startTime) => updateRotatingShift(shift.week, { startTime })} />
                    </Field>
                    <Field label={`Salida, semana ${shift.week}`}>
                      <TimePicker value={shift.endTime} ariaLabel={`Hora de salida, semana ${shift.week}`} onChange={(endTime) => updateRotatingShift(shift.week, { endTime })} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-2">
              <h2 className="text-sm font-semibold">Días que trabajas</h2>
              <DayButtons selected={work.days} label="Días de trabajo" onToggle={(day) => updateWork({ days: toggleDay(work.days, day) })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hora de entrada">
                <TimePicker value={work.startTime} ariaLabel="Hora de entrada" onChange={(startTime) => updateWork({ startTime })} />
              </Field>
              <Field label="Hora de salida">
                <TimePicker value={work.endTime} ariaLabel="Hora de salida" onChange={(endTime) => updateWork({ endTime })} />
              </Field>
            </div>
          </>
        )}
        <Field label="Tiempo de traslado (opcional, para calcular tu descanso)">
          <Select value={String(work.commute)} onValueChange={(value) => updateWork({ commute: Number(value) })}>
            <SelectTrigger aria-label="Tiempo de traslado" className="h-11 bg-background sm:max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[15, 30, 45, 60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex justify-end border-t border-border pt-5">
          <Button onClick={() => update({ view: "courses" })}>Continuar <ArrowRight /></Button>
        </div>
      </div>
    </PageFrame>
  );
}

function WorkAnnotation({ day, slotLabel, compact = false }: { day: WeekDay; slotLabel: string; compact?: boolean }) {
  const { state, update } = useCuadra();
  const [open, setOpen] = useState(false);
  const note = state.availability.workNotes?.[day]?.[slotLabel] ?? "";
  const [draft, setDraft] = useState(note);
  const annotationLabel = `${note ? "Editar" : "Agregar"} anotación de trabajo · ${day} · ${slotLabel}`;
  const save = () => {
    const dayNotes = { ...state.availability.workNotes?.[day] };
    const text = draft.trim();
    if (text) dayNotes[slotLabel] = text;
    else delete dayNotes[slotLabel];
    const workNotes = { ...state.availability.workNotes };
    if (Object.keys(dayNotes).length > 0) workNotes[day] = dayNotes;
    else delete workNotes[day];
    update({ availability: { ...state.availability, workNotes } });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(note);
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          aria-label={annotationLabel}
          title={annotationLabel}
          className={compact
            ? `size-7 rounded-full ${note ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "text-foreground"}`
            : "w-fit rounded-xl"}
        >
          <StickyNote aria-hidden="true" />
          {!compact && (note ? "Editar anotación" : "Agregar anotación")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-xl">
        <div className="grid gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              <StickyNote className="size-4" /> Anotación de trabajo
            </p>
            <p className="mt-1 text-xs text-amber-900/75">{day} · {slotLabel}. Esta nota solo aparecerá en este bloque.</p>
          </div>
          <Field label={`Anotación para trabajo ${day} · ${slotLabel}`}>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ej. Turno extra o llevar uniforme..."
              maxLength={500}
              rows={4}
            />
          </Field>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={save}>Guardar anotación</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WorkDetails() {
  const { state } = useCuadra();
  const work = state.availability;
  const rotatingShifts = work.rotatingShifts ?? (["A", "B"] as const).map((week) => ({
    week,
    days: work.days,
    startTime: work.startTime,
    endTime: work.endTime,
  }));
  const title = work.type === "rotativo"
    ? "Turno rotativo"
    : work.type === "variable"
      ? "Horario variable"
      : "Horario fijo";

  return (
    <section aria-label="Detalles del trabajo" className="grid gap-2">
      <h2 className="text-sm font-semibold">Detalles de tu trabajo</h2>
      <article className="grid gap-4 rounded-2xl border border-l-4 border-work/40 bg-card p-4 shadow-sm sm:p-5" style={{ borderLeftColor: "var(--work)" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-work-soft text-foreground">
            <Clock3 className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">Tu jornada laboral</p>
          </div>
        </div>
        {work.type === "rotativo" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {rotatingShifts.map((shift) => (
              <div key={shift.week} className="rounded-xl bg-work-soft/70 p-3">
                <p className="text-xs font-bold">Semana {shift.week}</p>
                <p className="mt-1 text-sm leading-5 text-foreground">
                  {shift.days.length ? shift.days.join(" · ") : "Sin días seleccionados"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-work-soft/70 p-3">
            <p className="text-sm font-semibold">{work.days.length ? work.days.join(" · ") : "Sin días seleccionados"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatTime(work.startTime)} – {formatTime(work.endTime)}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Traslado: {work.commute} min</p>
      </article>
    </section>
  );
}

function CourseAnnotation({ course, compact = false }: { course: Course; compact?: boolean }) {
  const { state, update } = useCuadra();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(course.note ?? "");
  const annotationLabel = `${course.note ? "Editar" : "Agregar"} anotación de ${course.name}`;
  const save = () => {
    const note = draft.trim() || undefined;
    update({
      courses: state.courses.map((item) => item.id === course.id ? { ...item, note } : item),
    });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(course.note ?? "");
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          aria-label={annotationLabel}
          title={annotationLabel}
          className={compact
            ? `size-7 rounded-full ${course.note ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "text-muted-foreground"}`
            : "rounded-xl"}
        >
          <StickyNote aria-hidden="true" />
          {!compact && (course.note ? "Editar anotación" : "Anotación")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-xl">
        <div className="grid gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              <StickyNote className="size-4" /> Anotación del curso
            </p>
            <p className="mt-1 text-xs text-amber-900/75">{course.name}</p>
          </div>
          <Field label={`Anotación para ${course.name}`}>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ej. Llevar materiales o preparar el parcial..."
              maxLength={500}
              rows={4}
            />
          </Field>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={save}>Guardar anotación</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CourseNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <aside className="mt-3 -rotate-[0.4deg] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900/70">
        <StickyNote className="size-3.5" /> Anotación
      </p>
      <p className="whitespace-pre-wrap text-xs leading-5">{note}</p>
    </aside>
  );
}

function CourseCard({
  course,
  onRemove,
  onToggleImportant,
}: {
  course: Course;
  onRemove: () => void;
  onToggleImportant: () => void;
}) {
  return (
    <article className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${course.mandatory ? "border-primary ring-1 ring-primary/20" : "border-border"}`} style={{ borderLeftColor: course.color ?? "#4f46e5" }}>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <h2 className="truncate font-semibold text-foreground">{course.name}</h2>
          <Button
            type="button"
            variant={course.mandatory ? "default" : "outline"}
            size="sm"
            aria-label={course.mandatory ? `Desmarcar ${course.name} como importante` : `Marcar ${course.name} como importante`}
            aria-pressed={course.mandatory}
            onClick={onToggleImportant}
            className="h-8 rounded-full px-3 text-[11px]"
          >
            <Star className={course.mandatory ? "fill-current" : ""} />
            {course.mandatory ? "Importante" : "Hacer importante"}
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Sección: {course.section} <span aria-hidden="true">|</span> {course.days.join(" · ")}
          <br />{formatTime(course.startTime)} – {formatTime(course.endTime)} <span aria-hidden="true">·</span> {course.credits} créditos
        </p>
        {course.instructor && <p className="mt-2 text-xs text-muted-foreground">Profesor/a: {course.instructor}</p>}
        <CourseNote note={course.note} />
        {course.demo && <p className="mt-2 text-[11px] font-medium text-muted-foreground">Curso de ejemplo</p>}
      </div>
      <div className="flex items-center gap-1">
        <CourseAnnotation course={course} />
        <Button variant="ghost" size="icon" aria-label={`Eliminar ${course.name}`} title={`Eliminar ${course.name}`} onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

function CourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, update } = useCuadra();
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [days, setDays] = useState<WeekDay[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [credits, setCredits] = useState("3");
  const [mandatory, setMandatory] = useState(false);
  const [instructor, setInstructor] = useState("");
  const [note, setNote] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || days.length === 0 || toMinutes(endTime) <= toMinutes(startTime)) return;
    const course: Course = {
      id: `curso-${crypto.randomUUID()}`,
      name: name.trim(), section: section.trim() || "A1", days, startTime, endTime, credits: Number(credits), mandatory,
      instructor: instructor.trim(), note: note.trim(), color,
    };
    update({ courses: [...state.courses, course], saved: false });
    setName(""); setSection(""); setDays([]); setMandatory(false); setInstructor(""); setNote(""); setColor("#4f46e5"); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar curso</DialogTitle>
          <DialogDescription>Solo necesitas el nombre, los días y las horas. Lo demás es opcional.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nombre del curso"><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Álgebra" /></Field>
          <Field label="Días"><DayButtons selected={days} label="Días del curso" onToggle={(day) => setDays((current) => toggleDay(current, day))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora de inicio"><TimePicker value={startTime} ariaLabel="Hora de inicio del curso" onChange={setStartTime} /></Field>
            <Field label="Hora de fin"><TimePicker value={endTime} ariaLabel="Hora de fin del curso" onChange={setEndTime} /></Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/20 bg-class-soft/70 p-4 text-sm">
            <Checkbox checked={mandatory} onCheckedChange={(checked) => setMandatory(checked === true)} className="mt-0.5" />
            <span>
              <span className="block font-semibold">Marcar como importante</span>
              <span className="mt-1 block text-xs text-muted-foreground">Se incluirá en todas las propuestas de horario.</span>
            </span>
          </label>
          <Accordion type="single" collapsible>
            <AccordionItem value="detalles">
              <AccordionTrigger className="text-sm">Más detalles (opcional)</AccordionTrigger>
              <AccordionContent className="grid gap-4 pt-2">
                <Field label="Sección">
                  <Input value={section} onChange={(event) => setSection(event.target.value)} placeholder="Por defecto: A1" />
                </Field>
                <Field label="Créditos">
                  <Select value={credits} onValueChange={setCredits}><SelectTrigger aria-label="Créditos"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6].map((value) => <SelectItem key={value} value={String(value)}>{value} créditos</SelectItem>)}</SelectContent></Select>
                </Field>
                <Field label="Profesor/a (opcional)"><Input value={instructor} onChange={(event) => setInstructor(event.target.value)} placeholder="Ej. Ana Torres" /></Field>
                <Field label="Nota o recordatorio (opcional)"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Examen importante el jueves" rows={3} /></Field>
                <Field label="Color del curso">
                  <Input type="color" aria-label="Color del curso" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-20 cursor-pointer p-1" />
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Agregar curso</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CoursesStep() {
  const { state, update } = useCuadra();
  const [open, setOpen] = useState(false);
  const removeCourse = (id: string) => {
    update({ courses: state.courses.filter((course) => course.id !== id), saved: false });
  };
  const toggleCourseImportance = (id: string) => {
    update({
      courses: state.courses.map((course) => course.id === id ? { ...course, mandatory: !course.mandatory } : course),
      saved: false,
    });
  };
  return (
    <PageFrame view="courses" eyebrow="Paso 2 de 4" title="¿Cuáles son tus cursos?" description="Agrega los cursos que quieres considerar para tu horario.">
      <div className="grid gap-3">
        {state.courses.some((course) => course.demo) && (
          <p className="rounded-2xl border border-primary/15 bg-class-soft/70 px-4 py-3 text-sm leading-6 text-foreground">
            Incluimos cursos de ejemplo para mostrarte cómo funciona. Al agregar cursos propios, las propuestas usarán tus cursos y dejarán de incluir los ejemplos.
          </p>
        )}
        {state.courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onRemove={() => removeCourse(course.id)}
            onToggleImportant={() => toggleCourseImportance(course.id)}
          />
        ))}
        {state.courses.length === 0 && <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">Todavía no has agregado cursos.</div>}
        <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <Button variant="outline" onClick={() => setOpen(true)}><Plus /> Agregar curso</Button>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => update({ view: "availability" })}><ArrowLeft /> Atrás</Button>
            <Button onClick={() => update({ view: "preferences" })}>Continuar <ArrowRight /></Button>
          </div>
        </div>
      </div>
      <CourseDialog open={open} onOpenChange={setOpen} />
    </PageFrame>
  );
}

function PreferencesStep() {
  const { state, update } = useCuadra();
  const preferences = state.preferences;
  const updatePreferences = (patch: Partial<typeof preferences>) => update({ preferences: { ...preferences, ...patch }, saved: false });
  return (
    <PageFrame view="preferences" eyebrow="Paso 3 de 4 · A tu manera" title="¿Qué te viene mejor?" description="Ya dejamos una opción recomendada. Puedes cambiarla o seguir sin ajustar nada.">
      <div className="grid gap-6 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-panel sm:p-7">
        <Field label="¿Cuántos cursos deseas llevar?">
          <Select value={String(preferences.courseCount)} onValueChange={(value) => updatePreferences({ courseCount: Number(value) })}>
            <SelectTrigger aria-label="Cantidad de cursos" className="h-11 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 8 }, (_, index) => index + 1).map((count) => <SelectItem key={count} value={String(count)}>{count} {count === 1 ? "curso" : "cursos"}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 text-sm">
          <Checkbox checked={preferences.avoidNights} onCheckedChange={(checked) => updatePreferences({ avoidNights: checked === true })} className="mt-0.5" />
          <span><span className="block font-semibold">Evitar clases nocturnas</span><span className="mt-1 block text-xs text-muted-foreground">Después de las 9 p. m.</span></span>
        </label>
        <div className="grid gap-2">
          <h2 className="text-sm font-semibold">¿Tienes días libres?</h2>
          <p className="text-xs text-muted-foreground">Marca los días que prefieres dejar sin clases.</p>
          <DayButtons selected={preferences.freeDays} label="Días libres preferidos" onToggle={(day) => updatePreferences({ freeDays: toggleDay(preferences.freeDays, day) })} />
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="descanso">
            <AccordionTrigger className="text-sm">Ajustar descanso entre trabajo y clase</AccordionTrigger>
            <AccordionContent className="pt-2">
              <Field label="Descanso mínimo">
                <Select value={String(preferences.minimumRest)} onValueChange={(value) => updatePreferences({ minimumRest: Number(value) })}>
                  <SelectTrigger aria-label="Descanso mínimo" className="h-11 bg-background sm:max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 4].map((hours) => <SelectItem key={hours} value={String(hours)}>{hours} {hours === 1 ? "hora" : "horas"}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <Button variant="outline" onClick={() => update({ view: "courses" })}><ArrowLeft /> Atrás</Button>
          <Button onClick={() => update({ view: "proposals", proposalIndex: 0 })}>Ver propuestas <ArrowRight /></Button>
        </div>
      </div>
    </PageFrame>
  );
}

const CALENDAR_SLOTS = [
  { label: "8–10 a. m.", start: 8 * 60, end: 10 * 60 },
  { label: "10–12 m.", start: 10 * 60, end: 12 * 60 },
  { label: "12–2 p. m.", start: 12 * 60, end: 14 * 60 },
  { label: "2–5 p. m.", start: 14 * 60, end: 17 * 60 },
  { label: "6–8 p. m.", start: 18 * 60, end: 20 * 60 },
  { label: "8–10 p. m.", start: 20 * 60, end: 22 * 60 },
];

function getCell(day: WeekDay, slotStart: number, slotEnd: number, courses: Course[], state: ReturnType<typeof useCuadra>["state"]) {
  const classesInSlot = courses.filter((course) => course.days.includes(day) && toMinutes(course.startTime) < slotEnd && toMinutes(course.endTime) > slotStart);
  const classInSlot = classesInSlot[0];
  if (classesInSlot.length > 1 && findCourseOverlaps(classesInSlot).some((item) => item.day === day)) {
    return {
      label: classesInSlot.map((course) => course.name).join(" + "),
      kind: "conflict" as const,
      important: classesInSlot.some((course) => course.mandatory),
    };
  }
  if (classInSlot) {
    const conflict = state.availability.days.includes(day) && Boolean(evaluateSchedule([classInSlot], state.availability, state.preferences).conflicts.some((item) => item.day === day));
    return { label: classInSlot.name, kind: conflict ? "conflict" as const : "class" as const, course: classInSlot };
  }
  const shifts = state.availability.type === "rotativo" && state.availability.rotatingShifts?.length
    ? state.availability.rotatingShifts.filter((shift) => shift.days.includes(day))
    : state.availability.days.includes(day)
      ? [{ startTime: state.availability.startTime, endTime: state.availability.endTime }]
      : [];
  if (shifts.some((shift) => toMinutes(shift.startTime) < slotEnd && toMinutes(shift.endTime) > slotStart)) {
    return { label: "Trabajo", kind: "work" as const };
  }
  return { label: "Libre", kind: "free" as const };
}

function FreeAnnotation({ day, slotLabel }: { day: WeekDay; slotLabel: string }) {
  const { state, update } = useCuadra();
  const note = state.freeNotes[day]?.[slotLabel] ?? "";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const annotationLabel = `${note ? "Editar" : "Agregar"} anotación de tiempo libre · ${day} · ${slotLabel}`;
  const save = () => {
    const dayNotes = { ...state.freeNotes[day] };
    const text = draft.trim();
    if (text) dayNotes[slotLabel] = text;
    else delete dayNotes[slotLabel];
    const freeNotes = { ...state.freeNotes };
    if (Object.keys(dayNotes).length > 0) freeNotes[day] = dayNotes;
    else delete freeNotes[day];
    update({ freeNotes });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(note);
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={annotationLabel}
          title={annotationLabel}
          className={`size-6 rounded-full shadow-sm ${note ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-white/80 text-success hover:bg-white"}`}
        >
          <StickyNote aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-xl">
        <div className="grid gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              <StickyNote className="size-4" /> Anotación de tiempo libre
            </p>
            <p className="mt-1 text-xs text-amber-900/75">{day} · {slotLabel}. Solo se guardará en este bloque.</p>
          </div>
          <Field label={`Anotación para tiempo libre ${day} · ${slotLabel}`}>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ej. Hacer compras o descansar..."
              maxLength={500}
              rows={4}
            />
          </Field>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={save}>Guardar anotación</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CalendarGrid({ courses }: { courses: Course[] }) {
  const { state } = useCuadra();
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="w-24 px-3 py-3 font-semibold text-muted-foreground">Hora</th>
            {WEEK_DAYS.map((day) => <th key={day} className="px-2 py-3 text-center font-semibold text-foreground">{day}</th>)}
          </tr>
        </thead>
        <tbody>
          {CALENDAR_SLOTS.map((slot) => (
            <tr key={slot.label} className="border-b border-border last:border-0">
              <th className="px-3 py-2.5 font-medium text-muted-foreground">{slot.label}</th>
              {WEEK_DAYS.map((day) => {
                const cell = getCell(day, slot.start, slot.end, courses, state);
                const colors = cell.kind === "conflict" ? "bg-conflict-soft text-conflict" : cell.kind === "class" ? "bg-class-soft text-primary" : cell.kind === "work" ? "bg-work-soft text-foreground" : "bg-free-soft text-success";
                const course = "course" in cell ? cell.course : undefined;
                const important = course?.mandatory || ("important" in cell && cell.important);
                const workNote = cell.kind === "work" ? state.availability.workNotes?.[day]?.[slot.label] : undefined;
                const freeNote = cell.kind === "free" ? state.freeNotes[day]?.[slot.label] : undefined;
                const description = course
                  ? [course.name, course.instructor && `Profesor/a: ${course.instructor}`, course.note].filter(Boolean).join(" · ")
                  : [cell.label, workNote, freeNote].filter(Boolean).join(" · ");
                return (
                  <td key={day} className="p-1">
                    <div
                      className={`group flex min-h-10 items-center justify-center gap-1 rounded-sm border px-1.5 text-center text-[10px] font-semibold leading-4 sm:text-[11px] ${colors} ${important ? "border-2 ring-2 ring-amber-500/50" : "border-transparent"}`}
                      style={course?.color
                        ? {
                          backgroundColor: `${course.color}20`,
                          borderColor: important ? "var(--work)" : `${course.color}60`,
                          borderLeftColor: important ? "var(--work)" : course.color,
                        }
                        : important
                          ? { borderColor: "var(--work)", borderLeftColor: "var(--work)" }
                          : undefined}
                      title={description}
                      aria-label={`${description}${important ? " · Curso importante" : ""}`}
                    >
                      {important && <span className="sr-only">Importante: </span>}
                      {course && <span className="min-w-0 truncate">{cell.label}</span>}
                      {important && (
                        <span title="Curso importante" className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-400 text-amber-950">
                          <Star className="size-2.5 fill-current" aria-hidden="true" />
                          <span className="sr-only">Curso importante</span>
                        </span>
                      )}
                      {course && <CourseAnnotation course={course} compact />}
                      {cell.kind === "work" && <WorkAnnotation day={day} slotLabel={slot.label} compact />}
                      {cell.kind === "free" && <FreeAnnotation day={day} slotLabel={slot.label} />}
                      {!course && cell.kind === "work" && <span className="min-w-0 truncate">{workNote || cell.label}</span>}
                      {!course && cell.kind !== "free" && cell.kind !== "work" && cell.label}
                      {cell.kind === "free" && <span className="min-w-0 truncate">{freeNote || cell.label}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarLegend() {
  const legend = [
    ["bg-class", "Clases"], ["bg-work", "Trabajo"], ["bg-free", "Libre"], ["bg-conflict", "Conflicto"],
  ];
  return <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{legend.map(([color, label]) => <span key={label} className="inline-flex items-center gap-2"><i className={`size-2.5 rounded-full ${color}`} /><span>{label}</span></span>)}<span className="inline-flex items-center gap-2"><Star className="size-3.5 fill-amber-400 text-amber-700" /> Curso importante</span><span className="basis-full text-[11px]">Abre el icono de nota para ver o editar anotaciones.</span></div>;
}

function downloadSchedule(courses: Course[]) {
  const rows = [
    ["Curso", "Sección", "Día", "Inicio", "Fin", "Profesor/a", "Nota"],
    ...courses.flatMap((course) => course.days.map((day) => [
      course.name,
      course.section,
      day,
      course.startTime,
      course.endTime,
      course.instructor ?? "",
      course.note ?? "",
    ])),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "horario-cuadra.csv";
  link.click();
  URL.revokeObjectURL(url);
}

type ProposalFacts = ReturnType<typeof evaluateSchedule> & { lateClassCount: number };
type ProposalOption = {
  proposal: ReturnType<typeof generateProposals>[number];
};

function getProposalFacts(courses: Course[], availability: Availability, preferences: Preferences): ProposalFacts {
  const facts = evaluateSchedule(courses, availability, preferences);
  return {
    ...facts,
    lateClassCount: courses.reduce(
      (count, course) => count + (toMinutes(course.endTime) > 21 * 60 ? course.days.length : 0),
      0,
    ),
  };
}

function ProposalComparison({
  proposals,
  availability,
  preferences,
}: {
  proposals: ProposalOption[];
  availability: Availability;
  preferences: Preferences;
}) {
  const options = proposals.map((item) => ({
    ...item,
    facts: getProposalFacts(item.proposal.courses, availability, preferences),
  }));
  return (
    <section
      id="proposal-comparison"
      aria-labelledby="proposal-comparison-title"
      className="grid gap-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 id="proposal-comparison-title" className="font-semibold text-foreground">Comparación real de tus propuestas</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Compara los cursos, horarios, preferencias y conflictos de cada opción usando tus datos guardados.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <caption className="sr-only">Comparación de cursos y conflictos por propuesta usando los datos guardados.</caption>
          <thead>
            <tr className="bg-muted/60">
              <th scope="col" className="w-48 px-3 py-3 font-semibold text-muted-foreground">Dato comparado</th>
              {options.map((item, index) => (
                <th scope="col" key={index} className="min-w-52 px-3 py-3 font-semibold text-foreground">
                  Opción {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Cursos y horarios</th>
              {options.map((item, index) => (
                <td key={index} className="px-3 py-3 align-top">
                  <ul className="grid gap-2">
                    {item.proposal.courses.map((course) => (
                      <li key={course.id}>
                        <span className="font-medium text-foreground">{course.name}</span>
                        {course.demo && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Ejemplo</span>}
                        <span className="block text-muted-foreground">{course.days.join(" · ")} · {formatTime(course.startTime)}–{formatTime(course.endTime)}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
            <tr className="border-t border-border bg-muted/20">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Ajuste a tus preferencias</th>
              {options.map((item, index) => <td key={index} className="px-3 py-3 font-semibold text-foreground">{item.proposal.score}%</td>)}
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Compatibilidad con tus preferencias</th>
              {options.map((item, index) => <td key={index} className="px-3 py-3 text-foreground">{item.facts.score}%</td>)}
            </tr>
            <tr className="border-t border-border bg-muted/20">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Compatibilidad con tu jornada</th>
              {options.map((item, index) => (
                <td key={index} className={item.facts.conflicts.length ? "px-3 py-3 text-conflict" : "px-3 py-3 text-success"}>
                  {item.facts.conflicts.length
                    ? `${item.facts.conflicts.length} conflicto${item.facts.conflicts.length === 1 ? "" : "s"}`
                    : "Compatible"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Cruces entre cursos</th>
              {options.map((item, index) => (
                <td key={index} className={item.facts.overlaps.length ? "px-3 py-3 text-conflict" : "px-3 py-3 text-success"}>
                  {item.facts.overlaps.length
                    ? `${item.facts.overlaps.length} cruce${item.facts.overlaps.length === 1 ? "" : "s"}`
                    : "Sin cruces"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border bg-muted/20">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Clases que terminan después de las 9 p. m.</th>
              {options.map((item, index) => <td key={index} className="px-3 py-3 text-foreground">{item.facts.lateClassCount} {item.facts.lateClassCount === 1 ? "clase" : "clases"}</td>)}
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-3 font-semibold text-foreground">Clases en tus días libres</th>
              {options.map((item, index) => <td key={index} className="px-3 py-3 text-foreground">{item.facts.freeDayClasses.length} {item.facts.freeDayClasses.length === 1 ? "clase" : "clases"}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProposalCard({
  index,
  proposal,
  active,
  onChoose,
}: {
  index: number;
  proposal: ReturnType<typeof generateProposals>[number];
  active: boolean;
  onChoose: () => void;
}) {
  const conflictCount = proposal.conflicts.length;
  return (
    <article className={`grid gap-3 rounded-2xl border p-5 shadow-sm transition-all ${active ? "border-primary bg-class-soft/70 shadow-md ring-1 ring-primary" : "border-border/80 bg-card hover:-translate-y-0.5 hover:shadow-md"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">Opción {index + 1}</p>
          <h3 className="mt-1 font-semibold text-foreground">{proposal.courses.length} cursos · {proposal.score}% de ajuste</h3>
        </div>
        {active && <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Seleccionada" />}
      </div>
      <ul className="grid gap-1.5 text-xs text-muted-foreground">
        {proposal.courses.map((course) => <li key={course.id} className="flex items-start gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-class" /> <span className="min-w-0">{course.name} <span className="text-muted-foreground/80">· {course.days.join(" / ")} · {formatTime(course.startTime)}–{formatTime(course.endTime)}</span></span></li>)}
      </ul>
      <p className={`text-xs font-medium ${conflictCount ? "text-conflict" : "text-success"}`}>
        {conflictCount
          ? `${conflictCount} conflicto${conflictCount === 1 ? "" : "s"} con tu jornada, traslado o descanso.`
          : "Horario viable: compatible con tu jornada y sin cruces entre cursos."}
      </p>
      <Button variant={active ? "default" : "outline"} onClick={onChoose} className="w-full">
        {active ? <><Check /> Seleccionada</> : "Elegir esta opción"}
      </Button>
    </article>
  );
}

function ProposalsStep() {
  const { state, update } = useCuadra();
  const [compare, setCompare] = useState(false);
  const proposals = useMemo<ProposalOption[]>(() => {
    return generateProposals(state.courses, state.availability, state.preferences, 3)
      .map((proposal) => ({ proposal }));
  }, [state.courses, state.availability, state.preferences]);
  const hasWorkConflicts = proposals.some((item) => item.proposal.conflicts.length > 0);
  const hasCourseShortage = proposals.some((item) => item.proposal.courses.length < state.preferences.courseCount);
  const availableUserCourseCount = state.courses.filter((course) => !course.demo).length;
  const active = proposals[state.proposalIndex] ?? proposals[0];
  const selectedCourses = active?.proposal.courses ?? [];
  const selectSchedule = () => {
    update({ view: "schedule", selectedCourseIds: selectedCourses.map((course) => course.id), proposalIndex: active ? Math.max(0, proposals.indexOf(active)) : 0, saved: true });
  };
  return (
    <PageFrame view="proposals" eyebrow="Paso 4 de 4" title="Tus propuestas de horario" description="Opciones calculadas con tu jornada, cursos y preferencias guardados.">
      {proposals.length === 0 ? (
        <div className="grid gap-4 rounded-[1.75rem] border border-border/70 bg-card p-6 text-center shadow-panel">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-work-soft text-foreground"><CalendarDays className="size-6" /></div>
          <h2 className="font-semibold">Aún no encontramos un horario viable</h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">Con tu jornada, cursos y preferencias no encontramos una combinación sin cruces. Ajusta lo que necesites para generar nuevas propuestas.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => update({ view: "availability" })}><ArrowLeft /> Revisar jornada</Button>
            <Button variant="outline" onClick={() => update({ view: "courses" })}><ArrowLeft /> Revisar cursos</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className={`flex flex-col gap-3 rounded-md border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${hasWorkConflicts ? "border-conflict/20 bg-conflict-soft" : "border-success/20 bg-success-soft"}`}>
            <div className="flex items-start gap-3">
              {hasWorkConflicts
                ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-conflict" />
                : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
              <div>
                      <h2 className={`font-semibold ${hasWorkConflicts ? "text-conflict" : "text-success"}`}>
                        {hasWorkConflicts
                          ? "No encontramos opciones sin conflictos; estas son las que mejor se ajustan a tus datos."
                          : "Todas estas opciones son compatibles con tu jornada y no tienen cruces entre cursos."}
                      </h2>
                      <p className="mt-1 text-xs text-foreground/75">
                        {hasWorkConflicts
                          ? "Las opciones no se cruzan entre cursos, pero revisa los conflictos con tu jornada antes de elegir."
                          : "Elige la que mejor se ajuste a tus preferencias."}
                      </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setCompare((value) => !value)}
              aria-expanded={compare}
              aria-controls="proposal-comparison"
              className="shrink-0"
            >
              <CalendarDays />{compare ? "Cerrar comparación" : "Comparar propuestas"}
            </Button>
          </div>
          {hasCourseShortage && availableUserCourseCount > 0 && (
            <p role="status" className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Pediste {state.preferences.courseCount} cursos y agregaste {availableUserCourseCount}. Te mostramos opciones con los cursos que guardaste; agrega {state.preferences.courseCount - availableUserCourseCount} más para completar tu selección.
            </p>
          )}
          {compare && <ProposalComparison proposals={proposals} availability={state.availability} preferences={state.preferences} />}
          <CalendarGrid courses={selectedCourses} />
          <CalendarLegend />
          <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
            {proposals.map((item, index) => (
              <ProposalCard
                key={`${index}-${item.proposal.courses.map((course) => course.id).sort().join("-")}`}
                index={index}
                proposal={item.proposal}
                active={active === proposals[index]}
                onChoose={() => update({ proposalIndex: index })}
              />
            ))}
          </div>
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
            <Button variant="outline" onClick={() => update({ view: "preferences" })}><ArrowLeft /> Ajustar preferencias</Button>
            <Button onClick={selectSchedule} disabled={!active}>Elegir horario <ArrowRight /></Button>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

function ScheduleView() {
  const { state, update } = useCuadra();
  const courses = state.courses.filter((course) => state.selectedCourseIds.includes(course.id));
  const evaluation = evaluateSchedule(courses, state.availability, state.preferences);
  const courseName = (id: string) => state.courses.find((course) => course.id === id)?.name ?? id;
  return (
    <PageFrame view="schedule" eyebrow="Horario guardado" title="Mi horario" description="Tu semana organizada en un solo lugar.">
      <div className="grid gap-5">
        {state.saved && (
          <div className="flex items-center gap-3 rounded-md border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            <CheckCircle2 className="size-5 shrink-0" /> Tu horario ha sido guardado
          </div>
        )}
        {evaluation.conflicts.length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-conflict/20 bg-conflict-soft px-4 py-3 text-sm text-conflict">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <span>Este horario todavía tiene {evaluation.conflicts.length} cruce{evaluation.conflicts.length === 1 ? "" : "s"} con tu jornada, traslado o descanso. Puedes cambiar tu turno para revisar otras opciones.</span>
          </div>
        )}
        {evaluation.overlaps.length > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-conflict/20 bg-conflict-soft px-4 py-3 text-sm text-conflict">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <span>
              Hay cursos que se cruzan entre sí:{" "}
              {evaluation.overlaps.map((item) => `${courseName(item.courseIds[0])} y ${courseName(item.courseIds[1])} (${item.day})`).join("; ")}.
              Puedes volver a las propuestas para elegir otra combinación.
            </span>
          </div>
        )}
        <CalendarGrid courses={courses} />
        <CalendarLegend />
        <WorkDetails />
        <section aria-label="Detalles de cursos" className="grid gap-2">
          <h2 className="text-sm font-semibold">Detalles de tus cursos</h2>
          {courses.map((course) => (
            <article
              key={course.id}
              className={`rounded-md border border-l-4 bg-card p-3 ${course.mandatory ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
              style={{ borderLeftColor: course.color ?? "#4f46e5" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{course.name}</h3>
                {course.mandatory && <span className="rounded-full bg-class-soft px-2 py-0.5 text-[10px] font-semibold text-primary">Importante</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {course.days.join(" · ")} · {formatTime(course.startTime)} – {formatTime(course.endTime)} · Sección {course.section}
                {course.instructor && ` · Profesor/a: ${course.instructor}`}
              </p>
              <CourseNote note={course.note} />
              <div className="mt-3">
                <CourseAnnotation course={course} />
              </div>
            </article>
          ))}
        </section>
        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => update({ view: "proposals" })}><ArrowLeft /> Volver a las propuestas</Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => downloadSchedule(courses)}><Download /> Descargar horario (.CSV)</Button>
            <Button onClick={() => update({ view: "plan-b", returnView: "schedule" })}>Cambió mi turno <ArrowRight /></Button>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

type PlanBOption = { day: WeekDay; title: string; startTime: string; endTime: string; issues: string[] };

function PlanB() {
  const { state, update } = useCuadra();
  const affected =
    state.courses.find((course) => state.selectedCourseIds.includes(course.id) && course.days.includes("Jue")) ??
    state.courses.find((course) => course.id === "base-datos");

  const options = useMemo<PlanBOption[]>(() => {
    if (!affected) return [];
    const others = state.courses.filter((course) => course.id !== affected.id && state.selectedCourseIds.includes(course.id));
    const candidates: { day: WeekDay; title: string; startTime: string; endTime: string }[] = [
      { day: "Vie", title: "Mover a viernes", startTime: affected.startTime, endTime: affected.endTime },
      { day: "Mié", title: "Mover a miércoles", startTime: "18:00", endTime: "20:00" },
    ];
    return candidates
      .filter((option) => !affected.days.includes(option.day))
      .map((option) => {
        const moved: Course = {
          ...affected,
          days: [...new Set<WeekDay>([...affected.days.filter((day) => day !== "Jue"), option.day])],
          startTime: option.startTime,
          endTime: option.endTime,
        };
        const issues: string[] = [];
        for (const overlap of findCourseOverlaps([...others, moved])) {
          if (overlap.day !== option.day || !overlap.courseIds.includes(affected.id)) continue;
          const otherId = overlap.courseIds.find((id) => id !== affected.id);
          const other = others.find((course) => course.id === otherId);
          if (other) issues.push(`Se cruza con ${other.name}`);
        }
        if (state.availability.days.includes(option.day) && hasWorkConflict(moved, state.availability, state.preferences, option.day)) {
          issues.push("Choca con tu trabajo, traslado o descanso");
        }
        return { ...option, issues };
      });
  }, [affected, state.courses, state.selectedCourseIds, state.availability, state.preferences]);

  const [choice, setChoice] = useState<WeekDay | null>(null);
  const selected = options.find((option) => option.day === choice) ?? options.find((option) => option.issues.length === 0) ?? options[0];

  const apply = () => {
    if (!affected || !selected) {
      update({ view: "schedule" });
      return;
    }
    const courses = state.courses.map((course) => course.id !== affected.id ? course : {
      ...course,
      days: [...new Set<WeekDay>([...course.days.filter((day) => day !== "Jue"), selected.day])],
      startTime: selected.startTime,
      endTime: selected.endTime,
    });
    const selectedCourseIds = state.selectedCourseIds.includes(affected.id) ? state.selectedCourseIds : [...state.selectedCourseIds, affected.id];
    update({ courses, selectedCourseIds, view: "schedule", saved: true });
  };

  return (
    <PageFrame view="plan-b" eyebrow="Plan B" title="Un cambio en tu turno no detiene tu semana" description="Revisa las alternativas para la clase que coincide con el cambio.">
      <div className="grid gap-5 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-panel sm:p-7">
        {!affected || options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No encontramos una clase afectada con alternativas disponibles. Revisa tus cursos o vuelve a tu horario.</p>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-md border border-conflict/20 bg-conflict-soft p-4 text-conflict">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div><h2 className="font-semibold">Tu turno del jueves cambió.</h2><p className="mt-1 text-sm">Estas son tus opciones:</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Clase afectada</p>
              <h2 className="mt-1 font-semibold">{affected.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Jue · {formatTime(affected.startTime)} – {formatTime(affected.endTime)}</p>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">Elige una alternativa</legend>
              {options.map((option) => (
                <label key={option.day} className={`grid cursor-pointer grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-md border p-4 ${selected?.day === option.day ? "border-primary bg-class-soft" : "border-border bg-background"}`}>
                  <input type="radio" name="plan-b" value={option.day} checked={selected?.day === option.day} onChange={() => setChoice(option.day)} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">({formatTime(option.startTime)} – {formatTime(option.endTime)})</span>
                    {option.issues.length === 0 ? (
                      <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> Sin cruces</span>
                    ) : (
                      option.issues.map((issue) => (
                        <span key={issue} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-conflict"><TriangleAlert className="size-3.5" /> {issue}</span>
                      ))
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}
        <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <Button variant="outline" onClick={() => update({ view: "schedule" })}><ArrowLeft /> Volver a mi horario</Button>
          {affected && options.length > 0 && <Button onClick={apply}>Elegir opción <ArrowRight /></Button>}
        </div>
      </div>
    </PageFrame>
  );
}

function FeedbackPage() {
  const { state, update } = useCuadra();
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const back = state.returnView === "feedback" ? "welcome" : state.returnView;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const entry: FeedbackEntry = {
      id: `comentario-${crypto.randomUUID()}`,
      message: text,
      createdAt: new Date().toISOString(),
    };
    update({ feedback: [entry, ...state.feedback] });
    setMessage("");
    setSubmitted(true);
  };
  return (
    <PageFrame view="feedback" eyebrow="Tu opinión" title="Comentarios de la aplicación" description="Cuéntanos qué funciona y qué podríamos mejorar. Tus comentarios se guardan en este dispositivo.">
      <div className="grid gap-6">
        <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-panel sm:p-7">
          <Field label="Tu comentario">
            <Textarea required maxLength={1000} rows={5} value={message} onChange={(event) => { setMessage(event.target.value); setSubmitted(false); }} placeholder="Escribe aquí tu sugerencia o experiencia..." />
          </Field>
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-4 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => update({ view: back })}><ArrowLeft /> Volver</Button>
            <Button type="submit"><MessageSquareText /> Guardar comentario</Button>
          </div>
          {submitted && <p role="status" className="text-sm font-medium text-success">Comentario guardado en este dispositivo.</p>}
        </form>
        {state.feedback.length > 0 && (
          <section aria-label="Comentarios guardados" className="grid gap-3">
            <h2 className="font-semibold">Comentarios guardados</h2>
            {state.feedback.map((entry) => (
              <article key={entry.id} className="rounded-md border border-border bg-card p-4">
                <p className="whitespace-pre-wrap text-sm leading-6">{entry.message}</p>
                <time className="mt-2 block text-xs text-muted-foreground" dateTime={entry.createdAt}>
                  {new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
                </time>
              </article>
            ))}
          </section>
        )}
      </div>
    </PageFrame>
  );
}

function HelpPage() {
  const { state, update } = useCuadra();
  const back = state.returnView === "help" ? (state.registered ? "schedule" : "welcome") : state.returnView;
  return (
    <main className="mx-auto min-h-[calc(100svh-64px)] max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-7 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-class-soft text-primary"><Headphones className="size-6" /></span>
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Centro de ayuda</p><h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">¿Necesitas ayuda?</h1><p className="mt-2 text-sm text-muted-foreground">Encuentra respuestas a tus dudas.</p></div>
      </div>
      <Accordion type="single" collapsible className="border-t border-border">
        <AccordionItem value="generar"><AccordionTrigger>¿Cómo generar mi horario?</AccordionTrigger><AccordionContent>Pulsa “Empezar a organizar mi horario” en el inicio. Indica tus días y horas de trabajo, agrega tus cursos y elige tus preferencias. No necesitas crear una cuenta; Cuadra guarda tu horario en este dispositivo.</AccordionContent></AccordionItem>
        <AccordionItem value="rotativo"><AccordionTrigger>¿Cómo funciona un horario rotativo?</AccordionTrigger><AccordionContent>Registra por separado tus turnos de semana A y semana B. Cuadra considera ambas semanas para señalar posibles cruces con tus clases.</AccordionContent></AccordionItem>
        <AccordionItem value="turno"><AccordionTrigger>¿Qué pasa si mi turno cambia?</AccordionTrigger><AccordionContent>Desde “Mi horario”, selecciona “Cambió mi turno” para revisar alternativas y elegir una nueva opción para la clase afectada.</AccordionContent></AccordionItem>
        <AccordionItem value="modificar"><AccordionTrigger>¿Puedo modificar mi horario?</AccordionTrigger><AccordionContent>Sí. Puedes regresar a tus propuestas, cambiar tus preferencias o actualizar los cursos y generar nuevas opciones.</AccordionContent></AccordionItem>
        <AccordionItem value="cuenta"><AccordionTrigger>¿Puedo cambiar mi contraseña?</AccordionTrigger><AccordionContent>En el prototipo puedes simular el cambio durante esta sesión. No uses una contraseña real: no hay autenticación conectada y el cambio no protege una cuenta real.</AccordionContent></AccordionItem>
      </Accordion>
      <div className="mt-7 rounded-md bg-class-soft p-5 sm:p-6">
        <div className="flex items-center gap-3"><Headphones className="size-5 text-primary" /><h2 className="font-semibold text-foreground">¿Aún tienes dudas?</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Estamos aquí para ayudarte con tu horario.</p>
        <Button variant="outline" className="mt-4 bg-background" asChild><a href="mailto:ayuda@cuadra.app"><Headphones /> Hablar con una persona</a></Button>
      </div>
      <Button variant="ghost" className="mt-6" onClick={() => update({ view: back })}><ArrowLeft /> Volver</Button>
    </main>
  );
}

export default function CuadraApp() {
  const { state } = useCuadra();
  return (
    <div className="cuadra-app min-h-screen bg-background text-foreground">
      <TopBar />
      {state.view === "welcome" && <Welcome />}
      {state.view === "availability" && <AvailabilityStep />}
      {state.view === "courses" && <CoursesStep />}
      {state.view === "preferences" && <PreferencesStep />}
      {state.view === "proposals" && <ProposalsStep />}
      {state.view === "schedule" && <ScheduleView />}
      {state.view === "plan-b" && <PlanB />}
      {state.view === "feedback" && <FeedbackPage />}
      {state.view === "help" && <HelpPage />}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:px-8">
          <span className="inline-flex items-center gap-2"><GraduationCap className="size-4 text-primary" /> CUADRA</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Tu horario se guarda en este dispositivo</span>
        </div>
      </footer>
    </div>
  );
}