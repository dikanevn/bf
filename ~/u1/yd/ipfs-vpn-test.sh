#!/bin/bash

# Скрипт для тестирования доступности IPFS через VPN
# Использует локальный шлюз для доступа к файлам

# Установка пути к IPFS
export IPFS_PATH=/home/dikanevn/u1/yd/.ipfs

# Проверка статуса IPFS демона
echo "Проверка статуса IPFS демона..."
if pgrep -x "ipfs" > /dev/null
then
    echo "IPFS демон запущен"
else
    echo "IPFS демон не запущен. Запускаю..."
    ipfs daemon --enable-gc &
    sleep 5
fi

# Проверка доступности локального шлюза
echo "Проверка доступности локального шлюза..."
if curl -s -f -m 5 http://localhost:8080/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn > /dev/null
then
    echo "Локальный шлюз доступен"
else
    echo "Локальный шлюз недоступен. Проверьте настройки IPFS."
    exit 1
fi

# Загрузка тестового файла в IPFS
echo "Загрузка тестового файла в IPFS..."
echo "Тестовый файл для проверки IPFS через VPN" > /tmp/ipfs-vpn-test.txt
CID=$(ipfs add -q /tmp/ipfs-vpn-test.txt)
echo "Файл загружен с CID: $CID"

# Проверка доступности файла через локальный шлюз
echo "Проверка доступности файла через локальный шлюз..."
if curl -s -f -m 5 http://localhost:8080/ipfs/$CID > /dev/null
then
    echo "Файл доступен через локальный шлюз"
    echo "Для доступа к файлу используйте: http://localhost:8080/ipfs/$CID"
else
    echo "Файл недоступен через локальный шлюз. Проверьте настройки IPFS."
fi

# Проверка доступности файла через публичные шлюзы
echo "Проверка доступности файла через публичные шлюзы..."
GATEWAYS=("https://ipfs.io/ipfs/" "https://dweb.link/ipfs/" "https://cf-ipfs.com/ipfs/" "https://gateway.ipfs.io/ipfs/")

for gateway in "${GATEWAYS[@]}"
do
    echo "Проверка шлюза: $gateway"
    if curl -s -f -m 10 "$gateway$CID" > /dev/null
    then
        echo "Файл доступен через шлюз: $gateway$CID"
    else
        echo "Файл недоступен через шлюз: $gateway$CID"
    fi
done

echo "Тестирование завершено!"
echo "Если файл доступен через локальный шлюз, но недоступен через публичные шлюзы,"
echo "используйте локальный шлюз для доступа к файлам при включенном VPN:"
echo "http://localhost:8080/ipfs/YOUR_CID" 