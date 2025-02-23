import fs from 'fs';
import path from 'path';

interface GameStatistic {
  gameId: string;
  playerCount: number;
  players: string[];
  startDate: string;
}

interface D02Round {
  round: number;
  coefficient: string;
  value: string;
  GAME_ID: string;
  TOTAL_TICKETS: string;
  RewardsOrDeploy?: string;
  // ... другие поля
}

interface LogTransaction {
  blockTime: string;
  logMessages: string[];
}

interface LogData {
  transactions: LogTransaction[];
}

function removeComments(jsonString: string): string {
  // Удаляем многострочные комментарии /* */
  return jsonString.replace(/\/\*[\s\S]*?\*\/\s*/g, '');
}

function findRewardOrDeployTime(logs: LogData, gameId: string): string | null {
  for (const transaction of logs.transactions) {
    for (const message of transaction.logMessages) {
      // Ищем сообщения о наградах или деплое
      if (message.includes(`Posted rewards for game ${gameId}`) || 
          message.includes(`Deployed token for game ${gameId}`)) {
        return transaction.blockTime;
      }
    }
  }
  return null;
}

async function main() {
  try {
    // Получаем номер папки из аргументов командной строки
    const folderNumber = process.argv[2];
    if (!folderNumber) {
      throw new Error('Необходимо указать номер папки в качестве аргумента');
    }

    // Читаем файл логов
    const logsPath = path.join(__dirname, 'logs', 'logsProgram.json');
    const logs: LogData = JSON.parse(fs.readFileSync(logsPath, 'utf8'));

    // Читаем файл со статистикой игр
    const statisticsPath = path.join(__dirname, 'agame_statistics.json');
    const fileContent = fs.readFileSync(statisticsPath, 'utf8');
    const jsonContent = removeComments(fileContent);
    const statistics = JSON.parse(jsonContent);
    
    // Создаем мапы для быстрого доступа к данным игры
    const gameMap = new Map<string, number>();
    const dateMap = new Map<string, string>();
    statistics.games.forEach((game: GameStatistic) => {
      gameMap.set(game.gameId, game.playerCount);
      dateMap.set(game.gameId, game.startDate);
    });

    // Формируем путь к конкретному файлу d02.json
    const d02Path = path.join(__dirname, 'rounds', folderNumber, 'd02.json');
    
    if (!fs.existsSync(d02Path)) {
      throw new Error(`Файл ${d02Path} не найден`);
    }

    console.log(`Обработка файла: ${d02Path}`);
    
    // Читаем и парсим файл
    const d02Data = JSON.parse(fs.readFileSync(d02Path, 'utf8'));
    let updated = false;
    let updatedFields: { round: number, field: string, oldValue: string, newValue: string }[] = [];

    // Обновляем данные
    for (const round of d02Data) {
      if (round.GAME_ID) {
        // Обновляем TOTAL_TICKETS если пустое
        if (!round.TOTAL_TICKETS && gameMap.has(round.GAME_ID)) {
          const newValue = gameMap.get(round.GAME_ID)?.toString() || '';
          round.TOTAL_TICKETS = newValue;
          updated = true;
          updatedFields.push({
            round: round.round,
            field: 'TOTAL_TICKETS',
            oldValue: '',
            newValue
          });
        }

        // Проверяем и обновляем RewardsOrDeploy из логов
        const logTime = findRewardOrDeployTime(logs, round.GAME_ID);
        if (logTime && round.RewardsOrDeploy !== logTime) {
          const oldValue = round.RewardsOrDeploy || '';
          round.RewardsOrDeploy = logTime;
          updated = true;
          updatedFields.push({
            round: round.round,
            field: 'RewardsOrDeploy',
            oldValue,
            newValue: logTime
          });
        }
      }
    }

    // Если были обновления, сохраняем файл
    if (updated) {
      fs.writeFileSync(d02Path, JSON.stringify(d02Data, null, 2));
      console.log(`\nФайл ${d02Path} обновлен:`);
      
      // Выводим подробную информацию об обновлениях
      updatedFields.forEach(update => {
        console.log(`Round ${update.round}:`);
        console.log(`  - Поле '${update.field}' изменено с '${update.oldValue}' на '${update.newValue}'`);
      });
    } else {
      console.log(`\nВ файле ${d02Path} нет данных для обновления`);
    }

    console.log('\nОбработка завершена');
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

main().catch(console.error); 