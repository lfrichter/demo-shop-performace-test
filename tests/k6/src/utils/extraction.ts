import { parseHTML } from 'k6/html';
import { Response } from 'k6/http';

export function extractCsrfToken(response: Response): string {
    const doc = parseHTML(response.body as string);
    const selection = doc.find('input[name="__RequestVerificationToken"]');

    // Se achou, retorna. Se não, retorna vazio sem spammar o log.
    return selection.size() > 0 ? selection.val() || '' : '';
}

// Extrai ID do produto de links como "/product-name-2" ou parâmetros
export function extractProductId(response: Response): string | null {
    const body = response.body as string;
    // Estratégia: Buscar o input hidden que guarda o ID do produto na página de detalhes
    // Padrão comum do nopCommerce (engine desse site): <input ... name="addtocart_123.EnteredQuantity" ...>
    // Onde 123 é o ID.
    const match = body.match(/name="addtocart_(\d+)\.EnteredQuantity"/);
    return match ? match[1] : null;
}
