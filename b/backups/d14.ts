import fs from 'fs';
import path from 'path';

interface GameStats {
    gameNumber: number;
    gameId: string;
    players: string[];
    startDate: string;
    playerCount: number;
}

interface Statistics {
    games: GameStats[];
    totalGames: number;
    totalPlayers: number;
}

interface Player {
    number: number;
    player: string;
}

function processGame(gameNumber: number, stats: Statistics): void {
    try {
        // Находим нужную игру
        const game = stats.games.find(g => g.gameNumber === gameNumber);
        
        if (!game) {
            console.error(`\nИгра номер ${gameNumber} не найдена в статистике`);
            return;
        }

        // Проверяем на дубликаты
        const playerCounts = new Map<string, number>();
        game.players.forEach(player => {
            playerCounts.set(player, (playerCounts.get(player) || 0) + 1);
        });

        const duplicates = Array.from(playerCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([player, count]) => `${player} (${count} раз)`);

        if (duplicates.length > 0) {
            throw new Error(
                `Обнаружены повторяющиеся игроки:\n${duplicates.join('\n')}\n` +
                `Обработка игры ${gameNumber} остановлена.`
            );
        }

        // Создаем массив игроков с номерами
        const players: Player[] = game.players.sort().map((player, index) => ({
            number: index + 1,
            player: player
        }));

        // Создаем директорию для игры, если её нет
        const gameDir = path.join('./rounds', gameNumber.toString());
        fs.mkdirSync(gameDir, { recursive: true });

        // Сохраняем результаты
        fs.writeFileSync(
            path.join(gameDir, 'd2.json'),
            JSON.stringify(players, null, 2),
            'utf-8'
        );

        // Выводим информацию
        const date = new Date(game.startDate).toLocaleString('ru-RU');
        console.log(`\nОбработка игры ${gameNumber} (${game.gameId})`);
        console.log(`Дата: ${date}`);
        console.log(`Обработано ${players.length} уникальных игроков`);
        console.log(`Результаты сохранены в ${path.join(gameDir, 'd2.json')}`);

    } catch (error) {
        console.error(`\nОшибка при обработке игры ${gameNumber}:`);
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
        }
    }
}

function parseGameNumbers(input: string): number[] {
    // Разбиваем строку по запятой и обрабатываем диапазоны
    return input.split(',').flatMap(part => {
        const trimmedPart = part.trim();
        if (!trimmedPart) return [];
        
        const range = trimmedPart.split('-').map(num => parseInt(num.trim()));
        
        if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
            // Если это диапазон (например, "1-5")
            let [start, end] = range;
            
            // Проверяем, что начало не больше конца
            if (start > end) {
                [start, end] = [end, start]; // Меняем местами, если начало больше конца
            }
            
            // Проверяем на отрицательные значения
            if (start < 1) {
                console.warn(`Предупреждение: номер игры не может быть меньше 1, используется 1 вместо ${start}`);
                start = 1;
            }
            
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        } else if (range.length === 1 && !isNaN(range[0])) {
            // Если это одиночное число
            const num = range[0];
            if (num < 1) {
                console.warn(`Предупреждение: номер игры не может быть меньше 1, игнорируется ${num}`);
                return [];
            }
            return [num];
        }
        
        console.warn(`Предупреждение: не удалось распознать часть "${trimmedPart}", она будет проигнорирована`);
        return [];
    });
}

function main() {
    try {
        // Получаем номера игр из аргументов командной строки
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.error('Укажите номера игр');
            console.error('Примеры:');
            console.error('  ts-node d14.ts 84');
            console.error('  ts-node d14.ts 84,85,86');
            console.error('  ts-node d14.ts 84-86');
            console.error('  ts-node d14.ts 1-21');
            console.error('  ts-node d14.ts 84,85,87-90');
            process.exit(1);
        }

        // Читаем файл статистики один раз
        const statsPath = './agame_statistics.json';
        if (!fs.existsSync(statsPath)) {
            throw new Error(`Файл статистики не найден: ${statsPath}`);
        }
        
        const statsContent = fs.readFileSync(statsPath, 'utf-8');
        const jsonContent = statsContent.replace(/\/\*[\s\S]*?\*\//, '').trim();
        let stats: Statistics;
        
        try {
            stats = JSON.parse(jsonContent);
        } catch (error) {
            throw new Error(`Ошибка при парсинге файла статистики: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }

        // Парсим номера игр
        const gameNumbers = parseGameNumbers(args.join(','));
        
        if (gameNumbers.length === 0) {
            throw new Error('Не удалось распознать номера игр');
        }

        console.log(`\nНачинаю обработку ${gameNumbers.length} игр: ${gameNumbers.join(', ')}`);
        
        // Обрабатываем каждую игру
        let successCount = 0;
        let errorCount = 0;
        let notFoundCount = 0;

        gameNumbers.forEach(gameNumber => {
            try {
                const gameExists = stats.games.some(g => g.gameNumber === gameNumber);
                if (!gameExists) {
                    notFoundCount++;
                    console.error(`\nИгра номер ${gameNumber} не найдена в статистике`);
                    return;
                }
                
                processGame(gameNumber, stats);
                successCount++;
            } catch (error) {
                errorCount++;
                if (error instanceof Error) {
                    console.error(`Ошибка при обработке игры ${gameNumber}: ${error.message}`);
                }
            }
        });

        // Выводим итоговую статистику
        console.log('\nИтоги обработки:');
        console.log(`Успешно обработано: ${successCount}`);
        if (notFoundCount > 0) {
            console.log(`Не найдено игр: ${notFoundCount}`);
        }
        if (errorCount > 0) {
            console.log(`Ошибок при обработке: ${errorCount}`);
        }
    } catch (error) {
        console.error('\nКритическая ошибка:');
        if (error instanceof Error) {
            console.error(error.message);
        }
        process.exit(1);
    }
}

main(); 