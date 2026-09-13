import { LineBadge, ScrollArea, Separator } from 'departs-ui';

export const DepartureList = () => {
  const rows = [
    { line: '22', color: '#7A0603', dest: 'Bílá Hora', min: 1 },
    { line: '136', color: '#007DA8', dest: 'Jižní Město', min: 3 },
    { line: 'A', color: '#00A562', dest: 'Nemocnice Motol', min: 4 },
    { line: '9', color: '#7A0603', dest: 'Spojovací', min: 6 },
    { line: '175', color: '#007DA8', dest: 'Florenc', min: 8 },
    { line: '4', color: '#7A0603', dest: 'Kotlářka', min: 11 },
    { line: '91', color: '#000000', dest: 'Divoká Šárka', min: 14 },
  ];
  return (
    <ScrollArea className="h-56 w-full max-w-xs rounded-2xl border border-border/50 bg-card">
      <div className="p-3">
        {rows.map((r, i) => (
          <div key={r.line + r.dest}>
            {i > 0 && <Separator className="my-2" />}
            <div className="flex items-center gap-3">
              <LineBadge name={r.line} routeColor={r.color} />
              <span className="flex-1 text-sm truncate">{r.dest}</span>
              <span className="text-sm font-bold tabular-nums">{r.min} min</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
