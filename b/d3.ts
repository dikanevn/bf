import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const COEFFICIENT = 101; // Примерное ожидаемое количество победителей

// Чтение списка игроков из d2.json
const d2Path = path.join(__dirname, 'd2.json');
let players: { number: number, player: string }[] = [];
try {
    const data = fs.readFileSync(d2Path, 'utf8');
    players = JSON.parse(data);
} catch (error) {
    console.error('Ошибка при чтении файла d2.json:', error);
    process.exit(1);
}

const TOTAL_PLAYERS = players.length;
let WIN_CHANCE = COEFFICIENT / TOTAL_PLAYERS; // Вероятность выигрыша

// Проверка вероятности выигрыша
if (WIN_CHANCE > 1) {
    console.warn('Вероятность выигрыша > 1, установлена на 1');
    WIN_CHANCE = 1;
}

let BITCOIN_BLOCK_HASH: string = ''; // Введите хэш здесь или оставьте пустым для тестов

// Генерация случайного хэша, если не задан вручную. Для тестов.
if (!BITCOIN_BLOCK_HASH) {
    console.warn('Хэш блока не предоставлен, генерируется случайный хэш для тестирования');
    BITCOIN_BLOCK_HASH = crypto.createHash('sha256')
        .update(crypto.randomBytes(32))
        .digest('hex');
    console.log(`Сгенерирован случайный хэш: ${BITCOIN_BLOCK_HASH}`);
} else {
    // Приводим хэш к нижнему регистру
    BITCOIN_BLOCK_HASH = BITCOIN_BLOCK_HASH.toLowerCase();
    
    // Проверяем, что хэш содержит только строчные hex символы и имеет длину 64
    if (!BITCOIN_BLOCK_HASH.match(/^[0-9a-f]{64}$/)) {
        console.error('Ошибка: Некорректный Bitcoin block hash! Хэш должен содержать 64 символа в нижнем регистре [0-9a-f]');
        process.exit(1);
    }
    console.log(`Используется предоставленный хэш: ${BITCOIN_BLOCK_HASH}`);
}

function bufferToBigInt(buffer: Buffer): bigint {
    let hex = '';
    // Преобразуем каждый байт в hex строку
    for (const byte of buffer) {
        hex += byte.toString(16).padStart(2, '0');
    }
    return BigInt('0x' + hex);
}

function shuffleArray<T>(array: T[], seed: string): T[] {
    const shuffled = [...array];
    
    // Алгоритм Фишера-Йетса с использованием HMAC для лучшего распределения
    for (let i = shuffled.length - 1; i > 0; i--) {
        // Генерируем случайное число для текущей позиции
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        // Используем HMAC-SHA256 вместо простого SHA-256
        const hmac = crypto.createHmac('sha256', seed)
            .update(indexBuffer)
            .digest();
        
        // Используем весь хэш для получения максимально случайного индекса
        const hashBigInt = bufferToBigInt(hmac);
        const j = Number(hashBigInt % BigInt(i + 1));
        
        // Меняем местами элементы
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

function generateRandomNumbers(seed: string, count: number): bigint[] {
    const numbers: bigint[] = [];
    const seedBuffer = Buffer.from(seed, 'hex');

    // Генерируем случайные числа для каждого индекса
    for (let i = 0; i < count; i++) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        // Двойной SHA-256 для лучшей случайности
        const numberHash = crypto.createHash('sha256')
            .update(
                crypto.createHash('sha256')
                    .update(Buffer.concat([seedBuffer, indexBuffer]))
                    .digest()
            )
            .digest();
        
        numbers.push(bufferToBigInt(numberHash));
    }

    return numbers;
}

function selectRandomPlayers() {
    console.log(`Всего игроков: ${TOTAL_PLAYERS}`);
    console.log(`Коэффициент (примерное ожидаемое кол-во победителей): ${COEFFICIENT}`);
    console.log(`Используется хэш блока: ${BITCOIN_BLOCK_HASH}`);

    // Вычисляем порог в hex, используя 2^256 вместо (2^256 - 1)
    const MAX_256_BIT = BigInt(2) ** BigInt(256);
    const WIN_THRESHOLD = (MAX_256_BIT * BigInt(COEFFICIENT)) / BigInt(TOTAL_PLAYERS);
    
    console.log(`Порог выигрыша (hex): 0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`);

    // Сначала перемешиваем список игроков
    const shuffledPlayers = shuffleArray(players, BITCOIN_BLOCK_HASH);
    
    // Генерация случайных чисел для перемешанного списка
    const randomNumbers = generateRandomNumbers(BITCOIN_BLOCK_HASH, TOTAL_PLAYERS);

    // Сохраняем все случайные числа для аудита с учетом перемешивания
    const auditData = {
        blockHash: BITCOIN_BLOCK_HASH,
        threshold: `0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`,
        totalPlayers: TOTAL_PLAYERS,
        coefficient: COEFFICIENT,
        randomNumbers: randomNumbers.map((value, index) => ({
            index,
            player: shuffledPlayers[index].player,
            number: shuffledPlayers[index].number,
            value: `0x${value.toString(16).padStart(64, '0')}`
        }))
    };
    
    const auditPath = path.join(__dirname, 'd3_audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2));

    // Фильтрация победителей по порогу
    const eligibleWinners = randomNumbers
        .map((num, i) => ({ index: i, value: num }))
        .filter(entry => entry.value <= WIN_THRESHOLD);

    console.log(`Выбрано ${eligibleWinners.length} победителей`);
    
    // Формируем результаты для сохранения, используя shuffledPlayers
    const results = eligibleWinners.map((entry, idx) => ({
        number: shuffledPlayers[entry.index].number,
        player: shuffledPlayers[entry.index].player,
        randomValue: `0x${entry.value.toString(16).padStart(64, '0')}`
    }));

    // Сохраняем результаты в файл
    const d3ResultsPath = path.join(__dirname, 'd3.json');
    fs.writeFileSync(d3ResultsPath, JSON.stringify(results, null, 2));
}

selectRandomPlayers();
