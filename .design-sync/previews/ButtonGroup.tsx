import { Button, ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from 'departs-ui';
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon } from 'lucide-react';

export const Horizontal = () => (
  <ButtonGroup>
    <Button variant="outline" size="sm">
      Today
    </Button>
    <Button variant="outline" size="sm">
      Tomorrow
    </Button>
    <Button variant="outline" size="sm">
      Pick date
    </Button>
  </ButtonGroup>
);

export const WithText = () => (
  <ButtonGroup>
    <Button variant="outline" size="sm" aria-label="Earlier">
      <ChevronLeftIcon />
    </Button>
    <ButtonGroupText>14:20</ButtonGroupText>
    <Button variant="outline" size="sm" aria-label="Later">
      <ChevronRightIcon />
    </Button>
  </ButtonGroup>
);

export const Vertical = () => (
  <ButtonGroup orientation="vertical">
    <Button variant="outline" size="sm" aria-label="Zoom in">
      <PlusIcon />
    </Button>
    <ButtonGroupSeparator orientation="horizontal" />
    <Button variant="outline" size="sm" aria-label="Zoom out">
      <MinusIcon />
    </Button>
  </ButtonGroup>
);
