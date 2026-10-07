/** `unsupported`: no Notification API (e.g. Safari on iOS outside an installed app). */
export type NotificationOutcome = NotificationPermission | 'unsupported';

export const notificationPermission = (): NotificationOutcome =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

/** Asks for notification permission; must run from a tap. Older Safari only offers the callback form. */
export const requestNotificationPermission = (): Promise<NotificationOutcome> => {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return new Promise((resolve) => {
        const result = Notification.requestPermission((permission) => resolve(permission));
        if (result) void result.then(resolve, () => resolve(Notification.permission));
    });
};
