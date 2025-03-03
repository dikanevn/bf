import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

interface D3Item {
    [key: string]: any;
    NFTnumber?: number;
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

// Функция для обработки файла d3.json в указанной папке
function processD3File(folderPath: string, roundData: D02Round): void {
    const d3FilePath = path.join(folderPath, 'd3.json');
    
    if (!fs.existsSync(d3FilePath)) {
        console.log(`Файл ${d3FilePath} не найден, пропускаем`);
        return;
    }
    
    try {
        console.log(`Обрабатываем файл: ${d3FilePath}`);
        const fileContent = fs.readFileSync(d3FilePath, 'utf8');
        const d3Data = safeParseJson(fileContent) as D3Item[];
        
        if (!roundData.shuffled_numbers || roundData.shuffled_numbers.length === 0) {
            console.error(`Для раунда ${roundData.round} отсутствует или пуст массив shuffled_numbers`);
            return;
        }
        
        // Получаем массив shuffled_numbers для текущего раунда
        const shuffledNumbers = [...roundData.shuffled_numbers];
        
        // Обрабатываем каждый элемент в d3Data
        for (let i = 0; i < d3Data.length; i++) {
            // Берем числа с конца массива shuffled_numbers
            // Первому элементу - последний, второму - предпоследний и т.д.
            const shuffledIndex = shuffledNumbers.length - 1 - i;
            
            if (shuffledIndex >= 0) {
                d3Data[i].NFTnumber = shuffledNumbers[shuffledIndex];
                console.log(`Элемент ${i}: добавлен NFTnumber = ${shuffledNumbers[shuffledIndex]}`);
            } else {
                console.warn(`Для элемента ${i} не хватает значений в shuffled_numbers`);
                break;
            }
        }
        
        // Записываем обновленные данные обратно в файл
        fs.writeFileSync(d3FilePath, formatJson(d3Data), 'utf8');
        console.log(`Файл ${d3FilePath} успешно обновлен`);
    } catch (error) {
        console.error(`Ошибка при обработке файла ${d3FilePath}:`, error);
    }
}

// Функция для получения данных раунда из файла d02.json
function getRoundData(d02Data: D02Round[], roundNumber: number): D02Round | null {
    const roundData = d02Data.find(round => round.round === roundNumber);
    if (!roundData) {
        console.error(`Раунд ${roundNumber} не найден в файле d02.json`);
        return null;
    }
    return roundData;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error('Пожалуйста, укажите максимальный номер папки');
        process.exit(1);
    }

    const maxFolderNumber = parseInt(args[0], 10);
    if (isNaN(maxFolderNumber) || maxFolderNumber <= 0) {
        console.error('Номер папки должен быть положительным числом');
        process.exit(1);
    }

    // Путь к файлу d02.json в указанной максимальной папке
    const d02FilePath = path.join(__dirname, 'rounds', maxFolderNumber.toString(), 'd02.json');

    try {
        if (!fs.existsSync(d02FilePath)) {
            console.error(`Файл ${d02FilePath} не найден`);
            process.exit(1);
        }

        console.log(`Читаем файл: ${d02FilePath}`);
        const fileContent = fs.readFileSync(d02FilePath, 'utf8');
        const d02Data = safeParseJson(fileContent) as D02Round[];

        // Обрабатываем все папки от 1 до maxFolderNumber
        for (let folderNumber = 1; folderNumber <= maxFolderNumber; folderNumber++) {
            const folderPath = path.join(__dirname, 'rounds', folderNumber.toString());
            
            if (!fs.existsSync(folderPath)) {
                console.log(`Папка ${folderPath} не найдена, пропускаем`);
                continue;
            }
            
            console.log(`\nОбрабатываем папку: ${folderPath}`);
            
            // Получаем данные раунда для текущей папки
            const roundData = getRoundData(d02Data, folderNumber);
            if (!roundData) {
                continue;
            }
            
            // Обрабатываем файл d3.json в текущей папке
            processD3File(folderPath, roundData);
        }

        console.log('\nОбработка всех папок завершена');

    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

main(); 