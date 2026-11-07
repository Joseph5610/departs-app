import { useState, useRef, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Activity, Bug, Lightbulb, MessageSquare, Loader2, Send } from 'lucide-react';
import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';

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
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleSection } from '@/components/Modals/SettingsModal/SettingsControls';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

import { useUiStore } from '@/state/uiStore';
import { feedbackPayloadSchema, type FeedbackPayload } from '@/types';
import { getDiagnosticSnapshot } from '@/hooks/features/useDiagnosticData';
import { FEEDBACK_LIMITS, TURNSTILE_SITE_KEY } from '@/config/constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PrivacyNote } from './PrivacyNote';

const baseFormSchema = feedbackPayloadSchema.omit({ diagnostics: true, turnstileToken: true });
type FormValues = z.infer<typeof baseFormSchema>;

const FIELD_LABEL = 'type-label text-muted-foreground px-0.5';

export const FeedbackModal = memo(() => {
    const { t } = useTranslation();
    const isOpen = useUiStore(s => s.isFeedbackOpen);
    const { setIsFeedbackOpen } = useUiStore(s => s.actions);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileInstance>(null);

    const formSchema = useMemo(() => baseFormSchema.extend({
        message: z.string()
            .min(FEEDBACK_LIMITS.MESSAGE_MIN_CHARS, t('feedback.validation.messageTooShort', { count: FEEDBACK_LIMITS.MESSAGE_MIN_CHARS }))
            .max(FEEDBACK_LIMITS.MESSAGE_MAX_CHARS, t('feedback.validation.messageTooLong', { count: FEEDBACK_LIMITS.MESSAGE_MAX_CHARS })),
        email: z.string().email(t('feedback.validation.invalidEmail')).optional().or(z.literal('')),
    }), [t]);

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

    const diagnosticSnapshot = useMemo(() => {
        return isOpen ? getDiagnosticSnapshot() : undefined;
    }, [isOpen]);

    const submitMutation = useMutation({
        mutationFn: (payload: FeedbackPayload) =>
            apiFetch<{ success: boolean }>('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }),
        onSuccess: () => {
            toast.success(t('feedback.success'));
            form.reset();
            setTurnstileToken(null);
            if (turnstileRef.current) {
                turnstileRef.current.reset();
            }
            setIsFeedbackOpen(false);
        },
        onError: () => {
            toast.error(t('feedback.error'));
            if (turnstileRef.current) {
                turnstileRef.current.reset();
            }
            setTurnstileToken(null);
        }
    });

    const onSubmit = (data: FormValues) => {
        if (!turnstileToken) {
            toast.error(t('feedback.errorTurnstile'));
            return;
        }

        const payload: FeedbackPayload = {
            ...data,
            turnstileToken,
            diagnostics: data.includeDiagnostics ? diagnosticSnapshot : undefined,
        };

        submitMutation.mutate(payload);
    };

    const onClose = useCallback(() => {
        setIsFeedbackOpen(false);
    }, [setIsFeedbackOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent phoneLayout="page" className="max-w-xl" data-testid="feedback-modal-content">
                <DialogHeader className="px-(--panel-gutter) pt-6 pb-2 shrink-0">
                    <DialogTitle>{t('feedback.title')}</DialogTitle>
                    <DialogDescription className="type-meta text-muted-foreground">
                        {t('feedback.description')}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 px-(--panel-gutter)">
                    <form id="feedback-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 pt-2 pb-4">
                        
                        <Controller
                            control={form.control}
                            name="type"
                            render={({ field, fieldState }) => (
                                <Field className="gap-2">
                                    <FieldLabel className={FIELD_LABEL}>
                                        {t('feedback.type')}
                                    </FieldLabel>
                                    <SegmentedControl
                                        fill
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { value: 'bug', label: <><Bug size={15} strokeWidth={1.75} />{t('feedback.typeBug')}</> },
                                            { value: 'feature_request', label: <><Lightbulb size={15} strokeWidth={1.75} />{t('feedback.typeFeature')}</> },
                                            { value: 'other', label: <><MessageSquare size={15} strokeWidth={1.75} />{t('feedback.typeOther')}</> },
                                        ]}
                                    />
                                    <FieldError className="type-meta" errors={[fieldState.error]} />
                                </Field>
                            )}
                        />

                        <Controller
                            control={form.control}
                            name="message"
                            render={({ field, fieldState }) => (
                                <Field className="gap-2">
                                    <FieldLabel htmlFor="feedback-message" className={FIELD_LABEL}>
                                        {t('feedback.message')} *
                                    </FieldLabel>
                                    <Textarea
                                        id="feedback-message"
                                        aria-invalid={fieldState.invalid}
                                        placeholder={t('feedback.messagePlaceholder')}
                                        className="min-h-28 resize-none"
                                        {...field}
                                    />
                                    <FieldError className="type-meta" errors={[fieldState.error]} />
                                </Field>
                            )}
                        />

                        <Controller
                            control={form.control}
                            name="email"
                            render={({ field, fieldState }) => (
                                <Field className="gap-2">
                                    <FieldLabel htmlFor="feedback-email" className={FIELD_LABEL}>
                                        {t('feedback.email')}
                                    </FieldLabel>
                                    <Input
                                        id="feedback-email"
                                        aria-invalid={fieldState.invalid}
                                        type="email"
                                        placeholder={t('feedback.emailPlaceholder')}
                                        {...field} 
                                        value={field.value || ''}
                                    />
                                    <FieldError className="type-meta" errors={[fieldState.error]} />
                                </Field>
                            )}
                        />

                        <Controller
                            control={form.control}
                            name="includeDiagnostics"
                            render={({ field }) => (
                                <Field className="gap-0">
                                    <Card size="none">
                                        <ToggleSection
                                            title={t('feedback.diagnostics')}
                                            description={t('feedback.diagnosticsDesc')}
                                            icon={Activity}
                                            isChecked={field.value}
                                            onToggle={field.onChange}
                                        >
                                            {diagnosticSnapshot && (
                                                <div className="p-3.5">
                                                    <pre className="max-h-48 overflow-auto rounded-nested bg-fill p-3 font-mono type-meta text-muted-foreground">
                                                        {JSON.stringify(diagnosticSnapshot, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </ToggleSection>
                                    </Card>
                                </Field>
                            )}
                        />

                        {TURNSTILE_SITE_KEY ? (
                            <div className="flex justify-center mt-1">
                                <Turnstile
                                    ref={turnstileRef}
                                    siteKey={TURNSTILE_SITE_KEY}
                                    onSuccess={(token) => setTurnstileToken(token)}
                                    onExpire={() => setTurnstileToken(null)}
                                    onError={() => setTurnstileToken(null)}
                                    options={{
                                        theme: 'auto'
                                    }}
                                />
                            </div>
                        ) : (
                            <Alert variant="warning">
                                <AlertDescription className="type-note">{t('feedback.unavailable')}</AlertDescription>
                            </Alert>
                        )}

                        <PrivacyNote />
                    </form>
                </ScrollArea>
                
                <div className="flex shrink-0 px-(--panel-gutter) pt-2 pb-4">
                    <Button
                        type="submit"
                        form="feedback-form"
                        size="lg"
                        disabled={!form.formState.isValid || !turnstileToken || submitMutation.isPending}
                        className="w-full"
                    >
                        {submitMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Send className="size-4" />
                        )}
                        {t('feedback.submit')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
});

FeedbackModal.displayName = 'FeedbackModal';
