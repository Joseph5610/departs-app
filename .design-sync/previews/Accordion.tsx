import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'departs-ui';

export const Faq = () => (
  <div className="w-full max-w-sm">
    <Accordion defaultValue={['live']}>
      <AccordionItem value="live">
        <AccordionTrigger>Where does live data come from?</AccordionTrigger>
        <AccordionContent>Vehicle positions come from the official PID and IDS JMK open data streams and refresh every 10 seconds.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="offline">
        <AccordionTrigger>Does it work offline?</AccordionTrigger>
        <AccordionContent>Scheduled timetables are cached, but live delays need a connection.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="cities">
        <AccordionTrigger>Which cities are supported?</AccordionTrigger>
        <AccordionContent>Prague and Brno, with more regions planned.</AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);
