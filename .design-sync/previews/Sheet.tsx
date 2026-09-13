import { Button, LineBadge, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from 'departs-ui';

export const Right = () => (
  <Sheet defaultOpen>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Náměstí Míru</SheetTitle>
        <SheetDescription>Metro A, trams 4, 10, 13, 16, 22</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-2 px-4">
        {[
          { line: 'A', color: '#00A562', dest: 'Depo Hostivař', min: '2 min' },
          { line: '22', color: '#7A0603', dest: 'Bílá Hora', min: '4 min' },
          { line: '4', color: '#7A0603', dest: 'Čechovo náměstí', min: '6 min' },
        ].map((d) => (
          <div key={d.line + d.dest} className="flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3 py-2.5">
            <LineBadge name={d.line} routeColor={d.color} size="lg" />
            <span className="flex-1 text-sm font-semibold truncate">{d.dest}</span>
            <span className="text-sm font-bold tabular-nums text-primary">{d.min}</span>
          </div>
        ))}
      </div>
      <SheetFooter>
        <Button variant="outline">Full timetable</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

export const GlassyLeftPanel = () => (
  <Sheet defaultOpen>
    <SheetContent side="left" variant="glassy" showCloseButton={false} hideOverlay>
      <SheetHeader>
        <SheetTitle>Favorite Stops</SheetTitle>
        <SheetDescription>Your pinned stops with live departures.</SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
);
