# Elements — аудит анимаций, UI и UX

Дата: 15 июля 2026. Методика: принципы design engineering Эмиля Ковальски, статический аудит исходников, проверка TypeScript/Vitest и production-сборки Chrome, Firefox и Safari MV3.

## Резюме

Основная проблема Elements была не в недостатке движения, а в несогласованной роли движения. Частые действия — запуск через shortcut и перемещение highlighter — были замедлены анимацией, тогда как редкие изменения состояния — сворачивание, сортировка и toast — либо прыгали, либо не имели полноценного enter/exit. После текущего прохода motion стал короче, целенаправленнее и доступнее.

Сильные стороны текущего дизайна: компактная тёмная панель, единая cyan-семантика, понятные keyboard hints, Shadow DOM-изоляция, сохранение правок по сайту и уже существующая поддержка reduced motion. Главные UX-риски следующего этапа: необратимые destructive actions, нативный `prompt()` для селектора, отсутствие busy/progress-состояний у импорта и слабая first-run подсказка.

## Что изменено в этом проходе

| Before | After | Why |
| --- | --- | --- |
| Панель появлялась и исчезала за `300ms` даже при запуске shortcut | Открытие и закрытие мгновенные | Частое keyboard-действие не должно ощущаться медленным |
| Highlighter анимировал `left/top/width/height` за `220ms` и заметно отставал | Pointer-переход геометрии `110–150ms`, мягкий enter; Q/W и scroll мгновенные | Есть визуальная связность без потери точности |
| Сворачивание меняло `height: auto` на `44px` скачком, а ширину — отдельным transition | Размеры синхронно морфятся одной interruptible WAAPI-анимацией `260–280ms`; контент и логотипы проходят staged blur-crossfade | Убрано резкое «сжатие DOM» и рассинхрон осей |
| Иконка minimize вращалась `400ms`, кнопки сжимались до `0.92` | Иконка синхронизирована с morph-кривой, press feedback `0.96–0.98` | Быстрее и менее «резиново» |
| Toast монтировался уже с `isVisible` и удалялся без exit-фазы | Отдельные enter и exit (`160–180ms`) с присутствием в DOM | Вход и выход теперь реально воспроизводятся и могут быть прерваны новым toast |
| Error-toast показывал зелёную иконку и имел `role="status"` | Красная семантика, `role="alert"`, assertive live-region | Визуальный и accessibility-статусы больше не противоречат друг другу |
| Экспорт не давал подтверждения | После скачивания показывается локализованный toast | Пользователь получает завершённый feedback loop |
| Сортировка списка мгновенно переставляла строки | Pointer-сортировка использует FLIP на `transform` за `180ms`; keyboard остаётся мгновенным | Сохраняется пространственный контекст без замедления клавиатуры |
| Cursor-follow подсветка отвлекала от содержимого и создавала постоянное движение | Подсветка и глобальный `pointermove` удалены; возвращён спокойный однотонный фон | Карточки снова формируют всю визуальную иерархию без декоративной конкуренции |
| Универсальный знак `</>` выглядел как иконка любого code-инструмента | Единый знак «выбранный элемент + курсор», отдельные active/inactive/unavailable toolbar-состояния и нативные размеры `16/32/48/128px` | Бренд отражает основную функцию Elements и остаётся различимым в панели браузера |
| Hover-состояния срабатывали на любом pointer | Hover ограничен `(hover: hover) and (pointer: fine)` | Нет «залипшего hover» на touch-устройствах |
| Мелкий muted-текст имел контраст `3.37–3.67:1` | Цвет `#8991a1`, контраст `5.14–5.60:1` | Мелкий текст проходит WCAG AA |
| Скрытая ссылка редактирования была доступна только мышью | `focus-within`, focus-visible и явные outlines | Keyboard navigation больше не скрывает действие |
| Preview включался от одного keyboard keydown и мог остаться активным до blur | Семантическая button, hold-to-preview на keydown/keyup и touch pointer | Предпросмотр всегда возвращается в исходное состояние |
| Switch-строки не сообщали состояние assistive tech | `role="switch"` + `aria-checked` | Состояние Remember/Compare читается скринридером |
| Узкое окно ломало композицию title/sort/actions | Адаптивная раскладка до `520px` | Options остаётся читаемой в узком окне |

## Инвентаризация motion после исправлений

| Поверхность | Триггер | Motion | Оценка |
| --- | --- | --- | --- |
| Открытие/закрытие picker | Toolbar или shortcut | Нет | Верно для высокочастотного и keyboard-сценария |
| Highlighter | Наведение | Геометрия `110–150ms` + opacity/scale enter | Короткая связность без прежнего шлейфа; Q/W и scroll не анимируются |
| Minimize/expand | Кнопка панели | Синхронный size morph + staged content/logo crossfade, `140–280ms` | Редкое состояние, движение объясняет изменение формы |
| Remember / Original | Click | Knob `transform`, track/background/glow, `180–240ms` | Непрерывная индикация состояния вместо телепортации; keyboard остаётся мгновенным |
| Список edits | Добавление/удаление | Контейнер `max-height`, `220ms` | Приемлемо для малого списка; exit строки ещё не проработан |
| Options cards | Первое открытие страницы | `translateY + scale + opacity`, `240ms`, stagger `40ms` | Редкий декоративный вход, interaction не блокируется |
| Options cards | Движение fine-pointer над карточкой | Spring-сглаживание `rotateX/rotateY` до `0.6deg` + `scale(1.008)` | Лёгкий параллакс и заметный hover-lift без резких скачков и layout-анимации |
| Options background | Статично | Однотонный `var(--bg)` | Чистая нейтральная основа без cursor tracking и декоративного шума |
| Sites list | Первая загрузка/import | `translateY + opacity`, `180ms`, stagger `30ms` | Умеренный cascade, задержка ограничена шестью шагами |
| Sites sort | Pointer click | FLIP `translateY`, `180ms` | Полезная spatial consistency; keyboard не анимируется |
| Toast | Успех/ошибка | `translateY + opacity`, `160–180ms` | Быстро и семантически полезно |
| Hover/press | Fine pointer / activation | Color `150ms`, scale `120ms` | Мгновенный tactile feedback без лишней амплитуды |

## Оставшиеся UX/UI-находки

### P0 — доверие, восстановление и целостность данных

1. **Import полностью заменяет существующие настройки без предупреждения.** Перед операцией нужен review-экран: число сайтов/правил в файле, режим Replace/Merge, явное подтверждение и автоматический snapshot для Undo.
2. **Delete site и delete edit необратимы из UI.** Toast должен содержать Undo; фактическое удаление можно коммитить после тайм-аута или хранить удалённый payload до следующего действия.
3. **Async-операции не имеют busy-state.** Import, export и удаление должны блокировать повторный запуск, показывать progress label и сохранять исходную ширину кнопки, чтобы layout не прыгал.
4. **Ошибки import показывают технический английский текст.** Нужны локализованные user-facing причины: неверный JSON, неподдерживаемая версия, ошибка storage/quota.

### P1 — ясность основного workflow

1. **First-run path не демонстрирует действие.** При первом запуске показать компактную трёхшаговую подсказку: наведи → выбери действие → Undo/Remember. Закрытие и повторный вызов должны быть доступны.
2. **Панель похожа на cheat sheet, а не на рабочий инструмент.** Сгруппировать её в блоки `Selection`, `Actions`, `Changes`; оставить shortcut рядом с действием, а не в длинных предложениях с точкой с запятой.
3. **Remember by default не объясняет область действия.** Текст должен явно различать «до перезагрузки» и «для этого сайта на всех устройствах».
4. **Show original page не показывает временный характер.** Добавить subdued banner `Previewing original` и явную кнопку Return to edited.
5. **Edit selector использует системный `prompt()/alert()`.** Заменить anchored popover с полем, live validation, примером совпадений (`1 match`) и Save/Cancel.
6. **Текстовое редактирование почти невидимо.** Во время contenteditable добавить outline, короткий helper `Enter to save · Esc to cancel` и feedback после сохранения.
7. **Нет явного feedback для Hide/Round/Text/Undo.** Нужен компактный status toast или live-region; keyboard users должны понимать, что команда сработала.

### P1 — accessibility

1. Увеличить самые маленькие hit targets с `24–30px` минимум до `32–36px` в compact desktop режиме; на touch — до `44px` через media query.
2. Проверить tab order после появления списка edits и возврат focus после удаления строки.
3. Добавить `aria-label` для edit/delete actions с контекстом селектора, а не общий `Remove from list`.
4. Не полагаться только на cyan/red: добавить текст/иконографику для активного, error и preview состояний.
5. Локализовать весь picker: сейчас Options использует i18n, а основная панель захардкожена на английском.

### P2 — визуальная система и polish

1. Вынести motion tokens (`120/180/220ms`, ease-out) и color tokens в общий слой, чтобы Options и Shadow UI не расходились.
2. Упростить тень панели на светлых страницах и добавить тонкий neutral outline: сейчас тяжёлая тень может выглядеть грязно поверх насыщенного контента.
3. Добавить типографическую иерархию в settings grid: action label 12–13px, shortcut secondary, пояснение максимум в одну строку.
4. Для длинного selector использовать middle truncation и полное значение в tooltip/copy action вместо `word-break: break-all`.
5. Добавить count/empty-state в список текущих правок: `3 changes on this page` делает состояние понятнее.
6. В Options заменить `input[type=button]` на семантические `<button>` и добавить иконки только там, где они ускоряют распознавание.

## План реализации

### Этап 1 — Recovery & async feedback (P0, 1–2 дня)

- Добавить undoable delete для сайта и отдельной правки.
- Перед import показывать summary + Replace/Merge.
- Ввести единый async-state для Import/Export/Delete и локализованные ошибки.
- Критерии: ни одна destructive операция не теряет данные без подтверждения или Undo; двойной клик не запускает дубликат операции.

### Этап 2 — Основной picker workflow (P1, 2–3 дня)

- Перестроить панель в `Selection / Actions / Changes`.
- Добавить first-run coachmark, status feedback и helper для text edit.
- Заменить selector prompt на валидируемый popover.
- Критерии: новый пользователь без README удаляет элемент, отменяет действие и понимает Remember менее чем за минуту.

### Этап 3 — Accessibility & localization (P1, 1–2 дня)

- Вынести строки picker в `_locales`.
- Пройти keyboard-only сценарии, focus return и contextual aria-labels.
- Добавить touch hit-target media rules.
- Критерии: все действия доступны Tab/Enter/Space/Escape; reduced motion не содержит пространственных переходов; контраст WCAG AA.

### Этап 4 — Visual system & regression QA (P2, 1–2 дня)

- Общие color/motion tokens, selector truncation, count/empty states.
- Снять slow-motion запись каждого перехода и проверить Chrome/Firefox/Safari.
- Критерии: UI motion не длиннее `300ms`, нет `transition: all`, hover только для fine pointer, быстрые повторные действия не вызывают скачков.

## Матрица финальной ручной проверки

1. Toolbar и shortcut: открыть/закрыть 10 раз быстро, проверить отсутствие задержки и ghost-panel.
2. Hover selection: быстро пройти по вложенным элементам, затем Q/W; highlighter не должен отставать.
3. Minimize: прервать expand/collapse встречным кликом; панель не должна мигать или оставаться с inline height.
4. Edits: Hide, Round, Text, Preview, Remember, Delete, Undo на коротком и длинном selector.
5. Options: пустой список, 1/10/100 сайтов, обе сортировки, delete, export, valid/invalid import.
6. Input modes: mouse, keyboard-only, touch/trackpad, `prefers-reduced-motion: reduce`.
7. Viewports: 360, 520, 640, 1440px; zoom 100/200%.
8. Browsers: Chrome MV3, Firefox MV3, Safari MV3; проверить системные focus rings и storage errors.

## Ограничение текущей проверки

Production builds Chrome/Firefox/Safari, TypeScript и unit tests пройдены. Встроенный browser-control runtime в этой сессии не предоставил инструмент подключения, поэтому покадровая визуальная проверка живого unpacked extension остаётся обязательным ручным gate перед релизом; матрица выше подготовлена именно для этого прохода.
