#!/bin/bash

# Cores para logs bonitos
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🧹 [1/6] Limpando ambiente anterior (Reset Factory)...${NC}"
docker compose down -v

echo -e "${CYAN}🏗️  [2/6] Subindo Infraestrutura (InfluxDB + Grafana)...${NC}"
docker compose up -d influxdb grafana

echo -e "${CYAN}⏳ Aguardando 15 segundos para provisionamento dos Dashboards...${NC}"
sleep 15

echo -e "${CYAN}☕ [3/6] Executando Teste Legacy (JMeter)...${NC}"
docker compose up jmeter

echo -e "${CYAN}⚡ [4/6] Executando Teste Moderno (k6)...${NC}"
docker compose up k6

echo -e "${CYAN}🎭 [5/6] Executando Frontend Performance (Playwright)...${NC}"
docker compose run --rm playwright

echo -e "${GREEN}✅ [6/6] Bateria de testes finalizada!${NC}"
echo -e "${GREEN}📊 Abrindo Dashboards no navegador...${NC}"

# Comando compatível com MacOS
open "http://localhost:3000/dashboards"
