import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from 'departs-ui';
import { InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from 'lucide-react';

export const Default = () => (
  <div className="w-full max-w-md">
    <Alert>
      <InfoIcon />
      <AlertTitle>Tram 22 diverted</AlertTitle>
      <AlertDescription>
        Due to track works between Národní třída and Anděl, trams run via Palackého náměstí until Sunday 20:00.
      </AlertDescription>
    </Alert>
  </div>
);

export const Subtle = () => (
  <div className="w-full max-w-md">
    <Alert variant="subtle" className="border-primary/30 bg-primary/10">
      <InfoIcon className="w-4 h-4 text-primary" strokeWidth={1.5} />
      <AlertTitle className="text-xs font-bold text-foreground">About Live Data</AlertTitle>
      <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
        Departs tracks public transit in real-time by fetching vehicle coordinates from official open data streams every 10 seconds.
      </AlertDescription>
    </Alert>
  </div>
);

export const Warning = () => (
  <div className="w-full max-w-md">
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertTitle>Live data stale</AlertTitle>
      <AlertDescription>Vehicle positions have not updated for over a minute. Times may be inaccurate.</AlertDescription>
    </Alert>
  </div>
);

export const Destructive = () => (
  <div className="w-full max-w-md">
    <Alert variant="destructive">
      <OctagonXIcon />
      <AlertTitle>Source offline</AlertTitle>
      <AlertDescription>The operator's feed is unavailable. Showing scheduled times only.</AlertDescription>
    </Alert>
  </div>
);

export const WithAction = () => (
  <div className="w-full max-w-md">
    <Alert>
      <InfoIcon />
      <AlertTitle>Metro C closed</AlertTitle>
      <AlertDescription>Replacement bus X-C runs between Florenc and Pražského povstání.</AlertDescription>
      <AlertAction>
        <Button size="icon-xs" variant="ghost" aria-label="Dismiss">
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  </div>
);
