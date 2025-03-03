import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface D02Round {
    round: number;
    winnersCount: number;
    BITCOIN_BLOCK_HASH: string;
    lottery_numbers?: number[];
    winning_numbers?: number[];
    shuffled_numbers?: number[];
    remaining_numbers?: number[];
    last_selected_index?: number;
}

function generateRandomNumbers(bitcoinHash: string, count: number, maxNumber: number): [number[], number[], number] {
    const numbersInOrder: number[] = [];
    const shuffledArray = Array.from({ length: maxNumber }, (_, i) => i + 1);
    let currentHash = bitcoinHash;
    let availableCount = maxNumber;
    
    for (let i = 0; i < count; i++) {
        const hash = crypto.createHash('sha256')
            .update(currentHash)
            .digest('hex');
            
        // Генерируем случайный индекс в пределах оставшихся чисел
        const randomIndex = parseInt(hash.slice(0, 8), 16) % availableCount;
        
        // Выбираем число из доступного диапазона
        const selectedNumber = shuffledArray[randomIndex];
        numbersInOrder.push(selectedNumber);
        
        // Перемещаем выбранное число в конец доступного диапазона
        [shuffledArray[randomIndex], shuffledArray[availableCount - 1]] = 
        [shuffledArray[availableCount - 1], shuffledArray[randomIndex]];
        
        // Уменьшаем количество доступных чисел
        availableCount--;
        
        // Обновляем хеш для следующей итерации
        currentHash = hash;
    }
    
    return [numbersInOrder, shuffledArray, availableCount];
}

function formatJson(data: any): string {
    const jsonString = JSON.stringify(data, (key, value) => {
        if (key === 'lottery_numbers' || key === 'winning_numbers' || key === 'shuffled_numbers' || key === 'remaining_numbers') {
            return Array.isArray(value) ? value : value;
        }
        return value;
    }, 2);

    return jsonString.replace(
        /("lottery_numbers"|"winning_numbers"|"shuffled_numbers"|"remaining_numbers"): \[\n\s+[\s\S]*?\n\s+\]/g,
        (match, key) => {
            const array = JSON.parse(match.substring(match.indexOf('['))).join(',');
            return `${key}: [${array}]`;
        }
    );
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Пожалуйста, укажите номер папки');
        process.exit(1);
    }

    const folderNumber = args[0];
    const filePath = path.join(process.cwd(), 'rounds', folderNumber, 'd02.json');

    try {
        console.log(`Обрабатываем файл: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent) as D02Round[];

        const firstRound = data[0];
        if (!firstRound || !firstRound.winnersCount) {
            throw new Error('Не найден первый раунд или winnersCount');
        }

        console.log(`Найден первый раунд, winnersCount: ${firstRound.winnersCount}`);

        // Добавляем массив чисел от 1 до winnersCount + 1000
        firstRound.lottery_numbers = Array.from(
            { length: firstRound.winnersCount + 1000 },
            (_, i) => i + 1
        );

        console.log(`Добавлен lottery_numbers массив длиной ${firstRound.lottery_numbers.length}`);

        // Генерируем случайные числа на основе Bitcoin хеша
        if (firstRound.BITCOIN_BLOCK_HASH) {
            console.log(`Используем Bitcoin хеш: ${firstRound.BITCOIN_BLOCK_HASH}`);
            const [selectedNumbers, shuffledNumbers, lastIndex] = generateRandomNumbers(
                firstRound.BITCOIN_BLOCK_HASH,
                firstRound.winnersCount,
                firstRound.winnersCount + 1000
            );
            firstRound.winning_numbers = selectedNumbers;
            firstRound.shuffled_numbers = shuffledNumbers;
            firstRound.remaining_numbers = shuffledNumbers.slice(0, shuffledNumbers.length - firstRound.winnersCount);
            firstRound.last_selected_index = firstRound.lottery_numbers[firstRound.lottery_numbers.length - 1];
            
            console.log(`Сгенерированы массивы:`);
            console.log(`- winning_numbers: ${selectedNumbers.length} чисел`);
            console.log(`- shuffled_numbers: ${shuffledNumbers.length} чисел`);
            console.log(`- remaining_numbers: ${firstRound.remaining_numbers.length} чисел`);
            console.log(`- last_selected_index: ${firstRound.last_selected_index}`);
        }

        const formattedJson = formatJson(data);
        fs.writeFileSync(filePath, formattedJson);
        console.log('Файл успешно обновлен');

    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

main(); 