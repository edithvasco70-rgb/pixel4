import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import CuadraApp from "@/components/cuadra/CuadraApp";
import { CuadraProvider, INITIAL_CUADRA_STATE } from "@/lib/cuadra-state";
import type { Course } from "@/lib/cuadra-schedule";

function renderRegistered(
  view: "welcome" | "availability" | "courses" | "preferences" | "proposals" | "schedule" | "feedback" = "availability",
  overrides: Partial<typeof INITIAL_CUADRA_STATE> = {},
) {
  window.localStorage.setItem(
    "cuadra-planner-v1",
    JSON.stringify({ ...INITIAL_CUADRA_STATE, ...overrides, registered: true, view }),
  );
  return render(
    <CuadraProvider>
      <CuadraApp />
    </CuadraProvider>,
  );
}

describe("Navegación a la portada", () => {
  beforeEach(() => window.localStorage.clear());

  it("permite empezar a crear el horario sin pasar por el registro", async () => {
    render(
      <CuadraProvider>
        <CuadraApp />
      </CuadraProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Empezar a organizar mi horario/i }));

    expect(await screen.findByText("¿Cuándo estás trabajando?")).toBeInTheDocument();
  });

  it("el logo lleva a la portada aunque el usuario ya esté registrado", async () => {
    renderRegistered("courses");
    expect(await screen.findByText("¿Cuáles son tus cursos?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /CUADRA, ir al inicio/i }));

    expect(await screen.findByText("Que tu trabajo no frene tus estudios")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar horario/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver mi horario/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cambiar contraseña/i })).toBeInTheDocument();
  });

  it("el botón Inicio también lleva a la portada", async () => {
    renderRegistered();
    fireEvent.click(await screen.findByRole("button", { name: "Inicio" }));
    expect(await screen.findByText("Que tu trabajo no frene tus estudios")).toBeInTheDocument();
  });

  it("simula el cambio de contraseña y valida la confirmación", async () => {
    renderRegistered("welcome");
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar contraseña" }));
    fireEvent.change(await screen.findByLabelText("Nueva contraseña (mínimo 6 caracteres)"), { target: { value: "nueva123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "otra123" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas nuevas no coinciden.");
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "nueva123" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Contraseña de demostración actualizada para esta sesión.");
  });

  it("explica y permite configurar las dos semanas de un turno rotativo", async () => {
    renderRegistered();
    fireEvent.click(await screen.findByRole("button", { name: "Rotativo" }));

    expect(await screen.findByText("Así funciona tu turno rotativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Hora de entrada, semana A")).toBeInTheDocument();
    expect(screen.getByLabelText("Hora de salida, semana B")).toBeInTheDocument();
  });

  it("explica las propuestas y permite seleccionar una", async () => {
    const courses: Course[] = [
      { id: "p", name: "Programación", section: "A1", days: ["Lun"], startTime: "19:30", endTime: "21:00", credits: 3, mandatory: true },
      { id: "b", name: "Base de Datos", section: "B2", days: ["Mar"], startTime: "19:30", endTime: "21:00", credits: 3, mandatory: true },
      { id: "r", name: "Redes", section: "C1", days: ["Vie"], startTime: "19:30", endTime: "21:00", credits: 3, mandatory: true },
    ];
    renderRegistered("availability", { courses });
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: /Ver propuestas/i }));

    expect(await screen.findByRole("heading", { name: "Tus propuestas de horario" })).toBeInTheDocument();
    expect(screen.getByText("Opción 1")).toBeInTheDocument();
    expect(screen.getByText(/Todas estas opciones son compatibles con tu jornada y no tienen cruces entre cursos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Comparar propuestas" }));
    const comparison = screen.getByRole("region", { name: "Comparación real de tus propuestas" });
    expect(within(comparison).getByRole("table")).toBeInTheDocument();
    expect(within(comparison).getByRole("rowheader", { name: "Compatibilidad con tus preferencias" })).toBeInTheDocument();
    expect(within(comparison).getAllByText("Programación").length).toBeGreaterThan(0);

    expect(screen.getAllByRole("button", { name: "Seleccionada" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Elegir horario" })).toBeInTheDocument();
  });

  it("no repite una propuesta cuando solo hay una combinación viable", async () => {
    window.localStorage.setItem(
      "cuadra-planner-v1",
      JSON.stringify({
        ...INITIAL_CUADRA_STATE,
        registered: true,
        view: "proposals",
        courses: [{
          id: "curso",
          name: "Curso",
          section: "A1",
          days: ["Sáb"],
          startTime: "10:00",
          endTime: "12:00",
          credits: 3,
          mandatory: false,
        }],
        preferences: { ...INITIAL_CUADRA_STATE.preferences, courseCount: 1 },
      }),
    );
    render(
      <CuadraProvider>
        <CuadraApp />
      </CuadraProvider>,
    );

    expect(await screen.findByText("Opción 1")).toBeInTheDocument();
    expect(screen.queryByText("Opción 2")).not.toBeInTheDocument();
  });

  it("muestra la mejor propuesta guardada aunque tenga conflictos con la jornada", async () => {
    const course: Course = {
      id: "propio",
      name: "Curso propio",
      section: "A1",
      days: ["Lun"],
      startTime: "18:00",
      endTime: "20:00",
      credits: 3,
      mandatory: true,
    };
    renderRegistered("proposals", {
      courses: [course],
      preferences: { ...INITIAL_CUADRA_STATE.preferences, courseCount: 1 },
    });

    expect(await screen.findByText(/No encontramos opciones sin conflictos/)).toBeInTheDocument();
    expect(screen.getAllByText("Curso propio").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 conflicto con tu jornada, traslado o descanso/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir horario" })).toBeEnabled();
  });

  it("compara los cursos propios guardados en lugar de depender de los cursos de ejemplo", async () => {
    window.localStorage.setItem(
      "cuadra-planner-v1",
      JSON.stringify({
        ...INITIAL_CUADRA_STATE,
        registered: true,
        view: "proposals",
        courses: [{
          id: "curso-propio",
          name: "Álgebra propia",
          section: "A1",
          days: ["Lun"],
          startTime: "19:30",
          endTime: "20:30",
          credits: 3,
          mandatory: false,
        }],
        preferences: { ...INITIAL_CUADRA_STATE.preferences, courseCount: 1 },
      }),
    );
    render(
      <CuadraProvider>
        <CuadraApp />
      </CuadraProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Comparar propuestas" }));
    const comparison = screen.getByRole("region", { name: "Comparación real de tus propuestas" });
    expect(within(comparison).getAllByText("Álgebra propia")).toHaveLength(1);
    expect(within(comparison).queryByText("Programación")).not.toBeInTheDocument();
    expect(within(comparison).getByRole("row", { name: /Compatibilidad con tu jornada/ })).toHaveTextContent("Compatible");
    expect(within(comparison).getByRole("row", { name: /Cruces entre cursos/ })).toHaveTextContent("Sin cruces");
    expect(within(comparison).queryByText(/cruce con trabajo/)).not.toBeInTheDocument();
  });

  it("guarda los comentarios locales desde su apartado", async () => {
    renderRegistered("feedback");
    fireEvent.change(await screen.findByLabelText("Tu comentario"), { target: { value: "Me gusta el horario." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar comentario" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Comentario guardado en este dispositivo.");
    expect(screen.getByText("Me gusta el horario.")).toBeInTheDocument();
  });

  it("permite agregar una anotación flotante a un curso", async () => {
    renderRegistered("courses");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar anotación de Programación" }));
    fireEvent.change(await screen.findByLabelText("Anotación para Programación"), {
      target: { value: "Repasar el ejercicio 4 antes del parcial." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));

    expect(await screen.findByText("Repasar el ejercicio 4 antes del parcial.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar anotación de Redes Informáticas" })).toBeInTheDocument();
  });

  it("permite agregar anotaciones de trabajo desde cada celda del horario", async () => {
    renderRegistered("schedule");
    expect(screen.queryByText("Anotaciones por franja horaria")).not.toBeInTheDocument();
    expect(screen.queryByText("Notas sobre tu trabajo")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", {
      name: "Agregar anotación de trabajo · Lun · 8–10 a. m.",
    }));
    fireEvent.change(await screen.findByLabelText("Anotación para trabajo Lun · 8–10 a. m."), {
      target: { value: "Turno extra del lunes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));

    expect(await screen.findByText("Turno extra del lunes.")).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Agregar anotación de trabajo · Lun · 10–12 m.",
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "Agregar anotación de trabajo · Lun · 10–12 m.",
    }));
    fireEvent.change(await screen.findByLabelText("Anotación para trabajo Lun · 10–12 m."), {
      target: { value: "Reunión del lunes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));

    expect(await screen.findByText("Reunión del lunes.")).toBeInTheDocument();
    expect(screen.getByText("Turno extra del lunes.")).toBeInTheDocument();
  });

  it("guarda anotaciones diferentes en cada bloque de tiempo libre", async () => {
    renderRegistered("schedule");
    fireEvent.click(await screen.findByRole("button", {
      name: "Agregar anotación de tiempo libre · Sáb · 8–10 a. m.",
    }));
    fireEvent.change(await screen.findByLabelText("Anotación para tiempo libre Sáb · 8–10 a. m."), {
      target: { value: "Leer un capítulo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));

    expect(await screen.findByText("Leer un capítulo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "Agregar anotación de tiempo libre · Sáb · 10–12 m.",
    }));
    fireEvent.change(await screen.findByLabelText("Anotación para tiempo libre Sáb · 10–12 m."), {
      target: { value: "Llamar a casa." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));

    expect(await screen.findByText("Llamar a casa.")).toBeInTheDocument();
    expect(screen.getByText("Leer un capítulo.")).toBeInTheDocument();
  });

  it("muestra los detalles del trabajo en una tarjeta separada del calendario", async () => {
    renderRegistered("schedule");

    expect(await screen.findByRole("region", { name: "Detalles del trabajo" })).toBeInTheDocument();
    expect(screen.getByText("Horario fijo")).toBeInTheDocument();
    expect(screen.getByText("Traslado: 30 min")).toBeInTheDocument();
    expect(screen.getAllByTitle("Curso importante").length).toBeGreaterThan(0);
  });

  it("permite marcar como importante un curso nuevo", async () => {
    renderRegistered("courses");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar curso" }));

    fireEvent.change(await screen.findByLabelText("Nombre del curso"), { target: { value: "Diseño de interfaces" } });
    fireEvent.click(screen.getByText("Lun"));
    fireEvent.click(screen.getByLabelText(/Marcar como importante/i));
    fireEvent.click(screen.getAllByRole("button", { name: "Agregar curso" }).at(-1)!);

    const courseHeading = await screen.findByText("Diseño de interfaces");
    expect(courseHeading.closest("article")).toHaveTextContent("Importante");
  });

  it("permite cambiar la importancia de un curso desde su tarjeta", async () => {
    renderRegistered("courses");
    const markImportant = await screen.findByRole("button", {
      name: "Marcar Redes Informáticas como importante",
    });

    fireEvent.click(markImportant);

    expect(await screen.findByRole("button", {
      name: "Desmarcar Redes Informáticas como importante",
    })).toHaveAttribute("aria-pressed", "true");
  });
});
