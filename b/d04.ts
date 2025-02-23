import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

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

interface RoundConfig {
    round: number;
    firstTicketsBuyTime: string;
    lastTicketsBuyTime: string;
}

function getRoundConfigs(roundNumbers: number[]): RoundConfig[] {
    try {
        return roundNumbers.map(roundNumber => {
            const configPath = path.join('rounds', roundNumber.toString(), 'd02.json');
            const d02Data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            
            // Ищем конфигурацию для конкретного раунда
            const roundConfig = d02Data.find((r: any) => r.round === roundNumber);
            
            if (!roundConfig) {
                throw new Error(`Раунд ${roundNumber} не найден в ${configPath}`);
            }

            if (!roundConfig.firstTicketsBuyTime || !roundConfig.lastTicketsBuyTime) {
                throw new Error(`Для раунда ${roundNumber} не указаны даты начала и конца`);
            }

            return {
                round: roundNumber,
                firstTicketsBuyTime: roundConfig.firstTicketsBuyTime,
                lastTicketsBuyTime: roundConfig.lastTicketsBuyTime
            };
        });
    } catch (error) {
        console.error('Ошибка при чтении конфигурации раундов:', error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

function processPlayers(roundConfig: RoundConfig): Player[] {
    try {
        const rawData = fs.readFileSync('d1.json', 'utf-8');
        const data: DuneData = JSON.parse(rawData);

        if (!data.result?.rows) {
            throw new Error('Неверная структура данных в d1.json');
        }

        if (!roundConfig.firstTicketsBuyTime || !roundConfig.lastTicketsBuyTime) {
            throw new Error(`Для раунда ${roundConfig.round} не указаны даты начала и конца`);
        }

        const startDate = new Date(roundConfig.firstTicketsBuyTime);
        const endDate = new Date(roundConfig.lastTicketsBuyTime);

        console.log(`\nОбработка раунда ${roundConfig.round}`);
        console.log('Временной диапазон:');
        console.log(`Начало: ${startDate.toISOString()}`);
        console.log(`Конец:  ${endDate.toISOString()}`);

        // Фильтруем по временному диапазону
        const filteredRows = data.result.rows.filter(row => {
            const timestamp = new Date(row.blocktime);
            return timestamp >= startDate && timestamp <= endDate;
        });

        // Проверяем на дубликаты
        const addressCounts = new Map<string, number>();
        filteredRows.forEach(row => {
            const count = addressCounts.get(row.raw_player) || 0;
            addressCounts.set(row.raw_player, count + 1);
        });

        // Находим дубликаты
        const duplicates = Array.from(addressCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([address, count]) => ({ address, count }));

        if (duplicates.length > 0) {
            console.error('\nНайдены дубликаты адресов:');
            duplicates.forEach(dup => {
                console.error(`Адрес ${dup.address} встречается ${dup.count} раз`);
            });
            throw new Error('Обнаружены повторяющиеся адреса в выборке');
        }

        const filteredPlayers = Array.from(addressCounts.keys()).sort();
        
        const numberedPlayers = filteredPlayers.map((player, index) => ({
            number: index + 1,
            player: player
        }));

        // Создаем директорию для раунда, если её нет
        const roundDir = path.join('rounds', roundConfig.round.toString());
        fs.mkdirSync(roundDir, { recursive: true });

        // Сохраняем результаты в папку раунда
        fs.writeFileSync(
            path.join(roundDir, 'd2.json'),
            JSON.stringify(numberedPlayers, null, 2),
            'utf-8'
        );

        console.log(`Обработано ${numberedPlayers.length} уникальных игроков`);
        console.log(`Результаты сохранены в ${path.join(roundDir, 'd2.json')}`);

        return numberedPlayers;

    } catch (error) {
        console.error(`Ошибка при обработке раунда ${roundConfig.round}:`, error);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
        process.exit(1);
    }
}

function main() {
    // Получаем номера раундов из аргументов командной строки
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Укажите номера раундов через запятую');
        console.error('Пример: ts-node d04.ts 1,2,3');
        process.exit(1);
    }

    // Парсим номера раундов
    const roundNumbers = args[0].split(',').map(Number);
    if (roundNumbers.some(isNaN)) {
        console.error('Некорректные номера раундов');
        process.exit(1);
    }

    // Получаем конфигурацию для каждого раунда
    const roundConfigs = getRoundConfigs(roundNumbers);

    // Обрабатываем каждый раунд
    roundConfigs.forEach(config => {
        processPlayers(config);
    });
}

main(); 