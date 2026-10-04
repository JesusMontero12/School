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
