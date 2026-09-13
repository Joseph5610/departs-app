import { Card, CardContent, Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from 'departs-ui';

export const Onboarding = () => {
  const slides = [
    { title: 'Live vehicles', body: 'See every tram, bus and metro train move in real time.' },
    { title: 'Departure boards', body: 'Tap any stop for the next departures with live delays.' },
    { title: 'Favorites', body: 'Pin the stops you use every day.' },
  ];
  return (
    <div className="w-full max-w-xs px-12">
      <Carousel>
        <CarouselContent>
          {slides.map((s) => (
            <CarouselItem key={s.title}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-1 py-6">
                  <span className="text-base font-semibold">{s.title}</span>
                  <span className="text-muted-foreground">{s.body}</span>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};
