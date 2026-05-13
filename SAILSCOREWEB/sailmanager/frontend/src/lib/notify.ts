/**
 * Centralised UI notifications for SailScore.
 *
 * Use this helper instead of window.alert / console.* for user-facing messages.
 * Behind the scenes uses `sonner` (lightweight toast library).
 *
 * Examples:
 *   notify.success('Saved');
 *   notify.error('Could not save changes');
 *   notify.info('Email queued for delivery');
 *   notify.warning('Some fields are missing');
 *   notify.promise(saveAsync(), {
 *     loading: 'Saving…',
 *     success: 'Saved!',
 *     error: (err) => `Could not save: ${err.message ?? err}`,
 *   });
 */
import { toast } from 'sonner';

type NotifyMessage = string | { title: string; description?: string };

function unpack(msg: NotifyMessage): { title: string; description?: string } {
  if (typeof msg === 'string') return { title: msg };
  return msg;
}

export const notify = {
  success(msg: NotifyMessage) {
    const { title, description } = unpack(msg);
    return toast.success(title, { description });
  },
  error(msg: NotifyMessage) {
    const { title, description } = unpack(msg);
    return toast.error(title, { description });
  },
  info(msg: NotifyMessage) {
    const { title, description } = unpack(msg);
    return toast(title, { description });
  },
  warning(msg: NotifyMessage) {
    const { title, description } = unpack(msg);
    return toast.warning(title, { description });
  },
  loading(msg: NotifyMessage) {
    const { title, description } = unpack(msg);
    return toast.loading(title, { description });
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
  /**
   * Wrap a promise and show loading / success / error states automatically.
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) {
    return toast.promise(promise, messages);
  },
};

export default notify;
