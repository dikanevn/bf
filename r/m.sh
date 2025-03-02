#!/bin/bash

# Загружаем RPC URL из .env файла
RPC_URL=$(grep "RPC_ENDPOINT_QUIKNODE" .env | cut -d'=' -f2)

# Функция для проверки баланса
check_balance() {
  echo "Проверка баланса..."
  solana balance -u $RPC_URL
}

# Функция для деплоя программы
deploy_program() {
  echo "Деплой программы..."
  solana program deploy target/deploy/r.so -u $RPC_URL
}

# Функция для сборки программы
build_program() {
  echo "Сборка программы..."
  cargo build-sbf
}

# Проверяем аргументы
if [ "$1" == "balance" ]; then
  check_balance
elif [ "$1" == "deploy" ]; then
  deploy_program
elif [ "$1" == "build" ]; then
  build_program
elif [ "$1" == "build-deploy" ]; then
  build_program
  deploy_program
else
  echo "Использование: ./deploy.sh [balance|deploy|build|build-deploy]"
  echo "  balance     - проверить баланс"
  echo "  deploy      - деплой программы"
  echo "  build       - сборка программы"
  echo "  build-deploy - сборка и деплой программы"
  check_balance
fi 