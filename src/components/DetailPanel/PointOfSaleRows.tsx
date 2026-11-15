import type React from 'react';
import { Card } from '@/components/ui/card';
import { Item, ItemMedia, ItemContent, ItemTitle } from '@/components/ui/item';
import { SectionHeading } from '@/components/SectionHeading';

/** One group of rows on the point-of-sale panel, with an optional heading above it. */
export const PosSection = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <section className="flex flex-col gap-2">
        {title && <SectionHeading>{title}</SectionHeading>}
        <Card size="none" className="overflow-hidden gap-0">
            {children}
        </Card>
    </section>
);

/** A row of a section: a muted icon, then the text. */
export const PosRow = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
    <Item variant="row" size="none">
        <ItemMedia variant="rowIcon" className="text-muted-foreground">
            <Icon strokeWidth={1.5} />
        </ItemMedia>
        <ItemContent>
            <ItemTitle className="block type-row text-foreground whitespace-normal wrap-break-word">{children}</ItemTitle>
        </ItemContent>
    </Item>
);
