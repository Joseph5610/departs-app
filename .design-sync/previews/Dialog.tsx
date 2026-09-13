import { Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Item, ItemActions, ItemContent, ItemDescription, ItemTitle, ScrollArea, Switch } from 'departs-ui';

export const Compact = () => (
  <Dialog defaultOpen>
    <DialogContent className="h-auto max-w-105 p-6 gap-6!">
      <DialogHeader>
        <DialogTitle>Clear search history?</DialogTitle>
        <DialogDescription>Recent stops, places and line filters will be removed from this device.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Clear history</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FullHeight = () => (
  <Dialog defaultOpen>
    <DialogContent>
      <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
        <DialogTitle>Settings</DialogTitle>
      </DialogHeader>
      <ScrollArea className="flex-1 min-h-0 px-6">
        <div className="flex flex-col gap-3 py-2 pb-8">
          <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">Display</h3>
          <Card variant="subtle" size="none">
            <Item variant="settings">
              <ItemContent>
                <ItemTitle>Live vehicle locations</ItemTitle>
                <ItemDescription className="text-xs">Show buses, trams, and metro</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch defaultChecked />
              </ItemActions>
            </Item>
            <Item variant="settings">
              <ItemContent>
                <ItemTitle>Vehicle colors by delay</ItemTitle>
                <ItemDescription className="text-xs">Color map vehicle markers based on current delay instead of line color</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch />
              </ItemActions>
            </Item>
          </Card>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
);
