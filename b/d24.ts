import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface D02Round {
    round: number;
    winnersCount: number;
    BITCOIN_BLOCK_HASH: string;
    lottery_numbers?: number[];
    shuffled_numbers?: number[];
    remaining_numbers?: number[];
    last_selected_index?: number;
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

// Функция для генерации случайного числа на основе хеша биткоина
function generateRandomNumber(hash: string, seed: number, max: number): number {
    const combinedSeed = `${hash}-${seed}`;
    const hashValue = crypto.createHash('sha256').update(combinedSeed).digest('hex');
    const randomValue = parseInt(hashValue.substring(0, 8), 16);
    return randomValue % max;
}

// Функция для перемешивания массива lottery_numbers для winnersCount элементов
function shuffleArrayForWinners(round: D02Round): void {
    // Проверяем, что winnersCount не пустой
    if (!round.winnersCount || round.winnersCount <= 0) {
        console.error(`Раунд ${round.round}: winnersCount отсутствует или равен 0, пропускаем обработку`);
        return;
    }

    if (!round.lottery_numbers || round.lottery_numbers.length === 0) {
        console.error(`Раунд ${round.round}: lottery_numbers отсутствует или пуст`);
        return;
    }

    // Копируем lottery_numbers в shuffled_numbers
    round.shuffled_numbers = [...round.lottery_numbers];
    
    const totalNumbers = round.shuffled_numbers.length;
    const winnersCount = round.winnersCount;
    
    console.log(`Раунд ${round.round}: Перемешиваем ${winnersCount} элементов из ${totalNumbers}`);
    
    // Перемешиваем только winnersCount элементов
    for (let i = 0; i < winnersCount; i++) {
        // Генерируем случайное число от 0 до (totalNumbers - i - 1)
        const randomIndex = generateRandomNumber(
            round.BITCOIN_BLOCK_HASH, 
            i, 
            totalNumbers - i
        );
        
        // Меняем местами элементы
        const lastIndex = totalNumbers - i - 1;
        const temp = round.shuffled_numbers[randomIndex];
        round.shuffled_numbers[randomIndex] = round.shuffled_numbers[lastIndex];
        round.shuffled_numbers[lastIndex] = temp;
        
        console.log(`Раунд ${round.round}: Шаг ${i+1}/${winnersCount} - поменяли местами элементы с индексами ${randomIndex} и ${lastIndex}`);
    }
    
    // Создаем remaining_numbers как копию shuffled_numbers без winnersCount элементов справа
    round.remaining_numbers = [...round.shuffled_numbers].slice(0, totalNumbers - winnersCount);
    
    // Записываем last_selected_index как последнее число в массиве lottery_numbers
    round.last_selected_index = round.lottery_numbers[round.lottery_numbers.length - 1];
    
    console.log(`Раунд ${round.round}: Перемешивание завершено`);
    console.log(`Раунд ${round.round}: remaining_numbers содержит ${round.remaining_numbers.length} элементов`);
    console.log(`Раунд ${round.round}: last_selected_index = ${round.last_selected_index}`);
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

        // Сортируем раунды по номеру
        data.sort((a, b) => a.round - b.round);

        // Сначала очищаем все массивы, кроме раунда 0
        data.forEach(round => {
            if (round.round !== 0) { // Не удаляем поля из раунда 0
                delete round.lottery_numbers;
                delete round.shuffled_numbers;
                delete round.remaining_numbers;
                delete round.last_selected_index;
            }
        });

        console.log('Массивы очищены для всех раундов, кроме раунда 0');

        // Обрабатываем все раунды, кроме раунда 0
        for (let i = 1; i < data.length; i++) {
            const currentRound = data[i];
            const previousRound = data[i - 1]; // Предыдущий раунд

            if (!previousRound || !previousRound.remaining_numbers) {
                console.error(`Для раунда ${currentRound.round} не найден предыдущий раунд или в нем отсутствует поле remaining_numbers`);
                continue;
            }

            console.log(`Обрабатываем раунд ${currentRound.round}, предыдущий раунд: ${previousRound.round}`);
            console.log(`Раунд ${currentRound.round} до изменений:`, JSON.stringify(currentRound, null, 2));

            // Копируем remaining_numbers из предыдущего раунда в lottery_numbers текущего раунда
            currentRound.lottery_numbers = [...previousRound.remaining_numbers];

            // Проверяем наличие last_selected_index в предыдущем раунде
            if (previousRound.last_selected_index === undefined) {
                console.error(`В раунде ${previousRound.round} отсутствует поле last_selected_index`);
                continue;
            }

            // Добавляем новые элементы, начиная с last_selected_index + 1 предыдущего раунда
            const startIndex = previousRound.last_selected_index + 1;
            const newNumbers = Array.from(
                { length: currentRound.winnersCount },
                (_, i) => startIndex + i
            );
            currentRound.lottery_numbers.push(...newNumbers);

            console.log(`Добавлено ${currentRound.winnersCount} новых элементов, начиная с ${startIndex}`);
            console.log(`Итоговый размер lottery_numbers: ${currentRound.lottery_numbers.length}`);
            
            // Перемешиваем массив lottery_numbers для winnersCount элементов
            shuffleArrayForWinners(currentRound);
            
            console.log(`Раунд ${currentRound.round} после изменений:`, JSON.stringify(currentRound, null, 2));
        }

        // Записываем изменения в файл
        try {
            const jsonStr = formatJson(data);
            fs.writeFileSync(filePath, jsonStr, { encoding: 'utf8', flag: 'w' });
            console.log(`Файл успешно обновлен`);
        } catch (writeError) {
            console.error(`Ошибка при записи файла:`, writeError);
            process.exit(1);
        }

    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

main(); 