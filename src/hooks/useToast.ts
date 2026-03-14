import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'info';

/**
 * useToast
 *
 * Re-implemented with Sonner for a more premium look and feel.
 */
export const useToast = () => {
    const showToast = (message: string, type: ToastType = 'info') => {
        switch (type) {
            case 'success':
                toast.success(message);
                break;
            case 'error':
                toast.error(message);
                break;
            case 'info':
            default:
                toast.info(message);
                break;
        }
    };

    return { showToast };
};
