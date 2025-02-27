import fs from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';

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
  BITCOIN_BLOCK_HASH: string;
  BITCOIN_BLOCK_NUMBER: string;
  BITCOIN_BLOCK_TIME: string;
  RewardsOrDeploy?: string;
  // ... другие поля
}

interface BitcoinBlockInfo {
  hash: string;
  time: number;
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

async function getBitcoinBlockInfo(blockNumber: string): Promise<BitcoinBlockInfo | null> {
  try {
    // Используем Blockstream API для получения информации о блоке
    const response = await axios.get(`https://blockstream.info/api/block-height/${blockNumber}`);
    const blockHash = response.data;
    
    // Получаем детальную информацию о блоке
    const blockInfo = await axios.get(`https://blockstream.info/api/block/${blockHash}`);
    
    return {
      hash: blockHash,
      time: blockInfo.data.timestamp
    };
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error(`Ошибка при получении информации о блоке ${blockNumber}: ${error.message}`);
    } else {
      console.error(`Неизвестная ошибка при получении информации о блоке ${blockNumber}`);
    }
    return null;
  }
}

function formatBlockTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

async function main() {
  try {
    // Получаем номер папки из аргументов командной строки
    const folderNumber = process.argv[2];
    if (!folderNumber) {
      throw new Error('Необходимо указать номер папки в качестве аргумента');
    }

    // Читаем файл со статистикой игр
    const statisticsPath = path.join(__dirname, 'agame_statistics.json');
    const fileContent = fs.readFileSync(statisticsPath, 'utf8');
    const jsonContent = removeComments(fileContent);
    const statistics = JSON.parse(jsonContent);
    
    // Создаем мапу для быстрого доступа к данным игр по gameId
    const gameMap = new Map<string, { playerCount: number, startDate: string }>();
    statistics.games.forEach((game: GameStatistic) => {
      gameMap.set(game.gameId, {
        playerCount: game.playerCount,
        startDate: game.startDate
      });
    });

    // Формируем путь к конкретному файлу d02.json
    const d02Path = path.join(__dirname, 'rounds', folderNumber.toString(), 'd02.json');
    
    if (!fs.existsSync(d02Path)) {
      throw new Error(`Файл ${d02Path} не найден`);
    }

    console.log(`Обработка файла: ${d02Path}`);
    
    // Читаем и парсим файл
    const d02Data = JSON.parse(fs.readFileSync(d02Path, 'utf8'));
    let updated = false;
    let updatedFields: { round: number, field: string, oldValue: string, newValue: string }[] = [];

    // Создаем мапу winnersCount из всех d3_audit.json файлов
    const winnersCountMap = new Map<number, number>();
    
    // Проходим по всем папкам от 1 до указанного номера
    for (let i = 1; i <= parseInt(folderNumber); i++) {
      const d3AuditPath = path.join(__dirname, 'rounds', i.toString(), 'd3_audit.json');
      if (fs.existsSync(d3AuditPath)) {
        try {
          const d3AuditData = JSON.parse(fs.readFileSync(d3AuditPath, 'utf8'));
          if (d3AuditData.winnersCount !== undefined) {
            winnersCountMap.set(i, d3AuditData.winnersCount);
          }
        } catch (e) {
          console.error(`Ошибка при чтении файла ${d3AuditPath}:`, e);
        }
      }
    }

    // Обновляем данные
    for (const round of d02Data) {
      // Обновляем TOTAL_TICKETS и RewardsOrDeploy из статистики игр
      if (round.GAME_ID && gameMap.has(round.GAME_ID)) {
        const gameData = gameMap.get(round.GAME_ID);
        
        // Обновляем TOTAL_TICKETS если оно пустое
        if (!round.TOTAL_TICKETS && gameData) {
          const newValue = gameData.playerCount.toString();
          round.TOTAL_TICKETS = newValue;
          updated = true;
          updatedFields.push({
            round: round.round,
            field: 'TOTAL_TICKETS',
            oldValue: '',
            newValue
          });
        }

        // Обновляем RewardsOrDeploy если оно пустое
        if (!round.RewardsOrDeploy && gameData) {
          const newValue = gameData.startDate;
          round.RewardsOrDeploy = newValue;
          updated = true;
          updatedFields.push({
            round: round.round,
            field: 'RewardsOrDeploy',
            oldValue: '',
            newValue
          });
        }
      }

      // Обновляем информацию о биткоин-блоках
      if (round.BITCOIN_BLOCK_NUMBER && 
         (!round.BITCOIN_BLOCK_HASH || round.BITCOIN_BLOCK_HASH === '' || 
          !round.BITCOIN_BLOCK_TIME || round.BITCOIN_BLOCK_TIME === '')) {
        
        console.log(`Получение информации для блока ${round.BITCOIN_BLOCK_NUMBER}...`);
        const blockInfo = await getBitcoinBlockInfo(round.BITCOIN_BLOCK_NUMBER);
        
        if (blockInfo) {
          // Обновляем хэш блока
          if (!round.BITCOIN_BLOCK_HASH || round.BITCOIN_BLOCK_HASH === '') {
            const oldHash = round.BITCOIN_BLOCK_HASH || '';
            round.BITCOIN_BLOCK_HASH = blockInfo.hash;
            updated = true;
            updatedFields.push({
              round: round.round,
              field: 'BITCOIN_BLOCK_HASH',
              oldValue: oldHash,
              newValue: blockInfo.hash
            });
          }

          // Обновляем время блока
          if (!round.BITCOIN_BLOCK_TIME || round.BITCOIN_BLOCK_TIME === '') {
            const formattedTime = formatBlockTime(blockInfo.time);
            const oldTime = round.BITCOIN_BLOCK_TIME || '';
            round.BITCOIN_BLOCK_TIME = formattedTime;
            updated = true;
            updatedFields.push({
              round: round.round,
              field: 'BITCOIN_BLOCK_TIME',
              oldValue: oldTime,
              newValue: formattedTime
            });
          }
        }

        // Добавляем задержку между запросами к API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Добавляем поле winnersCount, если его нет
      if (!('winnersCount' in round)) {
        round.winnersCount = '';
        updated = true;
      }

      // Обновляем winnersCount если есть данные в мапе
      const roundNumber = round.round;
      if (winnersCountMap.has(roundNumber)) {
        const newWinnersCount = winnersCountMap.get(roundNumber);
        const oldValue = round.winnersCount;
        
        if (newWinnersCount !== undefined && round.winnersCount !== newWinnersCount) {
          round.winnersCount = newWinnersCount;
          updated = true;
          updatedFields.push({
            round: roundNumber,
            field: 'winnersCount',
            oldValue: oldValue.toString(),
            newValue: newWinnersCount.toString()
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
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Ошибка:', error.message);
    } else {
      console.error('Неизвестная ошибка');
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Ошибка:', error.message);
  } else {
    console.error('Неизвестная ошибка');
  }
}); 