import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Bug, Lightbulb, MessageSquare, Loader2, Send } from 'lucide-react';
import { z } from 'zod';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { cn } from '@/lib/utils';

import { usePreferencesStore } from '../../../state/preferencesStore';
import { feedbackPayloadSchema, type FeedbackPayload } from '../../../types/feedback';
import { getDiagnosticSnapshot } from '../../../hooks/features/useDiagnosticData';

const formSchema = feedbackPayloadSchema.omit({ diagnostics: true, turnstileToken: true });
type FormValues = z.infer<typeof formSchema>;

export const FeedbackModal: React.FC = () => {
    const { t } = useTranslation();
    const isOpen = usePreferencesStore(s => s.isFeedbackOpen);
    const { setIsFeedbackOpen } = usePreferencesStore(s => s.actions);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileInstance>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            type: 'other',
            message: '',
            email: '',
            includeDiagnostics: true,
        },
        mode: 'onChange'
    });

    const includeDiagnostics = useWatch({ control: form.control, name: 'includeDiagnostics' });
    
    // Calculate the snapshot only when the modal opens (derived state)
    // This avoids useEffect cascading renders and keeps the component pure
    const diagnosticSnapshot = React.useMemo(() => {
        return isOpen ? getDiagnosticSnapshot() : undefined;
    }, [isOpen]);

    const submitMutation = useMutation({
        mutationFn: async (payload: FeedbackPayload) => {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to submit feedback');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success(t('feedback.success'));
            form.reset();
            setTurnstileToken(null);
            if (turnstileRef.current) {
                turnstileRef.current.reset();
            }
            setIsFeedbackOpen(false);
        },
        onError: (error: Error) => {
            toast.error(error.message);
            if (turnstileRef.current) {
                turnstileRef.current.reset();
            }
            setTurnstileToken(null);
        }
    });

    const onSubmit = (data: FormValues) => {
        if (!turnstileToken) {
            toast.error(t('feedback.errorTurnstile', 'Please verify you are human.'));
            return;
        }

        const payload: FeedbackPayload = {
            ...data,
            turnstileToken,
            diagnostics: data.includeDiagnostics ? diagnosticSnapshot : undefined,
        };

        submitMutation.mutate(payload);
    };

    const onClose = React.useCallback(() => {
        setIsFeedbackOpen(false);
    }, [setIsFeedbackOpen]);

    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent variant="default" className="sm:max-w-[425px]" data-testid="feedback-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>{t('feedback.title')}</DialogTitle>
                    <DialogDescription>
                        {t('feedback.description')}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 px-6">
                    <Form {...form}>
                        <form id="feedback-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 py-2 pb-8">
                            
                            {/* Type Selection */}
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('feedback.type')}</FormLabel>
                                        <FormControl>
                                            <ToggleGroup
                                                value={[field.value]}
                                                onValueChange={(val: string[]) => {
                                                    if (val && val.length > 0) field.onChange(val[0]);
                                                }}
                                                className="grid grid-cols-3 w-full gap-2 bg-transparent p-0"
                                            >
                                                <ToggleGroupItem value="bug" variant="outline" className={cn(
                                                    "h-auto py-3 rounded-xl flex-col gap-2 border-white/5",
                                                    "data-[state=on]:ring-1 data-[state=on]:ring-primary/40 data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
                                                )}>
                                                    <Bug className="h-5 w-5" />
                                                    <span className="text-xs">{t('feedback.typeBug')}</span>
                                                </ToggleGroupItem>
                                                <ToggleGroupItem value="feature_request" variant="outline" className={cn(
                                                    "h-auto py-3 rounded-xl flex-col gap-2 border-white/5",
                                                    "data-[state=on]:ring-1 data-[state=on]:ring-primary/40 data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
                                                )}>
                                                    <Lightbulb className="h-5 w-5" />
                                                    <span className="text-xs">{t('feedback.typeFeature')}</span>
                                                </ToggleGroupItem>
                                                <ToggleGroupItem value="other" variant="outline" className={cn(
                                                    "h-auto py-3 rounded-xl flex-col gap-2 border-white/5",
                                                    "data-[state=on]:ring-1 data-[state=on]:ring-primary/40 data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
                                                )}>
                                                    <MessageSquare className="h-5 w-5" />
                                                    <span className="text-xs">{t('feedback.typeOther')}</span>
                                                </ToggleGroupItem>
                                            </ToggleGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Message */}
                            <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('feedback.message')} *</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder={t('feedback.messagePlaceholder')}
                                                className="min-h-[120px] resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Email */}
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('feedback.email')}</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="email" 
                                                placeholder={t('feedback.emailPlaceholder')} 
                                                {...field} 
                                                value={field.value || ''}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Diagnostics Switch */}
                            <FormField
                                control={form.control}
                                name="includeDiagnostics"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col rounded-lg border border-white/5 bg-muted/20 overflow-hidden space-y-0">
                                        <div className="flex items-center justify-between p-4">
                                            <div className="space-y-0.5 pr-4">
                                                <FormLabel className="text-base">{t('feedback.diagnostics')}</FormLabel>
                                                <FormDescription>
                                                    {t('feedback.diagnosticsDesc')}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange} 
                                                />
                                            </FormControl>
                                        </div>

                                        {includeDiagnostics && diagnosticSnapshot && (
                                            <div className="px-4 pb-4 pt-2">
                                                <div className="bg-black/50 rounded-md p-3 overflow-x-auto border border-white/5">
                                                    <pre className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                                                        {JSON.stringify(diagnosticSnapshot, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </FormItem>
                                )}
                            />

                            {/* Turnstile */}
                            <div className="flex justify-center mt-2">
                                <Turnstile 
                                    ref={turnstileRef}
                                    siteKey={siteKey}
                                    onSuccess={(token) => setTurnstileToken(token)}
                                    onExpire={() => setTurnstileToken(null)}
                                    onError={() => setTurnstileToken(null)}
                                    options={{
                                        theme: 'auto'
                                    }}
                                />
                            </div>

                        </form>
                    </Form>
                </ScrollArea>
                
                <div className="px-6 pb-6 pt-2 shrink-0 border-t border-white/5 flex gap-3">
                    <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                        {t('common.cancel')}
                    </Button>
                    <Button 
                        type="submit" 
                        form="feedback-form" 
                        disabled={!form.formState.isValid || !turnstileToken || submitMutation.isPending} 
                        className="flex-1"
                    >
                        {submitMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {t('feedback.submit')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
