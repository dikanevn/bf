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
    
    // Создаем мапу для быстрого доступа к количеству игроков по gameId
    const gameMap = new Map<string, number>();
    statistics.games.forEach((game: GameStatistic) => {
      gameMap.set(game.gameId, game.playerCount);
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
      // Обновляем TOTAL_TICKETS из статистики игр
      if (round.GAME_ID && !round.TOTAL_TICKETS && gameMap.has(round.GAME_ID)) {
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