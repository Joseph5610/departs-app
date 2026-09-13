import { Button, Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, LineBadge } from 'departs-ui';
import { HashIcon, StarIcon } from 'lucide-react';

export const StatsCard = () => {
  const busiest = [
    { line: '22', color: '#7A0603', count: 38 },
    { line: '9', color: '#7A0603', count: 31 },
    { line: '136', color: '#007DA8', count: 24 },
    { line: 'A', color: '#00A562', count: 18 },
    { line: '175', color: '#007DA8', count: 16 },
  ];
  return (
    <div className="w-full max-w-xs">
      <Card variant="subtle" size="none">
        <CardHeader className="p-3.5 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <HashIcon size={16} className="text-primary" />
            <span>Busiest Lines</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="flex flex-wrap gap-2">
            {busiest.map((item) => (
              <div key={item.line} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 px-2 py-1 rounded-md">
                <LineBadge name={item.line} routeColor={item.color} size="sm" />
                <span className="text-xs font-bold text-foreground tabular-nums">{item.count} cars</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const WithHeaderAndFooter = () => (
  <div className="w-full max-w-xs">
    <Card>
      <CardHeader>
        <CardTitle>Náměstí Míru</CardTitle>
        <CardDescription>Metro A, trams 4, 10, 13, 16, 22</CardDescription>
        <CardAction>
          <Button size="icon-xs" variant="ghost" aria-label="Remove from favorites">
            <StarIcon className="fill-current text-primary" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Next departure towards Depo Hostivař in 2 min.</p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Map
        </Button>
        <Button size="sm">Departures</Button>
      </CardFooter>
    </Card>
  </div>
);

export const Small = () => (
  <div className="w-full max-w-64">
    <Card size="sm">
      <CardHeader>
        <CardTitle>On-time performance</CardTitle>
        <CardDescription>Last 10 minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">87%</div>
      </CardContent>
    </Card>
  </div>
);
