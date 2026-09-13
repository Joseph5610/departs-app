import { Button, Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from 'departs-ui';
import { InfoIcon } from 'lucide-react';

export const Default = () => (
  <div className="flex justify-center pt-4">
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" size="sm"><InfoIcon />Delay legend</Button>} />
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Vehicle colors</PopoverTitle>
          <PopoverDescription>Markers are colored by current delay.</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-1.5 text-xs">
          {[
            { label: 'On time (-1–2m)', cls: 'bg-primary' },
            { label: '2–5 min', cls: 'bg-amber-500' },
            { label: '>10 min', cls: 'bg-destructive' },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${r.cls}`} />
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
