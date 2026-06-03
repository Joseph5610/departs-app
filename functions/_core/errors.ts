export class ApiError extends Error {
    constructor(message: string, public status: number = 500, options?: ErrorOptions) {
        super(message, options);
        this.name = 'ApiError';
    }
}

export class NotImplementedError extends ApiError {
    constructor(message: string = 'Adapter not implemented') {
        super(message, 501);
        this.name = 'NotImplementedError';
    }
}
