#!/bin/bash
set -e

# Inicia o servidor em background
ollama serve &

# Captura o PID do servidor
OLLAMA_PID=$!

# Espera o servidor iniciar
sleep 5

# Baixa o modelo desejado (ignora falha se já tiver sido baixado antes)
ollama pull deepseek-coder:6.7b-instruct || true

# Espera o servidor continuar em primeiro plano
wait $OLLAMA_PID
