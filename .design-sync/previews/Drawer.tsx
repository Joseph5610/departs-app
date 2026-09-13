import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, LineBadge } from 'departs-ui';

export const Default = () => (
  <Drawer open>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Anděl</DrawerTitle>
        <DrawerDescription>Metro B, trams 4, 5, 9, 10, 12, 15, 16, 20</DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-2 px-4">
        {[
          { line: 'B', color: '#F8B322', dest: 'Černý Most', min: '1 min' },
          { line: '9', color: '#7A0603', dest: 'Spojovací', min: '3 min' },
        ].map((d) => (
          <div key={d.line} className="flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3 py-2.5">
            <LineBadge name={d.line} routeColor={d.color} size="lg" />
            <span className="flex-1 text-sm font-semibold truncate">{d.dest}</span>
            <span className="text-sm font-bold tabular-nums text-primary">{d.min}</span>
          </div>
        ))}
      </div>
      <DrawerFooter>
        <Button>Show on map</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
