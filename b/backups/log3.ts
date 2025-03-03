import fs from 'fs';
import path from 'path';

interface GameStats {
    gameNumber: number;
    gameId: string;
    players: string[];
    startDate: string;
    playerCount: number;
    duplicates?: { [key: string]: number };
}

interface Statistics {
    games: GameStats[];
    totalGames: number;
    totalPlayers: number;
}

interface Transaction {
    logMessages: string[];
    blockTime: string;
}

interface LogData {
    transactions: Transaction[];
}

function analyzeGameLogs(): Statistics {
    const logsDir = path.join(__dirname, 'logs');
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.json'));
    
    const gameMap = new Map<string, { 
        players: Set<string>, 
        startDate: string,
        playerCounts: { [key: string]: number }
    }>();
    
    // Читаем все лог-файлы и собираем информацию
    for (const logFile of logFiles) {
        try {
            const logContent = fs.readFileSync(path.join(logsDir, logFile), 'utf-8');
            const logData = JSON.parse(logContent) as LogData;
            
            if (Array.isArray(logData.transactions)) {
                logData.transactions.forEach(transaction => {
                    if (Array.isArray(transaction.logMessages)) {
                        transaction.logMessages.forEach(message => {
                            const match = message.match(/Player (\w+) bought ticket for game (\w+)/);
                            if (match) {
                                const [, playerId, gameId] = match;
                                
                                if (!gameMap.has(gameId)) {
                                    gameMap.set(gameId, {
                                        players: new Set(),
                                        startDate: transaction.blockTime,
                                        playerCounts: {}
                                    });
                                }
                                
                                const gameData = gameMap.get(gameId)!;
                                gameData.players.add(playerId);
                                gameData.playerCounts[playerId] = (gameData.playerCounts[playerId] || 0) + 1;
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.error(`Ошибка при обработке файла ${logFile}:`, error);
        }
    }
    
    // Формируем статистику
    let gameNumber = 1;
    const games: GameStats[] = Array.from(gameMap.entries()).map(([gameId, data]) => {
        // Находим дубликаты
        const duplicates: { [key: string]: number } = {};
        Object.entries(data.playerCounts).forEach(([playerId, count]) => {
            if (count > 1) {
                duplicates[playerId] = count;
            }
        });

        return {
            gameNumber: gameNumber++,
            gameId,
            players: Array.from(data.players),
            startDate: data.startDate,
            playerCount: data.players.size,
            ...(Object.keys(duplicates).length > 0 ? { duplicates } : {})
        };
    });
    
    // Сортируем игры по дате
    games.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    // Обновляем номера игр после сортировки
    games.forEach((game, index) => {
        game.gameNumber = index + 1;
    });
    
    const totalGames = games.length;
    const totalPlayers = new Set(games.flatMap(game => game.players)).size;
    
    // Создаем комментарий для файла
    const gamesOutput = games.map(game => {
        return `Игра ${game.gameNumber} (${game.gameId}): ${game.playerCount} игроков, дата: ${game.startDate}`;
    }).join('\n');
    
    // Находим игры с дубликатами
    const gamesWithDuplicates = games
        .filter(game => game.duplicates)
        .map(game => {
            const duplicateInfo = Object.entries(game.duplicates!)
                .map(([playerId, count]) => `${playerId} (${count} билетов)`)
                .join(', ');
            return `Игра ${game.gameNumber} (${game.gameId}), дата: ${game.startDate}\n  Дубликаты: ${duplicateInfo}`;
        });

    const statistics: Statistics = {
        games,
        totalGames,
        totalPlayers
    };
    
    // Сохраняем результат в файл с комментарием
    const outputPath = path.join(__dirname, 'game_statistics.json');
    const fileContent = `/*\n${gamesOutput}\n\nИгры с дубликатами:\n${gamesWithDuplicates.join('\n')}\n*/\n\n${JSON.stringify(statistics, null, 2)}`;
    fs.writeFileSync(outputPath, fileContent);
    
    // Выводим информацию в консоль
    console.log(gamesOutput);
    console.log('\nИгры с дубликатами:');
    console.log(gamesWithDuplicates.join('\n'));
    console.log('\nОбщая статистика:');
    console.log(`Всего игр: ${totalGames}`);
    console.log(`Всего уникальных игроков: ${totalPlayers}`);
    
    return statistics;
}

// Запускаем анализ
const stats = analyzeGameLogs(); 