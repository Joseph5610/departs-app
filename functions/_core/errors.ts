export class ApiError extends Error {
    constructor(message: string, public status: number = 500, options?: ErrorOptions) {
        super(message, options);
        this.name = 'ApiError';
    }
}
