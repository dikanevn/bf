import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as process from 'process';

// Константы
const COEFFICIENT = 0x28a2587c9e58000; // 0x28a2587c9e58000 == 183 * 10^15 в hex формате
const SCALE_FACTOR = BigInt(10 ** 15); // Множитель для масштабирования

const CONFIG = {
    BITCOIN_BLOCK_HASH: '',
    TIME_CONFIG: {
        startDate: '2025-01-17 17:14:51.000 UTC',
        endDate: '2025-01-19 18:59:39.000 UTC'
    }
};

// Интерфейсы
interface DuneData {
    result: {
        rows: Array<{
            raw_player: string;
            blocktime: string;
        }>;
    };
}

interface Player {
    number: number;
    player: string;
}

interface AuditData {
    blockHash: string;
    threshold: string;
    thresholdPercent: string;
    totalPlayers: number;
    coefficient: number | string;
    coefficientHex: string;
    winnersCount: number;
    randomNumbers: Array<{
        number: number;
        index: number;
        player: string;
        value: string;
        isWinner: boolean;
    }>;
}

// Функции для работы с криптографией
function bufferToBigInt(buffer: Buffer): bigint {
    const expectedLength = buffer.length * 2;
    let hex = '';
    for (const byte of buffer) {
        hex += byte.toString(16).padStart(2, '0');
    }
    
    if (hex.length < expectedLength) {
        hex = hex.padStart(expectedLength, '0');
    }
    
    return BigInt('0x' + hex);
}

function shuffleArray<T>(array: T[], seed: string): T[] {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        const hmac = crypto.createHmac('sha256', seed)
            .update(indexBuffer)
            .digest();
        
        const hashBigInt = bufferToBigInt(hmac);
        const j = Number(hashBigInt % BigInt(i + 1));
        
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

function generateRandomNumbers(seed: string, count: number): bigint[] {
    const numbers: bigint[] = [];
    const seedBuffer = Buffer.from(seed.padStart(64, '0'), 'hex');

    for (let i = 0; i < count; i++) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
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

// Основные функции обработки
function processPlayers(): Player[] {
    try {
        const rawData = fs.readFileSync('d1.json', 'utf-8');
        const data: DuneData = JSON.parse(rawData);

        if (!data.result?.rows) {
            throw new Error('Неверная структура данных в d1.json');
        }

        const startDate = new Date(CONFIG.TIME_CONFIG.startDate);
        const endDate = new Date(CONFIG.TIME_CONFIG.endDate);

        console.log('Временной диапазон:');
        console.log(`Начало: ${startDate.toISOString()}`);
        console.log(`Конец:  ${endDate.toISOString()}`);

        const filteredPlayers = data.result.rows
            .filter(row => {
                const timestamp = new Date(row.blocktime);
                const isInRange = timestamp >= startDate && timestamp <= endDate;
                return isInRange;
            })
            .map(row => row.raw_player)
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort();

        const numberedPlayers = filteredPlayers.map((player, index) => ({
            number: index + 1,
            player: player
        }));

        fs.writeFileSync(
            'd2.json',
            JSON.stringify(numberedPlayers, null, 2),
            'utf-8'
        );

        console.log(`Обработано ${numberedPlayers.length} уникальных игроков`);
        console.log('Результаты сохранены в d2.json');

        return numberedPlayers;

    } catch (error) {
        console.error('Ошибка при обработке данных:', error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

function selectWinners(players: Player[], blockHash: string = CONFIG.BITCOIN_BLOCK_HASH) {
    const TOTAL_PLAYERS = BigInt(players.length) * SCALE_FACTOR; // Масштабируем количество игроков
    let WIN_CHANCE = BigInt(COEFFICIENT) / TOTAL_PLAYERS;

    if (WIN_CHANCE > BigInt(1)) {
        console.warn('Вероятность выигрыша > 1, установлена на 1');
        WIN_CHANCE = BigInt(1);
    }

    if (!blockHash) {
        console.warn('Хэш блока не предоставлен, генерируется случайный хэш для тестирования');
        blockHash = crypto.createHash('sha256')
            .update(crypto.randomBytes(32))
            .digest('hex');
        console.log(`Сгенерирован случайный хэш: ${blockHash}`);
    } else {
        blockHash = blockHash.toLowerCase();
        
        if (!blockHash.match(/^[0-9a-f]{64}$/)) {
            console.error('Ошибка: Некорректный Bitcoin block hash! Хэш должен содержать 64 символа в нижнем регистре [0-9a-f]');
            process.exit(1);
        }
        console.log(`Используется предоставленный хэш: ${blockHash}`);
    }

    console.log(`Всего игроков (масштабированное): ${TOTAL_PLAYERS}`);
    console.log(`Коэффициент: 0x${COEFFICIENT.toString(16).toUpperCase()} (${COEFFICIENT})`);
    console.log(`Используется хэш блока: ${blockHash}`);

    const MAX_256_BIT = BigInt(2) ** BigInt(256);
    const WIN_THRESHOLD = (MAX_256_BIT * BigInt(COEFFICIENT)) / TOTAL_PLAYERS;
    
    // Вычисляем процент с максимальной точностью, используя BigInt для всех вычислений
    const percentNumerator = BigInt(COEFFICIENT) * BigInt(10000000000000000) * BigInt(100);
    const percentDenominator = TOTAL_PLAYERS;
    const percentBigInt = percentNumerator / percentDenominator;
    
    // Преобразуем в строку с фиксированной точкой (16 знаков после запятой)
    const percentString = percentBigInt.toString();
    const integerPart = percentString.slice(0, -16) || '0';
    const decimalPart = percentString.slice(-16).replace(/0+$/, '');
    
    const formattedPercent = decimalPart 
        ? `${integerPart}.${decimalPart}`
        : integerPart;
    
    console.log(`Порог выигрыша (hex): 0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`);
    console.log(`Порог выигрыша (%): ${formattedPercent} %`);

    const shuffledPlayers = shuffleArray(players, blockHash);
    const randomNumbers = generateRandomNumbers(blockHash, Number(players.length));

    const eligibleWinners = randomNumbers
        .map((num, i) => ({ index: i, value: num }))
        .filter(entry => entry.value <= WIN_THRESHOLD);

    const winnerIndices = new Set(eligibleWinners.map(w => w.index));

    console.log(`Количество победителей: ${eligibleWinners.length}`);

    // Форматируем coefficient как строку с фиксированной точкой
    const coefficientBigInt = BigInt(COEFFICIENT);
    const coefficientString = coefficientBigInt.toString();
    const coefficientIntegerPart = coefficientString.slice(0, -15) || '0';
    const coefficientDecimalPart = coefficientString.slice(-15).replace(/0+$/, '');
    
    const formattedCoefficient = coefficientDecimalPart 
        ? `${coefficientIntegerPart}.${coefficientDecimalPart}`
        : coefficientIntegerPart;

    // Сохраняем аудит с масштабированными значениями
    const auditData: AuditData = {
        blockHash,
        threshold: `0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`,
        thresholdPercent: `${formattedPercent}%`,
        totalPlayers: Number(TOTAL_PLAYERS / SCALE_FACTOR),
        coefficient: formattedCoefficient,
        coefficientHex: `0x${COEFFICIENT.toString(16).toUpperCase()}`,
        winnersCount: eligibleWinners.length,
        randomNumbers: randomNumbers.map((value, index) => ({
            number: shuffledPlayers[index].number,
            index,
            player: shuffledPlayers[index].player,
            value: `0x${value.toString(16).padStart(64, '0')}`,
            isWinner: winnerIndices.has(index)
        }))
        .sort((a, b) => a.number - b.number)
    };
    
    fs.writeFileSync('d3_audit.json', JSON.stringify(auditData, null, 2));

    // Формируем и сохраняем результаты
    const results = eligibleWinners
        .map(entry => ({
            number: shuffledPlayers[entry.index].number,
            player: shuffledPlayers[entry.index].player,
            randomValue: `0x${entry.value.toString(16).padStart(64, '0')}`
        }))
        .sort((a, b) => a.number - b.number);

    fs.writeFileSync('d3.json', JSON.stringify(results, null, 2));
}

// Основной процесс
function main() {
    const players = processPlayers();
    selectWinners(players);
}

main(); 