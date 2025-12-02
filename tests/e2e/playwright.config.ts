import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs', // Aponta para a pasta onde colocamos o arquivo
  fullyParallel: true,
  reporter: 'html',   // Gera relatório HTML bonito
  use: {
    baseURL: 'https://demowebshop.tricentis.com',
    trace: 'on-first-retry', // Grava o "filme" do teste se falhar na primeira vez
    screenshot: 'only-on-failure', // Tira foto se quebrar
    headless: true, // Rode false se quiser ver o navegador abrindo sempre
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
