import { writable } from "svelte/store";

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
};

type PendingConfirm = ConfirmRequest & { resolve: (ok: boolean) => void };

export const confirmRequest = writable<PendingConfirm | null>(null);

/** Resolves to the user's answer once `ConfirmDialog` is dismissed. */
export function confirm(request: ConfirmRequest) {
  return new Promise<boolean>((resolve) => {
    confirmRequest.set({ ...request, resolve });
  });
}

export function settleConfirm(answer: boolean) {
  confirmRequest.update((pending) => {
    pending?.resolve(answer);
    return null;
  });
}
