import fs from 'fs';
import path from 'path';

/**
 * Функция для переноса файлов d2.json из папки бэкапа в папку rounds
 */
function transferBackupFiles() {
    try {
        // Пути к директориям
        const backupDir = './roundsBackUp1';
        const targetDir = './rounds';

        // Проверяем существование директорий
        if (!fs.existsSync(backupDir)) {
            throw new Error(`Директория бэкапа не найдена: ${backupDir}`);
        }

        if (!fs.existsSync(targetDir)) {
            console.log(`Создаем директорию для раундов: ${targetDir}`);
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Получаем список поддиректорий в папке бэкапа
        const backupSubdirs = fs.readdirSync(backupDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        if (backupSubdirs.length === 0) {
            throw new Error(`В директории бэкапа не найдены поддиректории: ${backupDir}`);
        }

        console.log(`\nНайдено ${backupSubdirs.length} директорий в папке бэкапа`);

        // Счетчики для статистики
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Обрабатываем каждую поддиректорию
        backupSubdirs.forEach(subdir => {
            try {
                const sourceFilePath = path.join(backupDir, subdir, 'd2.json');
                const targetSubdirPath = path.join(targetDir, subdir);
                const targetFilePath = path.join(targetSubdirPath, 'd2.json');

                // Проверяем существование исходного файла
                if (!fs.existsSync(sourceFilePath)) {
                    console.warn(`Предупреждение: файл d2.json не найден в директории ${subdir}`);
                    skipCount++;
                    return;
                }

                // Создаем целевую директорию, если она не существует
                if (!fs.existsSync(targetSubdirPath)) {
                    fs.mkdirSync(targetSubdirPath, { recursive: true });
                }

                // Проверяем, существует ли уже файл в целевой директории
                if (fs.existsSync(targetFilePath)) {
                    console.log(`Файл уже существует в директории ${subdir}, пропускаем`);
                    skipCount++;
                    return;
                }

                // Копируем файл
                const fileContent = fs.readFileSync(sourceFilePath, 'utf-8');
                fs.writeFileSync(targetFilePath, fileContent, 'utf-8');

                console.log(`Успешно скопирован файл d2.json в директорию ${subdir}`);
                successCount++;
            } catch (error) {
                console.error(`Ошибка при обработке директории ${subdir}:`);
                if (error instanceof Error) {
                    console.error(error.message);
                }
                errorCount++;
            }
        });

        // Выводим итоговую статистику
        console.log('\nИтоги переноса файлов:');
        console.log(`Успешно перенесено: ${successCount}`);
        if (skipCount > 0) {
            console.log(`Пропущено: ${skipCount}`);
        }
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

// Запускаем функцию переноса файлов
transferBackupFiles(); 