import { Link } from 'wouter';
import { Database, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemMedia } from '@/components/ui/item';
import { RowChevron } from '@/components/Chevron';
import { RowText } from '@/components/Modals/SettingsModal/SettingsControls';
import { AdminLayout } from '@/pages/admin/AdminLayout';

const TOOLS = [
    { href: '/admin/explorer', icon: Database, title: 'Feed Explorer', description: 'Inspect the live vehicle and alert feeds as raw JSON.' },
    { href: '/admin/feedback', icon: MessageSquare, title: 'Feedback Hub', description: 'Review bug reports, feature requests and crashes with their diagnostics.' },
] as const;

export const AdminIndex = () => (
    <AdminLayout title="Dashboard" backUrl="/" contentClassName="max-w-2xl">
        <Card size="none">
            {TOOLS.map(({ href, icon: Icon, title, description }) => (
                <Item key={href} variant="row" size="none" render={<Link href={href} />}>
                    <ItemMedia variant="rowIcon"><Icon strokeWidth={1.75} /></ItemMedia>
                    <RowText title={title} description={description} />
                    <ItemActions><RowChevron /></ItemActions>
                </Item>
            ))}
        </Card>
    </AdminLayout>
);
