import * as fs from 'fs';
import * as crypto from 'crypto';

interface Player {
    number: number;
    player: string;
}

// Конфигурация
const COEFFICIENT = 2; // Желаемое количество победителей
const BITCOIN_BLOCK_HASH = '00000000000000000001749dc0ab5f2bb8eaea803f8a087bf2be7ec3bb32139b';

function generateRandomNumbers(seed: string, count: number): number[] {
    const shake = crypto.createHash('shake256', { outputLength: count * 8 });
    shake.update(seed);
    const hash = shake.digest('hex');
    const numbers: number[] = [];
    
    for (let i = 0; i < count; i++) {
        const hexPart = hash.slice(i * 16, (i + 1) * 16);
        const value = BigInt('0x' + hexPart);
        // Сжатие до диапазона 0-1
        numbers.push(Number(value) / Number(BigInt('0xFFFFFFFFFFFFFFFF')));
    }
    
    return numbers;
}

function selectRandomPlayers() {
    try {
        const rawData = fs.readFileSync('d2.json', 'utf-8');
        const players: Player[] = JSON.parse(rawData);
        
        const totalPlayers = players.length;
        const winChance = COEFFICIENT / totalPlayers; // Вероятность выигрыша для каждого игрока

        console.log(`Всего игроков: ${totalPlayers}`);
        console.log(`Коэффициент (желаемое кол-во победителей): ${COEFFICIENT}`);
        console.log(`Шанс выигрыша для каждого: ${(winChance * 100).toFixed(4)}%`);
        console.log(`Используется хэш блока: ${BITCOIN_BLOCK_HASH}`);

        // Генерируем случайные числа для каждого игрока
        const randomNumbers = generateRandomNumbers(BITCOIN_BLOCK_HASH, totalPlayers);
        
        // Определяем победителей
        const winners = randomNumbers
            .map((value, index) => ({ index, value }))
            .filter(item => item.value < winChance)
            .map(item => item.index);

        // Формируем финальный список
        const selected = winners.map((originalIndex, newIndex) => ({
            number: newIndex + 1,
            player: players[originalIndex].player,
            originalNumber: players[originalIndex].number,
            randomValue: randomNumbers[originalIndex],
            winThreshold: winChance
        }));

        console.log(`Выбрано ${selected.length} победителей`);
        
        // Сохраняем результат
        fs.writeFileSync(
            'd3.json',
            JSON.stringify({
                blockHash: BITCOIN_BLOCK_HASH,
                totalPlayers,
                coefficient: COEFFICIENT,
                winChance,
                selectedCount: selected.length,
                selected,
                algorithm: 'SHAKE256'
            }, null, 2),
            'utf-8'
        );
        
        console.log('Результаты сохранены в d3.json');

    } catch (error) {
        console.error('Ошибка при обработке данных:', error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
    }
}

selectRandomPlayers();
