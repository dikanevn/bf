import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as process from 'process';

// Интерфейсы
interface Player {
    number: number;
    player: string;
}

interface RoundConfig {
    coefficient: string;  // hex строка
    BITCOIN_BLOCK_HASH: string;
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
        randomIndex: number;
        player: string;
        randomValue: string;
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

function getRoundConfig(roundNumber: number): RoundConfig {
    try {
        const configPath = path.join('rounds', roundNumber.toString(), 'd02.json');
        const d02Data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Ищем конфигурацию для конкретного раунда
        const roundConfig = d02Data.find((r: any) => r.round === roundNumber);
        
        if (!roundConfig) {
            throw new Error(`Раунд ${roundNumber} не найден в ${configPath}`);
        }

        if (!roundConfig.BITCOIN_BLOCK_HASH) {
            throw new Error(`Для раунда ${roundNumber} не указан BITCOIN_BLOCK_HASH`);
        }

        return {
            coefficient: roundConfig.coefficient,
            BITCOIN_BLOCK_HASH: roundConfig.BITCOIN_BLOCK_HASH
        };
    } catch (error) {
        console.error(`Ошибка при чтении конфигурации для раунда ${roundNumber}:`, error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

function loadPlayers(roundNumber: number): Player[] {
    try {
        const d2Path = path.join('rounds', roundNumber.toString(), 'd2.json');
        const rawData = fs.readFileSync(d2Path, 'utf-8');
        const players: Player[] = JSON.parse(rawData);

        console.log(`Загружено ${players.length} игроков из ${d2Path}`);
        return players;

    } catch (error) {
        console.error(`Ошибка при загрузке игроков для раунда ${roundNumber}:`, error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

function processRound(roundNumber: number) {
    console.log(`\nОбработка раунда ${roundNumber}`);
    
    const config = getRoundConfig(roundNumber);
    const SCALE_FACTOR = BigInt(10 ** 15);
    const COEFFICIENT = BigInt(config.coefficient);
    const players = loadPlayers(roundNumber);
    const blockHash = config.BITCOIN_BLOCK_HASH;

    if (!blockHash) {
        console.error(`Ошибка: Не указан BITCOIN_BLOCK_HASH для раунда ${roundNumber}`);
        process.exit(1);
    }

    const TOTAL_PLAYERS = BigInt(players.length) * SCALE_FACTOR;
    let WIN_CHANCE = COEFFICIENT / TOTAL_PLAYERS;

    if (WIN_CHANCE > BigInt(1)) {
        console.warn('Вероятность выигрыша > 1, установлена на 1');
        WIN_CHANCE = BigInt(1);
    }

    console.log(`Всего игроков (масштабированное): ${TOTAL_PLAYERS}`);
    console.log(`Коэффициент: ${config.coefficient} (${COEFFICIENT})`);
    console.log(`Используется хэш блока: ${blockHash}`);

    const MAX_256_BIT = BigInt(2) ** BigInt(256);
    const WIN_THRESHOLD = (MAX_256_BIT * COEFFICIENT) / TOTAL_PLAYERS;
    
    const percentNumerator = COEFFICIENT * BigInt(10000000000000000) * BigInt(100);
    const percentDenominator = TOTAL_PLAYERS;
    const percentBigInt = percentNumerator / percentDenominator;
    
    const percentString = percentBigInt.toString();
    const integerPart = percentString.slice(0, -16) || '0';
    const decimalPart = percentString.slice(-16).replace(/0+$/, '');
    
    const formattedPercent = decimalPart 
        ? `${integerPart}.${decimalPart}`
        : integerPart;
    
    console.log(`Порог выигрыша (hex): 0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`);
    console.log(`Порог выигрыша (%): ${formattedPercent} %`);

    const shuffledPlayers = shuffleArray(players, blockHash);
    const randomNumbers = generateRandomNumbers(blockHash, players.length);

    const eligibleWinners = randomNumbers
        .map((num, i) => ({ index: i, value: num }))
        .filter(entry => entry.value <= WIN_THRESHOLD);

    const winnerIndices = new Set(eligibleWinners.map(w => w.index));

    console.log(`Количество победителей: ${eligibleWinners.length}`);

    const coefficientString = COEFFICIENT.toString();
    const coefficientIntegerPart = coefficientString.slice(0, -15) || '0';
    const coefficientDecimalPart = coefficientString.slice(-15).replace(/0+$/, '');
    
    const formattedCoefficient = coefficientDecimalPart 
        ? `${coefficientIntegerPart}.${coefficientDecimalPart}`
        : coefficientIntegerPart;

    const roundDir = path.join('rounds', roundNumber.toString());
    fs.mkdirSync(roundDir, { recursive: true });

    const auditData: AuditData = {
        blockHash,
        threshold: `0x${WIN_THRESHOLD.toString(16).padStart(64, '0')}`,
        thresholdPercent: `${formattedPercent}%`,
        totalPlayers: Number(TOTAL_PLAYERS / SCALE_FACTOR),
        coefficient: formattedCoefficient,
        coefficientHex: config.coefficient,
        winnersCount: eligibleWinners.length,
        randomNumbers: randomNumbers.map((value, index) => ({
            number: shuffledPlayers[index].number,
            randomIndex: index,
            player: shuffledPlayers[index].player,
            randomValue: `0x${value.toString(16).padStart(64, '0')}`,
            isWinner: winnerIndices.has(index)
        }))
        .sort((a, b) => a.number - b.number)
    };
    
    fs.writeFileSync(
        path.join(roundDir, 'd3_audit.json'),
        JSON.stringify(auditData, null, 2)
    );

    const results = eligibleWinners
        .map(entry => ({
            number: shuffledPlayers[entry.index].number,
            player: shuffledPlayers[entry.index].player,
            randomValue: `0x${entry.value.toString(16).padStart(64, '0')}`
        }))
        .sort((a, b) => a.number - b.number);

    fs.writeFileSync(
        path.join(roundDir, 'd3.json'),
        JSON.stringify(results, null, 2)
    );
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Укажите номера раундов через запятую');
        console.error('Пример: ts-node d05.ts 1,2,3');
        process.exit(1);
    }

    const roundNumbers = args[0].split(',').map(Number);
    if (roundNumbers.some(isNaN)) {
        console.error('Некорректные номера раундов');
        process.exit(1);
    }

    roundNumbers.forEach(roundNumber => {
        processRound(roundNumber);
    });
}

main(); 