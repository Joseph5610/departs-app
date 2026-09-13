import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from 'departs-ui';
import { LocateFixedIcon, SearchIcon, XIcon } from 'lucide-react';

export const Search = () => (
  <div className="w-full max-w-xs">
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search stops" defaultValue="Anděl" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Clear">
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const WithText = () => (
  <div className="w-full max-w-xs">
    <InputGroup>
      <InputGroupInput placeholder="Walking radius" defaultValue="500" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>m</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const WithAction = () => (
  <div className="w-full max-w-xs">
    <InputGroup>
      <InputGroupInput placeholder="From" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton variant="secondary">
          <LocateFixedIcon />
          My location
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const Textarea = () => (
  <div className="w-full max-w-xs">
    <InputGroup>
      <InputGroupTextarea placeholder="What would you like to change or what is broken?" />
      <InputGroupAddon align="block-end">
        <InputGroupText className="ml-auto">0 / 2000</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  </div>
);
