import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function generateRandomNumbers(bitcoinHash: string, count: number, lotteryNumbers: number[]): [number[], number[], number] {
    const numbersInOrder: number[] = [];
    const shuffledArray = [...lotteryNumbers]; // Копируем существующий массив
    let currentHash = bitcoinHash;
    let availableCount = lotteryNumbers.length;
    
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
    return JSON.stringify(data, (key, value) => {
        if (Array.isArray(value)) {
            // Фильтруем null и undefined значения из массивов
            return value.filter(item => item !== null && item !== undefined);
        }
        return value;
    }, 2).replace(/\[\n\s+([^\]]+)\n\s+\]/g, (match, content) => {
        // Форматируем массивы в одну строку и удаляем лишние пробелы
        const items = content.split(',')
            .map((item: string) => item.trim())
            .filter((item: string) => item !== '');
        return `[${items.join(',')}]`;
    });
}

function safeParseJson(content: string): any {
    try {
        // Очищаем контент от некорректных запятых
        const cleanContent = content
            .replace(/\[[\s,]*([^\]]+)[\s,]*\]/g, (match, inner) => {
                const elements = inner.split(',')
                    .map((item: string) => item.trim())
                    .filter((item: string) => item !== '' && item !== 'null' && item !== 'undefined');
                return `[${elements.join(',')}]`;
            })
            .replace(/,(\s*[}\]])/g, '$1') // Удаляем запятые перед закрывающими скобками
            .replace(/,\s*,/g, ','); // Удаляем двойные запятые
        
        return JSON.parse(cleanContent);
    } catch (error) {
        console.error('Ошибка при парсинге JSON:', error);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Пожалуйста, укажите номер папки');
        process.exit(1);
    }

    const folderNumber = args[0];
    const filePath = path.join(__dirname, 'rounds', folderNumber, 'd02.json');

    try {
        console.log(`Обрабатываем файл: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = safeParseJson(fileContent) as D02Round[];

        // Сначала очищаем все массивы, кроме раунда 0
        data.forEach(round => {
            if (round.round !== 0) { // Не удаляем поля из раунда 0
                delete round.lottery_numbers;
                delete round.winning_numbers;
                delete round.shuffled_numbers;
                delete round.remaining_numbers;
                delete round.last_selected_index;
            }
        });

        // Сортируем раунды по номеру
        data.sort((a, b) => a.round - b.round);

        // Находим раунд 0 для использования его данных
        const round0 = data.find(r => r.round === 0);
        console.log('Раунд 0:', JSON.stringify(round0, null, 2));
        
        if (!round0) {
            throw new Error('Не найден раунд 0');
        }
        
        console.log('Проверка полей раунда 0:');
        console.log('- remaining_numbers:', round0.remaining_numbers ? 'Найдено' : 'Отсутствует');
        console.log('- last_selected_index:', round0.last_selected_index !== undefined ? 'Найдено' : 'Отсутствует');
        
        if (!round0.remaining_numbers || round0.last_selected_index === undefined) {
            throw new Error(`Не найдены необходимые данные в раунде 0: ${!round0.remaining_numbers ? 'remaining_numbers отсутствует' : ''} ${round0.last_selected_index === undefined ? 'last_selected_index отсутствует' : ''}`);
        }

        for (let i = 0; i < data.length; i++) {
            const currentRound = data[i];
            if (currentRound.round === 0) continue; // Пропускаем раунд 0

            if (!currentRound || !currentRound.winnersCount) {
                throw new Error(`Не найден раунд ${currentRound.round} или winnersCount`);
            }

            console.log(`Обрабатываем раунд ${currentRound.round}, winnersCount: ${currentRound.winnersCount}`);

            // Определяем предыдущий раунд: для раунда 1 используем раунд 0, для остальных - предыдущий
            const previousRound = currentRound.round === 1 ? round0 : data[i - 1];
            if (!previousRound.remaining_numbers || previousRound.last_selected_index === undefined) {
                throw new Error(`Не найдены remaining_numbers или last_selected_index в раунде ${previousRound.round}`);
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

            console.log(`Добавлен lottery_numbers массив длиной ${currentRound.lottery_numbers.length}`);

            // Генерируем случайные числа на основе Bitcoin хеша
            if (currentRound.BITCOIN_BLOCK_HASH) {
                console.log(`Используем Bitcoin хеш: ${currentRound.BITCOIN_BLOCK_HASH}`);
                const [selectedNumbers, shuffledNumbers, lastIndex] = generateRandomNumbers(
                    currentRound.BITCOIN_BLOCK_HASH,
                    currentRound.winnersCount,
                    currentRound.lottery_numbers
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

                // Записываем изменения в файл после каждого раунда
                try {
                    const jsonStr = formatJson(data);
                    fs.writeFileSync(filePath, jsonStr, { encoding: 'utf8', flag: 'w' });
                    console.log(`Файл успешно обновлен после раунда ${currentRound.round}`);
                } catch (writeError) {
                    console.error(`Ошибка при записи файла после раунда ${currentRound.round}:`, writeError);
                    process.exit(1);
                }
            }
        }

    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

main(); 