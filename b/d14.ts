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
            throw new Error(`Игра номер ${gameNumber} не найдена`);
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
        const gameDir = path.join(__dirname, 'rounds', gameNumber.toString());
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
        const range = part.trim().split('-').map(num => parseInt(num.trim()));
        if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
            // Если это диапазон (например, "1-5")
            const [start, end] = range;
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        } else if (range.length === 1 && !isNaN(range[0])) {
            // Если это одиночное число
            return [range[0]];
        }
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
            console.error('  ts-node d14.ts 84,85,87-90');
            process.exit(1);
        }

        // Читаем файл статистики один раз
        const statsPath = path.join(__dirname, 'agame_statistics.json');
        const statsContent = fs.readFileSync(statsPath, 'utf-8');
        const jsonContent = statsContent.replace(/\/\*[\s\S]*?\*\//, '').trim();
        const stats: Statistics = JSON.parse(jsonContent);

        // Парсим номера игр
        const gameNumbers = parseGameNumbers(args.join(','));
        
        if (gameNumbers.length === 0) {
            throw new Error('Не удалось распознать номера игр');
        }

        // Обрабатываем каждую игру
        let successCount = 0;
        let errorCount = 0;

        gameNumbers.forEach(gameNumber => {
            try {
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
        if (errorCount > 0) {
            console.log(`Ошибок: ${errorCount}`);
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