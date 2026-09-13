import { Label, Textarea } from 'departs-ui';

export const Default = () => (
  <div className="w-full max-w-xs">
    <Textarea placeholder="What would you like to change or what is broken?" />
  </div>
);

export const FeedbackField = () => (
  <div className="w-full max-w-xs flex flex-col gap-1.5">
    <Label htmlFor="msg" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
      Your Message *
    </Label>
    <Textarea
      id="msg"
      defaultValue="The departure board for Karlovo náměstí shows tram 18 twice."
      className="min-h-28 resize-none rounded-xl border-border/80 bg-card text-sm leading-relaxed"
    />
  </div>
);

export const Disabled = () => (
  <div className="w-full max-w-xs">
    <Textarea disabled placeholder="Feedback is closed" />
  </div>
);
