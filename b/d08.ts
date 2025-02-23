import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as process from 'process';
import bs58 from 'bs58';

interface Player {
    number: number;
    player: string;  // адрес игрока
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
        player: string;
        randomValue: string;
        isWinner: boolean;
    }>;
}

function bufferToBigInt(buffer: Buffer): bigint {
    const hex = buffer.toString('hex').padStart(buffer.length * 2, '0');
    return BigInt('0x' + hex);
}

function generateRandomNumberForAddress(seed: string, address: string): bigint {
    const seedBuffer = Buffer.from(seed.padStart(64, '0'), 'hex');
    
    // Декодируем base58 адрес в байты
    const addressBytes = bs58.decode(address);
    
    // Убираем первый байт (версия) и последние 4 байта (контрольная сумма)
    const pubKeyBytes = addressBytes.slice(1, -4);
    
    const hash1 = crypto.createHash('sha256')
        .update(Buffer.concat([seedBuffer, Buffer.from(pubKeyBytes)]))
        .digest();
    
    const hash2 = crypto.createHash('sha256')
        .update(hash1)
        .digest();
    
    return bufferToBigInt(hash2);
}

function getRoundConfig(roundNumber: number): { coefficient: string; BITCOIN_BLOCK_HASH: string } {
    try {
        const configPath = path.join('rounds', roundNumber.toString(), 'd02.json');
        const d02Data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
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

    // Генерируем случайные числа для каждого адреса
    const playerResults = players.map(player => {
        const randomValue = generateRandomNumberForAddress(blockHash, player.player);
        return {
            number: player.number,
            player: player.player,
            randomValue,
            isWinner: randomValue <= WIN_THRESHOLD
        };
    }).sort((a, b) => a.number - b.number);

    const winners = playerResults.filter(p => p.isWinner);
    console.log(`Количество победителей: ${winners.length}`);

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
        winnersCount: winners.length,
        randomNumbers: playerResults.map(result => ({
            number: result.number,
            player: result.player,
            randomValue: `0x${result.randomValue.toString(16).padStart(64, '0')}`,
            isWinner: result.isWinner
        }))
    };
    
    fs.writeFileSync(
        path.join(roundDir, 'd3_audit.json'),
        JSON.stringify(auditData, null, 2)
    );

    const results = winners.map(winner => ({
        number: winner.number,
        player: winner.player,
        randomValue: `0x${winner.randomValue.toString(16).padStart(64, '0')}`
    })).sort((a, b) => a.number - b.number);

    fs.writeFileSync(
        path.join(roundDir, 'd3.json'),
        JSON.stringify(results, null, 2)
    );
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Укажите номера раундов через запятую');
        console.error('Пример: ts-node d08.ts 1,2,3');
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