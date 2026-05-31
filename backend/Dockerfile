# Використовуємо офіційний образ Node.js (легковажну версію alpine)
FROM node:20-alpine

# Створюємо робочу директорію всередині контейнера
WORKDIR /app

# Копіюємо package.json та package-lock.json (якщо є)
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо весь інший код бекенду
COPY . .

# Відкриваємо порт, на якому працює твій сервер
EXPOSE 3000

# Команда для запуску сервера
CMD ["node", "index.js"]