import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Bug, Lightbulb, MessageSquare, Loader2, Send, MessageSquareHeart } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

import { usePreferencesStore } from '../../../state/preferencesStore';
import { feedbackPayloadSchema, type FeedbackPayload } from '../../../types/feedback';
import { getDiagnosticSnapshot } from '../../../hooks/features/useDiagnosticData';

const formSchema = feedbackPayloadSchema.omit({ diagnostics: true, turnstileToken: true });
type FormValues = z.infer<typeof formSchema>;

interface TypeButtonProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const TypeButton: React.FC<TypeButtonProps> = ({ icon: Icon, label, isActive, onClick }) => (
    <Toggle
        pressed={isActive}
        onPressedChange={onClick}
        variant="outline"
        className={cn(
            "h-auto flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl transition-[transform,colors] text-xs font-semibold active:scale-95 group cursor-pointer",
            "border-border/80 hover:bg-foreground/10 hover:text-foreground",
            "data-[state=on]:bg-primary/20! data-[state=on]:text-primary! data-[state=on]:border-primary/50! data-[state=on]:shadow-[0_0_12px_rgba(var(--color-primary),0.15)]",
            "data-[state=off]:bg-transparent data-[state=off]:text-foreground/70"
        )}
    >
        <Icon size={18} className={cn("transition-transform duration-300", isActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
        <span className="text-xs font-bold">
            {label}
        </span>
    </Toggle>
);

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
            <DialogContent variant="default" className="max-w-xl" data-testid="feedback-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <MessageSquareHeart className="size-5 text-primary" />
                        <span>{t('feedback.title')}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {t('feedback.description')}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 px-6">
                    <Form {...form}>
                        <form id="feedback-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 py-2 pb-6">
                            
                            {/* Type Selection */}
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                                            {t('feedback.type')}
                                        </FormLabel>
                                        <FormControl>
                                            <Card variant="subtle" size="none">
                                                <div className="p-3">
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <TypeButton
                                                            icon={Bug}
                                                            label={t('feedback.typeBug')}
                                                            isActive={field.value === 'bug'}
                                                            onClick={() => field.onChange('bug')}
                                                        />
                                                        <TypeButton
                                                            icon={Lightbulb}
                                                            label={t('feedback.typeFeature')}
                                                            isActive={field.value === 'feature_request'}
                                                            onClick={() => field.onChange('feature_request')}
                                                        />
                                                        <TypeButton
                                                            icon={MessageSquare}
                                                            label={t('feedback.typeOther')}
                                                            isActive={field.value === 'other'}
                                                            onClick={() => field.onChange('other')}
                                                        />
                                                    </div>
                                                </div>
                                            </Card>
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
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                                            {t('feedback.message')} *
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder={t('feedback.messagePlaceholder')}
                                                className="min-h-28 resize-none rounded-xl border-border/80 bg-card focus-visible:ring-primary/40 text-sm leading-relaxed"
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
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                                            {t('feedback.email')}
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="email" 
                                                placeholder={t('feedback.emailPlaceholder')} 
                                                className="rounded-xl border-border/80 bg-card focus-visible:ring-primary/40 text-sm h-11"
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
                                    <FormItem className="space-y-0">
                                        <Card variant="subtle" size="none" className="overflow-hidden">
                                            <Item
                                                variant="settings"
                                                size="none"
                                                className="w-full border-0 p-4"
                                            >
                                                <ItemContent>
                                                    <ItemTitle className="text-foreground">{t('feedback.diagnostics')}</ItemTitle>
                                                    <ItemDescription className="text-xs leading-relaxed mt-0.5">{t('feedback.diagnosticsDesc')}</ItemDescription>
                                                </ItemContent>
                                                <ItemActions>
                                                    <FormControl>
                                                        <Switch 
                                                            checked={field.value} 
                                                            onCheckedChange={field.onChange} 
                                                        />
                                                    </FormControl>
                                                </ItemActions>
                                            </Item>

                                            {includeDiagnostics && diagnosticSnapshot && (
                                                <div className="px-4 pb-4 pt-1 border-t border-border/50">
                                                    <pre className="p-3 rounded-xl bg-muted/60 dark:bg-black/40 border border-border/50 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto select-all max-h-44">
                                                        {JSON.stringify(diagnosticSnapshot, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </Card>
                                    </FormItem>
                                )}
                            />

                            {/* Turnstile */}
                            <div className="flex justify-center mt-1">
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
                
                <div className="px-6 pb-6 pt-3 shrink-0 border-t border-border/50 flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl h-10 font-semibold cursor-pointer">
                        {t('common.cancel')}
                    </Button>
                    <Button 
                        type="submit" 
                        form="feedback-form" 
                        disabled={!form.formState.isValid || !turnstileToken || submitMutation.isPending} 
                        className="flex-1 rounded-xl h-10 font-semibold cursor-pointer"
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

FeedbackModal.displayName = 'FeedbackModal';
