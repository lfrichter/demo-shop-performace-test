import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { extractCsrfToken, extractProductId } from './utils/extraction';

// --- CONFIGURAÇÕES ---
export const options = {
    scenarios: {
        smoke_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: '45s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<5000'],
    },
};

const BASE_URL = 'https://demowebshop.tricentis.com';

// HEADER AJAX OBRIGATÓRIO (Do JMeter)
const AJAX_HEADERS = {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'K6-Performance-Test/1.0',
        'X-Requested-With': 'XMLHttpRequest'
    },
};

const PAGE_HEADERS = {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'K6-Performance-Test/1.0'
    },
};

// --- SETUP ---
export function setup() {
    const randomId = Math.floor(Math.random() * 100000);
    const user = {
        email: `teste.k6.${randomId}@example.com`,
        password: 'Password123!',
        firstName: 'Luis',
        lastName: 'Teste',
        countryId: '1', // USA
    };

    let res = http.get(`${BASE_URL}/register`, PAGE_HEADERS);
    let token = extractCsrfToken(res);

    const payload = {
        Gender: 'M',
        FirstName: user.firstName,
        LastName: user.lastName,
        Email: user.email,
        Password: user.password,
        ConfirmPassword: user.password,
        __RequestVerificationToken: token,
        'register-button': 'Register'
    };

    res = http.post(`${BASE_URL}/register`, payload, PAGE_HEADERS);
    check(res, { 'setup: user created': (r) => r.status === 200 });

    return user;
}

// --- CENÁRIO ---
export default function (user: any) {
    let csrfToken = '';
    let productId = '';

    // 1. Login
    group('01_Login_Flow', () => {
        const res = http.get(`${BASE_URL}/login`, PAGE_HEADERS);
        csrfToken = extractCsrfToken(res);

        const payload = {
            Email: user.email,
            Password: user.password,
            __RequestVerificationToken: csrfToken,
            RememberMe: 'false'
        };

        const loginRes = http.post(`${BASE_URL}/login`, payload, PAGE_HEADERS);
        check(loginRes, { 'login: success': (r) => r.body ? (r.body as string).includes('/logout') : false });
    });

    sleep(1);

    // 2. Busca e Seleção
    group('02_Search_Product', () => {
        const res = http.get(`${BASE_URL}/search?q=14.1-inch+Laptop`);
        check(res, { 'search: results found': (r) => r.status === 200 });

        const productLink = (res.body as string).match(/<h2 class="product-title">\s*<a href="([^"]+)">/);

        if (productLink && productLink[1]) {
            const productPageRes = http.get(`${BASE_URL}${productLink[1]}`);
            productId = extractProductId(productPageRes) || '';
            check(productPageRes, { 'product: id extracted': () => productId !== '' });
        }
    });

    // 3. Adicionar ao Carrinho
    if (productId) {
        group('03_Add_To_Cart', () => {
            const cartUrl = `${BASE_URL}/addproducttocart/details/${productId}/1`;
            const payload = { [`addtocart_${productId}.EnteredQuantity`]: '1' };
            const res = http.post(cartUrl, payload, AJAX_HEADERS);
            check(res, {
                'cart: added successfully': (r) => (r.body as string).includes('"success":true')
            });
        });
    }

    sleep(1);

    // 4. Checkout Completo (URLs CORRIGIDAS)
    group('04_Checkout_Flow', () => {
        const checkoutPage = http.get(`${BASE_URL}/checkout`, PAGE_HEADERS);
        check(checkoutPage, { 'checkout: page loaded': (r) => r.status === 200 });
        const checkoutToken = extractCsrfToken(checkoutPage);

        // Passo 1: Billing Address (URL CORRIGIDA: /OpcSaveBilling/)
        const billingPayload = {
            'billing_address_id': '',
            'BillingNewAddress.FirstName': user.firstName,
            'BillingNewAddress.LastName': user.lastName,
            'BillingNewAddress.Email': user.email,
            'BillingNewAddress.CountryId': user.countryId,
            'BillingNewAddress.StateProvinceId': '1',
            'BillingNewAddress.City': 'New York',
            'BillingNewAddress.Address1': 'Street 1',
            'BillingNewAddress.ZipPostalCode': '10001',
            'BillingNewAddress.PhoneNumber': '1234567890',
            'ShipToSameAddress': 'false',
            '__RequestVerificationToken': checkoutToken
        };
        // Nota: Removi o "nextstep" pois em chamadas OPC ele as vezes atrapalha se enviado errado,
        // mas o backend do nopCommerce costuma ignorar extras. O importante é a URL.
        const billingRes = http.post(`${BASE_URL}/checkout/OpcSaveBilling/`, billingPayload, AJAX_HEADERS);

        if(!check(billingRes, { 'checkout: billing saved': (r) => r.status === 200 })) {
             console.error(`[Billing Fail] Status: ${billingRes.status} Url: ${billingRes.url}`);
        }

        // Passo 2: Shipping Address (URL CORRIGIDA: /OpcSaveShipping/)
        const shippingPayload = {
            'shipping_address_id': '',
            'PickUpInStore': 'false',
            'ShippingNewAddress.FirstName': 'Luis',
            'ShippingNewAddress.LastName': 'Teste',
            'ShippingNewAddress.Email': user.email,
            'ShippingNewAddress.CountryId': '1',
            'ShippingNewAddress.StateProvinceId': '1',
            'ShippingNewAddress.City': 'New York',
            'ShippingNewAddress.Address1': 'Street 1',
            'ShippingNewAddress.ZipPostalCode': '10001',
            'ShippingNewAddress.PhoneNumber': '12345678',
            '__RequestVerificationToken': checkoutToken
        };
        const shippingRes = http.post(`${BASE_URL}/checkout/OpcSaveShipping/`, shippingPayload, AJAX_HEADERS);
        check(shippingRes, { 'checkout: shipping saved': (r) => r.status === 200 });

        // Passo 3: Shipping Method (URL CORRIGIDA: /OpcSaveShippingMethod/)
        const shippingMethodPayload = {
            'shippingoption': 'Ground___Shipping.FixedRate',
            '__RequestVerificationToken': checkoutToken
        };
        const shipMethodRes = http.post(`${BASE_URL}/checkout/OpcSaveShippingMethod/`, shippingMethodPayload, AJAX_HEADERS);
        check(shipMethodRes, { 'checkout: ship method saved': (r) => r.status === 200 });

        // Passo 4: Payment Method (URL CORRIGIDA: /OpcSavePaymentMethod/)
        const paymentMethodPayload = {
            'paymentmethod': 'Payments.CashOnDelivery',
            '__RequestVerificationToken': checkoutToken
        };
        const payMethodRes = http.post(`${BASE_URL}/checkout/OpcSavePaymentMethod/`, paymentMethodPayload, AJAX_HEADERS);
        check(payMethodRes, { 'checkout: pay method saved': (r) => r.status === 200 });

        // Passo 5: Payment Info (URL CORRIGIDA: /OpcSavePaymentInfo/)
        const payInfoRes = http.post(`${BASE_URL}/checkout/OpcSavePaymentInfo/`, {
            '__RequestVerificationToken': checkoutToken
        }, AJAX_HEADERS);
        check(payInfoRes, { 'checkout: pay info saved': (r) => r.status === 200 });

        // Passo 6: Confirm Order (URL CORRIGIDA: /OpcConfirmOrder/)
        const confirmRes = http.post(`${BASE_URL}/checkout/OpcConfirmOrder/`, {
            '__RequestVerificationToken': checkoutToken
        }, AJAX_HEADERS);
        check(confirmRes, { 'checkout: order confirmed': (r) => r.status === 200 });

        // Validação Final
        const successPage = http.get(`${BASE_URL}/checkout/completed/`, PAGE_HEADERS);
        const orderSuccess = check(successPage, {
            'order: completed successfully': (r) => (r.body as string).includes('Your order has been successfully processed')
        });

        if (orderSuccess) {
            // Regex robusta: aceita "Order Number:", "Order #", "Order:", tags <strong>, espaços, quebras de linha, etc.
            const orderIdMatch = (successPage.body as string).match(/Order\s*(?:Number|ID|#)?:?\s*(?:<[^>]*>)*\s*(\d+)/i);

            if (orderIdMatch && orderIdMatch[1]) {
                const orderId = orderIdMatch[1];
                console.log(`[Success] Pedido Gerado: #${orderId}`);
                // (opcional) você pode armazenar em variável ou emitir métrica customizada:
                // tags: { orderId } ou via custom metrics — veja abaixo.
            } else {
                console.warn('[Warning] Order ID não encontrado na página de confirmação');
                console.debug('[Debug] Conteúdo do corpo (500 chars):', (successPage.body as string).substring(0, 500));
            }
        } else {
             console.error(`[Order Fail] Final URL: ${successPage.url}`);
        }
    });
}
