#!/bin/bash

# Скрипт для настройки IPFS для работы при включенном VPN
# Устанавливает локальные публичные шлюзы и настраивает IPFS для работы с ними

# Установка пути к IPFS
export IPFS_PATH=/home/dikanevn/u1/yd/.ipfs

# Настройка публичных шлюзов
echo "Настройка публичных шлюзов IPFS..."
ipfs config --json Gateway.PublicGateways '{
  "ipfs.io": {
    "Paths": ["/ipfs", "/ipns"],
    "UseSubdomains": true
  },
  "dweb.link": {
    "Paths": ["/ipfs", "/ipns"],
    "UseSubdomains": false
  },
  "cf-ipfs.com": {
    "Paths": ["/ipfs", "/ipns"],
    "UseSubdomains": false
  },
  "gateway.ipfs.io": {
    "Paths": ["/ipfs", "/ipns"],
    "UseSubdomains": true
  }
}'

# Настройка Bootstrap узлов (добавление дополнительных узлов для лучшей связности)
echo "Добавление дополнительных Bootstrap узлов..."
ipfs bootstrap add /dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN
ipfs bootstrap add /dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa
ipfs bootstrap add /dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb
ipfs bootstrap add /dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt

# Настройка API для доступа извне WSL
echo "Настройка API для доступа извне WSL..."
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'

# Настройка Addresses.API для прослушивания всех интерфейсов
echo "Настройка API для прослушивания всех интерфейсов..."
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

# Настройка Addresses.Gateway для прослушивания всех интерфейсов
echo "Настройка Gateway для прослушивания всех интерфейсов..."
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# Перезапуск IPFS демона
echo "Перезапуск IPFS демона..."
pkill -f ipfs
sleep 2
ipfs daemon --enable-gc &

echo "Настройка IPFS для работы с VPN завершена!"
echo "Теперь вы можете использовать IPFS даже при включенном VPN."
echo "Для доступа к файлам используйте: http://localhost:8080/ipfs/YOUR_CID" 