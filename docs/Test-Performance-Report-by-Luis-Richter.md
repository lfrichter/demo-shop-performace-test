# ESTRATÉGIA DE TESTE DE PERFORMANCE - DEMO WEB SHOP
## RELATÓRIO TÉCNICO

- Luis Fernando Richter
- Consultor Sênior / Performance Engineer

---

### 1. Arquitetura da Solução de Teste

O script foi desenvolvido utilizando **Apache JMeter 5.6.3**, adotando uma abordagem de engenharia de performance focada em robustez, correlação dinâmica e simulação realista do comportamento do usuário.

**Destaques da Implementação:**
* **Correlação Dinâmica (CSRF):** Implementada extração via CSS Selector para capturar o `__RequestVerificationToken` em tempo real, garantindo que o script funcione independente da sessão ou usuário.
* **Massa de Dados Externa:** Utilização de `CSV Data Set Config` para parametrização de credenciais (Login), permitindo escalabilidade de usuários virtuais sem alteração de código (Hard-coding).
* **Simulação de Fluxo Real:** O checkout foi mapeado passo-a-passo (One Page Checkout), incluindo a manipulação correta de headers AJAX (`X-Requested-With`) e tratamento de dados de sessão via `HTTP Cookie Manager`.
* **Validação de Negócio:** Uso de `Response Assertions` em etapas críticas (Login, Add to Cart, Order Success) para garantir que o código HTTP 200 não mascare erros de aplicação (falsos positivos).

### 2. Estratégia de Volumetria (Cenários Propostos)

Para atender aos requisitos de carga, a arquitetura do teste foi desenhada para suportar os seguintes Throughputs (Vazão), calculados com base na Lei de Little:

* **Cenário 1 (Smoke/Baseline):** 1.000 pedidos/hora (~17 Threads). Foco em validar a funcionalidade sob carga leve.
* **Cenário 2 (Carga Média):** 5.000 pedidos/2 horas (~63 Threads). Foco em identificar degradação de tempo de resposta.
* **Cenário 3 (Stress/Pico):** 100.000 pedidos/4 horas.
    * *Nota Técnica:* Para este cenário (~833 Threads ativas simultâneas), recomenda-se a execução em modo **Distribuído (Master-Slave)** ou via contêineres em pipeline CI/CD, para evitar que a máquina injetora se torne o gargalo.

### 3. Observações e Sugestões de Melhoria

Durante a modelagem do script, foram identificados pontos de atenção na aplicação alvo que, em um projeto real, seriam reportados ao time de desenvolvimento:

1.  **Performance do Checkout:** O fluxo de checkout realiza múltiplas chamadas sequenciais (`OpcSaveBilling`, `OpcSaveShipping`, etc). Uma refatoração para envio de payload único poderia reduzir a latência total da transação.
2.  **Observabilidade:** Recomenda-se a integração deste script com ferramentas de APM (como New Relic ou Dynatrace) para correlacionar o aumento de latência no JMeter com queries lentas no banco de dados ou consumo de CPU no servidor.
3.  **Pipeline DevOps:** O script foi estruturado para ser executado em modo CLI (Non-GUI), facilitando a integração em esteiras de CI/CD (Jenkins/GitLab) para validação contínua de performance (Performance as Code).
