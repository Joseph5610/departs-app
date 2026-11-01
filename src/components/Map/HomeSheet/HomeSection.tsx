import type React from 'react';
import { SectionTitle } from '@/components/SectionTitle';

interface HomeSectionProps {
    title: string;
    /** Makes the title a link, marked by a chevron next to it. */
    onOpen?: () => void;
    children: React.ReactNode;
}

/** A titled group on the mobile home sheet. */
export const HomeSection = ({ title, onOpen, children }: HomeSectionProps) => (
    <section className="flex flex-col gap-2">
        <SectionTitle onOpen={onOpen}>{title}</SectionTitle>
        {children}
    </section>
);
