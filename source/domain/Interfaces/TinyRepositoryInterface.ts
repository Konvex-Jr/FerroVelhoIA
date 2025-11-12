export interface LocalTinyProduct {
    id: string;
    name: string;
    price: number;
    quantity: number;
    deposit_code?: string;
    name_vector?: number[]
    code?: string;
    sku?: string;
    gtin?: string;
    unit?: string;
    promo_price?: number;
    cost_price?: number;
    avg_cost_price?: number;
    location?: string;
    status?: string;
    created_at_tiny?: string | null;
}

export interface TinyRepositoryInterface {
    findProductsByName(queryVector: number[]): Promise<LocalTinyProduct[]>;

    saveProductWithVector(product: LocalTinyProduct): Promise<void>;

    updateStock(productId: string | number, quantity: number, depositCode: string): Promise<void>;

    getStateNumber(key: string, fallback: number): Promise<number>;

    setState(key: string, value: string): Promise<void>;

    getLastSync(key: string): Promise<string | null>;

    setLastSync(key: string, value: string): Promise<void>;
}