import * as fs from 'fs';
import * as process from 'process';

interface Round {
    round: number;
    coefficient: string;  // hex строка с префиксом 0x
    value: string;       // десятичное значение с точкой
    BITCOIN_BLOCK_HASH: string;
    BITCOIN_BLOCK_NUMBER: string;
    BITCOIN_BLOCK_TIME: string;  // Время блока биткоина
    firstTicketsBuyTime: string;
    lastTicketsBuyTime: string;
    tokenName: string;
    IS_TOKEN_LAUNCHED: boolean;
    BLOCK_DELAY_MINUTES_AFTER_GAME_START: number; // Задержка в минутах после начала игры до получения блока
    TOTAL_TICKETS: string; // Общее количество билетов
    TOKEN_ADDRESS: string; // Адрес токена
    RNG_ALGORITHM: string; // Добавляем новое поле
}

function generateRounds(): Round[] {
    const rounds: Round[] = [];
    const SCALE_FACTOR = BigInt(10 ** 15);
    const MULTIPLIER = BigInt(0x37cd9d7c6a800); // Множитель для следующих раундов
    
    let currentRound = 1;
    let currentCoefficient = BigInt(0x28a2587c9e58000); // Начальное значение (183 * 10^15)
    
    while (currentCoefficient > 0) {
        // Форматируем значение с точкой
        const coefficientString = currentCoefficient.toString();
        const integerPart = coefficientString.slice(0, -15) || '0';
        const decimalPart = coefficientString.slice(-15).replace(/0+$/, '');
        
        const formattedValue = decimalPart 
            ? `${integerPart}.${decimalPart}`
            : integerPart;

        rounds.push({
            round: currentRound,
            coefficient: `0x${currentCoefficient.toString(16).toUpperCase()}`,
            value: formattedValue,
            BITCOIN_BLOCK_HASH: "",
            BITCOIN_BLOCK_NUMBER: "",
            BITCOIN_BLOCK_TIME: "",  // Пустое значение для времени блока
            firstTicketsBuyTime: "",
            lastTicketsBuyTime: "",
            tokenName: "",
            IS_TOKEN_LAUNCHED: false,
            BLOCK_DELAY_MINUTES_AFTER_GAME_START: 30, // 30 минут задержки после начала игры до получения блока
            TOTAL_TICKETS: "", // Пустое значение для общего количества билетов
            TOKEN_ADDRESS: "", // Пустое значение для адреса токена
            RNG_ALGORITHM: "SHA-256(SHA-256(BTC_HASH + Solana_pubkey[1:-4]))"
        });

        // Вычисляем следующий коэффициент
        currentCoefficient = currentCoefficient * MULTIPLIER / SCALE_FACTOR;
        currentRound++;
    }

    return rounds;
}

function main() {
    const outputFile = 'd02.json';
    
    // Проверяем существование файла
    if (fs.existsSync(outputFile)) {
        console.error(`Ошибка: Файл ${outputFile} уже существует!`);
        console.error('Удалите существующий файл вручную, если хотите его перезаписать.');
        process.exit(1);
    }
    
    const rounds = generateRounds();
    
    // Сохраняем результаты только если файл не существует
    fs.writeFileSync(
        outputFile,
        JSON.stringify(rounds, null, 2),
        'utf-8'
    );

    console.log(`Сгенерировано ${rounds.length} раундов`);
    console.log(`Результаты сохранены в ${outputFile}`);
    
    // Выводим первые несколько раундов для проверки
    console.log('\nПервые 3 раунда:');
    rounds.slice(0, 3).forEach(round => {
        console.log(`Раунд ${round.round}: ${round.coefficient} (${round.value})`);
    });
}

main(); 