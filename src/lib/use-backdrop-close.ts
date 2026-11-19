import { useRef } from 'react';

/**
 * Closing a modal <dialog> from its backdrop: spread the result on the dialog.
 *
 * A tap on the backdrop, or on the dialog's own see-through padding, lands on
 * the dialog element itself. A click alone isn't enough to go on, though: a
 * drag that starts in a text box and ends outside the card also clicks the
 * dialog, and that closed the note with a half-written draft in it. So the
 * press has to start outside the card as well as end there.
 */
export function useBackdropClose(close: () => void) {
  const pressedOutside = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDialogElement>) => {
      pressedOutside.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      const outside = pressedOutside.current && e.target === e.currentTarget;
      pressedOutside.current = false;
      if (outside) close();
    },
  };
}
