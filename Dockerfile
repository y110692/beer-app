# Шаг 1: Сборка фронтенд-приложения
# Используем образ Node.js для установки зависимостей и сборки
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Собираем приложение для продакшена (Vite обычно создает папку 'dist')
RUN npm run build

# Шаг 2: Создание легковесного образа для обслуживания статических файлов
# Используем образ Nginx для обслуживания собранного приложения
FROM nginx:alpine

# Копируем собранные файлы из предыдущего шага в директорию Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем кастомную конфигурацию Nginx, если нужна (опционально)
# Если у вас есть файл nginx.conf в корне, раскомментируйте следующую строку
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80, который Nginx будет слушать
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
