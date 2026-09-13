import { Switch, Route } from 'wouter';
import { FeedExplorer } from './FeedExplorer/FeedExplorer';
import { AdminFeedback } from './AdminFeedback/AdminFeedback';
import { AdminIndex } from './AdminIndex/AdminIndex';

/** All admin pages; loaded as a separate chunk so the public app never downloads them. */
export default function AdminRoutes() {
    return (
        <Switch>
            <Route path="/admin/explorer">
                <FeedExplorer />
            </Route>
            <Route path="/admin/feedback">
                <AdminFeedback />
            </Route>
            <Route>
                <AdminIndex />
            </Route>
        </Switch>
    );
}
