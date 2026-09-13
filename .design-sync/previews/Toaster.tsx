import { Toaster, toast } from 'departs-ui';
import { useEffect } from 'react';

export const Toasts = () => {
  useEffect(() => {
    toast('Stop shared', { description: 'Link copied to clipboard.' });
    toast.success('Added to favorites');
    toast.error('You can pin at most 10 favorite stops.');
  }, []);
  return <Toaster position="top-center" expand />;
};
