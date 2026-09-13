import { SegmentedControl } from 'departs-ui';
import { SearchIcon } from 'lucide-react';
import { useState } from 'react';

export const ScopeHeader = () => {
  const [tab, setTab] = useState<'screen' | 'network'>('screen');
  return (
    <div className="w-full max-w-xs flex items-center justify-between px-1">
      <span className="text-xs font-semibold text-muted-foreground">Scope</span>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'screen', label: 'On Screen' },
          { value: 'network', label: 'Network' },
        ]}
      />
    </div>
  );
};

export const InSearchBar = () => {
  const [field, setField] = useState<'line' | 'vehicle'>('line');
  return (
    <div className="w-full max-w-xs flex items-center gap-2 h-10 px-3 rounded-xl border border-border/60 bg-card/60">
      <SearchIcon size={14} className="text-muted-foreground/50 shrink-0" />
      <SegmentedControl
        size="sm"
        value={field}
        onChange={setField}
        options={[
          { value: 'line', label: 'Line' },
          { value: 'vehicle', label: 'Vehicle' },
        ]}
      />
      <input type="text" placeholder="e.g. 22" className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
    </div>
  );
};
