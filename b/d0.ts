import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as process from 'process';

const ROUND = 1;
// Константы
const COEFFICIENT = 0xB7; // 183 в hex формате


const CONFIG = {
    BITCOIN_BLOCK_HASH: '81d68e36cc1ba5d895b9af7d7acdd8031030f02dceacac30ff3546bb8611b5cc',
    TIME_CONFIG: {
        startDate: '2025-01-17 17:14:51.000 UTC',
        endDate: '2025-01-19 18:59:39.000 UTC'
    }
};

// Проверка корректности дат
try {
    new Date(CONFIG.TIME_CONFIG.startDate);
    new Date(CONFIG.TIME_CONFIG.endDate);
} catch (e) {
    console.error('Ошибка: Некорректный формат даты!');
    process.exit(1);
}

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
    coefficient: number;
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
    // Обеспечиваем фиксированную длину hex-строки, равную длине буфера * 2
    const expectedLength = buffer.length * 2;
    let hex = '';
    for (const byte of buffer) {
        hex += byte.toString(16).padStart(2, '0');
    }
    
    // Проверяем и дополняем до ожидаемой длины
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
    // Убеждаемся, что seed имеет правильную длину
    const seedBuffer = Buffer.from(seed.padStart(64, '0'), 'hex');

    for (let i = 0; i < count; i++) {
        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32BE(i, 0);
        
        // SHA-256 всегда возвращает 32 байта (64 hex-символа)
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
    const TOTAL_PLAYERS = players.length;
    let WIN_CHANCE = COEFFICIENT / TOTAL_PLAYERS;

    if (WIN_CHANCE > 1) {
        console.warn('Вероятность выигрыша > 1, установлена на 1');
        WIN_CHANCE = 1;
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

    console.log(`Всего игроков: ${TOTAL_PLAYERS}`);
    console.log(`Коэффициент: 0x${COEFFICIENT.toString(16).toUpperCase()} (${COEFFICIENT})`);
    console.log(`Используется хэш блока: ${blockHash}`);

    const MAX_256_BIT = BigInt(2) ** BigInt(256);
    const WIN_THRESHOLD = (MAX_256_BIT * BigInt(COEFFICIENT)) / BigInt(TOTAL_PLAYERS);
    
    // Вычисляем процент
    const thresholdPercent = (Number(COEFFICIENT) / TOTAL_PLAYERS * 100).toFixed(2);
    
    console.log(`Порог выигрыша (hex): 0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`);
    console.log(`Порог выигрыша (%): ${thresholdPercent}%`);

    const shuffledPlayers = shuffleArray(players, blockHash);
    const randomNumbers = generateRandomNumbers(blockHash, TOTAL_PLAYERS);

    const eligibleWinners = randomNumbers
        .map((num, i) => ({ index: i, value: num }))
        .filter(entry => entry.value <= WIN_THRESHOLD);

    const winnerIndices = new Set(eligibleWinners.map(w => w.index));

    console.log(`Количество победителей: ${eligibleWinners.length}`);

    // Сохраняем аудит
    const auditData: AuditData = {
        blockHash,
        threshold: `0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`,
        thresholdPercent: `${thresholdPercent}%`,
        totalPlayers: TOTAL_PLAYERS,
        coefficient: COEFFICIENT,
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
            // Всегда используем 64 символа для hex-представления
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