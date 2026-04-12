# Offline Functionality Documentation

## Преглед

Приложението Malls включва пълна offline функционалност която детектира когато сървърът е недостъпен или няма интернет връзка и показва модал който блокира взаимодействие с приложението докато връзката не се възстанови.

## Компоненти

### 1. OfflineBanner Component (`components/OfflineBanner.tsx`)

React компонент който показва модал когато приложението е offline или сървърът е спрян.

**Основни функции:**
- Слуша за съобщения от Service Worker (`SERVER_OFFLINE`)
- Слуша за browser online/offline events
- Периодична проверка когато е offline (`/api/health`): 5 секунди за iOS, 10 секунди за Android/Desktop
- Автоматично затваря се когато връзката се възстанови
- Блокира всички взаимодействия с приложението (pointer-events-none, opacity)

**Състояния:**
- `isOffline`: Показва дали приложението е offline
- `isChecking`: Показва когато връзката е възстановена (зелена анимация)
- `isServerDown`: Разграничава проблеми със сървъра от проблеми с интернет

### 2. Service Worker (`public/sw.js`)

Service Worker който обработва кеширането и offline детекцията.

**Основни функции:**

#### GET заявки:
- Network-first стратегия: опитва се да зареди от network, ако fail-не - от cache
- За `/api/*` routes: винаги връща JSON error (503), никога HTML
- За navigation requests: връща минимален HTML с модал (запазва URL, не редиректира)

#### POST/PUT/DELETE заявки:
- Винаги опитва network
- Ако fail-не, изпраща `SERVER_OFFLINE` съобщение до всички clients
- Връща JSON error response (503) за API routes

#### Offline HTML:
- Когато няма кеш на страницата, връща минимален HTML с модал
- Задава `window.__isOffline = true` за да предотврати редиректи към login
- Проверява на всеки 10 секунди дали сървърът е онлайн
- При възстановяване - рефрешва страницата

### 3. ConditionalNav Component (`components/ConditionalNav.tsx`)

Wrapper компонент който включва OfflineBanner и блокира навигацията когато е offline.

**Функции:**
- Показва OfflineBanner компонента
- Блокира всички взаимодействия (`pointer-events-none`, `opacity-50`)
- Експонира `window.__isOffline` за други компоненти

## Как работи детекцията

### 1. Network Offline Detection

Когато браузърът детектира че няма интернет:
- Browser `offline` event се задейства
- `OfflineBanner` компонентът се активира
- Показва се модал с съобщение "Няма интернет връзка"

### 2. Server Down Detection

Когато сървърът е спрян но има интернет:

#### При POST/PUT/DELETE заявки:
1. Service Worker опитва fetch заявка
2. Заявката fail-ва (network error)
3. Service Worker изпраща `SERVER_OFFLINE` message до всички clients
4. `OfflineBanner` слуша за това съобщение и се активира

#### При GET заявки:
1. Service Worker опитва fetch заявка
2. Заявката fail-ва
3. Ако няма cache - връща offline HTML модал
4. Offline HTML задава `window.__isOffline = true`
5. Проверява на всеки 10 секунди дали сървърът е онлайн

#### При модали (добавяне/редактиране):
1. Модалът прави POST/PUT заявка
2. Заявката fail-ва или връща 503
3. Catch block-ът активира offline state чрез `window.__setOfflineState(true)`
4. `OfflineBanner` се показва

### 3. Health Check

Когато приложението е offline:
- `OfflineBanner` прави periodic health check на всеки 10 секунди
- Проверява `/api/health` endpoint
- Ако endpoint-ът върне 200 OK - връзката е възстановена
- Модалът показва "Връзката е възстановена!" с зелена анимация
- Автоматично се затваря след 1 секунда

## Предотвратяване на редиректи

### Проблем:
Когато Service Worker връща offline HTML, React приложението не се зарежда правилно. Admin/Staff страниците имат `useEffect` hooks които проверяват за session и редиректират към login ако няма stavни session.

### Решение:

1. **Offline HTML задава `window.__isOffline = true`**
   ```javascript
   window.__isOffline = true;
   ```

2. **Admin/Staff страниците проверяват преди редирект:**
   ```javascript
   useEffect(() => {
     // Don't redirect if offline
     if (typeof window !== 'undefined' && (window as any).__isOffline) {
       return;
     }
     // ... redirect logic
   }, [session, locale]);
   ```

3. **При възстановяване:**
   ```javascript
   window.__isOffline = false; // Before reload
   window.location.reload();
   ```

## API Endpoints

### `/api/health`
Просто endpoint който връща 200 OK ако сървърът е онлайн.

**Използва се за:**
- Periodic health checks на всеки 10 секунди
- Проверка дали сървърът е онлайн след network reconnect

## Глобални променливи

### `window.__isOffline`
Boolean променлива която показва дали приложението е offline.
- Задава се от `OfflineBanner` и Service Worker
- Използва се от Admin/Staff страници за предотвратяване на редиректи

### `window.__setOfflineState`
Функция която може да се използва за ръчно активиране на offline state.
- Използва се от модали когато POST/PUT заявки fail-ват

### `window.__setServerDown`
Функция която задава дали проблемът е със сървъра или с интернет.
- Използва се за показване на правилното съобщение

## Файлове които обработват offline state

### Модали и форми:
- `app/[locale]/admin/products/new/page.tsx` - Добавяне на продукт
- `app/[locale]/admin/products/[productRef]/edit/page.tsx` - Редактиране на продукт (slug или id)
- `app/[locale]/admin/categories/page.tsx` - Добавяне/редактиране/изтриване на категория

**Как работи:**
```javascript
try {
  const response = await fetch('/api/products', { ... });
  
  if (response.status === 503 || !response.ok) {
    // Trigger offline banner
    if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
      (window as any).__setOfflineState(true);
    }
    if (typeof window !== 'undefined' && (window as any).__setServerDown) {
      (window as any).__setServerDown(true);
    }
    throw new Error('Server is offline');
  }
} catch (error) {
  // Handle network errors
}
```

## Съобщения

### Offline модал съобщения:

1. **Няма интернет връзка:**
   - Заглавие: "Няма интернет връзка"
   - Текст: "Моля, проверете интернет връзката си и опитайте отново."

2. **Сървърът е недостъпен:**
   - Заглавие: "Временен проблем със сървъра"
   - Текст: "Сървърът е временно недостъпен. Приложението проверява автоматично на всеки 10 секунди дали сървърът е отново онлайн."

3. **Връзката е възстановена:**
   - Заглавие: "Връзката е възстановена!"
   - Текст: "Вече имате интернет връзка. Приложението е готово за използване."
   - Зелена анимация с spin иконка

## iOS и Мобилни Устройства

### iOS Safari Специфични Поправки

iOS Safari има ограничена поддръжка за Service Workers и ненадеждни browser events. Затова са добавени специални механизми:

#### 1. По-Честа Health Check
- **iOS**: Проверява на всеки **5 секунди** вместо 10
- **Android/Desktop**: Проверява на всеки **10 секунди**
- Причина: iOS browser events (`online`/`offline`) не работят надеждно

#### 2. Fetch Error Interceptor за iOS
- Ако Service Worker не работи на iOS, добавен е fallback механизъм
- Прихваща всички `fetch` errors и проверява дали сървърът е online
- Ако `fetch` fail-не с network error → прави health check → активира offline state

#### 3. Как Работи на iOS:

**Сценарий 1: Service Worker Работи (HTTPS/Production)**
1. Service Worker изпраща `SERVER_OFFLINE` message
2. `OfflineBanner` слуша за съобщението и се активира
3. Периодична проверка на всеки 5 секунди
4. При възстановяване - автоматично се затваря

**Сценарий 2: Service Worker Не Работи (HTTP/Localhost)**
1. `fetch` заявка fail-ва (network error)
2. Fetch interceptor прихваща грешката
3. Прави health check за потвърждение
4. Ако сървърът е down → активира offline state
5. Периодична проверка на всеки 5 секунди

### Важни Бележки за iOS:

1. **HTTPS е задължителен за production**
   - Service Worker работи само с HTTPS на iOS
   - На `localhost` (127.0.0.1) може да работи
   - **На HTTP през локално IP (напр. 192.168.x.x) НЕ РАБОТИ!**

2. **Browser Events са ненадеждни**
   - `navigator.onLine` не е надежден на iOS
   - `online`/`offline` events може да не се задействат
   - Затова използваме активна health check вместо пасивни events

3. **По-Честа Проверка**
   - iOS проверява на всеки 5 секунди за по-бързо детектиране
   - Това гарантира че потребителят вижда когато сървърът се върне

4. **Разграничаване между Network Offline и Server Down**
   - Когато Service Worker изпрати `SERVER_OFFLINE`, проверяваме `navigator.onLine`
   - Ако `navigator.onLine = false` → Network offline (показва "Няма интернет връзка")
   - Ако `navigator.onLine = true` → Server down (показва "Временен проблем със сървъра")

## Тестване

### Тест 1: Network Offline
1. Отвори приложението
2. В DevTools → Network → Set to "Offline"
3. Очакван резултат: Offline модал се показва веднага

### Тест 2: Server Ant Down
1. Стартирай dev сървър
2. Отвори приложението
3. Спри сървъра (Ctrl+C)
4. Очакван резултат: Offline модал се показва при следваща заявка

### Тест 3: Offline Modal при модал
1. Отвори Admin панел
2. Отвори "Добави продукт" модал
3. Спри сървъра
4. Опитай да запазиш продукта
5. Очакван резултат: Offline модал се показва

### Тест 4: Health Check
1. Спри сървъра
2. Очаквай 10 секунди
3. Стартирай сървъра отново
4. Очакван резултат: Модалът показва "Връзката е възстановена!" и се затваря автоматично

### Тест 5: Redirect Prevention
1. Отвори Admin/Staff панел (след login)
2. Спри сървъра
3. Рефрешни страницата
4. Очакван резултат: Показва се offline модал, НЕ се редиректира към login

### Тест 6: iOS Offline Detection
1. Отвори приложението на iOS устройство
2. Спри сървъра
3. Опитай да заредиш страница или да запазиш форма
4. Очакван резултат: 
   - Offline модал се показва (или чрез Service Worker или чрез fetch interceptor)
   - Health check на всеки 5 секунди (не 10)
   - При възстановяване на сървъра - модалът се затваря автоматично

**Забележка за iOS:**
- На production (HTTPS) - Service Worker работи перфектно
- На localhost/HTTP - може да работи частично, но fetch interceptor гарантира детекцията

## Service Worker Версия Display

В долния десен ъгъл на всяка страница има бутон "SW" който показва текущата версия на Service Worker.

**Как да използваш:**
1. Натисни бутона "SW" в долния десен ъгъл
2. Показва се панел с текуща версия (напр. "v3.3.1")
3. Натисни отново за да скриеш панела

**Статуси:**
- 🟢 **Зелена точка** + "Service Worker" = SW работи перфектно
- 🟠 **Оранжева точка** + "SW Limited" = SW не работи (iOS HTTP), използва fallback

**Защо е полезно:**
- Проверка дали новата версия е активирана след deploy
- Дебъгване на мобилни устройства (особено iOS)
- Потвърждаване че Service Worker работи
- Виждане дали iOS HTTP ограничението се задейства

**iOS HTTP Ограничение:**
- На iOS през локално IP (напр. `http://192.168.1.x:3000`) Service Worker НЕ РАБОТИ
- Показва: версия `v3.3.1` (hardcoded) + warning "iOS HTTP: SW не работи"
- Offline detection работи чрез fetch interceptor вместо Service Worker
- **Решение**: Deploy на production с HTTPS или тествай на Android

**Компоненти:**
- `components/ServiceWorkerVersion.tsx` - UI компонент
- `public/sw.js` - Съдържа `CACHE_VERSION` константа и отговаря на `GET_VERSION` съобщения
- `FALLBACK_VERSION` - Hardcoded версия за iOS HTTP fallback

## Важни бележки

1. **Service Worker версия**: Когато променяш Service Worker логиката, увеличи `CACHE_VERSION` в `public/sw.js`. Текущата версия се показва в долния десен ъгъл (бутон "SW").
2. **Offline HTML**: Връща се само когато няма кеш на страницата. Ако има кеш, React приложението се зарежда нормално.
3. **API Routes**: Винаги връщат JSON error (503), никога HTML. Това предотвратява JSON parse errors.
4. **Health Check Interval**: Проверява на всеки 5 секунди за iOS, 10 секунди за Android/Desktop когато е offline. Това може да се промени в `OfflineBanner.tsx`.

