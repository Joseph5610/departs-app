import type { LucideProps } from 'lucide-react';
import { Ticket, CreditCard, Building2, Landmark, HelpCircle } from 'lucide-react';
import type { PointOfSaleType } from '@/types';

const TYPE_ICONS: Record<PointOfSaleType, React.ElementType<LucideProps>> = {
    ticketMachine: Ticket,
    ticketOfficeMetro: Building2,
    informationCenter: Landmark,
    trainStation: Building2,
    carrierOffice: Building2,
    chipCardDispense: CreditCard,
};

export const PointOfSaleTypeIcon = ({ type, ...props }: LucideProps & { type: PointOfSaleType }) => {
    const Icon = TYPE_ICONS[type] ?? HelpCircle;
    return <Icon {...props} />;
};
