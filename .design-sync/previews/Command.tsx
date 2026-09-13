import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut, LineBadge } from 'departs-ui';
import { Building2Icon, ClockIcon, MapPinIcon } from 'lucide-react';

export const StopSearch = () => (
  <div className="w-full max-w-sm rounded-2xl border border-border/50 shadow-md">
    <Command>
      <CommandInput placeholder="Search stops, lines or places" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Recent">
          <CommandItem>
            <ClockIcon />
            <span>Karlovo náměstí</span>
            <CommandShortcut>
              <LineBadge name="B" routeColor="#F8B322" size="sm" />
            </CommandShortcut>
          </CommandItem>
          <CommandItem>
            <MapPinIcon />
            <span>Hlavní nádraží</span>
            <CommandShortcut>
              <LineBadge name="C" routeColor="#CF003D" size="sm" />
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Places">
          <CommandItem>
            <Building2Icon />
            <span>Národní muzeum</span>
          </CommandItem>
          <CommandItem>
            <Building2Icon />
            <span>Pražský hrad</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);
