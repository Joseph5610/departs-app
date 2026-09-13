import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'departs-ui';
import { StarIcon } from 'lucide-react';

export const Default = () => (
  <div className="flex justify-center pt-12">
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Add to favorites"><StarIcon size={16} strokeWidth={1.5} /></Button>} />
        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
          Add to favorites
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);
