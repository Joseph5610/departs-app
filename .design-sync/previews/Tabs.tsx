import { Tabs, TabsContent, TabsList, TabsTrigger } from 'departs-ui';
import { BarChart3Icon, BusIcon } from 'lucide-react';

export const Default = () => (
  <div className="w-full max-w-xs">
    <Tabs defaultValue="departures">
      <TabsList>
        <TabsTrigger value="departures">Departures</TabsTrigger>
        <TabsTrigger value="lines">Lines</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
      </TabsList>
      <TabsContent value="departures" className="pt-3 text-sm text-muted-foreground">
        Next 30 minutes from Náměstí Míru.
      </TabsContent>
    </Tabs>
  </div>
);

export const Pill = () => (
  <div className="w-full max-w-xs">
    <Tabs defaultValue="overview">
      <TabsList variant="pill" className="w-full grid grid-cols-2">
        <TabsTrigger value="overview" className="cursor-pointer gap-1.5 text-xs font-semibold">
          <BarChart3Icon size={14} />
          <span>Overview</span>
        </TabsTrigger>
        <TabsTrigger value="vehicles" className="cursor-pointer gap-1.5 text-xs font-semibold">
          <BusIcon size={14} />
          <span>Vehicles</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);

export const Line = () => (
  <div className="w-full max-w-xs">
    <Tabs defaultValue="network">
      <TabsList variant="line">
        <TabsTrigger value="screen">On Screen</TabsTrigger>
        <TabsTrigger value="network">Network</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);

export const Vertical = () => (
  <div className="w-full max-w-xs">
    <Tabs defaultValue="display" orientation="vertical" className="flex gap-4">
      <TabsList className="w-32">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="display">Display</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      <TabsContent value="display" className="text-sm text-muted-foreground">
        Map style, vehicle labels and units.
      </TabsContent>
    </Tabs>
  </div>
);
