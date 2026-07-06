import { useMemo } from 'react';
import { formatDateStr } from '../../utils/appointmentFormatters';
import CalendarDayCard from '../CalendarDayCard';
import TimeSlotCard from '../TimeSlotCard';

/**
 * Paso de selección de fecha y horario.
 * Muestra calendario con fechas habilitadas y slots de tiempo disponibles.
 */
const StepSchedule = ({
  calendarMonth,
  fechasHabilitadas,
  fechaSeleccionada,
  setFechaSeleccionada,
  slotsDisponibles,
  slotSeleccionado,
  setSlotSeleccionado,
  psicologaSeleccionada,
  modalidad,
  localSeleccionado,
  cargarSlotsDelDia,
  cambiarMes
}) => {
  const { año, mes, dias } = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const diasEnMes = new Date(y, m + 1, 0).getDate();
    const primerDia = new Date(y, m, 1).getDay();

    const d = [];
    for (let i = 0; i < primerDia; i++) d.push(null);
    for (let dNum = 1; dNum <= diasEnMes; dNum++) d.push(dNum);

    return { año: y, mes: m, dias: d };
  }, [calendarMonth]);

  const renderDias = () => {
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {diasSemana.map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {dias.map((d, idx) => {
            if (!d) return <div key={`empty-${idx}`} />;

            const dateStr = formatDateStr(año, mes, d);
            const isEnabled = fechasHabilitadas.has(dateStr);
            const isSelected = fechaSeleccionada &&
              fechaSeleccionada.getFullYear() === año &&
              fechaSeleccionada.getMonth() === mes &&
              fechaSeleccionada.getDate() === d;

            return (
              <CalendarDayCard
                key={`day-${d}`}
                day={d}
                isSelected={isSelected}
                isEnabled={isEnabled}
                onClick={() => {
                  const newDate = new Date(año, mes, d);
                  setFechaSeleccionada(newDate);
                  const slots = cargarSlotsDelDia(psicologaSeleccionada.id, dateStr, modalidad, localSeleccionado?.id);
                  setSlotsDisponibles(slots);
                  setSlotSeleccionado(null);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Seleccionar Fecha y Horario</h4>

      {fechasHabilitadas.size === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center gap-2 text-left">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          No hay disponibilidad para esta modalidad con la especialista seleccionada.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Lado del calendario */}
        <div className="h-[430px] max-h-[430px] bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-0 overflow-hidden">
          <div>
            <div className="flex justify-between items-center mb-6">
              <button
                type="button"
                onClick={() => cambiarMes(-1)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="font-bold text-sm text-slate-800 uppercase tracking-wider font-sans">
                {calendarMonth.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => cambiarMes(1)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>

            {renderDias()}
          </div>

          {fechaSeleccionada && (
            <div className="mt-6 pt-4 border-t border-slate-200 text-center">
              <p className="text-xs text-gray-400">Fecha seleccionada</p>
              <p className="font-bold text-sm text-[#003178] mt-1 capitalize font-sans">
                {fechaSeleccionada.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {/* Lado de los slots */}
        <div className="h-[430px] max-h-[430px] flex flex-col min-h-0 w-full">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col min-h-0 h-full">
            <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider shrink-0 font-sans text-left">Horarios Disponibles</h5>
            {!fechaSeleccionada ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                  Selecciona una fecha en el calendario para ver los horarios.
                </p>
              </div>
            ) : slotsDisponibles.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-550 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                  No hay horarios libres para esta fecha.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 min-h-0">
                {slotsDisponibles.map(slot => {
                  const isSelected = slotSeleccionado?.id === slot.id;
                  return (
                    <TimeSlotCard
                      key={slot.id}
                      inicio={slot.inicio}
                      fin={slot.fin}
                      isSelected={isSelected}
                      onClick={() => setSlotSeleccionado(slot)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepSchedule;
