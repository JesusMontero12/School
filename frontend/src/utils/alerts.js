import Swal from 'sweetalert2';

const base = Swal.mixin({ buttonsStyling: false, reverseButtons: true, focusCancel: true });
const toast = Swal.mixin({
  toast: true, position: 'bottom-end', showConfirmButton: false, timer: 3200, timerProgressBar: true,
  customClass: { popup: 'swal-ink' },
});

export const notify = {
  success: (title) => toast.fire({ icon: 'success', title }),
  error: (title) => toast.fire({ icon: 'error', title, timer: 5000 }),
};

/** Devuelve true si la persona confirma. `confirmText` debe nombrar la acción ("Eliminar usuario"). */
export async function confirmAction({ title, text, confirmText, danger = false }) {
  const { isConfirmed } = await base.fire({
    title, text, icon: danger ? 'warning' : 'question', showCancelButton: true,
    confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
    customClass: { popup: 'swal-ink', confirmButton: danger ? 'btn-danger-soft' : 'btn-ink', cancelButton: 'btn-quiet' },
  });
  return isConfirmed;
}

/** Pide un texto (p. ej. el motivo de una corrección). Devuelve el texto, o null si se cancela. */
export async function promptText({ title, text, label, confirmText, minLength = 5 }) {
  const { isConfirmed, value } = await base.fire({
    title, text, input: 'text', inputLabel: label, inputAttributes: { maxlength: 300 }, showCancelButton: true,
    confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
    customClass: { popup: 'swal-ink', confirmButton: 'btn-ink', cancelButton: 'btn-quiet' },
    inputValidator: (v) => (v && v.trim().length >= minLength ? null : `Escribe al menos ${minLength} caracteres`),
  });
  return isConfirmed ? value.trim() : null;
}
