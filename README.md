# Грошовий ДНК: тест фінансових архетипів

## Встановлення

```bash
cd money-dna-test
npm install
```

## Режими запуску

- `npm run dev` – запуск із nodemon (гаряче перезавантаження `server/server.js`)
- `npm start` – звичайний запуск Node.js

Фронтенд доступний за адресою [http://localhost:3000](http://localhost:3000).

## Структура

- `public/` – SPA: `index.html`, `styles.css`, `app.js`
- `data/archetypes.js` та `data/questions.js` – конфігураційні файли архетипів та 56 тверджень
- `server/server.js` – HTTP API + статична роздача фронтенду
- `server/db.js` – ініціалізація SQLite та хелпери збереження/читання результатів

## Збереження та відправка результатів

1. Після завершення тесту фронтенд відправляє `answers`, `scores` та топ-3 архетипи на `POST /api/results`.
2. Дані зберігаються в таблиці `results` (файл `data/moneydna.sqlite`).
3. Кнопка «Отримати PDF…» викликає `POST /api/send-report`. Зараз це заглушка, де можна підключити SMTP або Telegram Bot API.

## Dev-поради

- Прогрес тесту кешується в `localStorage` (`moneyDnaProgress`) і пропонує продовжити при повторному заході.
- Для поширення результатів можна передати `?id=123` у URL — фронтенд завантажить запис із бекенду.
