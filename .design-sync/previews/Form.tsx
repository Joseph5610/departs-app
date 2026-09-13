import { Button, Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input, Switch, Textarea, useForm } from 'departs-ui';

export const Feedback = () => {
  const form = useForm({ defaultValues: { message: '', email: '', diagnostics: true } });
  return (
    <div className="w-full max-w-sm">
      <Form {...form}>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(() => {})}>
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Your Message *</FormLabel>
                <FormControl>
                  <Textarea placeholder="What would you like to change or what is broken?" className="min-h-24 resize-none rounded-xl border-border/80 bg-card text-sm" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Email (optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@example.com" className="rounded-xl border-border/80 bg-card text-sm h-11" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="diagnostics"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <FormLabel>Include diagnostic data</FormLabel>
                  <FormDescription className="text-xs">Browser version and active stop help find bugs faster.</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
};

export const WithError = () => {
  const form = useForm({ defaultValues: { email: 'jan.novak@' }, errors: { email: { type: 'pattern', message: 'Enter a valid email address.' } } });
  return (
    <div className="w-full max-w-xs">
      <Form {...form}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </div>
  );
};
