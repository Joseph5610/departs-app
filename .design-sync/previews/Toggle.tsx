import { Toggle } from 'departs-ui';
import { AccessibilityIcon, SnowflakeIcon, StarIcon } from 'lucide-react';

export const Default = () => (
  <div className="flex items-center gap-2">
    <Toggle aria-label="Favorite" defaultPressed>
      <StarIcon />
    </Toggle>
    <Toggle aria-label="Favorite">
      <StarIcon />
    </Toggle>
  </div>
);

export const Outline = () => (
  <div className="flex items-center gap-2">
    <Toggle variant="outline" defaultPressed>
      <AccessibilityIcon />
      Low floor
    </Toggle>
    <Toggle variant="outline">
      <SnowflakeIcon />
      Air conditioned
    </Toggle>
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-2">
    <Toggle variant="outline" size="sm">
      Small
    </Toggle>
    <Toggle variant="outline">Default</Toggle>
    <Toggle variant="outline" size="lg">
      Large
    </Toggle>
  </div>
);
