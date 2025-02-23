import fs from 'fs';
import path from 'path';

interface GameStats {
    gameNumber: number;
    gameId: string;
    players: string[];
}

interface Statistics {
    games: GameStats[];
    totalGames: number;
    totalPlayers: number;
}

function analyzeGameLogs(): Statistics {
    const logsDir = path.join(__dirname, 'logs');
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.json'));
    
    const gameMap = new Map<string, Set<string>>();
    
    // Читаем все лог-файлы и собираем информацию
    for (const logFile of logFiles) {
        const logContent = fs.readFileSync(path.join(logsDir, logFile), 'utf-8');
        const logs = JSON.parse(logContent);
        
        // Анализируем каждую запись в логе
        for (const log of logs) {
            if (log.event === 'TICKET_BOUGHT') {
                const gameId = log.gameId;
                const playerId = log.playerId;
                
                if (!gameMap.has(gameId)) {
                    gameMap.set(gameId, new Set());
                }
                gameMap.get(gameId)?.add(playerId);
            }
        }
    }
    
    // Формируем статистику
    let gameNumber = 1;
    const games: GameStats[] = Array.from(gameMap.entries()).map(([gameId, players]) => ({
        gameNumber: gameNumber++,
        gameId,
        players: Array.from(players)
    }));
    
    // Подсчитываем общую статистику
    const totalGames = games.length;
    const totalPlayers = new Set(games.flatMap(game => game.players)).size;
    
    const statistics: Statistics = {
        games,
        totalGames,
        totalPlayers
    };
    
    // Сохраняем результат в файл
    const outputPath = path.join(__dirname, 'game_statistics.json');
    fs.writeFileSync(outputPath, JSON.stringify(statistics, null, 2));
    
    return statistics;
}

// Запускаем анализ
const stats = analyzeGameLogs();
console.log(`Всего игр: ${stats.totalGames}`);
console.log(`Всего уникальных игроков: ${stats.totalPlayers}`); 