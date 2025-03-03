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

        for (let i = 0; i < data.length; i++) {
            const currentRound = data[i];
            if (!currentRound || !currentRound.winnersCount) {
                throw new Error(`Не найден раунд ${i} или winnersCount`);
            }

            console.log(`Обрабатываем раунд ${currentRound.round}, winnersCount: ${currentRound.winnersCount}`);

            if (i === 0) {
                // Для первого раунда используем фиксированный массив 1-1000
                currentRound.lottery_numbers = Array.from(
                    { length: 1000 },
                    (_, i) => i + 1
                );
                currentRound.last_selected_index = 1000;
            } else {
                // Для последующих раундов используем remaining_numbers из предыдущего раунда
                const previousRound = data[i - 1];
                if (!previousRound.remaining_numbers || previousRound.last_selected_index === undefined) {
                    throw new Error(`Не найдены remaining_numbers или last_selected_index в предыдущем раунде ${i-1}`);
                }

                // Создаем новый массив из remaining_numbers предыдущего раунда
                currentRound.lottery_numbers = [...previousRound.remaining_numbers];

                // Добавляем новые элементы, начиная с last_selected_index + 1
                const startIndex = previousRound.last_selected_index + 1;
                const newNumbers = Array.from(
                    { length: currentRound.winnersCount },
                    (_, i) => startIndex + i
                );
                currentRound.lottery_numbers.push(...newNumbers);
            }

            console.log(`Добавлен lottery_numbers массив длиной ${currentRound.lottery_numbers.length}`);

            // Генерируем случайные числа на основе Bitcoin хеша
            if (currentRound.BITCOIN_BLOCK_HASH) {
                console.log(`Используем Bitcoin хеш: ${currentRound.BITCOIN_BLOCK_HASH}`);
                const [selectedNumbers, shuffledNumbers, lastIndex] = generateRandomNumbers(
                    currentRound.BITCOIN_BLOCK_HASH,
                    currentRound.winnersCount,
                    currentRound.winnersCount + 1000
                );
                currentRound.winning_numbers = selectedNumbers;
                currentRound.shuffled_numbers = shuffledNumbers;
                currentRound.remaining_numbers = shuffledNumbers.slice(0, shuffledNumbers.length - currentRound.winnersCount);
                currentRound.last_selected_index = currentRound.lottery_numbers[currentRound.lottery_numbers.length - 1];
                
                console.log(`Сгенерированы массивы:`);
                console.log(`- winning_numbers: ${selectedNumbers.length} чисел`);
                console.log(`- shuffled_numbers: ${shuffledNumbers.length} чисел`);
                console.log(`- remaining_numbers: ${currentRound.remaining_numbers.length} чисел`);
                console.log(`- last_selected_index: ${currentRound.last_selected_index}`);
            }
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