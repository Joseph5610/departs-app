import { IconToggle } from 'departs-ui';
import { BusIcon, CableCarIcon, ShipIcon, TrainFrontIcon, TrainIcon, TramFrontIcon } from 'lucide-react';
import { useState } from 'react';

export const VehicleFilter = () => {
  const modes = [
    { id: 'metro', label: 'Metro', icon: TrainFrontIcon },
    { id: 'tram', label: 'Tram', icon: TramFrontIcon },
    { id: 'bus', label: 'Bus', icon: BusIcon },
    { id: 'train', label: 'Train', icon: TrainIcon },
    { id: 'ferry', label: 'Ferry', icon: ShipIcon },
    { id: 'funicular', label: 'Funicular', icon: CableCarIcon },
  ];
  const [active, setActive] = useState<string[]>(['metro', 'tram', 'bus']);
  const toggle = (id: string) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <div className="w-full max-w-xs grid grid-cols-3 gap-2">
      {modes.map((m) => (
        <IconToggle
          key={m.id}
          icon={m.icon}
          label={m.label}
          isActive={active.includes(m.id)}
          onClick={() => toggle(m.id)}
          className="py-2.5 rounded-2xl text-sm"
          labelClassName="text-[10px] font-bold uppercase tracking-wider"
        />
      ))}
    </div>
  );
};

export const States = () => (
  <div className="flex gap-2">
    <IconToggle icon={TramFrontIcon} label="Active" isActive onClick={() => {}} className="py-2.5 rounded-2xl text-sm w-24" labelClassName="text-[10px] font-bold uppercase tracking-wider" />
    <IconToggle icon={TramFrontIcon} label="Inactive" isActive={false} onClick={() => {}} className="py-2.5 rounded-2xl text-sm w-24" labelClassName="text-[10px] font-bold uppercase tracking-wider" />
  </div>
);
