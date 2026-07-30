/**
 * Presenter for Otto's parking-review verdict shown to the proposer.
 * OpenSpec: changes/otto-parking-verification · spec otto-parking-verification.
 * Maps ai_review_status -> the message the user sees after proposing.
 */
import type { AiReviewStatus } from './api';

export interface OttoVerdictView {
  icon: string;
  title: string;
  message: string;
  showOctanos: boolean;
}

/**
 * Pure mapping from Otto's verdict to the confirmation-screen copy.
 * Exported for deterministic testing.
 */
export function ottoVerdictView(
  status: AiReviewStatus,
  octanos: number,
): OttoVerdictView {
  switch (status) {
    case 'approved':
      return {
        icon: '⭐',
        title: '¡Parking aprobado!',
        message:
          `Tu parking ha quedado aprobado y visible. Recibes ${octanos} Octanos que estarán ` +
          'pendientes hasta que un motero real verifique el parking.',
        showOctanos: true,
      };
    case 'flagged':
      return {
        icon: '⏳',
        title: 'Aportación en revisión',
        message:
          'La aportación ha quedado como dudosa; nuestro agente Otto no pudo confirmarla. ' +
          'Un administrador la comprobará y en unas horas estará disponible.',
        showOctanos: false,
      };
    case 'rejected':
      return {
        icon: '🚫',
        title: 'No ha pasado la verificación',
        message:
          'Tu parking no ha pasado la verificación: no parece que realmente sea un ' +
          'aparcamiento de motos. Si crees que es un error, vuelve a aportarlo con una foto clara.',
        showOctanos: false,
      };
  }
}
