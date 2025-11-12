import Connection from "../database/Connection";
import { LocalTinyProduct, TinyRepositoryInterface } from "../../domain/Interfaces/TinyRepositoryInterface";

export default class TinyRepositoryDatabase implements TinyRepositoryInterface {

    constructor(protected connection: Connection) { }

    async findProductsByName(queryVector: number[]): Promise<LocalTinyProduct[]> {
        const query = `
            SELECT 
                id, name, price, quantity, deposit_code
            FROM 
                tiny_products
            ORDER BY
                name_vector <=> $1
            LIMIT 5;
        `;

        try {
            const vectorString = `[${queryVector.join(',')}]`;
            const rows = await this.connection.execute(query, [vectorString]);

            return rows.map((row: any) => ({
                id: row.id,
                name: row.name,
                price: parseFloat(row.price),
                quantity: parseInt(row.quantity, 10) || 0,
                deposit_code: row.deposit_code
            }));
        } catch (error: any) {
            console.error("Erro ao buscar produtos por vetor:", error.message);
            return [];
        }
    }

    async saveProductWithVector(product: LocalTinyProduct): Promise<void> {
        const query = `
            INSERT INTO tiny_products (
                id, code, name, sku, gtin, unit, price, promo_price, cost_price, avg_cost_price,
                location, status, created_at_tiny, quantity, deposit_code, name_vector
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, to_timestamp(NULLIF($13,'')::text, 'DD/MM/YYYY HH24:MI:SS'), $14, $15, $16
            )
            ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                sku = EXCLUDED.sku,
                gtin = EXCLUDED.gtin,
                unit = EXCLUDED.unit,
                price = EXCLUDED.price,
                promo_price = EXCLUDED.promo_price,
                cost_price = EXCLUDED.cost_price,
                avg_cost_price = EXCLUDED.avg_cost_price,
                location = EXCLUDED.location,
                status = EXCLUDED.status,
                created_at_tiny = EXCLUDED.created_at_tiny,
                quantity = EXCLUDED.quantity,
                deposit_code = EXCLUDED.deposit_code,
                name_vector = EXCLUDED.name_vector;
        `;

        const vectorString = (product.name_vector && product.name_vector.length > 0)
            ? `[${product.name_vector.join(',')}]`
            : null;

        await this.connection.execute(query, [
            product.id,
            product.code ?? null,
            product.name,
            product.sku ?? null,
            product.gtin ?? null,
            product.unit ?? null,
            product.price ?? 0,
            product.promo_price ?? 0,
            product.cost_price ?? 0,
            product.avg_cost_price ?? 0,
            product.location ?? null,
            product.status ?? 'A',
            product.created_at_tiny ?? null,
            product.quantity ?? 0,
            product.deposit_code ?? null,
            vectorString
        ]);
    }

    async updateStock(productId: string | number, quantity: number, depositCode: string): Promise<void> {
        await this.connection.execute(
            `UPDATE public.tiny_products
              SET quantity = $2,
                  deposit_code = $3,
                  updated_at = NOW()
              WHERE id = $1;`,
            [productId, quantity, depositCode]
        );
    }

    async getLastSync(key: string): Promise<string | null> {
        const rows: any[] = await this.connection.execute(
            "SELECT value FROM public.tiny_sync_state WHERE key = $1",
            [key]
        );
        return rows?.[0]?.value ?? null;
    }

    async setLastSync(key: string, value: string): Promise<void> {
        await this.connection.execute(
            `INSERT INTO public.tiny_sync_state (key, value, updated_at)
              VALUES ($1,$2,NOW())
              ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();`,
            [key, value]
        );
    }
    async getStateNumber(key: string, fallback: number): Promise<number> {
        const result: any = await this.connection.execute(
            "SELECT value FROM public.tiny_sync_state WHERE key = $1",
            [key]
        );
        const rows = Array.isArray(result) ? result
            : result?.rows ?? result?.data ?? Object.values(result ?? {}).find(Array.isArray) ?? [];
        const raw = rows?.[0]?.value;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 1 ? n : fallback;
    }

    async setState(key: string, value: string): Promise<void> {
        await this.connection.execute(
            `INSERT INTO public.tiny_sync_state(key, value, updated_at)
            VALUES($1,$2,NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
            [key, value]
        );
    }
}