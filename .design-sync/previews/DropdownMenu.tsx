import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'departs-ui';
import { ArrowDownAZIcon, ClockIcon, ExternalLinkIcon, MessageSquareHeartIcon, MoreHorizontalIcon, Share2Icon, Trash2Icon } from 'lucide-react';

export const MoreOptions = () => (
  <div className="flex justify-end pr-40">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="More options" className="text-muted-foreground"><MoreHorizontalIcon size={16} strokeWidth={1.5} /></Button>} />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem>
          <Share2Icon size={14} className="mr-2" strokeWidth={1.5} />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MessageSquareHeartIcon size={14} className="mr-2" strokeWidth={1.5} />
          Send Feedback
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ExternalLinkIcon size={14} className="mr-2" strokeWidth={1.5} />
          Official departure board
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2Icon size={14} className="mr-2" strokeWidth={1.5} />
          Remove from favorites
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const SortRadio = () => (
  <div className="flex justify-end pr-40">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm">Sort</Button>} />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup value="departure">
          <DropdownMenuRadioItem value="departure" className="flex items-center gap-2">
            <ClockIcon size={14} strokeWidth={1.5} className="mr-1 text-muted-foreground" />
            <span>By departure time</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="line" className="flex items-center gap-2">
            <ArrowDownAZIcon size={14} strokeWidth={1.5} className="mr-1 text-muted-foreground" />
            <span>By line</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
